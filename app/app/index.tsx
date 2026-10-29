import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Skeleton } from '../src/components';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

export default function AppEntryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    router.replace(
      !onboardingComplete
        ? '/onboarding'
        : user
          ? '/home'
          : '/login',
    );
  }, [hasHydrated, onboardingComplete, router, user]);

  return (
    <View
      style={{
        backgroundColor: theme.colors.background,
        flex: 1,
        justifyContent: 'center',
        padding: theme.spacing['2xl'],
      }}
    >
      <Text
        accessibilityLabel="Carregando o FitBeacon"
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.semiBold,
          fontSize: theme.typography.fontSize.lg,
          lineHeight: theme.typography.lineHeight.lg,
          marginBottom: theme.spacing.lg,
          textAlign: 'center',
        }}
      >
        Preparando seu treino
      </Text>
      <Skeleton lines={3} />
    </View>
  );
}
