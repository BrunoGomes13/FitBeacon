import assert from 'node:assert/strict';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../state/store') {
      const state = {
        accessToken: 'test-token',
        refreshToken: null,
        setTokens() {},
        clearSession() {},
      };
      return {
        url: `data:text/javascript,${encodeURIComponent(
          `const state=${JSON.stringify(state)};export const useAppStore={getState:()=>state};`,
        )}`,
        shortCircuit: true,
      };
    }
    if (specifier.startsWith('.') && !extname(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') {
          throw error;
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
import { SessionOutbox } from '../src/api/sessionOutbox.ts';
import {
  ChunkedSessionStorage,
  FallbackSessionStorage,
  MemorySessionStorage,
  SessionFileStorage,
  withLegacyOutboxMigration,
} from '../src/api/sessionFileStorage.ts';
import { createExpoFileAdapter } from '../src/api/expoFileAdapter.ts';
import {
  WorkoutCompletionService,
  WorkoutDraftRepository,
  WorkoutLocalSaveError,
} from '../src/student/WorkoutCompletionService.ts';

const temporaryDirectories = [];
const outboxes = [];
const now = Date.now();
const startedAt = new Date(now - 5_000).toISOString();
const equipment = {
  _id: 'equipment-id',
  gymId: 'gym-id',
  areaId: { _id: 'area-id', name: 'Musculação', description: '' },
  name: 'Leg press',
  beacon: {
    uuid: '12345678-1234-4234-8234-123456789abc',
    major: 1,
    minor: 2,
    txPower: -59,
    rssiEnter: -70,
    rssiExit: -78,
  },
  adjustments: [],
  exerciseIds: Array.from({ length: 10 }, (_, index) => ({
    _id: `exercise-${index}`,
    name: `Exercício de resistência e fortalecimento muscular ${index}`.padEnd(60, 'x'),
    muscleGroup: 'Pernas',
    steps: [],
    commonMistakes: [],
    media: {},
    recommendedSets: 3,
    recommendedReps: 12,
  })),
  media: {},
};

function createFileStorage() {
  let directory;
  const adapter = {
    async read() {
      try {
        return await readFile(join(directory, 'store.json'), 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async writeTemporary(value) {
      await writeFile(join(directory, 'store.tmp'), value, 'utf8');
    },
    async replaceWithTemporary() {
      await rename(join(directory, 'store.tmp'), join(directory, 'store.json'));
    },
  };
  return {
    async initialize() {
      directory = await mkdtemp(join(tmpdir(), 'fitbeacon-workout-'));
      temporaryDirectories.push(directory);
      return new SessionFileStorage(adapter);
    },
    get filePath() {
      return join(directory, 'store.json');
    },
  };
}

function createDraft(sets, elapsedSeconds = 5, clientSessionId = `session-${sets.length}-${Math.random()}`) {
  return {
    ownerId: 'student-id',
    clientSessionId,
    equipment,
    startedAt,
    elapsedSeconds,
    exerciseIndex: 0,
    sets,
  };
}

function createSets(count) {
  return Array.from({ length: count }, (_, index) => ({
    exerciseId: `exercise-${index % 10}`,
    setNumber: Math.floor(index / 10) + 1,
    load: 25 + index,
    reps: 12,
  }));
}

async function setup(send = async () => {}) {
  const file = createFileStorage();
  const storage = await file.initialize();
  const outbox = new SessionOutbox(storage, 'student-id', {
    now: () => now,
    random: () => 1,
    baseDelayMs: 60_000,
  });
  outboxes.push(outbox);
  const drafts = new WorkoutDraftRepository(storage, () => now);
  const service = new WorkoutCompletionService({ drafts, outbox, send, now: () => now });
  await outbox.initialize();
  return { file, storage, outbox, drafts, service };
}

after(async () => {
  for (const outbox of outboxes) outbox.cancelScheduledRetry();
  await Promise.all(temporaryDirectories.map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

for (const count of [0, 1, 3, 10]) {
  test(`conclui treino com ${count} séries salvando primeiro no arquivo local`, async () => {
    let sent = 0;
    let localDataPresentBeforeSend = false;
    let localFileSizeBeforeSend = 0;
    const file = createFileStorage();
    const storage = await file.initialize();
    const outbox = new SessionOutbox(storage, 'student-id');
    outboxes.push(outbox);
    const drafts = new WorkoutDraftRepository(storage, () => now);
    const service = new WorkoutCompletionService({
      drafts,
      outbox,
      send: async () => {
        sent += 1;
        const serialized = await readFile(file.filePath, 'utf8');
        localDataPresentBeforeSend = serialized.includes('fitbeacon-session-outbox');
        localFileSizeBeforeSend = Buffer.byteLength(serialized);
      },
      now: () => now,
    });
    await outbox.initialize();
    const result = await service.complete(createDraft(createSets(count), 5));

    assert.equal(result.status, count === 0 ? 'discarded' : 'saved');
    assert.equal(sent, count === 0 ? 0 : 1);
    assert.equal(localDataPresentBeforeSend, count > 0);
    if (count === 10) assert.ok(localFileSizeBeforeSend > 2_048);
    if (count > 0) assert.equal(outbox.getSnapshot().pendingCount, 0);
  });
}

test('descarta treino sem consentimento e não sincroniza', async () => {
  let sent = false;
  const { outbox, service } = await setup(async () => { sent = true; });
  const result = await service.complete(createDraft(createSets(1)), now, false);

  assert.equal(result.status, 'discarded');
  assert.equal(sent, false);
  assert.equal(outbox.getSnapshot().pendingCount, 0);
});

test('migra itens antigos da fila do SecureStore para o arquivo antes de removê-los', async () => {
  const file = createFileStorage();
  const storage = await file.initialize();
  const legacyValues = new Map([['legacy-session-key', '{"payload":"existing"}']]);
  const legacyStorage = {
    getItem: async (key) => legacyValues.get(key) ?? null,
    setItem: async (key, value) => legacyValues.set(key, value),
    removeItem: async (key) => { legacyValues.delete(key); },
  };
  const migrated = withLegacyOutboxMigration(storage, legacyStorage);

  assert.equal(await migrated.getItem('legacy-session-key'), '{"payload":"existing"}');
  assert.equal(await storage.getItem('legacy-session-key'), '{"payload":"existing"}');
  assert.equal(legacyValues.has('legacy-session-key'), false);
});

for (const status of [400, 403, 500, 'timeout']) {
  test(`mantém localmente treino quando o envio falha (${status})`, async () => {
    const send = async () => {
      if (status === 'timeout') throw new Error('network timeout');
      throw Object.assign(new Error(`API ${status}`), { status });
    };
    const { outbox, drafts, service } = await setup(send);
    const draft = createDraft(createSets(3), 5, `failed-${status}`);
    const result = await service.complete(draft);

    assert.equal(result.status, 'pending');
    assert.equal(await outbox.isPending(draft.clientSessionId), status === 500 || status === 'timeout');
    assert.ok(
      outbox.getSnapshot().failures.some((failure) => failure.clientSessionId === draft.clientSessionId) ||
      await outbox.isPending(draft.clientSessionId),
    );
    assert.equal(await drafts.load(draft.ownerId), null);
    const diagnostic = await drafts.loadDiagnostic();
    assert.equal(diagnostic.failedStage, 'session-upload');
    assert.equal(diagnostic.code, status === 'timeout' ? null : status);
  });
}

test('recupera e enfileira rascunho pendente de treino', async () => {
  const { drafts, outbox, service } = await setup();
  const draft = createDraft(createSets(1), 5, 'recovered-session');
  await drafts.save(draft);
  const restored = await drafts.load(draft.ownerId);

  assert.ok(restored);
  const result = await service.complete(restored, now);
  assert.equal(result.status, 'saved');
  assert.equal(await outbox.isPending(draft.clientSessionId), false);
  assert.equal(await drafts.load(draft.ownerId), null);
});

test('copia nomes corretos de exercícios diferentes para o payload histórico', async () => {
  let payload;
  const { service } = await setup(async (session) => { payload = session; });
  const result = await service.complete(createDraft(createSets(2), 5, 'multiple-exercises'));

  assert.equal(result.status, 'saved');
  assert.deepEqual(
    payload.sets.map((set) => set.exerciseName),
    equipment.exerciseIds.slice(0, 2).map((exercise) => exercise.name),
  );
});

test('preserva o tempo líquido do cronômetro pausado na duração da sessão', async () => {
  let payload;
  const { service } = await setup(async (session) => { payload = session; });
  const draft = createDraft(createSets(1), 120, 'paused-session');
  draft.startedAt = new Date(now - 140_000).toISOString();

  const result = await service.complete(draft, now);

  assert.equal(result.status, 'saved');
  assert.equal(
    (Date.parse(payload.endedAt) - Date.parse(payload.startedAt)) / 1_000,
    120,
  );
});

test('duas conclusões simultâneas salvam e enviam uma única sessão', async () => {
  let sendCount = 0;
  const { service } = await setup(async () => { sendCount += 1; });
  const draft = createDraft(createSets(3), 5, 'concurrent-completion');
  const first = service.complete(draft);
  const second = service.complete(draft);

  assert.equal(first, second);
  const results = await Promise.all([first, second]);
  assert.equal(results[0].status, 'saved');
  assert.equal(sendCount, 1);
});

test('cliente real do app preserva localmente antes de 400, 403, 500 e timeout', async () => {
  const file = createFileStorage();
  const storage = await file.initialize();
  let responseMode = 500;
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const requestBody = JSON.parse(body);
    const localDataPresent = (await readFile(file.filePath, 'utf8'))
      .includes('fitbeacon-session-outbox');
    requests.push({
      clientSessionId: requestBody.sessions[0].clientSessionId,
      localDataPresent,
      responseMode,
    });
    if (responseMode === 'timeout') {
      response.destroy();
      return;
    }
    response.writeHead(responseMode, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      code: `SERVER_${responseMode}`,
      message: 'Serviço indisponível para teste.',
    }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const previousApiUrl = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${address.port}/api/v1`;
  try {
    const { recordTrainingSession } = await import('../src/api/services.ts');
    const outbox = new SessionOutbox(storage, 'student-id', {
      now: () => now,
      random: () => 1,
      baseDelayMs: 60_000,
    });
    outboxes.push(outbox);
    const drafts = new WorkoutDraftRepository(storage, () => now);
    const service = new WorkoutCompletionService({
      drafts,
      outbox,
      send: recordTrainingSession,
      now: () => now,
    });
    await outbox.initialize();
    for (const mode of [400, 403, 500, 'timeout']) {
      responseMode = mode;
      const sessionId = `http-client-${mode}`;
      const result = await service.complete(createDraft(createSets(1), 5, sessionId));
      assert.equal(result.status, 'pending');
      assert.ok(
        await outbox.isPending(sessionId) ||
        outbox.getSnapshot().failures.some((failure) => failure.clientSessionId === sessionId),
      );
    }
    assert.equal(requests.length, 4);
    assert.ok(requests.every((item) => item.localDataPresent));
  } finally {
    if (previousApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previousApiUrl;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('uma falha de escrita local impede envio e permite retry', async () => {
  let shouldFail = true;
  let sends = 0;
  let directory;
  const adapter = {
    async read() {
      try {
        return await readFile(join(directory, 'store.json'), 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async writeTemporary(value) {
      if (shouldFail && Buffer.byteLength(value) > 2_048) {
        throw new Error('O armazenamento atingiu seu limite de tamanho.');
      }
      await writeFile(join(directory, 'store.tmp'), value, 'utf8');
    },
    async replaceWithTemporary() {
      await rename(join(directory, 'store.tmp'), join(directory, 'store.json'));
    },
  };
  directory = await mkdtemp(join(tmpdir(), 'fitbeacon-limit-'));
  temporaryDirectories.push(directory);
  const storage = new SessionFileStorage(adapter);
  const outbox = new SessionOutbox(storage, 'student-id');
  await outbox.initialize();
  const drafts = new WorkoutDraftRepository(storage, () => now);
  const service = new WorkoutCompletionService({
    drafts,
    outbox,
    send: async () => { sends += 1; },
    now: () => now,
  });
  const draft = createDraft(createSets(10), 5, 'large-session');

  await assert.rejects(service.complete(draft), WorkoutLocalSaveError);
  assert.equal(sends, 0);
  shouldFail = false;
  const retry = await service.complete(draft);
  assert.equal(retry.status, 'saved');
  assert.equal(sends, 1);
});

function createFakeExpoFileSystem(documentUri = 'file:///documents/') {
  const files = new Map();
  const quarantined = [];
  return {
    files,
    quarantined,
    contract: {
      documentUri,
      createFile(uri) {
        const base = documentUri ? `${documentUri.replace(/\/?$/, '/')}` : '';
        return { uri: `${base}${uri}` };
      },
      exists(file) {
        return files.has(file.uri);
      },
      async readText(file) {
        return files.get(file.uri);
      },
      create(file) {
        files.set(file.uri, '');
      },
      async write(file, value) {
        files.set(file.uri, value);
      },
      delete(file) {
        files.delete(file.uri);
      },
      async move(file, destination) {
        if (!files.has(file.uri)) throw new Error('Arquivo de origem ausente.');
        files.set(destination.uri, files.get(file.uri));
        files.delete(file.uri);
        if (destination.uri.endsWith('.bad')) quarantined.push(destination.uri);
      },
    },
  };
}

for (const [label, createStorage] of [
  ['memória', async () => new MemorySessionStorage()],
  ['API mínima do Expo FileSystem', async () => {
    const fake = createFakeExpoFileSystem();
    return new SessionFileStorage(createExpoFileAdapter(fake.contract));
  }],
]) {
  test(`contrato get/set/remove da fila funciona em ${label}`, async () => {
    const storage = await createStorage();
    assert.equal(await storage.getItem('missing'), null);
    await storage.setItem('queue', JSON.stringify({ version: 1, sessions: ['one'] }));
    assert.deepEqual(JSON.parse(await storage.getItem('queue')), {
      version: 1,
      sessions: ['one'],
    });
    await storage.setItem('queue', 'updated');
    assert.equal(await storage.getItem('queue'), 'updated');
    await storage.removeItem('queue');
    assert.equal(await storage.getItem('queue'), null);
  });
}

for (const [contents, reason] of [
  ['', 'empty'],
  ['{', 'corrupt'],
  [JSON.stringify({ version: 9, entries: {} }), 'unknown-version'],
]) {
  test(`isola arquivo local ${reason} e reinicia a fila vazia`, async () => {
    const fake = createFakeExpoFileSystem();
    const adapter = createExpoFileAdapter(fake.contract);
    const primary = fake.contract.createFile('fitbeacon-sessions-v1.json');
    fake.files.set(primary.uri, contents);
    const quarantine = [];
    const storage = new SessionFileStorage(adapter, (entry) => quarantine.push(entry));
    assert.equal(await storage.getItem('queue'), null);
    assert.equal(quarantine[0].reason, reason);
    assert.equal(fake.quarantined.length, 1);
    await storage.setItem('queue', 'fresh');
    assert.equal(await storage.getItem('queue'), 'fresh');
  });
}

test('diretório de documentos indefinido usa SecureStore em blocos', async () => {
  const adapter = createExpoFileAdapter(createFakeExpoFileSystem(null).contract);
  const file = new SessionFileStorage(adapter);
  const secureMap = new Map();
  const secure = new ChunkedSessionStorage({
    getItem: (key) => secureMap.get(key) ?? null,
    setItem: (key, value) => secureMap.set(key, value),
    removeItem: (key) => secureMap.delete(key),
  });
  const fallback = new FallbackSessionStorage({
    file,
    secure,
    memory: new MemorySessionStorage(),
  });
  const payload = JSON.stringify({ data: 'á'.repeat(10_000) });
  await fallback.setItem('queue', payload);
  assert.equal(await fallback.getItem('queue'), payload);
  assert.equal(fallback.getStatus().destination, 'secure-store');
  assert.ok([...secureMap.values()].every((value) => Buffer.byteLength(value) <= 1_000));
});

test('falha de arquivo e SecureStore mantém a fila na memória', async () => {
  const failedFile = new SessionFileStorage({
    async read() { throw new Error('Filesystem indisponível.'); },
    async writeTemporary() { throw new Error('Filesystem indisponível.'); },
    async replaceWithTemporary() { throw new Error('Filesystem indisponível.'); },
  });
  const failedSecure = {
    async getItem() { throw new Error('SecureStore indisponível.'); },
    async setItem() { throw new Error('SecureStore indisponível.'); },
    async removeItem() { throw new Error('SecureStore indisponível.'); },
  };
  const fallback = new FallbackSessionStorage({
    file: failedFile,
    secure: failedSecure,
    memory: new MemorySessionStorage(),
  });
  await fallback.setItem('queue', 'available');
  assert.equal(await fallback.getItem('queue'), 'available');
  assert.equal(fallback.getStatus().destination, 'memory');
});
