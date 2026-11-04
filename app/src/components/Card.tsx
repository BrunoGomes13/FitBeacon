import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type CardProps = {
  children: ReactNode;
  elevated?: boolean;
};

export function Card({ children, elevated = false }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: elevated ? theme.colors.elevated : theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        borderWidth: theme.sizes.border,
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        shadowColor: theme.mode === 'light' ? '#17324D' : '#000000',
        shadowOffset: { width: 0, height: theme.mode === 'light' ? 3 : 0 },
        shadowOpacity: theme.mode === 'light' ? 0.08 : 0,
        shadowRadius: theme.mode === 'light' ? 12 : 0,
        elevation: theme.mode === 'light' ? 2 : 0,
      }}
    >
      {children}
    </View>
  );
}
