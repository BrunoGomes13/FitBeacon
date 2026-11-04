import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { AppState, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchEquipmentByBeacon, recordTrainingSession } from '../api/services';
import type { Equipment } from '../api/schemas';
import { getSessionStorage } from '../api/expoSessionStorage';
import { useSessionOutbox } from '../api/useSessionOutbox';
import type {
  BeaconEvent,
  BeaconIdentity,
  BeaconProvider,
  BeaconSnapshot,
  MockScenario,
} from '../beacon/types';
import { BeaconStateMachine, DEFAULT_BEACON_THRESHOLDS } from '../beacon/BeaconStateMachine';
import { MockBeaconProvider } from '../beacon/MockBeaconProvider';
import { RealBeaconProvider } from '../beacon/RealBeaconProvider';
import { requestBeaconPermissions } from '../beacon/permissions';
import { SessionConclusionController } from './SessionConclusionController';
import { createWorkoutStart } from './workoutPresentation';
import { getWorkoutElapsedSeconds } from './workoutClock';
import {
  WorkoutCompletionService,
  WorkoutDraftRepository,
  WorkoutLocalSaveError,
  type WorkoutConclusionDiagnostic,
  type WorkoutDraftInput,
} from './WorkoutCompletionService';
import { useAppStore } from '../state/store';
import { Toast } from '../components/Toast';

type RuntimeStatus = 'idle' | 'loading' | 'scanning' | 'error' | 'consent-required';
type FeedbackTone = 'success' | 'error' | 'info';
type SessionFeedback = {
  message: string;
  tone: FeedbackTone;
  countdownUntil?: number;
  retryKind?: 'checkpoint' | 'conclusion';
};

export type StudentBeaconState = {
  status: RuntimeStatus;
  message: string | null;
  snapshot: BeaconSnapshot;
  isMock: boolean;
  canSimulateExit: boolean;
  simulate: (scenario: MockScenario) => void;
  finishSession: () => Promise<void>;
  startWorkout: (equipment: Equipment, exerciseId: string) => Promise<void>;
  forceEndSession: () => void;
  checkpointWorkout: () => Promise<void>;
  retryFinish: () => Promise<void>;
  lastWorkoutConclusion: WorkoutConclusionDiagnostic | null;
  sessionFeedback: SessionFeedback | null;
};

const emptySnapshot: BeaconSnapshot = {
  activeBeaconKey: null,
  zoneState: 'outside',
  nearby: [],
  candidateBeaconKey: null,
  events: [],
  completedSessions: [],
};

const StudentBeaconContext = createContext<StudentBeaconState | null>(null);

type SessionMeta = {
  clientSessionId: string;
  startedAt: number;
  beacon: BeaconIdentity;
};

function createClientSessionId(): string {
  const segment = (length: number): string =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  return `${segment(8)}-${segment(4)}-4${segment(3)}-8${segment(3)}-${segment(12)}`;
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Não foi possível iniciar a detecção de aparelhos.';
  }
  if (/network|fetch|timeout|offline|connection/i.test(error.message)) {
    return 'Sem conexão com a internet. A sessão foi mantida no aparelho.';
  }
  return /não|nao|falha|imposs|sessão|sessao|bluetooth|permissão/i.test(error.message)
    ? error.message
    : 'Não foi possível concluir a operação neste aparelho.';
}

function isScannerScreen(pathname: string): boolean {
  return (
    pathname === '/home' ||
    pathname === '/equipment' ||
    pathname === '/workout' ||
    pathname === '/diagnostics'
  );
}

export function StudentBeaconRuntime({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const queryClientFromProvider = useQueryClient();
  const user = useAppStore((state) => state.user);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const trackingConsent = useAppStore((state) => state.trackingConsent);
  const { outbox, sync: syncOutbox } = useSessionOutbox(user?.id);
  const developerMode = useAppStore((state) => state.developerMode);
  const useMockBeacons = useAppStore((state) => state.useMockBeacons);
  const mockBeacon = useAppStore((state) => state.mockBeacon);
  const isMock = developerMode && useMockBeacons;
  const [status, setStatus] = useState<RuntimeStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [sessionFeedback, setSessionFeedback] = useState<SessionFeedback | null>(null);
  const [exitSimulated, setExitSimulated] = useState(false);
  const [lastWorkoutConclusion, setLastWorkoutConclusion] =
    useState<WorkoutConclusionDiagnostic | null>(null);
  const providerRef = useRef<BeaconProvider | null>(null);
  const machineRef = useRef(new BeaconStateMachine());
  const processEventsRef = useRef<(events: BeaconEvent[]) => void>(() => {});
  const syncTickerRef = useRef<() => void>(() => {});
  const syncScannerRef = useRef<() => void>(() => {});
  const sessionByKey = useRef(new Map<string, SessionMeta>());
  const conclusionPromises = useRef(new Map<string, Promise<void>>());
  const draftRepositoryRef = useRef<WorkoutDraftRepository | null>(null);
  const completionServiceRef = useRef<WorkoutCompletionService | null>(null);
  const checkpointWorkoutRef = useRef<() => Promise<void>>(async () => {});
  const retryFinishRef = useRef<() => Promise<void>>(async () => {});
  const finishActiveWorkoutRef = useRef<() => Promise<void>>(async () => {});
  const startWorkoutRef = useRef<(equipment: Equipment, exerciseId: string) => Promise<void>>(
    async () => {},
  );
  const failedSessionRef = useRef<SessionMeta | null>(null);
  const equipmentByKey = useRef(
    new Map<string, Awaited<ReturnType<typeof fetchEquipmentByBeacon>>>(),
  );
  const equipmentPromiseByKey = useRef(
    new Map<string, Promise<Awaited<ReturnType<typeof fetchEquipmentByBeacon>>>>(),
  );
  const lastOpenedEquipmentKey = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    if (!sessionFeedback || sessionFeedback.countdownUntil !== undefined) return;
    const feedback = sessionFeedback;
    const timeout = setTimeout(() => {
      setSessionFeedback((current) => current === feedback ? null : current);
    }, 3_500);
    return () => clearTimeout(timeout);
  }, [sessionFeedback]);

  useEffect(() => {
    pathnameRef.current = pathname;
    syncScannerRef.current();
  }, [pathname]);

  useEffect(() => {
    if (!hasHydrated || !outbox || trackingConsent) return;
    void outbox.clear().catch(() => {
      outbox.reportError(
        new Error('Não foi possível limpar as sessões salvas após a revogação do consentimento.'),
      );
    });
  }, [hasHydrated, outbox, trackingConsent]);

  useEffect(() => {
    if (!hasHydrated || !user || !trackingConsent || !outbox) return;
    let cancelled = false;
    void outbox.initialize()
      .then(() => (cancelled ? 0 : syncOutbox()))
      .catch(() => {
        outbox.reportError(
          new Error('Não foi possível carregar ou sincronizar as sessões salvas neste aparelho.'),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, outbox, syncOutbox, trackingConsent, user]);

  useEffect(() => {
    if (!hasHydrated || !user || !trackingConsent) {
      if (hasHydrated && user && !trackingConsent) {
        useAppStore.getState().clearWorkout();
        void new WorkoutDraftRepository(getSessionStorage())
          .remove(user.id)
          .catch((error: unknown) => {
            console.error('Não foi possível limpar o rascunho após a revogação do consentimento.', error);
          });
      }
      return;
    }

    let cancelled = false;
    const machine = new BeaconStateMachine();
    const provider: BeaconProvider = isMock
      ? new MockBeaconProvider(mockBeacon)
      : new RealBeaconProvider();
    machineRef.current = machine;
    providerRef.current = provider;
    const conclusionController = new SessionConclusionController(() => {
      try {
        if (router.canDismiss()) router.dismiss();
      } catch (error) {
        console.warn('Não foi possível fechar a tela anterior após o treino.', {
          name: error instanceof Error ? error.name : 'UnknownError',
        });
      }
      try {
        router.replace('/home');
      } catch (error) {
        console.warn('Não foi possível navegar ao início após o treino.', {
          name: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    });
    const drafts = new WorkoutDraftRepository(getSessionStorage());
    const completionService = outbox
      ? new WorkoutCompletionService({
          drafts,
          outbox,
          send: recordTrainingSession,
        })
      : null;
    draftRepositoryRef.current = drafts;
    completionServiceRef.current = completionService;
    conclusionPromises.current.clear();
    failedSessionRef.current = null;
    sessionByKey.current.clear();
    equipmentByKey.current.clear();
    equipmentPromiseByKey.current.clear();
    lastOpenedEquipmentKey.current = null;

    let ticker: ReturnType<typeof setInterval> | null = null;
    let appState = AppState.currentState;
    let processEvents: (events: BeaconEvent[]) => void = () => {};
    let scannerActive = false;
    let recoveryReady = false;
    let scannerTransition: Promise<void> = Promise.resolve();

    const updateCountdown = (): void => {
      const now = Date.now();
      setSessionFeedback((current) => {
        if (current?.countdownUntil === undefined) {
          return current;
        }

        const remaining = Math.max(
          0,
          Math.ceil((current.countdownUntil - now) / 1_000),
        );
        return {
          ...current,
          message: `Sinal perdido, encerrando em ${remaining}s.`,
        };
      });
    };

    const stopTicker = (): void => {
      if (ticker) {
        clearInterval(ticker);
        ticker = null;
      }
    };

    const runTick = (): void => {
      if (cancelled || !machine.getSnapshot().activeBeaconKey) {
        return;
      }

      try {
        processEvents(machine.tick(Date.now()));
        setSnapshot(machine.getSnapshot());
        updateCountdown();
        syncTicker();
      } catch (error) {
        setMessage(errorMessage(error));
      }
    };

    const syncTicker = (): void => {
      const shouldTick =
        !cancelled &&
        appState === 'active' &&
        machine.getSnapshot().activeBeaconKey !== null;

      if (shouldTick && !ticker) {
        ticker = setInterval(runTick, 1_000);
      } else if (!shouldTick) {
        stopTicker();
      }
    };

    const ensureEquipment = (
      beacon: BeaconIdentity,
    ): Promise<Awaited<ReturnType<typeof fetchEquipmentByBeacon>>> => {
      const cached = equipmentByKey.current.get(beacon.key);

      if (cached) {
        return Promise.resolve(cached);
      }

      const pending = equipmentPromiseByKey.current.get(beacon.key);

      if (pending) {
        return pending;
      }

      const request = queryClientFromProvider.fetchQuery({
        queryKey: ['equipment', beacon.uuid, beacon.major, beacon.minor],
        queryFn: () =>
          fetchEquipmentByBeacon({
            uuid: beacon.uuid,
            major: beacon.major,
            minor: beacon.minor,
          }),
      });
      equipmentPromiseByKey.current.set(beacon.key, request);

      return request.then((equipment) => {
        equipmentByKey.current.set(beacon.key, equipment);
        equipmentPromiseByKey.current.delete(beacon.key);

        useAppStore.getState().setDetectedEquipment(equipment);

        if (
          !cancelled &&
          lastOpenedEquipmentKey.current !== beacon.key &&
          !pathnameRef.current.startsWith('/equipment')
        ) {
          lastOpenedEquipmentKey.current = beacon.key;
          router.push(
            `/equipment?equipmentId=${encodeURIComponent(equipment._id)}&uuid=${encodeURIComponent(beacon.uuid)}&major=${beacon.major}&minor=${beacon.minor}`,
          );
        }

        return equipment;
      });
    };

    const saveCurrentDraft = async (): Promise<void> => {
      const activeWorkout = useAppStore.getState().activeWorkout;
      if (!activeWorkout || !user) return;
      await drafts.save({
        ownerId: user.id,
        clientSessionId: activeWorkout.clientSessionId,
        equipment: activeWorkout.equipment,
        origin: activeWorkout.origin,
        exerciseId: activeWorkout.exerciseId,
        startedAt: activeWorkout.startedAt,
        elapsedSeconds: getWorkoutElapsedSeconds(activeWorkout),
        exerciseIndex: activeWorkout.exerciseIndex,
        sets: activeWorkout.sets,
      });
    };
    checkpointWorkoutRef.current = saveCurrentDraft;

    const beginWorkout = async (
      equipment: Equipment,
      exerciseId: string,
    ): Promise<void> => {
      const beaconKey = `${equipment.beacon.uuid}:${equipment.beacon.major}:${equipment.beacon.minor}`;
      const beaconSession = sessionByKey.current.get(beaconKey);
      const activeWorkout = createWorkoutStart(
        equipment,
        exerciseId,
        useAppStore.getState().activeWorkout,
        beaconSession,
        createClientSessionId,
      );
      useAppStore.getState().startWorkout(activeWorkout);
      try {
        await drafts.save({
          ownerId: user.id,
          clientSessionId: activeWorkout.clientSessionId,
          equipment: activeWorkout.equipment,
          origin: activeWorkout.origin,
          exerciseId: activeWorkout.exerciseId,
          startedAt: activeWorkout.startedAt,
          elapsedSeconds: getWorkoutElapsedSeconds(activeWorkout),
          exerciseIndex: activeWorkout.exerciseIndex,
          sets: activeWorkout.sets,
        });
      } catch (error) {
        useAppStore.getState().clearWorkout();
        throw error;
      }
    };
    startWorkoutRef.current = beginWorkout;

    const concludeMeta = (meta: SessionMeta, endedAt: number): Promise<void> => {
      const existing = conclusionPromises.current.get(meta.clientSessionId);
      if (existing) return existing;
      if (!completionService) {
        return Promise.reject(new Error('Não foi possível acessar a fila local de treinos.'));
      }

      const result = conclusionController.conclude(meta.clientSessionId, async () => {
        const currentWorkout = useAppStore.getState().activeWorkout;
        const equipment =
          currentWorkout?.clientSessionId === meta.clientSessionId
            ? currentWorkout.equipment
            : await ensureEquipment(meta.beacon);
        const workout = useAppStore.getState().activeWorkout;
        const draft: WorkoutDraftInput = {
          ownerId: user.id,
          clientSessionId: meta.clientSessionId,
          equipment,
          origin: workout?.clientSessionId === meta.clientSessionId
            ? workout.origin
            : 'beacon',
          exerciseId: workout?.clientSessionId === meta.clientSessionId
            ? workout.exerciseId
            : equipment.exerciseIds[0]?._id,
          startedAt:
            workout?.clientSessionId === meta.clientSessionId
              ? workout.startedAt
              : new Date(meta.startedAt).toISOString(),
          elapsedSeconds:
            workout?.clientSessionId === meta.clientSessionId
              ? getWorkoutElapsedSeconds(workout, endedAt)
              : Math.max(0, Math.floor((endedAt - meta.startedAt) / 1_000)),
          exerciseIndex:
            workout?.clientSessionId === meta.clientSessionId
              ? workout.exerciseIndex
              : 0,
          sets:
            workout?.clientSessionId === meta.clientSessionId
              ? workout.sets
              : [],
        };
        const completion = await completionService.complete(
          draft,
          endedAt,
          trackingConsent,
        );
        if (useAppStore.getState().activeWorkout?.clientSessionId === meta.clientSessionId) {
          useAppStore.getState().clearWorkout();
        }
        sessionByKey.current.delete(meta.beacon.key);
        failedSessionRef.current = null;
        setSessionFeedback({
          tone: completion.status === 'saved' ? 'success' : 'info',
          message: completion.message,
        });
        try {
          setLastWorkoutConclusion(await drafts.loadDiagnostic());
        } catch (error) {
          console.error('Não foi possível carregar o diagnóstico da conclusão.', error);
        }
        void queryClientFromProvider.invalidateQueries({ queryKey: ['sessions'] });
      });
      if (result === false) return Promise.resolve();

      const operation = Promise.resolve(result)
        .then(() => undefined)
        .catch((error: unknown) => {
          failedSessionRef.current = meta;
          if (error instanceof WorkoutLocalSaveError) {
            setLastWorkoutConclusion({
              result: 'failed',
              failedStage: 'local-save',
              code: error.code,
              reason: error.message,
              errorName: error.originalErrorName,
              errorMessage: error.originalMessage,
              updatedAt: Date.now(),
            });
          }
          const reason =
            error instanceof Error ? error.message : 'Falha ao salvar o treino no aparelho.';
          setSessionFeedback({
            tone: 'error',
            message: `Não foi possível salvar: ${reason}`,
            retryKind: 'conclusion',
          });
          throw error;
        })
        .finally(() => {
          if (conclusionPromises.current.get(meta.clientSessionId) === operation) {
            conclusionPromises.current.delete(meta.clientSessionId);
          }
        });
      conclusionPromises.current.set(meta.clientSessionId, operation);
      return operation;
    };
    finishActiveWorkoutRef.current = async () => {
      const workout = useAppStore.getState().activeWorkout;
      if (!workout) return;
      let meta = [...sessionByKey.current.values()].find(
        (session) => session.clientSessionId === workout.clientSessionId,
      );
      if (!meta) {
        const beacon = workout.equipment.beacon;
        meta = {
          clientSessionId: workout.clientSessionId,
          startedAt: new Date(workout.startedAt).getTime(),
          beacon: {
            key: `${beacon.uuid}:${beacon.major}:${beacon.minor}`,
            uuid: beacon.uuid,
            major: beacon.major,
            minor: beacon.minor,
          },
        };
        sessionByKey.current.set(meta.beacon.key, meta);
        if (
          !conclusionController.isActive(meta.clientSessionId) &&
          !conclusionController.isCompleted(meta.clientSessionId)
        ) {
          conclusionController.begin(meta.clientSessionId);
        }
      }
      await concludeMeta(meta, Date.now());
    };
    retryFinishRef.current = async () => {
      const meta = failedSessionRef.current;
      if (!meta) return;
      await concludeMeta(meta, Date.now());
    };

    processEvents = (events: BeaconEvent[]): void => {
      for (const event of events) {
        const activeWorkout = useAppStore.getState().activeWorkout;
        const eventBeacon =
          event.type === 'session-end' || event.type === 'session-discarded'
            ? event.session.beacon
            : event.beacon;
        if (
          activeWorkout &&
          (activeWorkout.origin === 'manual' ||
            `${activeWorkout.equipment.beacon.uuid}:${activeWorkout.equipment.beacon.major}:${activeWorkout.equipment.beacon.minor}` !==
              eventBeacon.key)
        ) {
          continue;
        }
        if (event.type === 'session-start') {
          const meta = {
            clientSessionId: createClientSessionId(),
            startedAt: event.at,
            beacon: event.beacon,
          };
          sessionByKey.current.set(event.beacon.key, meta);
          conclusionController.begin(meta.clientSessionId);
          setExitSimulated(false);
        } else if (event.type === 'zone-enter') {
          if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              (error: unknown) => {
                console.warn('Não foi possível emitir o feedback tátil:', error);
              },
            );
          }

          void ensureEquipment(event.beacon).catch((error: unknown) => {
            if (!cancelled) {
              setMessage(errorMessage(error));
            }
          });
        } else if (event.type === 'session-end') {
          const meta = sessionByKey.current.get(event.session.beacon.key);

          if (!meta) {
            continue;
          }

          setExitSimulated(true);
          void concludeMeta(meta, event.session.endedAt).catch(() => undefined);
        } else if (event.type === 'session-discarded') {
          const session = sessionByKey.current.get(event.session.beacon.key);

          if (session) {
            setExitSimulated(true);
            void concludeMeta(session, event.session.endedAt).catch(() => undefined);
          }
        } else if (event.type === 'zone-exit') {
          if (lastOpenedEquipmentKey.current === event.beacon.key) {
            lastOpenedEquipmentKey.current = null;
          }
          useAppStore.getState().setDetectedEquipment(null);
        }
      }
    };
    processEventsRef.current = processEvents;
    syncTickerRef.current = syncTicker;

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && appState === 'active') {
        const activeWorkout = useAppStore.getState().activeWorkout;
        if (activeWorkout) {
          void (async () => {
            await saveCurrentDraft();
            if (activeWorkout.origin === 'manual') return;
            const meta = [...sessionByKey.current.values()].find(
              (session) => session.clientSessionId === activeWorkout.clientSessionId,
            );
            if (meta) {
              processEvents(machine.reset(Date.now()));
              setSnapshot(machine.getSnapshot());
            }
          })().catch((error: unknown) => {
            setSessionFeedback({
              tone: 'error',
              message: `Não foi possível salvar: ${errorMessage(error)}`,
              retryKind: 'checkpoint',
            });
          });
        }
      }
      appState = nextState;
      if (nextState === 'active') {
        runTick();
        void syncOutbox().catch(() => undefined);
      }
      syncTicker();
      void syncScanner();
    });

    const shouldScan = (): boolean =>
      !cancelled &&
      recoveryReady &&
      appState === 'active' &&
      (isScannerScreen(pathnameRef.current) ||
        (pathnameRef.current === '/settings' && developerMode && isMock));

    const startScanner = async (): Promise<void> => {
      if (!isMock) {
        const permission = await requestBeaconPermissions();

        if (!shouldScan()) {
          return;
        }

        if (permission.status !== 'granted' || permission.message) {
          throw new Error(
            permission.message ?? 'As permissões de Bluetooth foram negadas.',
          );
        }
      }

      await provider.start(
        (reading) => {
          if (cancelled) {
            return;
          }

          try {
            const events = machine.update(reading);
            processEvents(events);
            setSnapshot(machine.getSnapshot());
            syncTicker();
          } catch (error) {
            setMessage(errorMessage(error));
          }
        },
        (providerState) => {
          if (cancelled) {
            return;
          }

          if (providerState.status === 'error') {
            setStatus('error');
            setMessage(providerState.message);
            return;
          }

          if (providerState.status === 'scanning') {
            setMessage(null);
            setSnapshot(machine.getSnapshot());
          }
          setStatus(providerState.status === 'scanning' ? 'scanning' : 'idle');
        },
      );
    };

    const syncScanner = (): Promise<void> => {
      scannerTransition = scannerTransition.then(async () => {
        const wanted = shouldScan();
        if (wanted && !scannerActive) {
          scannerActive = true;
          setStatus('loading');
          try {
            await startScanner();
            if (!shouldScan()) {
              scannerActive = false;
              await provider.stop();
              if (!cancelled) setStatus('idle');
            }
          } catch (error) {
            scannerActive = false;
            if (!cancelled) {
              setStatus('error');
              setMessage(errorMessage(error));
            }
          }
        } else if (!wanted && scannerActive) {
          scannerActive = false;
          try {
            await provider.stop();
          } catch {
            if (!cancelled) {
              setStatus('error');
              setMessage('Não foi possível interromper a busca por aparelhos.');
            }
          }
          if (!cancelled) setStatus('idle');
        }
      });
      return scannerTransition;
    };

    const recoverPendingWorkout = async (): Promise<void> => {
      try {
        let draft = await drafts.load(user.id);
        const persistedWorkout = useAppStore.getState().activeWorkout;
        if (!draft && persistedWorkout) {
          draft = await drafts.save({
            ownerId: user.id,
            clientSessionId: persistedWorkout.clientSessionId,
            equipment: persistedWorkout.equipment,
            startedAt: persistedWorkout.startedAt,
            elapsedSeconds: getWorkoutElapsedSeconds(persistedWorkout),
            exerciseIndex: persistedWorkout.exerciseIndex ?? 0,
            sets: persistedWorkout.sets,
          });
        }

        if (draft) {
          const recoveredDraft = draft;
          useAppStore.getState().startWorkout({
            clientSessionId: recoveredDraft.clientSessionId,
            equipment: recoveredDraft.equipment,
            origin: recoveredDraft.origin,
            exerciseId:
              recoveredDraft.exerciseId ??
              recoveredDraft.equipment.exerciseIds[recoveredDraft.exerciseIndex]?._id ??
              recoveredDraft.equipment.exerciseIds[0]?._id ??
              '',
            startedAt: recoveredDraft.startedAt,
            resumedAt: null,
            accumulatedSeconds: recoveredDraft.elapsedSeconds,
            pausedAt: new Date().toISOString(),
            timerStatus: 'paused',
            exerciseIndex: recoveredDraft.exerciseIndex,
            sets: recoveredDraft.sets,
          });
          conclusionController.begin(recoveredDraft.clientSessionId);
          const completeRecovered = async (): Promise<void> => {
            await outbox?.initialize();
            const result = await conclusionController.conclude(
              recoveredDraft.clientSessionId,
              async () => {
                if (!completionService) {
                  throw new Error('Não foi possível acessar a fila local de treinos.');
                }
                const completion = await completionService.complete(
                  {
                    ownerId: user.id,
                    clientSessionId: recoveredDraft.clientSessionId,
                    equipment: recoveredDraft.equipment,
                    origin: recoveredDraft.origin,
                    exerciseId: recoveredDraft.exerciseId,
                    startedAt: recoveredDraft.startedAt,
                    elapsedSeconds: recoveredDraft.elapsedSeconds,
                    exerciseIndex: recoveredDraft.exerciseIndex,
                    sets: recoveredDraft.sets,
                  },
                  Date.now(),
                  trackingConsent,
                );
                useAppStore.getState().clearWorkout();
                setSessionFeedback({
                  tone: completion.status === 'saved' ? 'success' : 'info',
                  message: completion.status === 'discarded'
                    ? 'Treino curto, não registrado.'
                    : completion.message,
                });
                try {
                  setLastWorkoutConclusion(await drafts.loadDiagnostic());
                } catch (error) {
                  console.error('Não foi possível carregar o diagnóstico da conclusão.', error);
                }
              },
            );
            if (result === false) {
              throw new Error('A recuperação do treino pendente foi ignorada.');
            }
          };
          retryFinishRef.current = completeRecovered;
          await completeRecovered();
        } else {
          await outbox?.initialize();
          try {
            setLastWorkoutConclusion(await drafts.loadDiagnostic());
          } catch (error) {
            console.error('Não foi possível carregar o diagnóstico da conclusão.', error);
          }
        }
      } catch (error) {
        const activeWorkout = useAppStore.getState().activeWorkout;
        setSessionFeedback({
          tone: 'error',
          message: activeWorkout
            ? `Não foi possível salvar: ${errorMessage(error)}`
            : `Não foi possível recuperar o treino: ${errorMessage(error)}`,
          retryKind: activeWorkout ? 'conclusion' : undefined,
        });
        if (activeWorkout) router.replace('/workout');
      } finally {
        recoveryReady = true;
        void syncScanner();
      }
    };
    syncScannerRef.current = () => {
      void syncScanner();
    };
    void recoverPendingWorkout();

    return () => {
      cancelled = true;
      stopTicker();
      appStateSubscription.remove();
      providerRef.current = null;
      processEventsRef.current = () => {};
      syncTickerRef.current = () => {};
      syncScannerRef.current = () => {};
      void syncScanner();
    };
  }, [
    hasHydrated,
    developerMode,
    isMock,
    mockBeacon,
    queryClientFromProvider,
    router,
    outbox,
    syncOutbox,
    trackingConsent,
    user,
  ]);

  const contextValue = useMemo<StudentBeaconState>(
    () => ({
      status:
        !hasHydrated || !user
          ? 'idle'
          : !trackingConsent
            ? 'consent-required'
            : status === 'idle'
              ? 'loading'
              : status,
      message: !hasHydrated || !user || !trackingConsent ? null : message,
      snapshot:
        !hasHydrated || !user || !trackingConsent ? emptySnapshot : snapshot,
      isMock,
      simulate: (scenario) => {
        if (scenario === 'exit' && isMock) {
          const current = machineRef.current.getSnapshot();
          const activeBeacon = current.nearby.find(
            (beacon) => beacon.key === current.activeBeaconKey,
          );
          if (!activeBeacon || exitSimulated) return;

          setExitSimulated(true);
          try {
            providerRef.current?.simulate?.('exit');
          } catch (error) {
            setExitSimulated(false);
            setMessage(errorMessage(error));
            return;
          }
          const countdownUntil =
            activeBeacon.observedAt + DEFAULT_BEACON_THRESHOLDS.noSignalTimeoutMs;
          const remaining = Math.max(
            0,
            Math.ceil((countdownUntil - Date.now()) / 1_000),
          );
          setSessionFeedback({
            tone: 'info',
            countdownUntil,
            message: `Sinal perdido, encerrando em ${remaining}s.`,
          });
          return;
        }

        if (scenario === 'approach') {
          setExitSimulated(false);
        }

        try {
          providerRef.current?.simulate?.(scenario);
        } catch (error) {
          setMessage(errorMessage(error));
        }
      },
      finishSession: () => {
        const activeWorkout = useAppStore.getState().activeWorkout;
        if (activeWorkout?.origin === 'manual') {
          return finishActiveWorkoutRef.current();
        }
        if (!machineRef.current.getSnapshot().activeBeaconKey) {
          return finishActiveWorkoutRef.current();
        }

        setExitSimulated(true);
        const now = Date.now();
        try {
          processEventsRef.current(machineRef.current.reset(now));
          setSnapshot(machineRef.current.getSnapshot());
          syncTickerRef.current();
          if (isMock) providerRef.current?.simulate?.('exit');
          const activeWorkout = useAppStore.getState().activeWorkout;
          const meta = activeWorkout
            ? [...sessionByKey.current.values()].find(
                (session) => session.clientSessionId === activeWorkout.clientSessionId,
              )
            : null;
          return meta
            ? conclusionPromises.current.get(meta.clientSessionId) ?? Promise.resolve()
            : Promise.resolve();
        } catch (error) {
          setMessage(errorMessage(error));
          return Promise.reject(error);
        }
      },
      startWorkout: (equipment, exerciseId) =>
        startWorkoutRef.current(equipment, exerciseId),
      forceEndSession: () => {
        if (!isMock) {
          return;
        }

        if (!machineRef.current.getSnapshot().activeBeaconKey) {
          return;
        }

        setExitSimulated(true);
        try {
          processEventsRef.current(machineRef.current.reset(Date.now()));
          setSnapshot(machineRef.current.getSnapshot());
          syncTickerRef.current();
          providerRef.current?.simulate?.('exit');
        } catch (error) {
          setMessage(errorMessage(error));
        }
      },
      checkpointWorkout: async () => {
        try {
          await checkpointWorkoutRef.current();
          setSessionFeedback(null);
        } catch (error) {
          setSessionFeedback({
            tone: 'error',
            message: `Não foi possível salvar: ${errorMessage(error)}`,
            retryKind: 'checkpoint',
          });
          throw error;
        }
      },
      retryFinish: () => retryFinishRef.current(),
      lastWorkoutConclusion,
      canSimulateExit: snapshot.activeBeaconKey !== null && !exitSimulated,
      sessionFeedback,
    }),
    [
      hasHydrated,
      exitSimulated,
      lastWorkoutConclusion,
      isMock,
      message,
      snapshot,
      sessionFeedback,
      status,
      trackingConsent,
      user,
    ],
  );

  return (
    <StudentBeaconContext.Provider value={contextValue}>
      <View
        pointerEvents="box-none"
        style={{
          bottom: insets.bottom + 72,
          left: 16,
          position: 'absolute',
          right: 16,
          zIndex: 1_000,
        }}
      >
        <Toast
          accessibilityLabel="Status da sessão"
          message={sessionFeedback?.message ?? ''}
          tone={sessionFeedback?.tone}
          visible={sessionFeedback !== null}
          actionLabel={
            sessionFeedback?.retryKind === 'checkpoint' ||
            sessionFeedback?.retryKind === 'conclusion'
              ? 'Tentar de novo'
              : undefined
          }
          onAction={
            sessionFeedback?.retryKind === 'checkpoint'
              ? () => {
                  void contextValue.checkpointWorkout();
                }
              : sessionFeedback?.retryKind === 'conclusion'
                ? () => {
                    void contextValue.retryFinish().catch((error: unknown) => {
                      console.error('Falha ao repetir a conclusão do treino.', error);
                    });
                  }
                : undefined
          }
        />
      </View>
      {children}
    </StudentBeaconContext.Provider>
  );
}

export function useStudentBeacon(): StudentBeaconState {
  const context = useContext(StudentBeaconContext);

  if (!context) {
    throw new Error('useStudentBeacon deve ser usado dentro do runtime BLE.');
  }

  return context;
}
