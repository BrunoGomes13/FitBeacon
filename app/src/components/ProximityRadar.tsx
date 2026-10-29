import { Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

type ProximityRadarProps = {
  scanning: boolean;
  message: string;
};

export function ProximityRadar({ scanning, message }: ProximityRadarProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useDerivedValue(() =>
    scanning && !reducedMotion
      ? withRepeat(withTiming(1.7, { duration: 1_800 }), -1, true)
      : 1,
  );

  const ringStyle = useAnimatedStyle(() => ({
    opacity:
      scanning && !reducedMotion
        ? interpolate(pulse.value, [1, 1.7], [0.55, 0.08])
        : scanning
          ? 0.3
          : 0.08,
    transform: [{ scale: pulse.value }],
  }));
  const size = theme.spacing['6xl'] + theme.spacing['5xl'] + theme.spacing['4xl'];

  return (
    <View
      accessibilityLabel={message}
      accessibilityRole="progressbar"
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        borderWidth: theme.sizes.border,
        justifyContent: 'center',
        minHeight: size + theme.spacing['3xl'],
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
            height: size,
            position: 'absolute',
            width: size,
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.elevated,
          borderColor: theme.colors.primary,
          borderRadius: theme.radius.pill,
          borderWidth: theme.sizes.border,
          height: theme.spacing['5xl'],
          justifyContent: 'center',
          width: theme.spacing['5xl'],
        }}
      >
        <Text
          style={{
            color: theme.colors.primary,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize['2xl'],
            lineHeight: theme.typography.lineHeight['2xl'],
          }}
        >
          F
        </Text>
      </View>
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.semiBold,
          fontSize: theme.typography.fontSize.sm,
          lineHeight: theme.typography.lineHeight.md,
          marginTop: theme.spacing.lg,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
}
