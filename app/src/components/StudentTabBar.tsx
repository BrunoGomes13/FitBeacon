import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';

const tabs = [
  { href: '/home', label: 'Início', icon: '⌂' },
  { href: '/history', label: 'Histórico', icon: '◷' },
  { href: '/profile', label: 'Perfil', icon: '○' },
] as const;

export function StudentTabBar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderTopWidth: theme.sizes.border,
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingBottom: theme.spacing.sm,
        paddingTop: theme.spacing.xs,
      }}
    >
      {tabs.map((tab) => {
        const selected = pathname === tab.href;

        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.href}
            onPress={() => router.replace(tab.href)}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: theme.sizes.controlHeight,
              minWidth: theme.sizes.controlHeight,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <Text
              style={{
                color: selected ? theme.colors.primary : theme.colors.secondary,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.xs,
                lineHeight: theme.typography.lineHeight.sm,
                textAlign: 'center',
              }}
            >
              {tab.icon} {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
