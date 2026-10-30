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
import { fetchEquipmentByBeacon } from '../api/services';
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
import { useAppStore } from '../state/store';
import { Toast } from '../components/Toast';

type RuntimeStatus = 'idle' | 'loading' | 'scanning' | 'error' | 'consent-required';
type FeedbackTone = 'success' | 'error' | 'info';
type SessionFeedback = { message: string; tone: FeedbackTone; countdownUntil?: number };

export type StudentBeaconState = {
  status: RuntimeStatus;
  message: string | null;
  snapshot: BeaconSnapshot;
  isMock: boolean;
  simulate: (scenario: MockScenario) => void;
  forceEndSession: () => void;
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

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
}

function isScannerScreen(pathname: string): boolean {
  return pathname === '/home' || pathname === '/equipment' || pathname === '/diagnostics';
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
  const isMock = developerMode && useMockBeacons;
  const [status, setStatus] = useState<RuntimeStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [sessionFeedback, setSessionFeedback] = useState<SessionFeedback | null>(null);
  const providerRef = useRef<BeaconProvider | null>(null);
  const machineRef = useRef(new BeaconStateMachine());
  const processEventsRef = useRef<(events: BeaconEvent[]) => void>(() => {});
  const syncTickerRef = useRef<() => void>(() => {});
  const syncScannerRef = useRef<() => void>(() => {});
  const sessionByKey = useRef(new Map<string, SessionMeta>());
  const equipmentByKey = useRef(
    new Map<string, Awaited<ReturnType<typeof fetchEquipmentByBeacon>>>(),
  );
  const equipmentPromiseByKey = useRef(
    new Map<string, Promise<Awaited<ReturnType<typeof fetchEquipmentByBeacon>>>>(),
  );
  const lastOpenedEquipmentKey = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);

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
      if (hasHydrated && !trackingConsent) {
        useAppStore.getState().clearWorkout();
      }
      return;
    }

    let cancelled = false;
    const machine = new BeaconStateMachine();
    const provider: BeaconProvider = isMock
      ? new MockBeaconProvider()
      : new RealBeaconProvider();
    machineRef.current = machine;
    providerRef.current = provider;
    sessionByKey.current.clear();
    equipmentByKey.current.clear();
    equipmentPromiseByKey.current.clear();
    lastOpenedEquipmentKey.current = null;

    let ticker: ReturnType<typeof setInterval> | null = null;
    let appState = AppState.currentState;
    let processEvents: (events: BeaconEvent[]) => void = () => {};
    let scannerActive = false;
    let scannerTransition: Promise<void> = Promise.resolve();

    const updateCountdown = (): void => {
      setSessionFeedback((current) => {
        if (current?.countdownUntil === undefined) {
          return current;
        }

        const remaining = Math.max(
          0,
          Math.ceil((current.countdownUntil - Date.now()) / 1_000),
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

      processEvents(machine.tick(Date.now()));
      setSnapshot(machine.getSnapshot());
      updateCountdown();
      syncTicker();
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

        const session = sessionByKey.current.get(beacon.key);

        if (session) {
          useAppStore.getState().startWorkout({
            clientSessionId: session.clientSessionId,
            equipment,
            startedAt: new Date(session.startedAt).toISOString(),
            sets: [],
          });
        }

        useAppStore.getState().setDetectedEquipment(equipment);

        if (
          !cancelled &&
          lastOpenedEquipmentKey.current !== beacon.key &&
          !pathnameRef.current.startsWith('/equipment')
        ) {
          lastOpenedEquipmentKey.current = beacon.key;
          router.push(
            `/equipment?uuid=${encodeURIComponent(beacon.uuid)}&major=${beacon.major}&minor=${beacon.minor}`,
          );
        }

        return equipment;
      });
    };

    processEvents = (events: BeaconEvent[]): void => {
      for (const event of events) {
        if (event.type === 'session-start') {
          const meta = {
            clientSessionId: createClientSessionId(),
            startedAt: event.at,
            beacon: event.beacon,
          };
          sessionByKey.current.set(event.beacon.key, meta);
          const equipment = equipmentByKey.current.get(event.beacon.key);

          if (equipment) {
            useAppStore.getState().startWorkout({
              clientSessionId: meta.clientSessionId,
              equipment,
              startedAt: new Date(meta.startedAt).toISOString(),
              sets: [],
            });
          }
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
          sessionByKey.current.delete(event.session.beacon.key);

          if (!meta) {
            continue;
          }

          let droppedOldest = false;
          void ensureEquipment(meta.beacon)
            .then(async (equipment) => {
              const activeWorkout = useAppStore.getState().activeWorkout;
              const sets =
                activeWorkout?.clientSessionId === meta.clientSessionId
                  ? activeWorkout.sets
                  : [];

              if (!outbox) {
                throw new Error('Não foi possível acessar a fila de sessões deste usuário.');
              }
              const droppedId = await outbox.enqueue({
                clientSessionId: meta.clientSessionId,
                equipmentId: equipment._id,
                areaId: equipment.areaId._id,
                startedAt: new Date(event.session.startedAt).toISOString(),
                endedAt: new Date(event.session.endedAt).toISOString(),
                sets,
              });
              droppedOldest = droppedId !== null;
              if (useAppStore.getState().activeWorkout?.clientSessionId === meta.clientSessionId) {
                useAppStore.getState().clearWorkout();
              }

              await syncOutbox();
              const outboxSnapshot = outbox.getSnapshot();
              const failedSession = outboxSnapshot.failures.find(
                (failure) => failure.clientSessionId === meta.clientSessionId,
              );
              if (droppedId) {
                setSessionFeedback({
                  tone: 'info',
                  message: 'Limite de 50 sessões atingido; a sessão pendente mais antiga foi descartada para salvar a atual.',
                });
              } else if (failedSession) {
                setSessionFeedback({
                  tone: 'error',
                  message: `A sessão foi salva, mas não pôde ser registrada: ${failedSession.reason}`,
                });
              } else if (outboxSnapshot.pendingCount > 0) {
                setSessionFeedback({
                  tone: outboxSnapshot.errorMessage ? 'error' : 'info',
                  message: outboxSnapshot.errorMessage
                    ? `Sessão salva no aparelho. ${outboxSnapshot.errorMessage}`
                    : 'Sessão salva no aparelho e aguardando sincronização.',
                });
              } else if (developerMode) {
                setSessionFeedback({
                  tone: 'success',
                  message: `Sessão registrada: ${equipment.name} · ${formatDuration(event.session.durationMs)}.`,
                });
              }
            })
            .catch((error: unknown) => {
              if (!cancelled) {
                const detail = errorMessage(error);
                outbox?.reportError(
                  new Error('Não foi possível salvar ou sincronizar a sessão neste aparelho.'),
                );
                setSessionFeedback({
                  tone: 'error',
                  message: droppedOldest
                    ? `Limite de 50 sessões atingido; a sessão pendente mais antiga foi descartada. Não foi possível sincronizar agora: ${detail}`
                    : `Não foi possível salvar a sessão: ${detail}`,
                });
              }
            });
        } else if (event.type === 'session-discarded') {
          const session = sessionByKey.current.get(event.session.beacon.key);
          sessionByKey.current.delete(event.session.beacon.key);

          if (
            session &&
            useAppStore.getState().activeWorkout?.clientSessionId ===
              session.clientSessionId
          ) {
            useAppStore.getState().clearWorkout();
          }
          if (developerMode) {
            setSessionFeedback({
              tone: 'info',
              message: `Sessão menor que ${DEFAULT_BEACON_THRESHOLDS.minimumSessionDurationMs / 1_000}s (${formatDuration(event.session.durationMs)}); descartada.`,
            });
          }
        } else if (event.type === 'zone-exit') {
          if (lastOpenedEquipmentKey.current === event.beacon.key) {
            lastOpenedEquipmentKey.current = null;
          }
        }
      }
    };
    processEventsRef.current = processEvents;
    syncTickerRef.current = syncTicker;

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
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
      appState === 'active' &&
      isScannerScreen(pathnameRef.current);

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

          const events = machine.update(reading);
          processEvents(events);
          setSnapshot(machine.getSnapshot());
          syncTicker();
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
    syncScannerRef.current = () => {
      void syncScanner();
    };
    void syncScanner();

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
        providerRef.current?.simulate?.(scenario);

        if (scenario !== 'exit' || !isMock) {
          return;
        }

        const current = machineRef.current.getSnapshot();
        const activeBeacon = current.nearby.find(
          (beacon) => beacon.key === current.activeBeaconKey,
        );

        if (!activeBeacon) {
          setSessionFeedback({
            tone: 'info',
            message: 'Nenhuma sessão ativa para encerrar.',
          });
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
      },
      forceEndSession: () => {
        if (!isMock) {
          return;
        }

        if (!machineRef.current.getSnapshot().activeBeaconKey) {
          setSessionFeedback({
            tone: 'info',
            message: 'Nenhuma sessão ativa para encerrar.',
          });
          return;
        }

        providerRef.current?.simulate?.('exit');
        processEventsRef.current(machineRef.current.reset(Date.now()));
        setSnapshot(machineRef.current.getSnapshot());
        syncTickerRef.current();
      },
      sessionFeedback,
    }),
    [
      hasHydrated,
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
          left: 16,
          position: 'absolute',
          right: 16,
          top: insets.top + 8,
          zIndex: 1_000,
        }}
      >
        <Toast
          accessibilityLabel="Status da sessão"
          message={sessionFeedback?.message ?? ''}
          tone={sessionFeedback?.tone}
          visible={sessionFeedback !== null}
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
