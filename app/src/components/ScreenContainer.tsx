import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
};

export function ScreenContainer({
  children,
  scroll = true,
}: ScreenContainerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const hasStudentTabBar = [
    '/home',
    '/equipment-list',
    '/gym-map',
    '/history',
    '/history-detail',
    '/profile',
    '/profile-info',
    '/reports',
    '/settings',
  ].includes(pathname);
  const content = (
    <View
      style={{
        alignSelf: 'center',
        gap: theme.spacing.lg,
        maxWidth: theme.sizes.contentMaxWidth,
        paddingBottom: hasStudentTabBar
          ? theme.sizes.controlHeight + theme.spacing.xs + theme.spacing.sm +
            theme.sizes.border + insets.bottom + theme.spacing.lg
          : Math.max(theme.spacing['5xl'], insets.bottom + theme.spacing.lg),
        paddingHorizontal: theme.sizes.pagePadding,
        paddingTop: theme.sizes.pageTopPadding + insets.top,
        width: theme.sizes.fullWidth,
      }}
    >
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.colors.background, flex: 1 }}
    >
      {content}
    </ScrollView>
  );
}
