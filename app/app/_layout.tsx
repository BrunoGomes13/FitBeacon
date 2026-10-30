import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, useColorScheme, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/api/queryClient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { themes } from '../src/theme';
import { StudentBeaconRuntime } from '../src/student/StudentBeaconRuntime';
import { NativeErrorBoundary } from '../src/components/NativeErrorBoundary';
import { useAppStore } from '../src/state/store';

export default function RootLayout() {
  const colorScheme = useColorScheme();
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

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Text
          accessibilityLabel="Carregando fonte"
          style={{
            color: theme.colors.primary,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize.lg,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          …
        </Text>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <NativeErrorBoundary theme={theme}>
            <StudentBeaconRuntime>
              <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: theme.colors.background },
                  headerShown: false,
                }}
              />
            </StudentBeaconRuntime>
          </NativeErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
