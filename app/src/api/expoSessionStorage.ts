import { File, Paths } from 'expo-file-system';
import { secureStateStorage } from '../state/secureStorage.ts';
import {
  createExpoFileAdapter,
} from './expoFileAdapter.ts';
export { createExpoFileAdapter } from './expoFileAdapter.ts';
import {
  ChunkedSessionStorage,
  FallbackSessionStorage,
  MemorySessionStorage,
  SessionFileStorage,
  safeErrorMessage,
  withLegacyOutboxMigration,
  type SessionStorageStatus,
  type StorageQuarantine,
} from './sessionFileStorage.ts';
import type { SessionOutboxStorage } from './sessionOutbox.ts';

export const storageListeners = new Set<(status: SessionStorageStatus) => void>();
let storageStatus: SessionStorageStatus = {
  destination: 'file',
  lastError: null,
  quarantined: null,
};

function publishStorageStatus(status: SessionStorageStatus): void {
  storageStatus = status;
  for (const listener of storageListeners) listener(status);
}

export function subscribeSessionStorageStatus(
  listener: (status: SessionStorageStatus) => void,
): () => void {
  storageListeners.add(listener);
  listener(storageStatus);
  return () => {
    storageListeners.delete(listener);
  };
}

export function getSessionStorageStatus(): SessionStorageStatus {
  return storageStatus;
}

const secureChunks = new ChunkedSessionStorage({
  getItem: (key) => secureStateStorage.getItem(key),
  setItem: async (key, value) => {
    await secureStateStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    await secureStateStorage.removeItem(key);
  },
});

const legacyStorage: SessionOutboxStorage = {
  getItem: async (key) => (await secureStateStorage.getItem(key)) ?? null,
  setItem: async (key, value) => {
    await secureStateStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    await secureStateStorage.removeItem(key);
  },
};

let storage: SessionOutboxStorage | null = null;
let fallbackStorage: FallbackSessionStorage | null = null;

export function getSessionStorage(): SessionOutboxStorage {
  if (storage) return storage;

  let documentUri: string | undefined;
  try {
    documentUri = Paths.document.uri;
  } catch (error) {
    storageStatus = {
      ...storageStatus,
      lastError: {
        stage: 'resolve-document-directory',
        name: error instanceof Error ? error.name : 'UnknownError',
        message: safeErrorMessage(error),
      },
    };
    publishStorageStatus(storageStatus);
  }
  const fileAdapter = createExpoFileAdapter({
    documentUri,
    createFile: (name) => new File(Paths.document, name),
    exists: (file) => file.exists,
    readText: (file) => file.text(),
    create: (file, options) => file.create(options),
    write: (file, value) => file.write(value),
    delete: (file) => file.delete(),
    move: (file, destination, options) => file.move(destination, options),
  });
  const fileStorage = new SessionFileStorage(fileAdapter, (quarantine) => {
    fallbackStorage?.setQuarantine(quarantine);
    if (!fallbackStorage) {
      storageStatus = { ...storageStatus, quarantined: quarantine };
      publishStorageStatus(storageStatus);
    }
  });
  fallbackStorage = new FallbackSessionStorage({
    file: fileStorage,
    secure: secureChunks,
    memory: new MemorySessionStorage(),
    onStatus: publishStorageStatus,
  });
  storage = withLegacyOutboxMigration(
    fallbackStorage,
    legacyStorage,
    (stage, error) => {
      publishStorageStatus({
        ...storageStatus,
        lastError: {
          stage,
          name: error instanceof Error ? error.name : 'UnknownError',
          message: safeErrorMessage(error),
        },
      });
    },
  );
  return storage;
}

export type StorageProbeResult = {
  sizeKb: number;
  ok: boolean;
  destination: SessionStorageStatus['destination'];
  error: { stage: string; name: string; message: string } | null;
  quarantine: StorageQuarantine | null;
};

export async function testSessionStorage(): Promise<StorageProbeResult[]> {
  const target = getSessionStorage();
  const results: StorageProbeResult[] = [];
  for (const sizeKb of [1, 10, 100]) {
    const key = `fitbeacon-storage-probe:${Date.now()}:${sizeKb}`;
    const expected = JSON.stringify({ version: 1, data: 'x'.repeat(sizeKb * 1_024) });
    try {
      await target.setItem(key, expected);
      const actual = await target.getItem(key);
      if (actual !== expected) {
        throw new Error('O conteúdo lido não corresponde ao JSON gravado.');
      }
      await target.removeItem(key);
      results.push({
        sizeKb,
        ok: true,
        destination: storageStatus.destination,
        error: null,
        quarantine: storageStatus.quarantined,
      });
    } catch (error) {
      const current = storageStatus.lastError;
      results.push({
        sizeKb,
        ok: false,
        destination: storageStatus.destination,
        error: current ?? {
          stage: 'round-trip',
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message.slice(0, 240) : 'Erro desconhecido.',
        },
        quarantine: storageStatus.quarantined,
      });
    }
  }
  return results;
}
