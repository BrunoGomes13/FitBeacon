import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, ErrorState } from '../src/components';
import { AppTextInput } from '../src/components/AppTextInput';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { register } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(12, 'Use pelo menos 12 caracteres.').max(128),
  gymId: z.string().regex(/^[a-f\d]{24}$/i, 'Informe o ID válido da sua academia.'),
  consentTracking: z.boolean(),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAppStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      gymId: process.env.EXPO_PUBLIC_GYM_ID ?? '',
      consentTracking: false,
    },
  });
  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (result) => {
      setSession(
        { accessToken: result.accessToken, refreshToken: result.refreshToken },
        result.user,
      );
      router.replace('/home');
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : 'Não foi possível criar a conta.',
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
        eyebrow="FITBEACON · NOVA CONTA"
        subtitle="Crie seu acesso de aluno para sua academia."
        title="Comece seu próximo treino."
      />
      {formError ? (
        <Card>
          <ErrorState
            accessibilityLabel="Erro ao criar conta"
            description={formError}
            onRetry={() => setFormError(null)}
            retryLabel="Revisar cadastro"
            title="Não foi possível criar a conta"
          />
        </Card>
      ) : null}
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <AppTextInput
            accessibilityLabel="Nome completo"
            autoCapitalize="words"
            autoComplete="name"
            error={fieldState.error?.message}
            label="Nome"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Seu nome"
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <AppTextInput
            accessibilityLabel="E-mail"
            autoComplete="email"
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
            accessibilityLabel="Senha com no mínimo 12 caracteres"
            autoComplete="new-password"
            error={fieldState.error?.message}
            label="Senha (mínimo 12 caracteres)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Crie uma senha"
            secureTextEntry
            secureToggle
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="gymId"
        render={({ field, fieldState }) => (
          <AppTextInput
            accessibilityLabel="ID da academia"
            autoCapitalize="none"
            autoCorrect={false}
            error={fieldState.error?.message}
            label="ID da academia"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="24 caracteres hexadecimais"
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="consentTracking"
        render={({ field }) => (
          <Pressable
            accessibilityLabel="Consentir com registro de atividade"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: field.value }}
            onPress={() => field.onChange(!field.value)}
            style={{
              alignItems: 'flex-start',
              flexDirection: 'row',
              gap: theme.spacing.md,
              minHeight: theme.sizes.controlHeight,
              paddingVertical: theme.spacing.sm,
            }}
          >
            <View
              style={{
                alignItems: 'center',
                backgroundColor: field.value
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderColor: field.value ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.radius.md,
                borderWidth: theme.sizes.border,
                height: theme.sizes.controlHeight,
                justifyContent: 'center',
                width: theme.sizes.controlHeight,
              }}
            >
              {field.value ? (
                <Text
                  style={{
                    color: theme.colors.onPrimary,
                    fontFamily: theme.typography.fontFamily.bold,
                    fontSize: theme.typography.fontSize.md,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  ✓
                </Text>
              ) : null}
            </View>
            <Text
              style={{
                color: theme.colors.secondary,
                flex: 1,
                fontFamily: theme.typography.fontFamily.regular,
                fontSize: theme.typography.fontSize.sm,
                lineHeight: theme.typography.lineHeight.md,
                paddingTop: theme.spacing.sm,
              }}
            >
              Concordo com a coleta de dados de uso para acompanhar meus treinos. Posso
              revogar esse consentimento nas configurações.
            </Text>
          </Pressable>
        )}
      />
      <Button
        accessibilityLabel="Criar conta de aluno"
        label="Criar conta"
        loading={mutation.isPending}
        onPress={() => void onSubmit()}
      />
      <Text
        style={{
          color: theme.colors.secondary,
          fontFamily: theme.typography.fontFamily.regular,
          fontSize: theme.typography.fontSize.xs,
          lineHeight: theme.typography.lineHeight.md,
        }}
      >
        O ID da academia é fornecido pela administração. O consentimento é opcional para
        criar a conta, mas necessário para detectar aparelhos e salvar sessões.
      </Text>
      <Link href="/login" asChild>
        <Button
          accessibilityLabel="Já tenho uma conta"
          label="Já tenho uma conta"
          onPress={() => undefined}
          variant="secondary"
        />
      </Link>
    </ScreenContainer>
  );
}
