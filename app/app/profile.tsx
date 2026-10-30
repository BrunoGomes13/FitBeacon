import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Toast,
} from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { SessionOutboxPanel } from '../src/student/SessionOutboxPanel';
import { logout, updateTrackingConsent } from '../src/api/services';
import { useAppStore, type ThemePreference } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

const themeChoices: ReadonlyArray<{ label: string; value: ThemePreference }> = [
  { label: 'Sistema', value: 'system' },
  { label: 'Claro', value: 'light' },
  { label: 'Escuro', value: 'dark' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const accessToken = useAppStore((state) => state.accessToken);
  const refreshToken = useAppStore((state) => state.refreshToken);
  const consent = useAppStore((state) => state.trackingConsent);
  const themePreference = useAppStore((state) => state.themePreference);
  const developerMode = useAppStore((state) => state.developerMode);
  const useMockBeacons = useAppStore((state) => state.useMockBeacons);
  const setTrackingConsent = useAppStore((state) => state.setTrackingConsent);
  const setThemePreference = useAppStore((state) => state.setThemePreference);
  const setDeveloperMode = useAppStore((state) => state.setDeveloperMode);
  const setUseMockBeacons = useAppStore((state) => state.setUseMockBeacons);
  const clearSession = useAppStore((state) => state.clearSession);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const consentMutation = useMutation({
    mutationFn: updateTrackingConsent,
    onSuccess: (updatedUser) => {
      setTrackingConsent(updatedUser.consentTracking, updatedUser);
      setSuccessMessage(
        updatedUser.consentTracking
          ? 'Consentimento ativado. A detecção pode iniciar.'
          : 'Consentimento revogado. A detecção foi pausada.',
      );
    },
    onError: (error) => {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o consentimento.',
      );
    },
  });

  const toggleConsent = (): void => {
    setLogoutError(null);
    consentMutation.mutate(!consent);
  };

  const signOut = async (): Promise<void> => {
    setLogoutError(null);

    try {
      await logout(refreshToken);
      clearSession();
      router.replace('/login');
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Não foi possível encerrar sua sessão. Tente novamente.',
      );
    }
  };

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <ScreenHeader
          eyebrow="FITBEACON · CONTA"
          subtitle="Privacidade, aparência e preferências."
          title="Perfil e configurações"
        />
        {logoutError ? (
          <Card>
            <ErrorState
              accessibilityLabel="Falha ao atualizar configurações"
              description={logoutError}
              onRetry={() => setLogoutError(null)}
              retryLabel="Entendi"
              title="Não foi possível concluir"
            />
          </Card>
        ) : null}
        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.lg,
              lineHeight: theme.typography.lineHeight.lg,
            }}
          >
            Seus dados
          </Text>
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.md,
              lineHeight: theme.typography.lineHeight.md,
            }}
          >
            {user?.name ?? 'Aluno FitBeacon'}
          </Text>
          <Text
            style={{
              color: theme.colors.secondary,
              fontFamily: theme.typography.fontFamily.regular,
              fontSize: theme.typography.fontSize.sm,
              lineHeight: theme.typography.lineHeight.md,
            }}
          >
            {user?.email ?? 'Conta local'}
          </Text>
        </Card>
        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.lg,
              lineHeight: theme.typography.lineHeight.lg,
            }}
          >
            Aparência
          </Text>
          <Text
            style={{
              color: theme.colors.secondary,
              fontFamily: theme.typography.fontFamily.regular,
              fontSize: theme.typography.fontSize.sm,
              lineHeight: theme.typography.lineHeight.md,
            }}
          >
            Escolha um tema ou acompanhe a configuração do aparelho.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {themeChoices.map((choice) => (
              <Chip
                accessibilityLabel={`Usar tema ${choice.label.toLowerCase()}`}
                key={choice.value}
                label={choice.label}
                onPress={() => setThemePreference(choice.value)}
                selected={themePreference === choice.value}
              />
            ))}
          </View>
        </Card>
        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.lg,
              lineHeight: theme.typography.lineHeight.lg,
            }}
          >
            Privacidade e consentimento
          </Text>
          <Text
            style={{
              color: theme.colors.secondary,
              fontFamily: theme.typography.fontFamily.regular,
              fontSize: theme.typography.fontSize.sm,
              lineHeight: theme.typography.lineHeight.md,
            }}
          >
            {consent
              ? 'O app pode detectar aparelhos próximos e registrar suas sessões.'
              : 'A coleta está desativada. Sem consentimento, não iniciamos detecção nem registramos sessões.'}
          </Text>
          <Button
            accessibilityLabel={
              consent ? 'Revogar consentimento de atividade' : 'Ativar consentimento de atividade'
            }
            label={consent ? 'Revogar consentimento' : 'Ativar consentimento'}
            loading={consentMutation.isPending}
            onPress={toggleConsent}
            variant={consent ? 'secondary' : 'primary'}
          />
        </Card>
        <SessionOutboxPanel consent={consent} ownerId={user?.id} />
        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.lg,
              lineHeight: theme.typography.lineHeight.lg,
            }}
          >
            Desenvolvimento
          </Text>
          <Pressable
            accessibilityLabel="Ativar modo desenvolvedor"
            accessibilityRole="switch"
            accessibilityState={{ checked: developerMode }}
            onPress={() => setDeveloperMode(!developerMode)}
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: theme.spacing.md,
              minHeight: theme.sizes.controlHeight,
            }}
          >
            <View
              style={{
                backgroundColor: developerMode ? theme.colors.primary : theme.colors.elevated,
                borderColor: developerMode ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.radius.pill,
                borderWidth: theme.sizes.border,
                height: theme.spacing['2xl'],
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.xs,
                width: theme.spacing['5xl'],
              }}
            >
              <View
                style={{
                  alignSelf: developerMode ? 'flex-end' : 'flex-start',
                  backgroundColor: developerMode ? theme.colors.onPrimary : theme.colors.text,
                  borderRadius: theme.radius.pill,
                  height: theme.spacing.lg,
                  width: theme.spacing.lg,
                }}
              />
            </View>
            <Text
              style={{
                color: theme.colors.text,
                flex: 1,
                fontFamily: theme.typography.fontFamily.medium,
                fontSize: theme.typography.fontSize.sm,
                lineHeight: theme.typography.lineHeight.md,
              }}
            >
              Modo desenvolvedor {developerMode ? 'ativado' : 'desativado'}
            </Text>
          </Pressable>
          {developerMode ? (
            <>
              <Pressable
                accessibilityLabel="Usar simulação Mock"
                accessibilityRole="switch"
                accessibilityState={{ checked: useMockBeacons }}
                onPress={() => setUseMockBeacons(!useMockBeacons)}
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: theme.spacing.md,
                  minHeight: theme.sizes.controlHeight,
                }}
              >
                <View
                  style={{
                    backgroundColor: useMockBeacons
                      ? theme.colors.primary
                      : theme.colors.elevated,
                    borderColor: useMockBeacons
                      ? theme.colors.primary
                      : theme.colors.border,
                    borderRadius: theme.radius.pill,
                    borderWidth: theme.sizes.border,
                    height: theme.spacing['2xl'],
                    justifyContent: 'center',
                    paddingHorizontal: theme.spacing.xs,
                    width: theme.spacing['5xl'],
                  }}
                >
                  <View
                    style={{
                      alignSelf: useMockBeacons ? 'flex-end' : 'flex-start',
                      backgroundColor: useMockBeacons
                        ? theme.colors.onPrimary
                        : theme.colors.text,
                      borderRadius: theme.radius.pill,
                      height: theme.spacing.lg,
                      width: theme.spacing.lg,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: theme.colors.text,
                    flex: 1,
                    fontFamily: theme.typography.fontFamily.medium,
                    fontSize: theme.typography.fontSize.sm,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  Usar Mock para simular aparelhos
                </Text>
              </Pressable>
              <Button
                accessibilityLabel="Abrir diagnóstico BLE"
                label="Abrir diagnóstico BLE"
                onPress={() => router.push('/diagnostics')}
                variant="secondary"
              />
            </>
          ) : null}
        </Card>
        <Toast
          accessibilityLabel="Configuração atualizada"
          message={successMessage ?? ''}
          tone="success"
          visible={successMessage !== null}
        />
        {developerMode ? (
          <Button
            accessibilityLabel="Abrir galeria de componentes"
            label="Galeria de componentes"
            onPress={() => router.push('/gallery')}
            variant="ghost"
          />
        ) : null}
        <Button
          accessibilityLabel="Sair da conta"
          label="Sair da conta"
          onPress={() => void signOut()}
          variant="secondary"
          disabled={!accessToken}
        />
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
