import { useState } from 'react';
import { Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, ErrorState, Toast } from '../src/components';
import { AppTextInput } from '../src/components/AppTextInput';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { login } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAppStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      setSession(
        { accessToken: result.accessToken, refreshToken: result.refreshToken },
        result.user,
      );
      router.replace('/home');
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : 'Não foi possível entrar.',
      );
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <ScreenContainer>
      <ScreenHeader
        eyebrow="FITBEACON · ACESSO"
        subtitle="Entre para continuar seu treino."
        title="Bem-vindo de volta."
      />
      {formError ? (
        <Card>
          <ErrorState
            accessibilityLabel="Erro ao entrar"
            description={formError}
            onRetry={() => setFormError(null)}
            retryLabel="Corrigir dados"
            title="Não foi possível entrar"
          />
        </Card>
      ) : null}
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <AppTextInput
            accessibilityLabel="E-mail"
            autoComplete="email"
            autoCapitalize="none"
            error={fieldState.error?.message}
            keyboardType="email-address"
            label="E-mail"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="voce@email.com"
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <AppTextInput
            accessibilityLabel="Senha"
            autoComplete="password"
            error={fieldState.error?.message}
            label="Senha"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Sua senha"
            secureTextEntry
            secureToggle
            value={field.value}
          />
        )}
      />
      <Button
        accessibilityLabel="Entrar na conta"
        label="Entrar"
        loading={mutation.isPending}
        onPress={() => void onSubmit()}
      />
      <Toast
        accessibilityLabel="Conta necessária"
        message="Ainda não tem uma conta? Cadastre-se para começar."
        tone="info"
        visible={!formError}
      />
      <Link href="/register" asChild>
        <Button
          accessibilityLabel="Criar conta"
          label="Criar uma conta"
          onPress={() => undefined}
          variant="secondary"
        />
      </Link>
      <Link href="/gallery" asChild>
        <Button
          accessibilityLabel="Abrir galeria de componentes"
          label="Galeria de componentes"
          onPress={() => undefined}
          variant="ghost"
        />
      </Link>
      <Text
        style={{
          color: theme.colors.secondary,
          fontFamily: theme.typography.fontFamily.regular,
          fontSize: theme.typography.fontSize.xs,
          lineHeight: theme.typography.lineHeight.sm,
          textAlign: 'center',
        }}
      >
        Seus dados de acesso são transmitidos diretamente à API da academia.
      </Text>
    </ScreenContainer>
  );
}
