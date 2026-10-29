import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

type ErrorStateProps = {
  title: string;
  description: string;
  retryLabel: string;
  accessibilityLabel: string;
  onRetry: () => void;
};

export function ErrorState({
  title,
  description,
  retryLabel,
  accessibilityLabel,
  onRetry,
}: ErrorStateProps) {
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
        style={{
          color: theme.colors.error,
          fontFamily: theme.typography.fontFamily.bold,
          fontSize: theme.typography.fontSize['2xl'],
          lineHeight: theme.typography.lineHeight['2xl'],
        }}
      >
        !
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
      <Button
        accessibilityLabel={retryLabel}
        label={retryLabel}
        onPress={onRetry}
        variant="secondary"
      />
    </View>
  );
}
