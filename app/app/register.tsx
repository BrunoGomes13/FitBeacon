import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BottomSheet,
  BrandLockup,
  Button,
  Card,
  ErrorState,
} from '../src/components';
import { AppTextInput } from '../src/components/AppTextInput';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { register } from '../src/api/services';
import { formatCpfInput } from '../src/api/cpf';
import { registerSchema } from '../src/api/accountValidation';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAppStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [consentTextVisible, setConsentTextVisible] = useState(false);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      cpf: '',
      password: '',
      confirmPassword: '',
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
    mutation.mutate({
      name: values.name,
      email: values.email,
      cpf: values.cpf,
      password: values.password,
      gymId: values.gymId,
      consentTracking: values.consentTracking,
    });
  });

  return (
    <ScreenContainer>
      <Pressable
        accessibilityLabel="Voltar para o login"
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
          Criar conta
        </Text>
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Preencha os dados para começar sua jornada.
        </Text>
      </View>
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
            label="Nome completo"
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
        name="cpf"
        render={({ field, fieldState }) => (
          <AppTextInput
            accessibilityLabel="CPF"
            error={fieldState.error?.message}
            keyboardType="number-pad"
            label="CPF"
            onBlur={field.onBlur}
            onChangeText={(value) => field.onChange(formatCpfInput(value))}
            placeholder="000.000.000-00"
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
            label="Senha"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Mínimo de 12 caracteres"
            secureTextEntry
            secureToggle
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <AppTextInput
            accessibilityLabel="Confirmar senha"
            autoComplete="new-password"
            error={fieldState.error?.message}
            label="Confirmar senha"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Digite a senha novamente"
            secureTextEntry
            secureToggle
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="consentTracking"
        render={({ field }) => (
          <View style={{ gap: theme.spacing.xs }}>
            <Pressable
              accessibilityLabel="Consentir com registro de atividade"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: field.value }}
              onPress={() => field.onChange(!field.value)}
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: theme.spacing.md,
                minHeight: theme.sizes.controlHeight,
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
                  height: 24,
                  justifyContent: 'center',
                  width: 24,
                }}
              >
                {field.value ? (
                  <Text style={{ color: theme.colors.onPrimary, fontSize: 16 }}>✓</Text>
                ) : null}
              </View>
              <Text
                style={{
                  color: theme.colors.text,
                  flex: 1,
                  fontFamily: theme.typography.fontFamily.regular,
                  fontSize: theme.typography.fontSize.sm,
                  lineHeight: theme.typography.lineHeight.md,
                }}
              >
                Concordo com o registro das minhas atividades para acompanhar meus treinos.
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => setConsentTextVisible(true)}
              style={{
                alignSelf: 'flex-start',
                justifyContent: 'center',
                minHeight: theme.sizes.controlHeight,
              }}
            >
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.typography.fontFamily.semiBold,
                  fontSize: theme.typography.fontSize.sm,
                  lineHeight: theme.typography.lineHeight.md,
                }}
              >
                Ler o texto de consentimento LGPD
              </Text>
            </Pressable>
          </View>
        )}
      />
      <Button
        accessibilityLabel="Cadastrar"
        label="Cadastrar"
        loading={mutation.isPending}
        onPress={() => void onSubmit()}
      />
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          minHeight: theme.sizes.controlHeight,
        }}
      >
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.sm,
          }}
        >
          Já tem uma conta?{' '}
        </Text>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="link" style={{ justifyContent: 'center', minHeight: 48 }}>
            <Text
              style={{
                color: theme.colors.primary,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              Entrar
            </Text>
          </Pressable>
        </Link>
      </View>
      <BottomSheet
        accessibilityLabel="Texto de consentimento LGPD"
        onClose={() => setConsentTextVisible(false)}
        title="Consentimento para dados de atividade"
        visible={consentTextVisible}
      >
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          Com sua autorização, o FitBeacon identifica equipamentos próximos por Bluetooth
          e registra os horários, a duração e as séries dos seus treinos para exibir seu
          histórico. Esses dados são usados para as funcionalidades do aplicativo e
          podem ser removidos da coleta ao revogar o consentimento em Perfil. O cadastro
          pode ser concluído sem consentir, mas o rastreamento e o registro de sessões
          ficarão desativados.
        </Text>
      </BottomSheet>
    </ScreenContainer>
  );
}
