import { useEffect, useMemo, useState } from 'react';
import { AppState, Image, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Check, Pause, Play, Radio } from 'lucide-react-native';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Toast,
} from '../src/components';
import { AppTextInput } from '../src/components/AppTextInput';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useStudentBeacon } from '../src/student/StudentBeaconRuntime';
import { useAppStore } from '../src/state/store';
import { getWorkoutElapsedSeconds } from '../src/student/workoutClock';
import { useTheme } from '../src/theme/ThemeProvider';

const setSchema = z.object({
  load: z.coerce.number().finite().min(0, 'A carga não pode ser negativa.').max(2000),
  reps: z.coerce.number().int().min(1, 'Informe ao menos uma repetição.').max(1000),
});

type SetFormInput = z.input<typeof setSchema>;
type SetValues = z.infer<typeof setSchema>;

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export default function WorkoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    equipmentId?: string;
    exerciseId?: string;
    origin?: string;
  }>();
  const workout = useAppStore((state) => state.activeWorkout);
  const addWorkoutSet = useAppStore((state) => state.addWorkoutSet);
  const setWorkoutProgress = useAppStore((state) => state.setWorkoutProgress);
  const pauseWorkout = useAppStore((state) => state.pauseWorkout);
  const resumeWorkout = useAppStore((state) => state.resumeWorkout);
  const beacon = useStudentBeacon();
  const paused = workout?.timerStatus === 'paused';
  const startedAt = workout?.startedAt;
  const resumedAt = workout?.resumedAt ?? null;
  const accumulatedSeconds = workout?.accumulatedSeconds ?? 0;
  const pausedAt = workout?.pausedAt ?? null;
  const timerStatus = workout?.timerStatus;
  const [elapsedSeconds, setElapsedSeconds] = useState(
    () => workout ? getWorkoutElapsedSeconds(workout) : 0,
  );
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [localSaveFailed, setLocalSaveFailed] = useState(false);
  const [finishSaveFailed, setFinishSaveFailed] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const routeEquipmentId = typeof params.equipmentId === 'string' ? params.equipmentId : null;
  const routeExerciseId = typeof params.exerciseId === 'string' ? params.exerciseId : null;
  const routeExercise =
    workout &&
    routeEquipmentId === workout.equipment._id &&
    routeExerciseId
      ? workout.equipment.exerciseIds.find((item) => item._id === routeExerciseId)
      : undefined;
  const exercise =
    routeExercise ??
    workout?.equipment.exerciseIds.find((item) => item._id === workout.exerciseId) ??
    workout?.equipment.exerciseIds[workout.exerciseIndex];
  const goBack = (): void => {
    if (!workout) {
      router.back();
      return;
    }
    void beacon.checkpointWorkout()
      .catch(() => undefined)
      .finally(() => router.back());
  };
  const currentSets = useMemo(
    () => workout?.sets.filter((set) => set.exerciseId === exercise?._id) ?? [],
    [exercise?._id, workout?.sets],
  );
  const recommendedSets = exercise?.recommendedSets ?? 3;
  const recommendedReps = exercise?.recommendedReps ?? 12;
  const form = useForm<SetFormInput, undefined, SetValues>({
    resolver: zodResolver(setSchema),
    defaultValues: { load: 0, reps: recommendedReps },
  });

  useEffect(() => {
    if (!workout) {
      router.replace('/home');
    }
  }, [router, workout]);

  useEffect(() => {
    if (!workout || !routeExercise || routeExercise._id === workout.exerciseId) return;
    setWorkoutProgress({
      exerciseId: routeExercise._id,
      exerciseIndex: workout.equipment.exerciseIds.findIndex(
        (item) => item._id === routeExercise._id,
      ),
    });
  }, [routeExercise, setWorkoutProgress, workout]);

  useEffect(() => {
    if (!startedAt || !timerStatus) return;
    const updateElapsed = (): void => {
      setElapsedSeconds(getWorkoutElapsedSeconds({
        startedAt,
        resumedAt,
        accumulatedSeconds,
        pausedAt,
        timerStatus,
      }));
    };
    updateElapsed();
    if (timerStatus === 'paused') return;

    const timer = setInterval(updateElapsed, 1_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') updateElapsed();
    });
    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [
    startedAt,
    resumedAt,
    accumulatedSeconds,
    pausedAt,
    timerStatus,
  ]);

  useEffect(() => {
    if (restSeconds === null || restSeconds <= 0) return;
    const timer = setTimeout(
      () => setRestSeconds((remaining) => (remaining === null ? null : remaining - 1)),
      1_000,
    );
    return () => clearTimeout(timer);
  }, [restSeconds]);

  useEffect(() => {
    if (!sessionMessage) return;
    const timer = setTimeout(() => setSessionMessage(null), 2_000);
    return () => clearTimeout(timer);
  }, [sessionMessage]);

  const onSubmitSet = form.handleSubmit(async (values) => {
    if (!workout || !exercise || currentSets.length >= recommendedSets) return;
    addWorkoutSet({
      exerciseId: exercise._id,
      setNumber: currentSets.length + 1,
      load: values.load,
      reps: values.reps,
    });
    try {
      await beacon.checkpointWorkout();
      setLocalSaveFailed(false);
      setSessionMessage('set-registered');
    } catch {
      setLocalSaveFailed(true);
      return;
    }
    setRestSeconds(90);
    form.setValue('load', values.load);
    form.setValue('reps', recommendedReps);
  });

  const finishWorkout = async (): Promise<void> => {
    try {
      await beacon.finishSession();
      setLocalSaveFailed(false);
      setFinishSaveFailed(false);
    } catch {
      setLocalSaveFailed(true);
      setFinishSaveFailed(true);
    }
  };

  const isLastExercise =
    !!workout && workout.exerciseIndex >= workout.equipment.exerciseIds.length - 1;
  const retryConclusion =
    finishSaveFailed || beacon.sessionFeedback?.retryKind === 'conclusion';
  const showLocalRetry =
    localSaveFailed || beacon.sessionFeedback?.retryKind !== undefined;

  if (!workout) {
    return (
      <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
        <ScreenContainer>
          <EmptyState
            accessibilityLabel="Nenhum treino em andamento"
            description="Aproxime-se de um aparelho para iniciar uma sessão."
            title="Não há treino ativo"
          />
        </ScreenContainer>
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
        <ScreenContainer>
          <Pressable
            accessibilityLabel="Voltar ao equipamento"
            accessibilityRole="button"
            onPress={goBack}
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: theme.spacing.sm,
              minHeight: theme.sizes.controlHeight,
            }}
          >
            <ArrowLeft color={theme.colors.text} size={22} />
            <Text style={{ color: theme.colors.text }}>Voltar</Text>
          </Pressable>
          <ErrorState
            accessibilityLabel="Exercício indisponível"
            description="Este equipamento ainda não possui exercícios vinculados."
            onRetry={goBack}
            retryLabel="Voltar ao equipamento"
            title="Treino indisponível"
          />
        </ScreenContainer>
      </View>
    );
  }

  const imageUrl = exercise.media.imageUrl ?? workout.equipment.media.imageUrl;

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <Pressable
          accessibilityLabel="Voltar ao equipamento"
          accessibilityRole="button"
          onPress={goBack}
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            gap: theme.spacing.sm,
            minHeight: theme.sizes.controlHeight,
          }}
        >
          <ArrowLeft color={theme.colors.text} size={22} />
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.medium,
              fontSize: theme.typography.fontSize.sm,
            }}
          >
            Voltar
          </Text>
        </Pressable>
        <ScreenHeader
          eyebrow="FITBEACON · TREINO"
          subtitle={workout.equipment.name}
          title="Treino em andamento"
        />
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.xs,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          O treino é salvo automaticamente quando você se afasta do aparelho.
        </Text>
        <Card>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ gap: theme.spacing.xs }}>
              <Text
                style={{
                  color: theme.colors.secondary,
                  fontFamily: theme.typography.fontFamily.medium,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                Tempo de treino
              </Text>
              <Text
                accessibilityLabel={`Tempo de treino ${formatClock(elapsedSeconds)}`}
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.typography.fontFamily.bold,
                  fontSize: theme.typography.fontSize['3xl'],
                  lineHeight: theme.typography.lineHeight['3xl'],
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatClock(elapsedSeconds)}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={paused ? 'Continuar cronômetro' : 'Pausar cronômetro'}
              accessibilityRole="button"
              onPress={() => (paused ? resumeWorkout() : pauseWorkout())}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.pill,
                height: 52,
                justifyContent: 'center',
                width: 52,
              }}
            >
              {paused ? (
                <Play color={theme.colors.onPrimary} fill={theme.colors.onPrimary} size={22} />
              ) : (
                <Pause color={theme.colors.onPrimary} fill={theme.colors.onPrimary} size={22} />
              )}
            </Pressable>
          </View>
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            {imageUrl ? (
              <Image
                accessibilityLabel={`Demonstração de ${exercise.name}`}
                source={{ uri: imageUrl }}
                style={{
                  backgroundColor: theme.colors.elevated,
                  borderRadius: theme.radius.md,
                  height: 88,
                  width: 88,
                }}
              />
            ) : (
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: theme.colors.elevated,
                  borderRadius: theme.radius.md,
                  height: 88,
                  justifyContent: 'center',
                  width: 88,
                }}
              >
                <Radio color={theme.colors.primary} size={32} />
              </View>
            )}
            <View style={{ flex: 1, gap: theme.spacing.xs, justifyContent: 'center' }}>
              <Text
                style={{
                  color: theme.colors.secondary,
                  fontFamily: theme.typography.fontFamily.medium,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                Série {Math.min(currentSets.length + 1, recommendedSets)} de {recommendedSets}
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.typography.fontFamily.semiBold,
                  fontSize: theme.typography.fontSize.md,
                  lineHeight: theme.typography.lineHeight.md,
                }}
              >
                {exercise.name}
              </Text>
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.typography.fontFamily.medium,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {recommendedReps} repetições
              </Text>
            </View>
          </View>
        </Card>
        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.md,
              lineHeight: theme.typography.lineHeight.md,
            }}
          >
            Execução correta
          </Text>
          {(exercise.steps.length ? exercise.steps.slice(0, 4) : [
            'Mantenha a postura ereta',
            'Pés na largura dos ombros',
            'Desça até a amplitude confortável',
          ]).map((step, index) => (
            <View
              key={`${step}-${index}`}
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: theme.spacing.sm,
                minHeight: 40,
              }}
            >
              <Check color={theme.colors.success} size={20} strokeWidth={2.5} />
              <Text
                style={{
                  color: theme.colors.secondary,
                  flex: 1,
                  fontFamily: theme.typography.fontFamily.regular,
                  fontSize: theme.typography.fontSize.sm,
                  lineHeight: theme.typography.lineHeight.md,
                }}
              >
                {step}
              </Text>
            </View>
          ))}
        </Card>
        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.md,
            }}
          >
            Registrar série
          </Text>
          <Controller
            control={form.control}
            name="load"
            render={({ field, fieldState }) => (
              <AppTextInput
                accessibilityLabel="Carga em quilogramas"
                error={fieldState.error?.message}
                keyboardType="decimal-pad"
                label="Carga (kg)"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                value={String(field.value)}
              />
            )}
          />
          <Controller
            control={form.control}
            name="reps"
            render={({ field, fieldState }) => (
              <AppTextInput
                accessibilityLabel="Repetições realizadas"
                error={fieldState.error?.message}
                keyboardType="number-pad"
                label="Repetições realizadas"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                value={String(field.value)}
              />
            )}
          />
          {restSeconds !== null ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.elevated,
                borderRadius: theme.radius.md,
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
              }}
            >
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.typography.fontFamily.semiBold,
                  fontSize: theme.typography.fontSize.lg,
                }}
              >
                {restSeconds > 0
                  ? `Descanso · ${Math.floor(restSeconds / 60)}:${String(restSeconds % 60).padStart(2, '0')}`
                  : 'Descanso concluído'}
              </Text>
              <Button
                accessibilityLabel="Pular descanso"
                label="Pular descanso"
                onPress={() => setRestSeconds(null)}
                variant="ghost"
              />
            </View>
          ) : null}
          {currentSets.map((set) => (
            <Text
              key={`${set.exerciseId}-${set.setNumber}`}
              style={{
                color: theme.colors.success,
                fontFamily: theme.typography.fontFamily.medium,
                fontSize: theme.typography.fontSize.sm,
                lineHeight: theme.typography.lineHeight.md,
              }}
            >
              Série {set.setNumber}: {set.load} kg × {set.reps} repetições
            </Text>
          ))}
          {currentSets.length < recommendedSets ? (
            <Button
              accessibilityLabel="Finalizar série"
              label="Finalizar série"
              onPress={() => void onSubmitSet()}
            />
          ) : !isLastExercise ? (
            <Button
              accessibilityLabel="Próximo exercício"
              label="Próximo exercício"
              onPress={() => {
                const nextExercise = workout.equipment.exerciseIds[workout.exerciseIndex + 1];
                if (!nextExercise) return;
                setWorkoutProgress({
                  exerciseIndex: workout.exerciseIndex + 1,
                  exerciseId: nextExercise._id,
                });
                router.setParams({
                  equipmentId: workout.equipment._id,
                  exerciseId: nextExercise._id,
                  origin: workout.origin,
                });
                setRestSeconds(null);
              }}
              variant="secondary"
            />
          ) : (
            <Button
              accessibilityLabel="Finalizar treino e voltar ao início"
              label="Finalizar treino"
              onPress={() => void finishWorkout()}
            />
          )}
          {!isLastExercise ? (
            <Button
              accessibilityLabel="Finalizar treino e voltar ao início"
              label="Finalizar treino"
              onPress={() => void finishWorkout()}
              variant="secondary"
            />
          ) : null}
          <Toast
            accessibilityLabel="Aviso do treino"
            message="Série registrada."
            visible={sessionMessage === 'set-registered'}
          />
          {showLocalRetry ? (
            <Button
              accessibilityLabel="Tentar salvar o treino novamente"
              label="Tentar de novo"
              onPress={() => {
                if (retryConclusion) {
                  void beacon.retryFinish().catch(() => undefined);
                } else {
                  void beacon.checkpointWorkout()
                    .then(() => setLocalSaveFailed(false))
                    .catch(() => setLocalSaveFailed(true));
                }
              }}
              variant="secondary"
            />
          ) : null}
        </Card>
      </ScreenContainer>
    </View>
  );
}
