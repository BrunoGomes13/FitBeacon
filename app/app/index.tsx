import { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import brandLogo from '../assets/brand/logo-fitbeacon-transparente.png';

function GymBackdrop() {
  return (
    <View pointerEvents="none" style={{ ...absoluteFill, overflow: 'hidden' }}>
      <Svg height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 390 844" width="100%">
        <Defs>
          <SvgGradient id="gym-wall" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor="#0A2947" />
            <Stop offset="0.55" stopColor="#071728" />
            <Stop offset="1" stopColor="#02070D" />
          </SvgGradient>
          <SvgGradient id="gym-floor" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#0B233A" />
            <Stop offset="1" stopColor="#01050A" />
          </SvgGradient>
        </Defs>
        <Rect fill="url(#gym-wall)" height="844" width="390" />
        <G opacity={0.42}>
          <Path d="M-20 100 L420 0 L420 40 L-20 190 Z" fill="#16446B" />
          <Path d="M-40 220 L360 80 L390 106 L-20 280 Z" fill="#0B355A" />
          <Path d="M260 0 L390 0 L390 450 L330 450 Z" fill="#07111D" />
          <Path d="M0 300 L390 242 L390 550 L0 620 Z" fill="#061321" />
          <Path d="M0 580 L390 505 L390 844 L0 844 Z" fill="url(#gym-floor)" />
          <Path d="M32 88 L48 78 L120 210 L104 218 Z" fill="#73BCE2" opacity={0.5} />
          <Path d="M194 18 L206 14 L250 108 L238 112 Z" fill="#8CCBEA" opacity={0.42} />
          <Path d="M300 190 L332 185 L332 560 L300 565 Z" fill="#153552" />
          <Path d="M345 180 L360 178 L360 560 L345 562 Z" fill="#205070" />
          <Path d="M265 560 L292 555 L330 810 L303 816 Z" fill="#1C3C55" />
          <Path d="M356 545 L378 540 L390 790 L370 796 Z" fill="#24445B" />
          <Circle cx="320" cy="620" fill="#030911" r="52" />
          <Circle cx="320" cy="620" fill="none" r="34" stroke="#1B405C" strokeWidth="9" />
          <Circle cx="365" cy="644" fill="#030911" r="39" />
          <Circle cx="365" cy="644" fill="none" r="25" stroke="#1B405C" strokeWidth="7" />
          <Path d="M44 600 L254 530 L280 550 L70 632 Z" fill="#122E45" />
          <Path d="M60 630 L276 552 L286 570 L70 650 Z" fill="#24435B" />
          <Path d="M84 650 L96 646 L150 814 L137 818 Z" fill="#31516A" />
          <Path d="M236 594 L250 590 L278 805 L263 808 Z" fill="#31516A" />
          <Path d="M70 655 L280 580" fill="none" stroke="#69859B" strokeWidth="5" />
          <Path d="M98 590 L276 526" fill="none" stroke="#183A56" strokeWidth="16" />
        </G>
        <Rect fill="#02070D" height="844" opacity={0.58} width="390" />
      </Svg>
      <LinearGradient
        colors={['rgba(2, 7, 13, 0.18)', 'rgba(2, 7, 13, 0.72)', '#02070D']}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={absoluteFill}
      />
    </View>
  );
}

const absoluteFill = {
  bottom: 0,
  left: 0,
  position: 'absolute' as const,
  right: 0,
  top: 0,
};

export default function AppEntryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const user = useAppStore((state) => state.user);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!hasHydrated || hasNavigated.current) return;
    const timer = setTimeout(() => {
      hasNavigated.current = true;
      router.replace(user ? '/home' : '/login');
    }, 350);
    return () => clearTimeout(timer);
  }, [hasHydrated, router, user]);

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: '#02070D',
        flex: 1,
        justifyContent: 'center',
        padding: theme.spacing['2xl'],
      }}
    >
      <GymBackdrop />
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', width: '100%' }}>
        <Image
          accessibilityLabel="FitBeacon, tecnologia que te guia no seu treino"
          resizeMode="contain"
          source={brandLogo}
          style={{ height: 190, maxWidth: 360, width: '100%' }}
        />
      </View>
      <View
        accessibilityLabel="Carregando o FitBeacon"
        style={{
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: 72,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.sm,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Carregando...
        </Text>
      </View>
    </View>
  );
}
