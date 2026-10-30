import { z } from 'zod';

const sessionSetSchema = z.object({
  exerciseId: z.string().min(1),
  setNumber: z.number().int().positive(),
  load: z.number().nonnegative(),
  reps: z.number().int().positive(),
});

export const completedSessionSchema = z.object({
  clientSessionId: z.string().min(1),
  equipmentId: z.string().min(1),
  areaId: z.string().min(1),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  sets: z.array(sessionSetSchema),
});

export type CompletedSessionPayload = z.infer<typeof completedSessionSchema>;

const queueRecordSchema = z.object({
  payload: completedSessionSchema,
  attempts: z.number().int().nonnegative(),
  retryAt: z.number().nonnegative(),
});

const indexSchema = z.object({
  pendingIds: z.array(z.string()),
  failures: z.array(z.object({
    clientSessionId: z.string(),
    failedAt: z.number(),
    reason: z.string(),
  })),
});

type QueueRecord = z.infer<typeof queueRecordSchema>;
type QueueIndex = z.infer<typeof indexSchema>;
export type SessionOutboxFailure = QueueIndex['failures'][number];
export type SessionOutboxSnapshot = {
  pendingCount: number;
  failures: SessionOutboxFailure[];
  errorMessage: string | null;
};
export type SessionOutboxStorage = {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
};
export type SessionSender = (session: CompletedSessionPayload) => Promise<void>;

export type SessionOutboxOptions = {
  maxPending?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  now?: () => number;
  random?: () => number;
};

const emptyIndex = (): QueueIndex => ({ pendingIds: [], failures: [] });
const emptySnapshot = (): SessionOutboxSnapshot => ({ pendingCount: 0, failures: [], errorMessage: null });

function serialized<T>(schema: z.ZodType<T>, value: string, description: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`O armazenamento da fila contém dados inválidos (${description}).`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`O armazenamento da fila contém dados incompatíveis (${description}).`);
  }
  return result.data;
}

function responseStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = error.status;
  return typeof status === 'number' ? status : undefined;
}

function errorMessage(error: unknown): string {
  const status = responseStatus(error);
  if (status !== undefined) {
    if (status === 401) return 'Sua sessão expirou. Entre novamente para sincronizar os treinos.';
    if (status === 403) return 'Sua conta não tem permissão para registrar esta sessão.';
    if (status === 404) return 'O equipamento ou a área desta sessão não foi encontrado.';
    if (status === 409) return 'Esta sessão entrou em conflito com outro registro.';
    if (status === 422) return 'Os dados desta sessão não foram aceitos.';
    if (status >= 500) return 'O servidor está indisponível. A sessão continua salva para tentar novamente.';
    if (status >= 400) return `A API não aceitou a sessão (código ${status}).`;
  }
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : '';
  if (/network|fetch|timeout|offline|connection/i.test(message)) {
    return 'Sem conexão com a internet. A sessão continua salva para tentar novamente.';
  }
  if (/não|nao|falha|imposs|sessão|sessao|armazenamento/i.test(message)) {
    return message;
  }
  return 'Não foi possível sincronizar agora. A sessão continua salva para tentar novamente.';
}

export class SessionOutbox {
  private readonly storage: SessionOutboxStorage;
  private readonly maxPending: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly indexKey: string;
  private readonly listeners = new Set<() => void>();
  private readonly recordPrefix: string;
  private snapshot = emptySnapshot();
  private writeChain: Promise<void> = Promise.resolve();
  private syncPromise: Promise<number> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private sender: SessionSender | null = null;

  constructor(
    storage: SessionOutboxStorage,
    ownerId: string,
    options: SessionOutboxOptions = {},
  ) {
    if (!ownerId.trim()) throw new Error('A fila precisa estar associada a um usuário.');
    this.storage = storage;
    this.maxPending = options.maxPending ?? 50;
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.maxDelayMs = options.maxDelayMs ?? 5 * 60_000;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    if (!Number.isInteger(this.maxPending) || this.maxPending < 1) {
      throw new Error('O limite de sessões pendentes deve ser um inteiro positivo.');
    }
    this.indexKey = `fitbeacon-session-outbox:${encodeURIComponent(ownerId)}:index`;
    this.recordPrefix = `fitbeacon-session-outbox:${encodeURIComponent(ownerId)}:record:`;
  }

  getSnapshot = (): SessionOutboxSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async initialize(): Promise<void> {
    const index = await this.readIndex();
    this.publish(index);
  }

  async enqueue(session: CompletedSessionPayload): Promise<string | null> {
    const payload = completedSessionSchema.parse(session);
    const droppedId = await this.updateIndex(async (index) => {
      if (
        index.pendingIds.includes(payload.clientSessionId) ||
        index.failures.some((failure) => failure.clientSessionId === payload.clientSessionId)
      ) {
        return { index, result: null };
      }

      const nextPendingIds = [...index.pendingIds];
      const dropped = nextPendingIds.length >= this.maxPending ? nextPendingIds.shift() ?? null : null;
      const record: QueueRecord = { payload, attempts: 0, retryAt: 0 };
      await this.storage.setItem(this.recordKey(payload.clientSessionId), JSON.stringify(record));
      nextPendingIds.push(payload.clientSessionId);
      return {
        index: { ...index, pendingIds: nextPendingIds },
        result: dropped,
      };
    });

    if (droppedId) await this.storage.removeItem(this.recordKey(droppedId));
    return droppedId;
  }

  async sync(send: SessionSender, force = false): Promise<number> {
    if (this.syncPromise) return this.syncPromise;
    this.sender = send;
    const operation = this.drain(send, force);
    this.syncPromise = operation;
    try {
      return await operation;
    } finally {
      if (this.syncPromise === operation) this.syncPromise = null;
    }
  }

  async clear(): Promise<void> {
    this.cancelRetry();
    await this.updateIndex(async (index) => {
      for (const id of index.pendingIds) await this.storage.removeItem(this.recordKey(id));
      for (const failure of index.failures) await this.storage.removeItem(this.recordKey(failure.clientSessionId));
      await this.storage.removeItem(this.indexKey);
      return { index: emptyIndex(), result: undefined };
    });
  }

  cancelScheduledRetry(): void {
    this.cancelRetry();
  }

  private async drain(send: SessionSender, force: boolean): Promise<number> {
    let sent = 0;
    while (true) {
      const index = await this.readIndex();
      let candidate: QueueRecord | null = null;
      let earliestRetryAt = Number.POSITIVE_INFINITY;
      for (const id of index.pendingIds) {
        const record = await this.readRecord(id);
        if (force || record.retryAt <= this.now()) {
          candidate = record;
          break;
        }
        earliestRetryAt = Math.min(earliestRetryAt, record.retryAt);
      }

      if (!candidate) {
        if (Number.isFinite(earliestRetryAt)) this.scheduleRetry(send, earliestRetryAt);
        return sent;
      }

      try {
        await send(candidate.payload);
        await this.updateIndex(async (current) => ({
          index: {
            ...current,
            pendingIds: current.pendingIds.filter((id) => id !== candidate.payload.clientSessionId),
          },
          result: undefined,
        }));
        await this.storage.removeItem(this.recordKey(candidate.payload.clientSessionId));
          this.setSyncError(null);
          sent += 1;
      } catch (error) {
        const status = responseStatus(error);
        if (status !== undefined && status >= 400 && status < 500 && status !== 401) {
          const failure: SessionOutboxFailure = {
            clientSessionId: candidate.payload.clientSessionId,
            failedAt: this.now(),
            reason: errorMessage(error),
          };
          await this.updateIndex(async (current) => ({
            index: {
              pendingIds: current.pendingIds.filter((id) => id !== failure.clientSessionId),
              failures: [...current.failures, failure],
            },
            result: undefined,
          }));
          this.setSyncError(null);
          continue;
        }

        const attempts = candidate.attempts + 1;
        const delayCeiling = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (attempts - 1));
        const retryAt = this.now() + Math.floor(this.random() * (delayCeiling + 1));
        await this.storage.setItem(
          this.recordKey(candidate.payload.clientSessionId),
          JSON.stringify({ payload: candidate.payload, attempts, retryAt } satisfies QueueRecord),
        );
        this.setSyncError(errorMessage(error));
        this.scheduleRetry(send, retryAt);
        return sent;
      }
    }
  }

  private scheduleRetry(send: SessionSender, retryAt: number): void {
    this.cancelRetry();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.sync(send);
    }, Math.max(0, retryAt - this.now()));
  }

  private cancelRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private recordKey(id: string): string {
    return `${this.recordPrefix}${encodeURIComponent(id)}`;
  }

  private async readIndex(): Promise<QueueIndex> {
    const value = await this.storage.getItem(this.indexKey);
    return value === null ? emptyIndex() : serialized(indexSchema, value, 'índice');
  }

  private async readRecord(id: string): Promise<QueueRecord> {
    const value = await this.storage.getItem(this.recordKey(id));
    if (value === null) throw new Error('Uma sessão pendente não foi encontrada no armazenamento local.');
    return serialized(queueRecordSchema, value, 'sessão');
  }

  private async updateIndex<T>(
    update: (index: QueueIndex) => Promise<{ index: QueueIndex; result: T }>,
  ): Promise<T> {
    let result!: T;
    const operation = this.writeChain.then(async () => {
      const current = await this.readIndex();
      const updated = await update(current);
      if (updated.index.pendingIds.length > 0 || updated.index.failures.length > 0) {
        await this.storage.setItem(this.indexKey, JSON.stringify(updated.index));
      } else {
        await this.storage.removeItem(this.indexKey);
      }
      this.publish(updated.index);
      result = updated.result;
    });
    this.writeChain = operation.then(() => undefined, () => undefined);
    await operation;
    return result;
  }

  private publish(index: QueueIndex): void {
    this.snapshot = {
      pendingCount: index.pendingIds.length,
      failures: index.failures,
      errorMessage: this.snapshot.errorMessage,
    };
    for (const listener of this.listeners) listener();
  }

  reportError(error: unknown): void {
    this.setSyncError(errorMessage(error));
  }

  private setSyncError(errorMessageValue: string | null): void {
    this.snapshot = { ...this.snapshot, errorMessage: errorMessageValue };
    for (const listener of this.listeners) listener();
  }
}

const outboxes = new Map<string, SessionOutbox>();

export function getSessionOutbox(ownerId: string, storage: SessionOutboxStorage): SessionOutbox {
  let outbox = outboxes.get(ownerId);
  if (!outbox) {
    outbox = new SessionOutbox(storage, ownerId);
    outboxes.set(ownerId, outbox);
  }
  return outbox;
}
