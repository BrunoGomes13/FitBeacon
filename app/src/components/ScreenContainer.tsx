import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
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
  const content = (
    <View
      style={{
        alignSelf: 'center',
        gap: theme.spacing.lg,
        maxWidth: theme.sizes.contentMaxWidth,
        paddingBottom: theme.spacing['5xl'],
        paddingHorizontal: theme.sizes.pagePadding,
        paddingTop: theme.sizes.pageTopPadding,
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
