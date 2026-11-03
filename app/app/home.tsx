import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Activity,
  Bell,
  Bike,
  Dumbbell,
  Radio,
  UserRound,
  Zap,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../src/components';
import { BrandLockup } from '../src/components/BrandLockup';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchAllTrainingSessions, fetchAreas } from '../src/api/services';
import { formatDurationMinutes, getTrainingProgress, type TrainingPeriod } from '../src/api/trainingProgress';
import type { Area } from '../src/api/schemas';
import { useStudentBeacon } from '../src/student/StudentBeaconRuntime';
import {
  getEquipmentRoute,
  shouldShowNearbyEquipmentBanner,
} from '../src/student/homePresentation';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

function AreaIcon({ name, color }: { name: string; color: string }) {
  const normalized = name.toLocaleLowerCase('pt-BR');
  const Icon = normalized.includes('cardio')
    ? Bike
    : normalized.includes('funcional')
      ? Zap
      : normalized.includes('livre')
        ? Activity
        : Dumbbell;

  return <Icon color={color} size={22} strokeWidth={1.8} />;
}

function ProgressMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        borderRightColor: theme.colors.border,
        borderRightWidth: label === 'Séries' ? 0 : theme.sizes.border,
        flex: 1,
        gap: theme.spacing.xs,
        justifyContent: 'center',
        minHeight: 72,
        paddingHorizontal: theme.spacing.xs,
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.bold,
          fontSize: theme.typography.fontSize.lg,
          lineHeight: theme.typography.lineHeight.lg,
          textAlign: 'center',
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: theme.colors.secondary,
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: theme.typography.fontSize.xs,
          lineHeight: theme.typography.lineHeight.sm,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: theme.colors.secondary,
          fontFamily: theme.typography.fontFamily.regular,
          fontSize: 10,
          lineHeight: 14,
          textAlign: 'center',
        }}
      >
        {detail}
      </Text>
    </View>
  );
}

function AreaTile({ area, onPress }: { area: Area; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={`Ver equipamentos da área ${area.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        borderWidth: theme.sizes.border,
        flexDirection: 'row',
        gap: theme.spacing.sm,
        minHeight: 64,
        opacity: pressed ? theme.interactionOpacity.pressed : 1,
        paddingHorizontal: theme.spacing.md,
        width: '48%',
      })}
    >
      <AreaIcon color={theme.colors.primary} name={area.name} />
      <Text
        numberOfLines={2}
        style={{
          color: theme.colors.text,
          flex: 1,
          fontFamily: theme.typography.fontFamily.semiBold,
          fontSize: theme.typography.fontSize.sm,
          lineHeight: theme.typography.lineHeight.md,
        }}
      >
        {area.name}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const consent = useAppStore((state) => state.trackingConsent);
  const developerMode = useAppStore((state) => state.developerMode);
  const beacon = useStudentBeacon();
  const detectedEquipment = useAppStore((state) => state.detectedEquipment);
  const [period, setPeriod] = useState<TrainingPeriod>('week');
  const areasQuery = useQuery({
    queryKey: ['student', 'areas'],
    queryFn: fetchAreas,
    enabled: Boolean(user),
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: fetchAllTrainingSessions,
    enabled: Boolean(user),
  });
  const progress = sessionsQuery.data
    ? getTrainingProgress(sessionsQuery.data, period)
    : null;
  const firstName = user?.name.trim().split(/\s+/)[0] ?? 'atleta';

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            gap: theme.spacing.sm,
            justifyContent: 'space-between',
          }}
        >
          <BrandLockup variant="home" />
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.xs }}>
            <Pressable
              accessibilityLabel="Notificações"
              accessibilityRole="button"
              onPress={() => router.push('/history')}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: theme.sizes.controlHeight,
                minWidth: theme.sizes.controlHeight,
              }}
            >
              <Bell color={theme.colors.text} size={22} />
            </Pressable>
            <Pressable
              accessibilityLabel="Abrir perfil"
              accessibilityRole="button"
              onPress={() => router.push('/profile')}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.elevated,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.pill,
                borderWidth: theme.sizes.border,
                height: 44,
                justifyContent: 'center',
                width: 44,
              }}
            >
              <UserRound color={theme.colors.text} size={20} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.bold,
              fontSize: theme.typography.fontSize.xl,
              lineHeight: theme.typography.lineHeight.xl,
            }}
          >
            Olá, {firstName}! 👋
          </Text>
          <Text
            style={{
              color: theme.colors.secondary,
              fontFamily: theme.typography.fontFamily.medium,
              fontSize: theme.typography.fontSize.md,
              lineHeight: theme.typography.lineHeight.md,
            }}
          >
            Bora treinar hoje?
          </Text>
        </View>

        {shouldShowNearbyEquipmentBanner(detectedEquipment) ? (
          <LinearGradient
            colors={[theme.colors.primaryStart, theme.colors.primaryEnd]}
            end={{ x: 1, y: 0 }}
            start={{ x: 0, y: 0 }}
            style={{
              alignItems: 'center',
              borderRadius: theme.radius.lg,
              flexDirection: 'row',
              gap: theme.spacing.md,
              minHeight: 112,
              padding: theme.spacing.md,
            }}
          >
            <Radio color={theme.colors.onPrimary} size={40} strokeWidth={1.6} />
            <View style={{ flex: 1, gap: theme.spacing.sm }}>
              <Text
                style={{
                  color: theme.colors.onPrimary,
                  flexShrink: 1,
                  fontFamily: theme.typography.fontFamily.semiBold,
                  fontSize: theme.typography.fontSize.md,
                  lineHeight: theme.typography.lineHeight.md,
                }}
              >
                Você está próximo de um equipamento!
              </Text>
              <Button
                accessibilityLabel="Ver equipamento próximo"
                label="Ver equipamento"
                onPress={() => router.push(getEquipmentRoute(detectedEquipment))}
                variant="secondary"
              />
            </View>
          </LinearGradient>
        ) : null}

        {beacon.status === 'error' ? (
          <Card>
            <ErrorState
              accessibilityLabel="Erro na detecção de aparelhos"
              description={beacon.message ?? 'Confira o Bluetooth e tente novamente.'}
              onRetry={() => router.push('/profile')}
              retryLabel="Ver configurações"
              title="Não estamos procurando aparelhos"
            />
          </Card>
        ) : null}

        {!consent ? (
          <Card>
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.md,
                lineHeight: theme.typography.lineHeight.md,
              }}
            >
              Ative o consentimento para detectar aparelhos e salvar seus treinos.
            </Text>
            <Button
              accessibilityLabel="Configurar consentimento"
              label="Configurar consentimento"
              onPress={() => router.push('/profile')}
              variant="secondary"
            />
          </Card>
        ) : null}

        <View style={{ gap: theme.spacing.md }}>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: theme.typography.fontFamily.bold,
                fontSize: theme.typography.fontSize.lg,
                lineHeight: theme.typography.lineHeight.lg,
              }}
            >
              Seu progresso
            </Text>
            <Pressable
              accessibilityLabel={`Período: ${period === 'week' ? 'esta semana' : 'este mês'}. Toque para alterar`}
              accessibilityRole="button"
              onPress={() => setPeriod((current) => (current === 'week' ? 'month' : 'week'))}
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                minHeight: theme.sizes.controlHeight,
                paddingHorizontal: theme.spacing.xs,
              }}
            >
              <Text
                style={{
                  color: theme.colors.secondary,
                  fontFamily: theme.typography.fontFamily.medium,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {period === 'week' ? 'Esta semana' : 'Este mês'} ›
              </Text>
            </Pressable>
          </View>
          <Card>
            {sessionsQuery.isLoading ? (
              <Skeleton lines={3} />
            ) : sessionsQuery.isError ? (
              <ErrorState
                accessibilityLabel="Erro ao carregar progresso"
                description={sessionsQuery.error.message}
                onRetry={() => void sessionsQuery.refetch()}
                retryLabel="Tentar novamente"
                title="Não carregamos seu progresso"
              />
            ) : sessionsQuery.isSuccess && progress ? (
              <View style={{ flexDirection: 'row' }}>
                <ProgressMetric
                  detail="concluídos"
                  label="Treinos"
                  value={String(progress.workouts)}
                />
                <ProgressMetric
                  detail="de treino"
                  label="Tempo total"
                  value={formatDurationMinutes(progress.durationMinutes)}
                />
                <ProgressMetric
                  detail="registradas"
                  label="Séries"
                  value={String(progress.sets)}
                />
              </View>
            ) : (
              <EmptyState
                accessibilityLabel="Seu progresso ainda está vazio"
                description="Seu resumo aparece aqui quando você registrar o primeiro treino."
                title="Comece seu primeiro treino"
              />
            )}
          </Card>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.bold,
              fontSize: theme.typography.fontSize.lg,
              lineHeight: theme.typography.lineHeight.lg,
            }}
          >
            Áreas da academia
          </Text>
          {areasQuery.isLoading ? <Skeleton lines={2} /> : null}
          {areasQuery.isError ? (
            <Card>
              <ErrorState
                accessibilityLabel="Erro ao carregar áreas"
                description={areasQuery.error.message}
                onRetry={() => void areasQuery.refetch()}
                retryLabel="Tentar novamente"
                title="Não carregamos as áreas"
              />
            </Card>
          ) : null}
          {areasQuery.isSuccess && areasQuery.data.length === 0 ? (
            <Card>
              <EmptyState
                accessibilityLabel="Nenhuma área cadastrada"
                description="As áreas da academia serão exibidas aqui quando estiverem disponíveis."
                title="Nenhuma área disponível"
              />
            </Card>
          ) : null}
          {areasQuery.isSuccess && areasQuery.data.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {areasQuery.data.map((area) => (
                <AreaTile
                  area={area}
                  key={area._id}
                  onPress={() => router.push(`/equipment-list?areaId=${area._id}`)}
                />
              ))}
            </View>
          ) : null}
        </View>

        {developerMode && beacon.isMock ? (
          <Card>
            <Text
              style={{
                color: theme.colors.warning,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.md,
              }}
            >
              Modo desenvolvedor · Mock ativo
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Button
                accessibilityLabel="Simular aproximação do aparelho"
                label="Aproximar"
                onPress={() => beacon.simulate('approach')}
                variant="secondary"
              />
              <Button
                accessibilityLabel="Simular afastamento do aparelho"
                disabled={!beacon.canSimulateExit}
                label={beacon.canSimulateExit ? 'Afastar' : 'Sem sessão ativa'}
                onPress={() => beacon.simulate('exit')}
                variant="secondary"
              />
              <Button
                accessibilityLabel="Abrir diagnóstico de beacons"
                label="Diagnóstico"
                onPress={() => router.push('/diagnostics')}
                variant="ghost"
              />
            </View>
          </Card>
        ) : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
