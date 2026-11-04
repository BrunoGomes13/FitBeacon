import { z } from 'zod';
import {
  completedSessionSchema,
  type CompletedSessionPayload,
  type SessionOutbox,
} from '../api/sessionOutbox.ts';
import { equipmentSchema, type Equipment, type SessionSetInput } from '../api/schemas.ts';
import type { SessionOutboxStorage } from '../api/sessionOutbox.ts';

const draftSchema = z.object({
  version: z.literal(1),
  ownerId: z.string().min(1),
  clientSessionId: z.string().min(1),
  equipment: equipmentSchema,
  origin: z.enum(['beacon', 'manual']).default('beacon'),
  exerciseId: z.string().optional(),
  startedAt: z.iso.datetime(),
  elapsedSeconds: z.number().int().nonnegative(),
  exerciseIndex: z.number().int().nonnegative().default(0),
  sets: z.array(z.object({
    exerciseId: z.string(),
    setNumber: z.number().int().positive(),
    load: z.number().nonnegative(),
    reps: z.number().int().positive(),
  })),
  updatedAt: z.number().nonnegative(),
});

export type WorkoutDraft = z.infer<typeof draftSchema>;
export type WorkoutDraftInput = {
  ownerId: string;
  clientSessionId: string;
  equipment: Equipment;
  origin?: 'beacon' | 'manual';
  exerciseId?: string;
  startedAt: string;
  elapsedSeconds: number;
  exerciseIndex?: number;
  sets: SessionSetInput[];
};

export type WorkoutConclusionDiagnostic = {
  result: 'saved' | 'pending' | 'discarded' | 'failed';
  failedStage: 'local-save' | 'session-upload' | 'set-upload' | null;
  code: number | string | null;
  reason: string | null;
  errorName: string | null;
  errorMessage: string | null;
  updatedAt: number;
};

export type WorkoutConclusionResult = {
  status: 'saved' | 'pending' | 'discarded';
  payload?: CompletedSessionPayload;
  message: string;
};

export class WorkoutLocalSaveError extends Error {
  readonly code: number | string | null = null;
  readonly stage = 'local-save' as const;
  readonly originalErrorName: string;
  readonly originalMessage: string;

  constructor(message: string, originalError: unknown) {
    super('Falha ao gravar os dados locais.');
    this.name = 'WorkoutLocalSaveError';
    this.originalErrorName =
      originalError instanceof Error ? originalError.name : 'UnknownError';
    this.originalMessage = safeDiagnosticMessage(
      originalError instanceof Error ? originalError.message : message,
    );
  }
}

export class WorkoutDraftRepository {
  private readonly storage: SessionOutboxStorage;
  private readonly now: () => number;

  constructor(storage: SessionOutboxStorage, now: () => number = Date.now) {
    this.storage = storage;
    this.now = now;
  }

  async save(input: WorkoutDraftInput): Promise<WorkoutDraft> {
    const parsed = draftSchema.parse({
      version: 1,
      ...input,
      updatedAt: this.now(),
    });
    await this.storage.setItem(this.draftKey(input.ownerId), JSON.stringify(parsed));
    return parsed;
  }

  async load(ownerId: string): Promise<WorkoutDraft | null> {
    const value = await this.storage.getItem(this.draftKey(ownerId));
    if (value === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error('O rascunho local do treino está corrompido.');
    }
    const result = draftSchema.safeParse(parsed);
    if (!result.success) throw new Error('O rascunho local do treino tem dados incompatíveis.');
    return result.data;
  }

  async remove(ownerId: string): Promise<void> {
    await this.storage.removeItem(this.draftKey(ownerId));
  }

  async saveDiagnostic(value: WorkoutConclusionDiagnostic): Promise<void> {
    await this.storage.setItem('fitbeacon:last-workout-conclusion:v1', JSON.stringify(value));
  }

  async loadDiagnostic(): Promise<WorkoutConclusionDiagnostic | null> {
    const value = await this.storage.getItem('fitbeacon:last-workout-conclusion:v1');
    if (!value) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error('O diagnóstico local da última conclusão está corrompido.');
    }
    const result = z.object({
      result: z.enum(['saved', 'pending', 'discarded', 'failed']),
      failedStage: z.enum(['local-save', 'session-upload', 'set-upload']).nullable(),
      code: z.union([z.number(), z.string()]).nullable(),
      reason: z.string().nullable(),
      errorName: z.string().nullable().optional(),
      errorMessage: z.string().nullable().optional(),
      updatedAt: z.number(),
    }).safeParse(parsed);
    return result.success
      ? {
          ...result.data,
          errorName: result.data.errorName ?? null,
          errorMessage: result.data.errorMessage ?? null,
        }
      : null;
  }

  private draftKey(ownerId: string): string {
    return `fitbeacon-workout-draft:v1:${encodeURIComponent(ownerId)}`;
  }
}

export class WorkoutCompletionService {
  private readonly drafts: WorkoutDraftRepository;
  private readonly outbox: SessionOutbox;
  private readonly send: (payload: CompletedSessionPayload) => Promise<void>;
  private readonly now: () => number;
  private readonly inFlight = new Map<string, Promise<WorkoutConclusionResult>>();

  constructor(input: {
    drafts: WorkoutDraftRepository;
    outbox: SessionOutbox;
    send: (payload: CompletedSessionPayload) => Promise<void>;
    now?: () => number;
  }) {
    this.drafts = input.drafts;
    this.outbox = input.outbox;
    this.send = input.send;
    this.now = input.now ?? Date.now;
  }

  complete(
    draft: WorkoutDraftInput,
    endedAt = this.now(),
    consentTracking = true,
  ): Promise<WorkoutConclusionResult> {
    const existing = this.inFlight.get(draft.clientSessionId);
    if (existing) return existing;
    const operation = this.completeOnce(draft, endedAt, consentTracking);
    this.inFlight.set(draft.clientSessionId, operation);
    void operation.finally(() => {
      if (this.inFlight.get(draft.clientSessionId) === operation) {
        this.inFlight.delete(draft.clientSessionId);
      }
    }).catch(() => undefined);
    return operation;
  }

  private async completeOnce(
    draft: WorkoutDraftInput,
    endedAt: number,
    consentTracking: boolean,
  ): Promise<WorkoutConclusionResult> {
    const startedAtMs = new Date(draft.startedAt).getTime();
    const durationSec = Math.max(
      1,
      Math.min(
        Math.floor(draft.elapsedSeconds),
        Math.floor((endedAt - startedAtMs) / 1_000),
      ),
    );
    if (!consentTracking) {
      await this.drafts.remove(draft.ownerId);
      await this.recordDiagnostic({
        result: 'discarded',
        failedStage: null,
        code: null,
        reason: 'Consentimento não ativo.',
        errorName: null,
        errorMessage: null,
        updatedAt: this.now(),
      });
      return { status: 'discarded', message: 'Registro pausado: consentimento não ativo.' };
    }
    if (draft.sets.length === 0 && durationSec < 20) {
      await this.drafts.remove(draft.ownerId);
      await this.recordDiagnostic({
        result: 'discarded',
        failedStage: null,
        code: null,
        reason: 'Sessão sem séries e menor que 20 segundos.',
        errorName: null,
        errorMessage: null,
        updatedAt: this.now(),
      });
      return { status: 'discarded', message: 'Sessão curta, não registrada.' };
    }

    const payload = completedSessionSchema.parse({
      clientSessionId: draft.clientSessionId,
      origin: draft.origin ?? 'beacon',
      equipmentId: draft.equipment._id,
      equipmentName: draft.equipment.name,
      areaId: draft.equipment.areaId._id,
      areaName: draft.equipment.areaId.name,
      startedAt: draft.startedAt,
      endedAt: new Date(startedAtMs + durationSec * 1_000).toISOString(),
      sets: draft.sets.map((set) => ({
        ...set,
        exerciseName: draft.equipment.exerciseIds.find(
          (exercise) => exercise._id === set.exerciseId,
        )?.name ?? 'Exercício',
      })),
    });

    try {
      await this.drafts.save({ ...draft, elapsedSeconds: durationSec });
      await this.outbox.enqueue(payload);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha ao gravar os dados locais.';
      await this.recordDiagnostic({
        result: 'failed',
        failedStage: 'local-save',
        code: error instanceof Error && 'code' in error ? String(error.code) : null,
        reason: safeDiagnosticMessage(reason),
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: safeDiagnosticMessage(reason),
        updatedAt: this.now(),
      });
      throw new WorkoutLocalSaveError(reason, error);
    }

    await this.drafts.remove(draft.ownerId);

    let syncFailure: unknown = null;
    try {
      await this.outbox.sync(this.send, true);
    } catch (error) {
      syncFailure = error;
      this.outbox.reportError(error);
    }

    const snapshot = this.outbox.getSnapshot();
    const failed = snapshot.failures.find(
      (failure) => failure.clientSessionId === draft.clientSessionId,
    );
    const pending = await this.outbox.isPending(draft.clientSessionId);
    const diagnostic: WorkoutConclusionDiagnostic = failed
      ? {
          result: 'pending',
          failedStage:
            failed.reason.includes('série') || String(failed.code).includes('EXERCISE')
              ? 'set-upload'
              : 'session-upload',
          code: failed.code ?? null,
          reason: safeDiagnosticMessage(failed.reason),
          errorName: 'ApiError',
          errorMessage: safeDiagnosticMessage(failed.reason),
          updatedAt: this.now(),
        }
      : syncFailure
        ? {
            result: 'pending',
            failedStage: 'session-upload',
            code: this.errorCode(syncFailure) ?? snapshot.errorCode,
            reason: safeDiagnosticMessage(this.errorReason(syncFailure)),
            errorName: syncFailure instanceof Error ? syncFailure.name : 'UnknownError',
            errorMessage: safeDiagnosticMessage(this.errorReason(syncFailure)),
            updatedAt: this.now(),
          }
        : {
            result: pending ? 'pending' : 'saved',
          failedStage: pending ? 'session-upload' : null,
          code: pending ? snapshot.errorCode : null,
          reason: pending ? safeDiagnosticMessage(snapshot.errorMessage ?? '') : null,
          errorName: pending ? 'ApiError' : null,
          errorMessage: pending ? safeDiagnosticMessage(snapshot.errorMessage ?? '') : null,
          updatedAt: this.now(),
          };
    await this.recordDiagnostic(diagnostic);

    if (failed || syncFailure || pending) {
      return {
        status: 'pending',
        payload,
        message: failed
          ? `Treino salvo no aparelho, envio não concluído: ${failed.reason}`
          : 'Treino salvo no aparelho, será enviado quando houver conexão.',
      };
    }
    return { status: 'saved', payload, message: 'Treino salvo.' };
  }

  private async recordDiagnostic(value: WorkoutConclusionDiagnostic): Promise<void> {
    try {
      await this.drafts.saveDiagnostic(value);
    } catch (error) {
      console.error('Não foi possível registrar o diagnóstico local de conclusão.', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: safeDiagnosticMessage(
          error instanceof Error ? error.message : 'Erro desconhecido.',
        ),
      });
    }
  }

  private errorCode(error: unknown): number | string | null {
    if (typeof error !== 'object' || error === null) return null;
    if ('code' in error && (typeof error.code === 'string' || typeof error.code === 'number')) {
      return error.code;
    }
    return 'status' in error && typeof error.status === 'number' ? error.status : null;
  }

  private errorReason(error: unknown): string {
    return error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar o treino.';
  }
}

function safeDiagnosticMessage(message: string): string {
  return message
    .replace(/[A-Z]:\\Users\\[^\\]+/gi, '[private-path]')
    .replace(/file:\/\/\/[^\s]+/gi, '[private-path]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, 240);
}
