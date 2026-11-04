import { z } from 'zod';
import type { SessionOutboxStorage } from './sessionOutbox.ts';

const fileSchema = z.object({
  version: z.literal(1),
  entries: z.record(z.string(), z.string()),
});

function parseChunkIndex(value: string): z.infer<typeof chunkIndexSchema> | null {
  try {
    const result = chunkIndexSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export type StorageQuarantine = {
  reason: 'empty' | 'corrupt' | 'unknown-version';
  message: string;
};

export type AtomicJsonFileAdapter = {
  read: () => Promise<string | null>;
  writeTemporary: (value: string) => Promise<void>;
  replaceWithTemporary: () => Promise<void>;
  quarantine?: () => Promise<void>;
};

export type SessionStorageStatus = {
  destination: 'file' | 'secure-store' | 'memory';
  lastError: { stage: string; name: string; message: string } | null;
  quarantined: StorageQuarantine | null;
};

export class SessionFileStorage implements SessionOutboxStorage {
  private readonly adapter: AtomicJsonFileAdapter;
  private readonly onQuarantine: (value: StorageQuarantine) => void;
  private writeChain: Promise<void> = Promise.resolve();
  private quarantined: StorageQuarantine | null = null;

  constructor(
    adapter: AtomicJsonFileAdapter,
    onQuarantine: (value: StorageQuarantine) => void = () => {},
  ) {
    this.adapter = adapter;
    this.onQuarantine = onQuarantine;
  }

  async getItem(key: string): Promise<string | null> {
    const data = await this.read();
    return data.entries[key] ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.update((entries) => {
      entries[key] = value;
    });
  }

  async removeItem(key: string): Promise<void> {
    await this.update((entries) => {
      delete entries[key];
    });
  }

  getQuarantine(): StorageQuarantine | null {
    return this.quarantined;
  }

  private async update(change: (entries: Record<string, string>) => void): Promise<void> {
    const operation = this.writeChain.then(async () => {
      const current = await this.read();
      const entries = { ...current.entries };
      change(entries);
      const serialized = JSON.stringify({ version: 1, entries });
      await this.adapter.writeTemporary(serialized);
      await this.adapter.replaceWithTemporary();
    });
    this.writeChain = operation.then(() => undefined, () => undefined);
    await operation;
  }

  private async read(): Promise<z.infer<typeof fileSchema>> {
    const serialized = await this.adapter.read();
    if (serialized === null) return { version: 1, entries: {} };
    if (serialized.trim() === '') {
      await this.resetInvalidFile('empty', 'Arquivo vazio colocado em quarentena.');
      return { version: 1, entries: {} };
    }

    let value: unknown;
    try {
      value = JSON.parse(serialized);
    } catch {
      await this.resetInvalidFile('corrupt', 'JSON inválido colocado em quarentena.');
      return { version: 1, entries: {} };
    }

    const result = fileSchema.safeParse(value);
    if (!result.success) {
      await this.resetInvalidFile(
        'unknown-version',
        'Formato local desconhecido colocado em quarentena.',
      );
      return { version: 1, entries: {} };
    }
    return result.data;
  }

  private async resetInvalidFile(
    reason: StorageQuarantine['reason'],
    message: string,
  ): Promise<void> {
    try {
      await this.adapter.quarantine?.();
    } catch (error) {
      message = `${message} Não foi possível mover o arquivo: ${safeErrorMessage(error)}`;
    }
    this.quarantined = { reason, message };
    this.onQuarantine(this.quarantined);
  }
}

export type LegacySessionOutboxStorage = SessionOutboxStorage & {
  getItem: (name: string) => string | null | Promise<string | null>;
};

export function withLegacyOutboxMigration(
  fileStorage: SessionOutboxStorage,
  legacyStorage: LegacySessionOutboxStorage,
  onError: (stage: string, error: unknown) => void = () => {},
): SessionOutboxStorage {
  return {
    async getItem(key) {
      const current = await fileStorage.getItem(key);
      if (current !== null) return current;
      let legacy: string | null;
      try {
        legacy = await legacyStorage.getItem(key);
      } catch (error) {
        onError('read-legacy-secure-store', error);
        return null;
      }
      if (legacy === null) return null;
      await fileStorage.setItem(key, legacy);
      try {
        await legacyStorage.removeItem(key);
      } catch (error) {
        onError('remove-legacy-secure-store', error);
      }
      return legacy;
    },
    async setItem(key, value) {
      await fileStorage.setItem(key, value);
      try {
        await legacyStorage.removeItem(key);
      } catch (error) {
        onError('remove-legacy-secure-store', error);
      }
    },
    async removeItem(key) {
      await fileStorage.removeItem(key);
      try {
        await legacyStorage.removeItem(key);
      } catch (error) {
        onError('remove-legacy-secure-store', error);
      }
    },
  };
}

export type ChunkStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

export class ChunkedSessionStorage implements SessionOutboxStorage {
  private readonly storage: ChunkStorage;
  private readonly prefix: string;
  private readonly chunkBytes: number;

  constructor(storage: ChunkStorage, prefix = 'fitbeacon-outbox-v1', chunkBytes = 1_000) {
    if (!Number.isInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 1_024) {
      throw new Error('Os blocos do fallback devem ter no máximo 1 KB.');
    }
    this.storage = storage;
    this.prefix = prefix;
    this.chunkBytes = chunkBytes;
  }

  async getItem(key: string): Promise<string | null> {
    const prefix = this.keyPrefix(key);
    const indexValue = await this.storage.getItem(`${prefix}:index`);
    if (indexValue === null) return null;
    const parsed = z.object({ version: z.literal(1), chunks: z.number().int().nonnegative() })
      .safeParse(JSON.parse(indexValue));
    if (!parsed.success) throw new Error('Índice de blocos do SecureStore inválido.');
    const chunks: string[] = [];
    for (let index = 0; index < parsed.data.chunks; index += 1) {
      const chunk = await this.storage.getItem(`${prefix}:part:${index}`);
      if (chunk === null) throw new Error('Um bloco da fila no SecureStore está ausente.');
      chunks.push(chunk);
    }
    return chunks.join('');
  }

  async setItem(key: string, value: string): Promise<void> {
    const prefix = this.keyPrefix(key);
    const previous = await this.storage.getItem(`${prefix}:index`);
    const previousIndex = previous === null ? null : parseChunkIndex(previous);
    const chunks = splitUtf8(value, this.chunkBytes);
    for (let index = 0; index < chunks.length; index += 1) {
      await this.storage.setItem(`${prefix}:part:${index}`, chunks[index]);
    }
    await this.storage.setItem(
      `${prefix}:index`,
      JSON.stringify({ version: 1, chunks: chunks.length }),
    );
    if (previousIndex) {
      for (let index = chunks.length; index < previousIndex.chunks; index += 1) {
        await this.storage.removeItem(`${prefix}:part:${index}`);
      }
    }
  }

  async removeItem(key: string): Promise<void> {
    const prefix = this.keyPrefix(key);
    const indexValue = await this.storage.getItem(`${prefix}:index`);
    if (indexValue !== null) {
      const parsed = parseChunkIndex(indexValue);
      if (parsed) {
        for (let index = 0; index < parsed.chunks; index += 1) {
          await this.storage.removeItem(`${prefix}:part:${index}`);
        }
      }
    }
    await this.storage.removeItem(`${prefix}:index`);
  }

  private keyPrefix(key: string): string {
    return `${this.prefix}:${encodeURIComponent(key)}`;
  }
}

const chunkIndexSchema = z.object({
  version: z.literal(1),
  chunks: z.number().int().nonnegative(),
});

export class MemorySessionStorage implements SessionOutboxStorage {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

export class FallbackSessionStorage implements SessionOutboxStorage {
  private readonly file: SessionOutboxStorage;
  private readonly secure: SessionOutboxStorage;
  private readonly memory: SessionOutboxStorage;
  private readonly onStatus: (status: SessionStorageStatus) => void;
  private destination: SessionStorageStatus['destination'] = 'file';
  private lastError: SessionStorageStatus['lastError'] = null;
  private quarantined: StorageQuarantine | null = null;
  private readonly preferredFallbackKeys = new Set<string>();
  private readonly tombstones = new Set<string>();

  constructor(input: {
    file: SessionOutboxStorage;
    secure: SessionOutboxStorage;
    memory: SessionOutboxStorage;
    onStatus?: (status: SessionStorageStatus) => void;
    quarantined?: StorageQuarantine | null;
  }) {
    this.file = input.file;
    this.secure = input.secure;
    this.memory = input.memory;
    this.onStatus = input.onStatus ?? (() => {});
    this.quarantined = input.quarantined ?? null;
    this.publish();
  }

  async getItem(key: string): Promise<string | null> {
    if (this.tombstones.has(key)) return null;
    if (this.preferredFallbackKeys.has(key)) {
      try {
        const preferred = await this.secure.getItem(key);
        if (preferred === STORAGE_TOMBSTONE) return null;
        if (preferred !== null) return preferred;
      } catch (error) {
        this.failover('read-secure-store', error);
      }
      const inMemory = await this.memory.getItem(key);
      if (inMemory === STORAGE_TOMBSTONE) return null;
      if (inMemory !== null) return inMemory;
      return null;
    }
    try {
      const value = await this.file.getItem(key);
      if (value !== null) {
        if (value === STORAGE_TOMBSTONE) {
          this.tombstones.add(key);
          return null;
        }
        this.tombstones.delete(key);
        return value;
      }
    } catch (error) {
      this.failover('read-file', error);
    }
    try {
      const value = await this.secure.getItem(key);
      if (value !== null) {
        if (value === STORAGE_TOMBSTONE) {
          this.tombstones.add(key);
          return null;
        }
        this.preferredFallbackKeys.add(key);
        this.tombstones.delete(key);
        this.destination = 'secure-store';
        this.publish();
        return value;
      }
    } catch (error) {
      this.failover('read-secure-store', error);
    }
    const inMemory = await this.memory.getItem(key);
    if (inMemory === STORAGE_TOMBSTONE) {
      this.tombstones.add(key);
      return null;
    }
    return inMemory;
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.file.setItem(key, value);
      this.preferredFallbackKeys.delete(key);
      this.tombstones.delete(key);
      this.destination = 'file';
      this.publish();
      await this.removeFallbackCopies(key);
      return;
    } catch (error) {
      this.failover('write-file', error);
    }
    try {
      await this.secure.setItem(key, value);
      this.preferredFallbackKeys.add(key);
      this.tombstones.delete(key);
      this.destination = 'secure-store';
      this.publish();
      await this.memory.removeItem(key);
      return;
    } catch (error) {
      this.failover('write-secure-store', error);
    }
    try {
      await this.memory.setItem(key, value);
      this.preferredFallbackKeys.add(key);
      this.tombstones.delete(key);
      this.destination = 'memory';
      this.publish();
    } catch (error) {
      this.failover('write-memory', error);
      throw new Error(
        `Nenhum armazenamento local disponível: ${safeErrorMessage(error)}`,
        { cause: error },
      );
    }
  }

  async removeItem(key: string): Promise<void> {
    const errors: unknown[] = [];
    const successfulStorages: SessionOutboxStorage[] = [];
    let succeeded = false;
    for (const [destination, storage] of [
      ['file', this.file],
      ['secure-store', this.secure],
      ['memory', this.memory],
    ] as const) {
      try {
        await storage.removeItem(key);
        succeeded = true;
        successfulStorages.push(storage);
      } catch (error) {
        errors.push(error);
        this.failover(`remove-${destination}`, error);
      }
    }
    if (!succeeded) {
      throw new Error(`Não foi possível remover dados de nenhum armazenamento: ${safeErrorMessage(errors[0])}`);
    }
    if (errors.length > 0) {
      let markerWritten = false;
      for (const storage of successfulStorages) {
        try {
          await storage.setItem(key, STORAGE_TOMBSTONE);
          markerWritten = true;
        } catch (error) {
          this.failover('write-removal-tombstone', error);
        }
      }
      if (!markerWritten) {
        throw new Error(
          `Não foi possível confirmar a remoção local: ${safeErrorMessage(errors[0])}`,
          { cause: errors[0] },
        );
      }
    }
    this.preferredFallbackKeys.delete(key);
    this.tombstones.add(key);
  }

  private async removeFallbackCopies(key: string): Promise<void> {
    try {
      await this.secure.removeItem(key);
    } catch (error) {
      this.failover('cleanup-secure-store', error);
    }
    try {
      await this.memory.removeItem(key);
    } catch (error) {
      this.failover('cleanup-memory', error);
    }
  }

  getStatus(): SessionStorageStatus {
    return {
      destination: this.destination,
      lastError: this.lastError,
      quarantined: this.quarantined,
    };
  }

  setQuarantine(value: StorageQuarantine): void {
    this.quarantined = value;
    this.publish();
  }

  private failover(stage: string, error: unknown): void {
    this.lastError = {
      stage,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: safeErrorMessage(error),
    };
    this.destination = stage.includes('secure-store') ? 'memory' : 'secure-store';
    this.publish();
  }

  private publish(): void {
    this.onStatus(this.getStatus());
  }
}

const STORAGE_TOMBSTONE = '\u0000fitbeacon:deleted:v1';

function splitUtf8(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let chunk = '';
  let chunkSize = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const size = codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    if (chunk && chunkSize + size > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkSize = 0;
    }
    chunk += character;
    chunkSize += size;
  }
  if (chunk || chunks.length === 0) chunks.push(chunk);
  return chunks;
}

export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[A-Z]:\\Users\\[^\\]+/gi, '[private-path]')
    .replace(/file:\/\/\/[^\\s]+/gi, '[private-path]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, 240);
}
