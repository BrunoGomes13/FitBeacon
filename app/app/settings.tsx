import { useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, Bell, Check, Globe, LogOut, MapPin, Moon, Shield, Sun } from 'lucide-react-native';
import { BrandLockup, Button, Card, ErrorState } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { logout } from '../src/api/services';
import { fetchGymEquipment } from '../src/api/services';
import { useSessionOutbox } from '../src/api/useSessionOutbox';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import type { ThemePreference } from '../src/state/store';
import { useStudentBeacon } from '../src/student/StudentBeaconRuntime';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const beacon = useStudentBeacon();
  const accessToken = useAppStore((state) => state.accessToken);
  const refreshToken = useAppStore((state) => state.refreshToken);
  const user = useAppStore((state) => state.user);
  const developerMode = useAppStore((state) => state.developerMode);
  const useMockBeacons = useAppStore((state) => state.useMockBeacons);
  const mockBeacon = useAppStore((state) => state.mockBeacon);
  const setThemePreference = useAppStore((state) => state.setThemePreference);
  const themePreference = useAppStore((state) => state.themePreference);
  const setDeveloperMode = useAppStore((state) => state.setDeveloperMode);
  const setUseMockBeacons = useAppStore((state) => state.setUseMockBeacons);
  const setMockBeacon = useAppStore((state) => state.setMockBeacon);
  const clearSession = useAppStore((state) => state.clearSession);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { syncNow } = useSessionOutbox(user?.id);
  const mockEquipmentsQuery = useQuery({
    queryKey: ['student', 'equipment'],
    queryFn: fetchGymEquipment,
    enabled: Boolean(user && developerMode && useMockBeacons),
  });
  const mockEquipments = mockEquipmentsQuery.data ?? [];
  const selectedMockEquipment =
    mockEquipments.find((equipment) =>
      mockBeacon
        ? equipment.beacon.uuid === mockBeacon.uuid &&
          equipment.beacon.major === mockBeacon.major &&
          equipment.beacon.minor === mockBeacon.minor
        : equipment.name.toLocaleLowerCase('pt-BR').includes('leg press 45'),
    ) ?? mockEquipments[0];

  const syncSessions = async (): Promise<void> => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const count = await syncNow();
      setSyncFeedback(count > 0 ? `${count} treino(s) sincronizado(s).` : 'Não há treinos pendentes.');
    } catch {
      setSyncFeedback('A sincronização será tentada novamente quando houver conexão.');
    } finally {
      setSyncing(false);
    }
  };

  const confirmSignOut = (): void => {
    Alert.alert('Sair do FitBeacon?', 'Você precisará entrar novamente para acessar sua conta.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void logout(refreshToken)
            .then(() => {
              clearSession();
              try {
                if (router.canDismiss()) router.dismiss();
              } catch (error) {
                console.warn('Não foi possível fechar a tela anterior ao sair.', {
                  name: error instanceof Error ? error.name : 'UnknownError',
                });
              }
              try {
                router.replace('/login');
              } catch (error) {
                console.warn('Não foi possível abrir o login ao sair.', {
                  name: error instanceof Error ? error.name : 'UnknownError',
                });
              }
            })
            .catch((error: unknown) => {
              setLogoutError(error instanceof Error ? error.message : 'Não foi possível encerrar sua sessão.');
            });
        },
      },
    ]);
  };

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <Button accessibilityLabel="Voltar ao perfil" label="Voltar ao perfil" onPress={() => router.back()} variant="ghost" />
        <ScreenHeader eyebrow="FITBEACON · PREFERÊNCIAS" subtitle="Ajuste sua experiência no app." title="Configurações" />
        {logoutError ? (
          <Card>
            <ErrorState accessibilityLabel="Falha ao sair da conta" description={logoutError} onRetry={() => setLogoutError(null)} retryLabel="Entendi" title="Não foi possível sair" />
          </Card>
        ) : null}
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.fontSize.md }}>
              Tema
            </Text>
            <View accessibilityLabel="Preferência de tema" accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {([
                ['system', 'Sistema', Activity],
                ['light', 'Claro', Sun],
                ['dark', 'Escuro', Moon],
              ] as const).map(([preference, label, Icon]) => (
                <Pressable
                  accessibilityLabel={`Tema ${label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: themePreference === preference }}
                  key={preference}
                  onPress={() => setThemePreference(preference satisfies ThemePreference)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: themePreference === preference ? theme.colors.primaryStart : theme.colors.elevated,
                    borderColor: themePreference === preference ? theme.colors.primaryStart : theme.colors.border,
                    borderRadius: theme.radius.pill,
                    borderWidth: theme.sizes.border,
                    flexDirection: 'row',
                    gap: theme.spacing.xs,
                    minHeight: theme.sizes.controlHeight,
                    paddingHorizontal: theme.spacing.md,
                  }}
                >
                  <Icon color={themePreference === preference ? theme.colors.onPrimary : theme.colors.text} size={18} />
                  <Text style={{ color: themePreference === preference ? theme.colors.onPrimary : theme.colors.text, fontSize: theme.typography.fontSize.sm }}>
                    {label}
                  </Text>
                  {themePreference === preference ? <Check color={theme.colors.onPrimary} size={16} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
          <PreferenceRow icon={Bell} label="Notificações" theme={theme} disabled>
            <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>Em breve</Text>
          </PreferenceRow>
          <PreferenceRow icon={Globe} label="Idioma" theme={theme}>
            <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>Português</Text>
          </PreferenceRow>
          <Pressable
            accessibilityLabel="Abrir configurações de permissões de localização"
            accessibilityRole="button"
            onPress={() => {
              void Linking.openSettings().catch((error: unknown) => {
                setLogoutError(error instanceof Error ? error.message : 'Não foi possível abrir as configurações do sistema.');
              });
            }}
            style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md, minHeight: theme.sizes.controlHeight }}
          >
            <MapPin color={theme.colors.primary} size={18} />
            <Text style={{ color: theme.colors.text, flex: 1, fontSize: theme.typography.fontSize.sm }}>Permissões de localização</Text>
            <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>Configurações do sistema</Text>
          </Pressable>
          <PreferenceRow icon={Shield} label="LGPD" theme={theme} onPress={() => router.push('/profile-info?section=privacy')} />
          <Pressable
            accessibilityLabel="Sair da conta"
            accessibilityRole="button"
            disabled={!accessToken || !user}
            onPress={confirmSignOut}
            style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md, minHeight: theme.sizes.controlHeight }}
          >
            <LogOut color={theme.colors.error} size={18} />
            <Text style={{ color: theme.colors.error, flex: 1, fontSize: theme.typography.fontSize.sm }}>Sair</Text>
          </Pressable>
        </Card>
        {developerMode ? (
          <Card>
            <Text style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.fontSize.md }}>
              Modo desenvolvedor
            </Text>
            <PreferenceRow icon={Activity} label="Usar Mock" theme={theme}>
              <Switch
                accessibilityLabel="Usar Mock de beacon"
                onValueChange={setUseMockBeacons}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                value={useMockBeacons}
              />
            </PreferenceRow>
            {useMockBeacons ? (
              <>
                <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>
                  Equipamento simulado: {selectedMockEquipment?.name ?? 'Leg press 45°'}
                </Text>
                {mockEquipmentsQuery.isError ? (
                  <Text style={{ color: theme.colors.error, fontSize: theme.typography.fontSize.sm }}>
                    Não foi possível carregar os equipamentos para o Mock.
                  </Text>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    {mockEquipments.map((equipment) => (
                      <Button
                        accessibilityLabel={`Selecionar ${equipment.name} para o Mock`}
                        key={equipment._id}
                        label={equipment.name}
                        onPress={() =>
                          setMockBeacon({
                            key: `${equipment.beacon.uuid}:${equipment.beacon.major}:${equipment.beacon.minor}`,
                            ...equipment.beacon,
                          })
                        }
                        variant={
                          selectedMockEquipment?._id === equipment._id
                            ? 'primary'
                            : 'secondary'
                        }
                      />
                    ))}
                  </View>
                </ScrollView>
                <Button accessibilityLabel="Simular aproximação" icon={<Activity color={theme.colors.primary} size={18} />} label="Simular aproximação" onPress={() => beacon.simulate('approach')} variant="secondary" />
                <Button accessibilityLabel="Simular afastamento" disabled={!beacon.snapshot.activeBeaconKey} icon={<MapPin color={theme.colors.primary} size={18} />} label={beacon.snapshot.activeBeaconKey ? 'Simular afastamento' : 'Sem sessão ativa'} onPress={() => beacon.simulate('exit')} variant="secondary" />
                <Button accessibilityLabel="Encerrar sessão agora" disabled={!beacon.snapshot.activeBeaconKey} label="Encerrar sessão agora" onPress={beacon.forceEndSession} variant="secondary" />
              </>
            ) : null}
            <Button
              accessibilityLabel="Sincronizar treinos agora"
              disabled={syncing}
              label="Sincronizar agora"
              loading={syncing}
              onPress={() => void syncSessions()}
              variant="secondary"
            />
            {syncFeedback ? (
              <Text accessibilityRole="status" style={{ color: theme.colors.secondary }}>
                {syncFeedback}
              </Text>
            ) : null}
            <Button accessibilityLabel="Abrir diagnóstico BLE" label="Abrir Diagnóstico" onPress={() => router.push('/diagnostics')} variant="secondary" />
          </Card>
        ) : null}
        <Card>
          <Pressable
            accessibilityLabel={developerMode ? 'Desativar modo desenvolvedor' : 'Ativar modo desenvolvedor'}
            accessibilityRole="switch"
            accessibilityState={{ checked: developerMode }}
            onPress={() => setDeveloperMode(!developerMode)}
            style={{ alignItems: 'center', flexDirection: 'row', minHeight: theme.sizes.controlHeight }}
          >
            <Text style={{ color: theme.colors.text, flex: 1, fontSize: theme.typography.fontSize.sm }}>Modo desenvolvedor</Text>
            <Switch
              accessibilityElementsHidden
              onValueChange={setDeveloperMode}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              value={developerMode}
            />
          </Pressable>
        </Card>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.xl }}>
          <BrandLockup variant="settings" />
          <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>
            Versão {Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}

function PreferenceRow({
  icon: Icon,
  label,
  theme,
  disabled = false,
  onPress,
  children,
}: {
  icon: typeof Moon;
  label: string;
  theme: ReturnType<typeof useTheme>;
  disabled?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const content = (
    <>
      <Icon color={disabled ? theme.colors.secondary : theme.colors.primary} size={18} />
      <Text style={{ color: disabled ? theme.colors.secondary : theme.colors.text, flex: 1, fontSize: theme.typography.fontSize.sm }}>
        {label}
      </Text>
      {children}
    </>
  );

  return onPress ? (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md, minHeight: theme.sizes.controlHeight }}>
      {content}
    </Pressable>
  ) : (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md, minHeight: theme.sizes.controlHeight }}>
      {content}
    </View>
  );
}
