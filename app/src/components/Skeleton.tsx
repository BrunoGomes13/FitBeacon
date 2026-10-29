import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type SkeletonProps = {
  lines?: 1 | 2 | 3;
};

export function Skeleton({ lines = 3 }: SkeletonProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel="Conteúdo carregando"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={{ gap: theme.spacing.md }}
    >
      {Array.from({ length: lines }, (_, index) => (
        <View
          key={index}
          style={{
            backgroundColor: theme.colors.elevated,
            borderRadius: theme.radius.pill,
            height: theme.sizes.skeletonLineHeight,
            width:
              index === lines - 1
                ? theme.sizes.skeletonShortLineWidth
                : theme.sizes.skeletonFullLineWidth,
          }}
        />
      ))}
    </View>
  );
}
