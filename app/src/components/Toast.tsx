import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type ToastTone = 'success' | 'error' | 'info';

type ToastProps = {
  visible: boolean;
  message: string;
  tone?: ToastTone;
  accessibilityLabel: string;
};

export function Toast({
  visible,
  message,
  tone = 'success',
  accessibilityLabel,
}: ToastProps) {
  const theme = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors[tone],
        borderRadius: theme.radius.md,
        borderWidth: theme.sizes.border,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: theme.typography.fontSize.sm,
          lineHeight: theme.typography.lineHeight.md,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
