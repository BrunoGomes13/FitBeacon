import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function ScreenHeader({ eyebrow, title, subtitle }: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {eyebrow ? (
        <Text
          style={{
            color: theme.colors.primary,
            fontFamily: theme.typography.fontFamily.semiBold,
            fontSize: theme.typography.fontSize.xs,
            lineHeight: theme.typography.lineHeight.sm,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.bold,
          fontSize: theme.typography.fontSize['3xl'],
          lineHeight: theme.typography.lineHeight['3xl'],
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
