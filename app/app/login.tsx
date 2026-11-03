import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BrandLockup, Button, Card, ErrorState } from '../src/components';
import { AppTextInput } from '../src/components/AppTextInput';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { login } from '../src/api/services';
import { loginSchema } from '../src/api/accountValidation';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAppStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      setSession(
        { accessToken: result.accessToken, refreshToken: result.refreshToken },
        result.user,
        rememberMe,
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
      <BrandLockup variant="full" />
      <View style={{ gap: theme.spacing.xs }}>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize['2xl'],
            lineHeight: theme.typography.lineHeight['2xl'],
          }}
        >
          Bem-vindo de volta!
        </Text>
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Faça login para continuar.
        </Text>
      </View>
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
        name="identifier"
        render={({ field, fieldState }) => (
          <AppTextInput
            accessibilityLabel="E-mail ou CPF"
            autoComplete="username"
            autoCapitalize="none"
            error={fieldState.error?.message}
            keyboardType="default"
            label="E-mail ou CPF"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="voce@email.com ou CPF"
            value={field.value}
            textContentType="username"
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
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          minHeight: theme.sizes.controlHeight,
        }}
      >
        <Pressable
          accessibilityLabel="Lembrar-me"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberMe }}
          onPress={() => setRememberMe((current) => !current)}
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            gap: theme.spacing.sm,
            minHeight: theme.sizes.controlHeight,
          }}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: rememberMe ? theme.colors.primary : theme.colors.surface,
              borderColor: rememberMe ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.radius.md,
              borderWidth: theme.sizes.border,
              height: 22,
              justifyContent: 'center',
              width: 22,
            }}
          >
            {rememberMe ? (
              <Text style={{ color: theme.colors.onPrimary, fontSize: 14 }}>✓</Text>
            ) : null}
          </View>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.medium,
              fontSize: theme.typography.fontSize.sm,
              lineHeight: theme.typography.lineHeight.md,
            }}
          >
            Lembrar-me
          </Text>
        </Pressable>
        <Link href="/forgot-password" asChild>
          <Pressable
            accessibilityRole="link"
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              minHeight: theme.sizes.controlHeight,
              paddingLeft: theme.spacing.sm,
            }}
          >
            <Text
              style={{
                color: theme.colors.primary,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.xs,
                lineHeight: theme.typography.lineHeight.md,
              }}
            >
              Esqueceu sua senha?
            </Text>
          </Pressable>
        </Link>
      </View>
      <Button
        accessibilityLabel="Entrar na conta"
        label="Entrar"
        loading={mutation.isPending}
        onPress={() => void onSubmit()}
      />
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ backgroundColor: theme.colors.border, flex: 1, height: 1 }} />
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.medium,
            fontSize: theme.typography.fontSize.sm,
          }}
        >
          ou
        </Text>
        <View style={{ backgroundColor: theme.colors.border, flex: 1, height: 1 }} />
      </View>
      <Link href="/register" asChild>
        <Button
          accessibilityLabel="Criar conta"
          label="Cadastrar"
          onPress={() => undefined}
          variant="secondary"
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
        Acesse sua jornada de treino com segurança.
      </Text>
    </ScreenContainer>
  );
}
