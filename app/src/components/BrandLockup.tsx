import { Image, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import fullLogo from '../../assets/brand/logo-fitbeacon-transparente.png';
import symbol from '../../assets/brand/simbolo-fitbeacon-transparente.png';

type BrandLockupProps = {
  variant: 'full' | 'home' | 'settings';
};

export function BrandLockup({ variant }: BrandLockupProps) {
  const theme = useTheme();

  if (variant === 'full') {
    return (
      <View
        accessibilityLabel="FitBeacon, tecnologia que te guia no seu treino"
        style={{
          alignItems: 'center',
          alignSelf: 'center',
          backgroundColor: theme.colors.brandSurface,
          borderRadius: theme.radius.lg,
          justifyContent: 'center',
          maxWidth: 420,
          padding: theme.spacing.md,
          width: '100%',
        }}
      >
        <Image
          accessibilityLabel="Logo FitBeacon"
          resizeMode="contain"
          source={fullLogo}
          style={{ height: 150, maxWidth: 360, width: '100%' }}
        />
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={variant === 'home' ? 'FitBeacon' : 'Configurações FitBeacon'}
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.brandSurface,
        borderRadius: theme.radius.lg,
        flexDirection: 'row',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Image
        accessibilityLabel="Símbolo FitBeacon"
        resizeMode="contain"
        source={symbol}
        style={{ height: 36, width: 36 }}
      />
      {variant === 'home' ? (
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize.lg,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          Fit<Text style={{ color: theme.colors.primary }}>Beacon</Text>
        </Text>
      ) : (
        <Text
          style={{
            color: theme.colors.primary,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize.lg,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          Beacon
        </Text>
      )}
    </View>
  );
}
