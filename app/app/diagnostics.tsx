import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Toast,
} from '../src/components';
import { BeaconStateMachine } from '../src/beacon/BeaconStateMachine';
import { DEFAULT_BEACON_THRESHOLDS, getGymBeaconUuid } from '../src/beacon/config';
import { MockBeaconProvider } from '../src/beacon/MockBeaconProvider';
import { RealBeaconProvider } from '../src/beacon/RealBeaconProvider';
import { openAppSettings, requestBeaconPermissions } from '../src/beacon/permissions';
import type {
  BeaconEvent,
  BeaconPermissionSnapshot,
  BeaconProvider,
  BeaconProviderState,
  BeaconSnapshot,
  MockScenario,
} from '../src/beacon/types';
import { useTheme } from '../src/theme/ThemeProvider';

type ProviderMode = 'mock' | 'real';

const initialSnapshot: BeaconSnapshot = {
  activeBeaconKey: null,
  zoneState: 'outside',
  nearby: [],
  candidateBeaconKey: null,
  events: [],
  completedSessions: [],
};

const scenarios: ReadonlyArray<{ label: string; value: MockScenario }> = [
  { label: 'Aproximar', value: 'approach' },
  { label: 'Afastar', value: 'exit' },
  { label: 'Variação', value: 'vary' },
  { label: 'Trocar aparelho', value: 'switch' },
];

function messageFromEvents(events: BeaconEvent[]): string | null {
  const zoneEvent = events.find(
    (event) => event.type === 'zone-enter' || event.type === 'zone-exit',
  );

  if (zoneEvent?.type === 'zone-enter') {
    return `Beacon ${zoneEvent.beacon.major}/${zoneEvent.beacon.minor} entrou na zona.`;
  }

  if (zoneEvent?.type === 'zone-exit') {
    return `Beacon ${zoneEvent.beacon.major}/${zoneEvent.beacon.minor} saiu da zona.`;
  }

  if (events.some((event) => event.type === 'session-discarded')) {
    return 'Sessão curta descartada (menos de 20 segundos).';
  }

  return null;
}

function stateLabel(state: BeaconSnapshot['nearby'][number]['state']): string {
  switch (state) {
    case 'inside':
      return 'Na zona';
    case 'candidate':
      return 'Confirmando entrada';
    case 'outside':
      return 'Fora da zona';
  }
}

function getDisplayedGymUuid(): string {
  try {
    return getGymBeaconUuid();
  } catch {
    return 'UUID inválido na configuração';
  }
}

export default function BeaconDiagnosticsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const machineRef = useRef(new BeaconStateMachine());
  const providerRef = useRef<BeaconProvider | null>(null);
  const [providerMode, setProviderMode] = useState<ProviderMode>(
    process.env.EXPO_PUBLIC_BEACON_PROVIDER === 'real' ? 'real' : 'mock',
  );
  const [providerStateEntry, setProviderStateEntry] = useState<{
    key: string;
    value: BeaconProviderState;
  }>({ key: '', value: { status: 'idle' } });
  const [permissionEntry, setPermissionEntry] = useState<{
    key: string;
    value: BeaconPermissionSnapshot;
  }>({
    key: '',
    value: {
      status: 'unknown',
      locationServicesEnabled: null,
      message: null,
    },
  });
  const [snapshotEntry, setSnapshotEntry] = useState<{
    key: string;
    value: BeaconSnapshot;
  }>({ key: '', value: initialSnapshot });
  const [attemptedKey, setAttemptedKey] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [toastEntry, setToastEntry] = useState<{
    key: string;
    value: string | null;
  }>({ key: '', value: null });
  const [showInfo, setShowInfo] = useState(false);
  const attemptKey = `${providerMode}:${retryCount}`;
  const attemptKeyRef = useRef(attemptKey);
  const providerState =
    providerStateEntry.key === attemptKey
      ? providerStateEntry.value
      : { status: 'idle' as const };
  const permission =
    permissionEntry.key === attemptKey
      ? permissionEntry.value
      : {
          status: 'unknown' as const,
          locationServicesEnabled: null,
          message: null,
        };
  const snapshot =
    snapshotEntry.key === attemptKey ? snapshotEntry.value : initialSnapshot;
  const toastMessage = toastEntry.key === attemptKey ? toastEntry.value : null;
  const isLoading = attemptedKey !== attemptKey;

  useEffect(() => {
    let cancelled = false;
    let provider: BeaconProvider | null = null;
    attemptKeyRef.current = attemptKey;
    machineRef.current = new BeaconStateMachine();

    const showEvents = (events: BeaconEvent[]): void => {
      const message = messageFromEvents(events);

      if (message) {
        setToastEntry({ key: attemptKey, value: message });
      }
    };

    const onProviderState = (state: BeaconProviderState): void => {
      if (cancelled) {
        return;
      }

      setProviderStateEntry({ key: attemptKey, value: state });
    };

    const start = async (): Promise<void> => {
      try {
        if (providerMode === 'real') {
          const permissionResult = await requestBeaconPermissions();

          if (cancelled) {
            return;
          }

          setPermissionEntry({ key: attemptKey, value: permissionResult });

          if (permissionResult.status !== 'granted') {
            onProviderState({
              status: 'error',
              message:
                permissionResult.message ??
                'As permissões necessárias não foram concedidas.',
            });
            return;
          }

          if (
            Platform.OS === 'android' &&
            Number(Platform.Version) <= 30 &&
            permissionResult.locationServicesEnabled === false
          ) {
            onProviderState({
              status: 'error',
              message:
                permissionResult.message ??
                'Ative os serviços de localização do Android para buscar beacons.',
            });
            return;
          }
        }

        provider =
          providerMode === 'mock' ? new MockBeaconProvider() : new RealBeaconProvider();
        providerRef.current = provider;

        await provider.start((reading) => {
          if (cancelled) {
            return;
          }

          const events = machineRef.current.update(reading);
          showEvents(events);
          setSnapshotEntry({
            key: attemptKey,
            value: machineRef.current.getSnapshot(),
          });
        }, onProviderState);
      } catch (error) {
        onProviderState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Não foi possível iniciar o diagnóstico de beacons.',
        });
      } finally {
        if (!cancelled) {
          setAttemptedKey(attemptKey);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      providerRef.current = null;

      if (provider) {
        void provider.stop().catch((error: unknown) => {
          console.error(
            'Falha ao encerrar o provedor de beacons:',
            error instanceof Error ? error.message : error,
          );
        });
      }
    };
  }, [attemptKey, providerMode, retryCount]);

  useEffect(() => {
    const timer = setInterval(() => {
      const events = machineRef.current.tick(Date.now());
      const message = messageFromEvents(events);

      if (message) {
        setToastEntry({ key: attemptKeyRef.current, value: message });
      }

      setSnapshotEntry({
        key: attemptKeyRef.current,
        value: machineRef.current.getSnapshot(),
      });
    }, 500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (toastMessage === null) {
      return;
    }

    const timer = setTimeout(() => {
      setToastEntry((current) =>
        current.key === attemptKey ? { key: attemptKey, value: null } : current,
      );
    }, 3_000);

    return () => clearTimeout(timer);
  }, [attemptKey, toastMessage]);

  const changeMode = (mode: ProviderMode): void => {
    if (providerMode !== mode) {
      setProviderMode(mode);
    } else {
      setRetryCount((current) => current + 1);
    }
  };

  const statusText =
    providerState.status === 'scanning'
      ? 'Procurando beacons'
      : providerState.status === 'error'
        ? 'Busca interrompida'
        : 'Aguardando';
  const errorMessage =
    providerState.status === 'error' ? providerState.message : permission.message;

  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: 'center',
        gap: theme.spacing.lg,
        paddingBottom: theme.spacing['4xl'],
        paddingHorizontal: theme.sizes.pagePadding,
        paddingTop: theme.sizes.pageTopPadding,
      }}
      style={{ backgroundColor: theme.colors.background, flex: 1 }}
    >
      <View
        style={{
          gap: theme.spacing.md,
          maxWidth: theme.sizes.contentMaxWidth,
          width: theme.sizes.fullWidth,
        }}
      >
        <Button
          accessibilityLabel="Voltar para a galeria de componentes"
          label="Voltar à galeria"
          onPress={() => router.back()}
          variant="ghost"
        />
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize['3xl'],
            lineHeight: theme.typography.lineHeight['3xl'],
          }}
        >
          Diagnóstico iBeacon
        </Text>
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.sm,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Modo desenvolvedor · UUID da academia: {getDisplayedGymUuid()}
        </Text>

        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.lg,
              lineHeight: theme.typography.lineHeight.lg,
            }}
          >
            Origem dos sinais
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Button
              accessibilityLabel="Usar beacons simulados"
              label="Mock"
              onPress={() => changeMode('mock')}
              variant={providerMode === 'mock' ? 'primary' : 'secondary'}
            />
            <Button
              accessibilityLabel="Usar Bluetooth real"
              label="Bluetooth real"
              onPress={() => changeMode('real')}
              variant={providerMode === 'real' ? 'primary' : 'secondary'}
            />
          </View>
          <Text
            style={{
              color: theme.colors.secondary,
              fontFamily: theme.typography.fontFamily.regular,
              fontSize: theme.typography.fontSize.sm,
              lineHeight: theme.typography.lineHeight.md,
            }}
          >
            Estado: {statusText}
          </Text>
        </Card>

        {providerMode === 'mock' ? (
          <Card>
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.lg,
                lineHeight: theme.typography.lineHeight.lg,
              }}
            >
              Simulações
            </Text>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
            >
              {scenarios.map((scenario) => (
                <Button
                  accessibilityLabel={`Simular ${scenario.label.toLowerCase()}`}
                  key={scenario.value}
                  label={scenario.label}
                  onPress={() => providerRef.current?.simulate?.(scenario.value)}
                  variant="secondary"
                />
              ))}
            </View>
          </Card>
        ) : null}

        {isLoading ? <Skeleton lines={3} /> : null}

        {!isLoading && providerState.status === 'error' ? (
          <Card>
            <ErrorState
              accessibilityLabel="Falha ao iniciar a busca por beacons"
              description={
                errorMessage ?? 'Confira o Bluetooth e as permissões e tente novamente.'
              }
              onRetry={() => setRetryCount((current) => current + 1)}
              retryLabel="Tentar novamente"
              title="Não foi possível buscar beacons"
            />
            {permission.status === 'denied-permanently' ? (
              <Button
                accessibilityLabel="Abrir configurações do aplicativo"
                label="Abrir configurações do app"
                onPress={() => {
                  void openAppSettings().catch((error: unknown) => {
                    setProviderStateEntry({
                      key: attemptKey,
                      value: {
                        status: 'error',
                        message:
                          error instanceof Error
                            ? error.message
                            : 'Não foi possível abrir as configurações do app.',
                      },
                    });
                  });
                }}
                variant="secondary"
              />
            ) : null}
          </Card>
        ) : null}

        {!isLoading &&
        providerState.status !== 'error' &&
        snapshot.nearby.length === 0 ? (
          <Card>
            <EmptyState
              accessibilityLabel="Nenhum beacon encontrado"
              description={
                providerMode === 'mock'
                  ? 'A simulação enviará leituras automaticamente. Use os botões para testar outras situações.'
                  : 'Aproxime-se de um beacon iBeacon configurado para esta academia.'
              }
              title="Nenhum beacon por perto"
            />
          </Card>
        ) : null}

        {!isLoading && providerState.status !== 'error' && snapshot.nearby.length > 0 ? (
          <Card>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: theme.spacing.sm,
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  flex: 1,
                  fontFamily: theme.typography.fontFamily.semiBold,
                  fontSize: theme.typography.fontSize.lg,
                  lineHeight: theme.typography.lineHeight.lg,
                }}
              >
                Beacons detectados
              </Text>
              <Pressable
                accessibilityLabel="Sobre as regras de detecção"
                accessibilityRole="button"
                onPress={() => setShowInfo(true)}
                style={{
                  alignItems: 'center',
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.pill,
                  borderWidth: theme.sizes.border,
                  height: theme.sizes.controlHeight,
                  justifyContent: 'center',
                  minWidth: theme.sizes.controlHeight,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.info,
                    fontFamily: theme.typography.fontFamily.bold,
                    fontSize: theme.typography.fontSize.md,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  i
                </Text>
              </Pressable>
            </View>
            {snapshot.nearby.map((beacon) => (
              <View
                key={beacon.key}
                style={{
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  borderWidth: theme.sizes.border,
                  gap: theme.spacing.xs,
                  padding: theme.spacing.md,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.fontFamily.semiBold,
                    fontSize: theme.typography.fontSize.md,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  {beacon.major}/{beacon.minor} · {stateLabel(beacon.state)}
                </Text>
                <Text
                  selectable
                  style={{
                    color: theme.colors.secondary,
                    fontFamily: theme.typography.fontFamily.regular,
                    fontSize: theme.typography.fontSize.xs,
                    lineHeight: theme.typography.lineHeight.sm,
                  }}
                >
                  UUID: {beacon.uuid}
                </Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.fontFamily.medium,
                    fontSize: theme.typography.fontSize.sm,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  RSSI bruto: {beacon.rssi} dBm · suavizado:{' '}
                  {beacon.smoothedRssi.toFixed(1)} dBm
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {snapshot.activeBeaconKey ? (
          <Card>
            <Text
              style={{
                color: theme.colors.success,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.md,
                lineHeight: theme.typography.lineHeight.md,
              }}
            >
              Sessão ativa: {snapshot.activeBeaconKey}
            </Text>
          </Card>
        ) : null}

        <Toast
          accessibilityLabel="Evento da detecção de beacon"
          message={toastMessage ?? ''}
          visible={toastMessage !== null}
          tone="info"
        />
      </View>

      <BottomSheet
        accessibilityLabel="Informações sobre detecção de beacons"
        onClose={() => setShowInfo(false)}
        title="Regras de detecção"
        visible={showInfo}
      >
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.sm,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          RSSI é suavizado pela mediana de cinco leituras e média móvel exponencial. A
          entrada exige {DEFAULT_BEACON_THRESHOLDS.entryConfirmations} leituras acima de{' '}
          {DEFAULT_BEACON_THRESHOLDS.rssiEnter} dBm; a saída ocorre abaixo de{' '}
          {DEFAULT_BEACON_THRESHOLDS.rssiExit} dBm. A troca exige vantagem de{' '}
          {DEFAULT_BEACON_THRESHOLDS.switchMarginDb} dB por{' '}
          {DEFAULT_BEACON_THRESHOLDS.switchDelayMs / 1_000} segundos. Uma sessão termina
          após {DEFAULT_BEACON_THRESHOLDS.noSignalTimeoutMs / 1_000} segundos sem sinal e
          durações abaixo de {DEFAULT_BEACON_THRESHOLDS.minimumSessionDurationMs / 1_000}{' '}
          segundos são descartadas.
        </Text>
      </BottomSheet>
    </ScrollView>
  );
}
