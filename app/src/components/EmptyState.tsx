import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  accessibilityLabel: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  accessibilityLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xl,
      }}
    >
      <Text
        accessibilityElementsHidden
        style={{
          color: theme.colors.primary,
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: theme.typography.fontSize['3xl'],
          lineHeight: theme.typography.lineHeight['3xl'],
        }}
      >
        ◇
      </Text>
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.semiBold,
          fontSize: theme.typography.fontSize.lg,
          lineHeight: theme.typography.lineHeight.lg,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.secondary,
          fontFamily: theme.typography.fontFamily.regular,
          fontSize: theme.typography.fontSize.sm,
          lineHeight: theme.typography.lineHeight.md,
          textAlign: 'center',
        }}
      >
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button
          accessibilityLabel={actionLabel}
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}
