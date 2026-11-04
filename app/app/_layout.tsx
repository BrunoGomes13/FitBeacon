import { useEffect, useState } from 'react';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/api/queryClient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { themes } from '../src/theme';
import { StudentBeaconRuntime } from '../src/student/StudentBeaconRuntime';
import { NativeErrorBoundary } from '../src/components/NativeErrorBoundary';
import { useAppStore } from '../src/state/store';
import { installGlobalErrorHandler } from '../src/utils/globalErrors';
import { getBrandAssets } from '../src/brand/brandAssets';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const themePreference = useAppStore((state) => state.themePreference);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const mode =
    themePreference === 'system'
      ? colorScheme === 'dark'
        ? 'dark'
        : 'light'
      : themePreference;
  const theme = themes[mode];
  const brand = getBrandAssets(mode);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded || !hasHydrated) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          flex: 1,
          gap: theme.spacing.lg,
          justifyContent: 'center',
          padding: theme.spacing['2xl'],
        }}
      >
        <Image
          accessibilityLabel="Carregando fonte"
          resizeMode="contain"
          source={brand.splash}
          style={{ height: 190, maxWidth: 360, width: '100%' }}
        />
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={{ color: theme.colors.text }}>Carregando...</Text>
        <StatusBar
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        />
        <NavigationBar
          style={mode === 'dark' ? 'light' : 'dark'}
        />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <NativeErrorBoundary theme={theme}>
            <StudentBeaconRuntime>
              <StatusBar
                barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
              />
              <NavigationBar
                style={mode === 'dark' ? 'light' : 'dark'}
              />
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: theme.colors.background },
                  headerShown: false,
                  navigationBarColor: theme.colors.background,
                  animation: reduceMotion ? 'none' : 'fade',
                }}
              />
            </StudentBeaconRuntime>
          </NativeErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
