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
      }}
    >
      {children}
    </View>
  );
}
