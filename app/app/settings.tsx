import { useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Activity, Bell, Globe, LogOut, MapPin, Moon, Shield, Sun } from 'lucide-react-native';
import { BrandLockup, Button, Card, ErrorState } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { logout } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import { getNextThemePreference } from '../src/student/profilePresentation';
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
  const setThemePreference = useAppStore((state) => state.setThemePreference);
  const setDeveloperMode = useAppStore((state) => state.setDeveloperMode);
  const setUseMockBeacons = useAppStore((state) => state.setUseMockBeacons);
  const clearSession = useAppStore((state) => state.clearSession);
  const [logoutError, setLogoutError] = useState<string | null>(null);

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
              router.dismissAll();
              router.replace('/login');
            })
            .catch((error: unknown) => {
              setLogoutError(error instanceof Error ? error.message : 'Não foi possível encerrar sua sessão.');
            });
        },
      },
    ]);
  };

  const toggleTheme = (): void => {
    setThemePreference(getNextThemePreference(theme.mode === 'dark'));
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
          <PreferenceRow icon={theme.mode === 'dark' ? Moon : Sun} label="Modo escuro" theme={theme}>
            <Switch
              accessibilityLabel="Modo escuro"
              onValueChange={toggleTheme}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              value={theme.mode === 'dark'}
            />
          </PreferenceRow>
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
                <Button accessibilityLabel="Simular aproximação" icon={<Activity color={theme.colors.primary} size={18} />} label="Simular aproximação" onPress={() => beacon.simulate('approach')} variant="secondary" />
                <Button accessibilityLabel="Simular afastamento" disabled={!beacon.snapshot.activeBeaconKey} icon={<MapPin color={theme.colors.primary} size={18} />} label={beacon.snapshot.activeBeaconKey ? 'Simular afastamento' : 'Sem sessão ativa'} onPress={() => beacon.simulate('exit')} variant="secondary" />
                <Button accessibilityLabel="Encerrar sessão agora" disabled={!beacon.snapshot.activeBeaconKey} label="Encerrar sessão agora" onPress={beacon.forceEndSession} variant="secondary" />
              </>
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
