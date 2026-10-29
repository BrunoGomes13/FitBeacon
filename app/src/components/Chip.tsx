import { Pressable, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type ChipProps = {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({
  label,
  accessibilityLabel,
  selected = false,
  onPress,
}: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: selected ? theme.colors.primary : theme.colors.elevated,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        borderRadius: theme.radius.pill,
        borderWidth: theme.sizes.border,
        justifyContent: 'center',
        minHeight: theme.sizes.chipHeight,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Text
        style={{
          color: selected ? theme.colors.onPrimary : theme.colors.text,
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: theme.typography.fontSize.sm,
          lineHeight: theme.typography.lineHeight.sm,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
