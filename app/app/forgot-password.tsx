import { useRouter } from 'expo-router';
import { ArrowLeft, LifeBuoy } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { Button, Card } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { useTheme } from '../src/theme/ThemeProvider';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScreenContainer>
      <Pressable
        accessibilityLabel="Voltar ao login"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={{
          alignItems: 'center',
          alignSelf: 'flex-start',
          justifyContent: 'center',
          minHeight: theme.sizes.controlHeight,
          minWidth: theme.sizes.controlHeight,
        }}
      >
        <ArrowLeft color={theme.colors.text} size={24} />
      </Pressable>
      <Card>
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'flex-start',
            backgroundColor: theme.colors.elevated,
            borderRadius: theme.radius.pill,
            justifyContent: 'center',
            minHeight: 56,
            minWidth: 56,
          }}
        >
          <LifeBuoy color={theme.colors.primary} size={28} />
        </View>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize['2xl'],
            lineHeight: theme.typography.lineHeight['2xl'],
          }}
        >
          Recuperar acesso
        </Text>
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          A recuperação de senha é feita pela administração da sua academia. Entre em
          contato com a equipe para confirmar sua identidade e redefinir o acesso. O
          FitBeacon não envia e-mails de recuperação.
        </Text>
      </Card>
      <Button
        accessibilityLabel="Voltar para entrar"
        label="Voltar para entrar"
        onPress={() => router.replace('/login')}
        variant="secondary"
      />
    </ScreenContainer>
  );
}
