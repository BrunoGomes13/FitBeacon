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
import brandLogo from '../assets/brand/logo-fitbeacon-transparente.png';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const themePreference = useAppStore((state) => state.themePreference);
  const mode =
    themePreference === 'system'
      ? colorScheme === 'dark'
        ? 'dark'
        : 'light'
      : themePreference;
  const theme = themes[mode];
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

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

  if (!fontsLoaded) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: '#02070D',
          flex: 1,
          gap: theme.spacing.lg,
          justifyContent: 'center',
          padding: theme.spacing['2xl'],
        }}
      >
        <Image
          accessibilityLabel="Carregando fonte"
          resizeMode="contain"
          source={brandLogo}
          style={{ height: 190, maxWidth: 360, width: '100%' }}
        />
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={{ color: theme.colors.text }}>Carregando...</Text>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <NativeErrorBoundary theme={theme}>
            <StudentBeaconRuntime>
              <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
              <NavigationBar style={mode === 'dark' ? 'dark' : 'light'} />
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
