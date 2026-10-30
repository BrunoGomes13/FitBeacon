import { useQueryClient } from '@tanstack/react-query';
import { Undo2, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type EntityKind = 'equipment' | 'areas' | 'exercises';
type DeleteEntry = {
  key: string;
  kind: EntityKind;
  id: string;
  name: string;
  status: 'waiting' | 'deleting';
};
type DeleteQueueValue = {
  pendingIds: ReadonlySet<string>;
  enqueue: (kind: EntityKind, id: string, name: string) => void;
};
type DeleteMessage = {
  id: number;
  text: string;
  entry?: DeleteEntry;
  isError?: boolean;
};

const paths: Record<EntityKind, string> = {
  equipment: '/admin/equipment',
  areas: '/admin/areas',
  exercises: '/admin/exercises',
};

const DeleteQueueContext = createContext<DeleteQueueValue | null>(null);
const undoWindowMs = 6_000;

export function DeleteQueueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const entries = useRef(new Map<string, DeleteEntry>());
  const timers = useRef(new Map<string, number>());
  const messageSequence = useRef(0);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [messages, setMessages] = useState<DeleteMessage[]>([]);
  const lastPath = useRef(location.pathname);
  const commitRef = useRef<(entry: DeleteEntry, keepalive?: boolean) => Promise<void>>(async () => undefined);
  const flushRef = useRef<(keepalive?: boolean) => Promise<void>>(async () => undefined);

  const showMessage = useCallback((message: Omit<DeleteMessage, 'id'>) => {
    const id = ++messageSequence.current;
    setMessages((current) => [...current, { ...message, id }]);
    window.setTimeout(() => {
      setMessages((current) => current.filter((entry) => entry.id !== id));
    }, undoWindowMs + 4_000);
  }, []);

  const syncPendingIds = useCallback(() => {
    setPendingIds(new Set(entries.current.keys()));
  }, []);

  const commit = useCallback(async (entry: DeleteEntry, keepalive = false): Promise<void> => {
    const current = entries.current.get(entry.key);
    if (!current || current.status === 'deleting') return;

    const timer = timers.current.get(entry.key);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(entry.key);
    const deleting: DeleteEntry = { ...current, status: 'deleting' };
    entries.current.set(entry.key, deleting);
    syncPendingIds();
    setMessages((currentMessages) => currentMessages.map((message) =>
      message.entry?.key === entry.key
        ? { ...message, text: `Excluindo “${entry.name}”…`, entry: deleting }
        : message,
    ));

    try {
      await apiFetch(`${paths[entry.kind]}/${entry.id}`, {
        method: 'DELETE',
        keepalive,
      });
      entries.current.delete(entry.key);
      syncPendingIds();
      queryClient.setQueriesData<{ data: { _id: string }[] }>(
        { queryKey: ['admin', entry.kind] },
        (currentData) => currentData
          ? { ...currentData, data: currentData.data.filter((item) => item._id !== entry.id) }
          : currentData,
      );
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (error) {
      entries.current.delete(entry.key);
      syncPendingIds();
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      showMessage({
        text: error instanceof Error ? error.message : 'A API recusou a exclusão. O item foi restaurado.',
        isError: true,
      });
    }
  }, [queryClient, showMessage, syncPendingIds]);

  const flush = useCallback(async (keepalive = false): Promise<void> => {
    const waiting = [...entries.current.values()].filter((entry) => entry.status === 'waiting');
    await Promise.all(waiting.map((entry) => commit(entry, keepalive)));
  }, [commit]);

  useEffect(() => {
    commitRef.current = commit;
    flushRef.current = flush;
  }, [commit, flush]);

  const enqueue = useCallback((kind: EntityKind, id: string, name: string) => {
    const key = `${kind}:${id}`;
    if (entries.current.has(key)) return;
    const entry: DeleteEntry = { key, kind, id, name, status: 'waiting' };
    entries.current.set(key, entry);
    syncPendingIds();
    const timer = window.setTimeout(() => {
      void commitRef.current(entry);
    }, undoWindowMs);
    timers.current.set(key, timer);
    showMessage({ text: `“${name}” será excluído em 6 segundos.`, entry });
  }, [showMessage, syncPendingIds]);

  const undo = useCallback((entry: DeleteEntry) => {
    const current = entries.current.get(entry.key);
    if (!current || current.status !== 'waiting') return;
    const timer = timers.current.get(entry.key);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(entry.key);
    entries.current.delete(entry.key);
    syncPendingIds();
    setMessages((currentMessages) => currentMessages.filter((message) => message.entry?.key !== entry.key));
    showMessage({ text: `Exclusão de “${entry.name}” desfeita.` });
  }, [showMessage, syncPendingIds]);

  useEffect(() => {
    if (lastPath.current !== location.pathname) {
      lastPath.current = location.pathname;
      void flushRef.current();
    }
  }, [location.pathname]);

  useEffect(() => {
    const onBeforeUnload = (): void => {
      void flushRef.current(true);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const value = { pendingIds, enqueue };
  return (
    <DeleteQueueContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="delete-toast-stack" role="region" aria-label="Avisos de exclusão">
        {messages.map((message) => (
          <div className={`delete-toast${message.isError ? ' delete-toast-error' : ''}`} key={message.id} role={message.isError ? 'alert' : 'status'}>
            <span className="min-w-0 flex-1 break-words">{message.text}</span>
            {message.entry && message.entry.status === 'waiting' ? (
              <button
                className="btn btn-secondary min-h-12 shrink-0"
                onClick={() => undo(message.entry as DeleteEntry)}
                type="button"
              >
                <Undo2 aria-hidden="true" size={16} /> Desfazer
              </button>
            ) : null}
            <button
              aria-label="Fechar aviso"
              className="btn btn-ghost min-h-12 min-w-12 shrink-0 p-0"
              onClick={() => setMessages((current) => current.filter((entry) => entry.id !== message.id))}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        ))}
      </div>
    </DeleteQueueContext.Provider>
  );
}

export function useDeleteQueue(): DeleteQueueValue {
  const context = useContext(DeleteQueueContext);
  if (!context) throw new Error('useDeleteQueue deve ser usado dentro de DeleteQueueProvider.');
  return context;
}

export const deleteUndoWindowMs = undoWindowMs;
