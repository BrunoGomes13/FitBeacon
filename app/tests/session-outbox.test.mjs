import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../state/store') {
      const mutableStoreStub = `const state=${JSON.stringify({
        accessToken: 'expired-access-token',
        refreshToken: 'test-refresh-token',
      })}; export const useAppStore={getState:()=>({...state,setTokens:(tokens)=>Object.assign(state,tokens),clearSession:()=>Object.assign(state,{accessToken:null,refreshToken:null})})}`;
      return {
        url: `data:text/javascript,${encodeURIComponent(mutableStoreStub)}`,
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

const { SessionOutbox } = await import('../src/api/sessionOutbox.ts');
const { recordTrainingSession } = await import('../src/api/services.ts');

class MemoryStorage {
  values = new Map();

  async getItem(key) {
    return this.values.get(key) ?? null;
  }

  async setItem(key, value) {
    this.values.set(key, value);
  }

  async removeItem(key) {
    this.values.delete(key);
  }
}

const session = (clientSessionId) => ({
  clientSessionId,
  equipmentId: 'equipment-id',
  areaId: 'area-id',
  startedAt: '2026-10-30T12:00:00.000Z',
  endedAt: '2026-10-30T12:01:00.000Z',
  sets: [{ exerciseId: 'exercise-id', setNumber: 1, load: 10, reps: 8 }],
});

test('mantém a sessão offline, persiste após reinício e reenvia o mesmo clientSessionId', async () => {
  const storage = new MemoryStorage();
  const options = { now: () => 1_000, random: () => 0.5, baseDelayMs: 100, maxDelayMs: 1_000 };
  const firstProcess = new SessionOutbox(storage, 'user-1', options);
  const payload = session('session-stable-id');
  await firstProcess.enqueue(payload);

  const attemptedIds = [];
  const offlineSend = async (item) => {
    attemptedIds.push(item.clientSessionId);
    throw new Error('Rede indisponível.');
  };
  await firstProcess.sync(offlineSend);
  firstProcess.cancelScheduledRetry();
  assert.ok(storage.values.has('fitbeacon-session-outbox:user-1:record:session-stable-id'));
  assert.equal(firstProcess.getSnapshot().pendingCount, 1);

  const afterRestart = new SessionOutbox(storage, 'user-1', options);
  await afterRestart.initialize();
  assert.equal(afterRestart.getSnapshot().pendingCount, 1);
  await afterRestart.sync(async (item) => attemptedIds.push(item.clientSessionId), true);
  afterRestart.cancelScheduledRetry();

  assert.deepEqual(attemptedIds, ['session-stable-id', 'session-stable-id']);
  assert.equal(afterRestart.getSnapshot().pendingCount, 0);
});

test('renova o token via cliente API e retira a sessão somente após sucesso', async () => {
  const storage = new MemoryStorage();
  const queue = new SessionOutbox(storage, 'user-1');
  const payload = session('session-refresh-id');
  await queue.enqueue(payload);
  assert.ok(storage.values.has('fitbeacon-session-outbox:user-1:record:session-refresh-id'));
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/auth/refresh')) {
      return new globalThis.Response(
        JSON.stringify({ accessToken: 'renewed-access-token', refreshToken: 'renewed-refresh-token' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (calls.filter((call) => call.url.endsWith('/sessions/batch')).length === 1) {
      return new globalThis.Response(
        JSON.stringify({ code: 'UNAUTHORIZED', message: 'Token expirado.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new globalThis.Response(
      JSON.stringify({
        data: [{ data: payload, created: true }],
        created: 1,
        idempotent: 0,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    await queue.sync(recordTrainingSession);
  } finally {
    queue.cancelScheduledRetry();
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.filter((call) => call.url.endsWith('/auth/refresh')).length, 1);
  const batchCalls = calls.filter((call) => call.url.endsWith('/sessions/batch'));
  assert.equal(batchCalls.length, 2);
  assert.equal(
    new globalThis.Headers(batchCalls[0].init.headers).get('Authorization'),
    'Bearer expired-access-token',
  );
  assert.equal(
    new globalThis.Headers(batchCalls[1].init.headers).get('Authorization'),
    'Bearer renewed-access-token',
  );
  assert.deepEqual(JSON.parse(batchCalls[0].init.body), { sessions: [payload] });
  assert.deepEqual(JSON.parse(batchCalls[1].init.body), { sessions: [payload] });
  assert.equal(queue.getSnapshot().pendingCount, 0);
});

test('move erro 4xx para falhas com motivo sem remover os dados persistidos', async () => {
  const storage = new MemoryStorage();
  const queue = new SessionOutbox(storage, 'user-1');
  await queue.enqueue(session('session-invalid-id'));

  await queue.sync(async () => {
    throw Object.assign(new Error('Equipamento não encontrado.'), { status: 404 });
  });

  assert.equal(queue.getSnapshot().pendingCount, 0);
  assert.deepEqual(queue.getSnapshot().failures.map(({ clientSessionId, reason }) => ({ clientSessionId, reason })), [{
    clientSessionId: 'session-invalid-id',
    reason: 'O equipamento ou a área desta sessão não foi encontrado.',
  }]);
  assert.equal(typeof queue.getSnapshot().failures[0].failedAt, 'number');
  const afterRestart = new SessionOutbox(storage, 'user-1');
  await afterRestart.initialize();
  assert.equal(
    afterRestart.getSnapshot().failures[0].reason,
    'O equipamento ou a área desta sessão não foi encontrado.',
  );
});

test('ao exceder o limite descarta a sessão pendente mais antiga e informa o ID descartado', async () => {
  const queue = new SessionOutbox(new MemoryStorage(), 'user-1', { maxPending: 2 });
  await queue.enqueue(session('oldest-id'));
  await queue.enqueue(session('middle-id'));
  const discarded = await queue.enqueue(session('newest-id'));

  assert.equal(discarded, 'oldest-id');
  assert.equal(queue.getSnapshot().pendingCount, 2);
});

test('limpa pendências e falhas quando o consentimento é revogado', async () => {
  const storage = new MemoryStorage();
  const queue = new SessionOutbox(storage, 'user-1');
  await queue.enqueue(session('pending-id'));
  await queue.enqueue(session('failed-id'));
  await queue.sync(async () => {
    throw Object.assign(new Error('Consentimento não válido.'), { status: 400 });
  });

  await queue.clear();

  assert.equal(queue.getSnapshot().pendingCount, 0);
  assert.deepEqual(queue.getSnapshot().failures, []);
  const afterRestart = new SessionOutbox(storage, 'user-1');
  await afterRestart.initialize();
  assert.equal(afterRestart.getSnapshot().pendingCount, 0);
});
