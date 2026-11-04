import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type ToastTone = 'success' | 'error' | 'info';

type ToastProps = {
  visible: boolean;
  message: string;
  tone?: ToastTone;
  accessibilityLabel: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function Toast({
  visible,
  message,
  tone = 'success',
  accessibilityLabel,
  actionLabel,
  onAction,
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
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={{ alignSelf: 'flex-start', minHeight: theme.sizes.controlHeight, justifyContent: 'center' }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.sm,
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
