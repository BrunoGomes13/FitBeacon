import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { recordTrainingSession } from './services';
import { secureStateStorage } from '../state/secureStorage';
import {
  getSessionOutbox,
  type CompletedSessionPayload,
  type SessionOutboxStorage,
  type SessionOutboxSnapshot,
} from './sessionOutbox';

const emptySnapshot: SessionOutboxSnapshot = {
  pendingCount: 0,
  failures: [],
  errorMessage: null,
};
const outboxStorage: SessionOutboxStorage = {
  getItem: async (key) => (await secureStateStorage.getItem(key)) ?? null,
  setItem: async (key, value) => {
    await secureStateStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    await secureStateStorage.removeItem(key);
  },
};
const emptySubscribe = (): (() => void) => () => undefined;
const getEmptySnapshot = (): SessionOutboxSnapshot => emptySnapshot;

export function useSessionOutbox(ownerId: string | null | undefined) {
  const queryClient = useQueryClient();
  const outbox = useMemo(
    () => ownerId ? getSessionOutbox(ownerId, outboxStorage) : null,
    [ownerId],
  );
  const snapshot = useSyncExternalStore(
    outbox?.subscribe ?? emptySubscribe,
    outbox?.getSnapshot ?? getEmptySnapshot,
    getEmptySnapshot,
  );

  useEffect(() => {
    if (!outbox) return;
    void outbox.initialize().catch(() => {
      outbox.reportError(
        new Error('Não foi possível carregar as sessões salvas neste aparelho.'),
      );
    });
  }, [outbox]);

  const sendSession = useCallback(async (session: CompletedSessionPayload) => {
    await recordTrainingSession(session);
    await queryClient.invalidateQueries({ queryKey: ['sessions'] }).catch(() => undefined);
  }, [queryClient]);

  const sync = useCallback(async (force = false) => {
    if (!outbox) return 0;
    try {
      return await outbox.sync(sendSession, force);
    } catch {
      const error = new Error('Não foi possível acessar ou atualizar a fila salva neste aparelho.');
      outbox.reportError(error);
      throw error;
    }
  }, [outbox, sendSession]);

  const syncNow = useCallback(() => sync(true), [sync]);

  return { outbox, snapshot, sync, syncNow };
}
