import { Pressable, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const foregroundColor = isPrimary ? theme.colors.onPrimary : theme.colors.text;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: isPrimary
          ? theme.colors.primary
          : isSecondary
            ? theme.colors.elevated
            : theme.colors.transparent,
        borderColor: isSecondary ? theme.colors.border : theme.colors.transparent,
        borderRadius: theme.radius.md,
        borderWidth: isSecondary ? theme.sizes.border : 0,
        flexDirection: 'row',
        gap: theme.spacing.sm,
        justifyContent: 'center',
        minHeight: theme.sizes.controlHeight,
        opacity: isDisabled
          ? theme.interactionOpacity.disabled
          : pressed
            ? theme.interactionOpacity.pressed
            : 1,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      })}
    >
      {loading ? (
        <Text
          accessibilityElementsHidden
          style={{
            color: foregroundColor,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          …
        </Text>
      ) : null}
      <Text
        style={{
          color: foregroundColor,
          fontFamily: theme.typography.fontFamily.semiBold,
          fontSize: theme.typography.fontSize.sm,
          lineHeight: theme.typography.lineHeight.sm,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
