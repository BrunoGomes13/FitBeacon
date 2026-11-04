import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Bike, Clock3, House, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

const tabs = [
  { href: '/home', label: 'Início', Icon: House },
  { href: '/equipment-list', label: 'Equipamentos', Icon: Bike },
  { href: '/history', label: 'Treinos', Icon: Clock3 },
  { href: '/profile', label: 'Perfil', Icon: UserRound },
] as const;

export function StudentTabBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderTopWidth: theme.sizes.border,
        elevation: theme.mode === 'light' ? 8 : 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingBottom: Math.max(theme.spacing.sm, insets.bottom),
        paddingTop: theme.spacing.xs,
        shadowColor: theme.mode === 'light' ? '#17324D' : '#000000',
        shadowOffset: { width: 0, height: theme.mode === 'light' ? -3 : 0 },
        shadowOpacity: theme.mode === 'light' ? 0.08 : 0,
        shadowRadius: theme.mode === 'light' ? 10 : 0,
      }}
    >
      {tabs.map((tab) => {
        const selected = pathname === tab.href;
        const Icon = tab.Icon;

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
            <Icon
              color={selected ? theme.colors.primary : theme.colors.secondary}
              size={20}
              strokeWidth={1.8}
            />
            <Text
              style={{
                color: selected ? theme.colors.primary : theme.colors.secondary,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.xs,
                lineHeight: theme.typography.lineHeight.sm,
                textAlign: 'center',
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
