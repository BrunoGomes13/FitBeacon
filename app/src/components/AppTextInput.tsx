import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

type AppTextInputProps = TextInputProps & {
  label: string;
  error?: string;
  accessibilityLabel: string;
  secureToggle?: boolean;
};

export function AppTextInput({
  label,
  error,
  accessibilityLabel,
  secureToggle = false,
  secureTextEntry,
  onBlur,
  onFocus,
  ...props
}: AppTextInputProps) {
  const theme = useTheme();
  const [isSecureVisible, setIsSecureVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const usesSecureText = secureTextEntry && !isSecureVisible;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: theme.typography.fontSize.sm,
          lineHeight: theme.typography.lineHeight.sm,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderColor: error
            ? theme.colors.error
            : isFocused
              ? theme.colors.primary
              : theme.colors.border,
          borderRadius: theme.radius.md,
          borderWidth: isFocused ? 2 : theme.sizes.border,
          flexDirection: 'row',
          minHeight: theme.sizes.controlHeight,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <TextInput
          accessibilityLabel={accessibilityLabel}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.colors.secondary}
          secureTextEntry={usesSecureText}
          style={{
            color: theme.colors.text,
            flex: 1,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            minHeight: theme.sizes.controlHeight,
            paddingVertical: theme.spacing.sm,
          }}
          {...props}
        />
        {secureToggle && secureTextEntry ? (
          <Pressable
            accessibilityLabel={isSecureVisible ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityRole="button"
            onPress={() => setIsSecureVisible((visible) => !visible)}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: theme.sizes.controlHeight,
              minWidth: theme.sizes.controlHeight,
            }}
          >
            {isSecureVisible ? (
              <EyeOff color={theme.colors.info} size={20} />
            ) : (
              <Eye color={theme.colors.info} size={20} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{
            color: theme.colors.error,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.xs,
            lineHeight: theme.typography.lineHeight.sm,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
