import { Pressable, Text } from 'react-native';
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
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
          ? theme.colors.transparent
          : isSecondary
            ? theme.colors.elevated
            : theme.colors.transparent,
        borderColor: isSecondary ? theme.colors.primary : theme.colors.transparent,
        borderRadius: isPrimary ? theme.radius.pill : theme.radius.lg,
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
      {isPrimary ? (
        <LinearGradient
          colors={[theme.colors.primaryStart, theme.colors.primaryEnd]}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={{
            borderRadius: theme.radius.pill,
            bottom: 0,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        />
      ) : null}
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
      {icon}
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
