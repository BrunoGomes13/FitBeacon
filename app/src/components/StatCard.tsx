import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        borderWidth: theme.sizes.border,
        flex: 1,
        gap: theme.spacing.xs,
        minWidth: 0,
        padding: theme.spacing.lg,
      }}
    >
      <Text
        style={{
          color: theme.colors.secondary,
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: theme.typography.fontSize.xs,
          lineHeight: theme.typography.lineHeight.sm,
        }}
      >
        {label}
      </Text>
      <Text
        accessibilityLabel={`${label}: ${value}`}
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.bold,
          fontSize: theme.typography.fontSize['2xl'],
          lineHeight: theme.typography.lineHeight['2xl'],
          minHeight: theme.sizes.statValueMinHeight,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: theme.colors.success,
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: theme.typography.fontSize.xs,
          lineHeight: theme.typography.lineHeight.sm,
        }}
      >
        {detail}
      </Text>
    </View>
  );
}
