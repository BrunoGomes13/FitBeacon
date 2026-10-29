import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type TabItem<Value extends string> = {
  label: string;
  value: Value;
};

type TabsProps<Value extends string> = {
  items: readonly TabItem<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  accessibilityLabel: string;
};

export function Tabs<Value extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
}: TabsProps<Value>) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={{
        backgroundColor: theme.colors.elevated,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        borderWidth: theme.sizes.border,
        flexDirection: 'row',
        gap: theme.spacing.xs,
        padding: theme.spacing.xs,
      }}
    >
      {items.map((item) => {
        const selected = value === item.value;

        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.value}
            onPress={() => onChange(item.value)}
            style={{
              alignItems: 'center',
              backgroundColor: selected ? theme.colors.surface : theme.colors.transparent,
              borderRadius: theme.radius.md,
              flex: 1,
              justifyContent: 'center',
              minHeight: theme.sizes.controlHeight,
              paddingHorizontal: theme.spacing.xs,
              paddingVertical: theme.spacing.sm,
            }}
          >
            <Text
              style={{
                color: selected ? theme.colors.text : theme.colors.secondary,
                fontFamily: selected
                  ? theme.typography.fontFamily.semiBold
                  : theme.typography.fontFamily.medium,
                fontSize: theme.typography.fontSize.xs,
                lineHeight: theme.typography.lineHeight.xs,
                textAlign: 'center',
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
