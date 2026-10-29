import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorState } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { requestBeaconPermissions } from '../src/beacon/permissions';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

const onboardingSteps = [
  {
    title: 'Seu treino, no aparelho certo',
    description:
      'Ao se aproximar de um equipamento, mostramos regulagens, execução e séries recomendadas.',
    icon: '01',
  },
  {
    title: 'Bluetooth e proximidade',
    description:
      'O app procura beacons iBeacon próximos. No Android, o Bluetooth é necessário; em versões antigas, também pedimos localização durante o uso.',
    icon: '02',
  },
  {
    title: 'Você controla seus dados',
    description:
      'O registro de atividade depende do seu consentimento. Você pode revogá-lo a qualquer momento nas configurações do perfil.',
    icon: '03',
  },
] as const;

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const [step, setStep] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentStep = onboardingSteps[step];
  const isLastStep = step === onboardingSteps.length - 1;

  const continueOnboarding = async (): Promise<void> => {
    if (step === 1) {
      setIsRequesting(true);
      setErrorMessage(null);

      try {
        const result = await requestBeaconPermissions();

        if (result.status !== 'granted') {
          setErrorMessage(
            result.message ?? 'Você poderá conceder essa permissão nas configurações.',
          );
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível solicitar as permissões.',
        );
      } finally {
        setIsRequesting(false);
      }
    }

    if (isLastStep) {
      completeOnboarding();
      router.replace('/login');
    } else {
      setStep((current) => current + 1);
    }
  };

  return (
    <ScreenContainer>
      <Text
        style={{
          color: theme.colors.primary,
          fontFamily: theme.typography.fontFamily.semiBold,
          fontSize: theme.typography.fontSize.xs,
          lineHeight: theme.typography.lineHeight.sm,
        }}
      >
        FITBEACON · BOAS-VINDAS
      </Text>
      <ScreenHeader
        subtitle="Uma experiência de treino conectada à sua academia."
        title="Treine com orientação, em cada movimento."
      />
      <Card>
        <Text
          style={{
            color: theme.colors.primary,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize['4xl'],
            lineHeight: theme.typography.lineHeight['4xl'],
          }}
        >
          {currentStep.icon}
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.semiBold,
            fontSize: theme.typography.fontSize.xl,
            lineHeight: theme.typography.lineHeight.xl,
          }}
        >
          {currentStep.title}
        </Text>
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          {currentStep.description}
        </Text>
      </Card>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {onboardingSteps.map((item, index) => (
          <View
            accessibilityLabel={`Etapa ${index + 1} de ${onboardingSteps.length}${index === step ? ', atual' : ''}`}
            key={item.icon}
            style={{
              backgroundColor: index === step ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.radius.pill,
              flex: 1,
              height: theme.spacing.xs,
            }}
          />
        ))}
      </View>
      {errorMessage ? (
        <ErrorState
          accessibilityLabel="Permissão de proximidade não concedida"
          description={errorMessage}
          onRetry={() => setErrorMessage(null)}
          retryLabel="Entendi"
          title="Permissão não concedida"
        />
      ) : null}
      <Button
        accessibilityLabel={isLastStep ? 'Começar' : 'Continuar onboarding'}
        label={isLastStep ? 'Começar' : step === 1 ? 'Permitir e continuar' : 'Continuar'}
        loading={isRequesting}
        onPress={() => void continueOnboarding()}
      />
      {step > 0 ? (
        <Button
          accessibilityLabel="Voltar etapa do onboarding"
          label="Voltar"
          onPress={() => setStep((current) => Math.max(0, current - 1))}
          variant="ghost"
        />
      ) : null}
    </ScreenContainer>
  );
}
