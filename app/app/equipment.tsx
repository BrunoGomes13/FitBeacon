import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  Toast,
  type TabItem,
} from '../src/components';
import { AppTextInput } from '../src/components/AppTextInput';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchEquipmentByBeacon } from '../src/api/services';
import type { Exercise } from '../src/api/schemas';
import { useAppStore } from '../src/state/store';
import { useStudentBeacon } from '../src/student/StudentBeaconRuntime';
import { useTheme } from '../src/theme/ThemeProvider';

type EquipmentTab = 'adjustments' | 'execution' | 'sets';

const equipmentTabs: readonly TabItem<EquipmentTab>[] = [
  { label: 'Regulagem', value: 'adjustments' },
  { label: 'Execução', value: 'execution' },
  { label: 'Séries', value: 'sets' },
];

const setSchema = z.object({
  load: z.coerce.number().finite().min(0, 'A carga não pode ser negativa.').max(2000),
  reps: z.coerce.number().int().min(1, 'Informe ao menos uma repetição.').max(1000),
});

type SetValues = z.infer<typeof setSchema>;
type SetFormInput = z.input<typeof setSchema>;

function MediaPreview({
  imageUrl,
  videoUrl,
}: {
  imageUrl?: string;
  videoUrl?: string;
}) {
  const theme = useTheme();
  const player = useVideoPlayer(videoUrl ?? null, (videoPlayer) => {
    if (videoUrl) {
      videoPlayer.loop = true;
      videoPlayer.muted = true;
      videoPlayer.play();
    }
  });

  if (videoUrl) {
    return (
      <VideoView
        accessibilityLabel="Vídeo de demonstração em loop"
        contentFit="cover"
        nativeControls
        player={player}
        style={{
          backgroundColor: theme.colors.elevated,
          borderRadius: theme.radius.lg,
          height: theme.spacing['6xl'] + theme.spacing['5xl'],
          width: '100%',
        }}
      />
    );
  }

  if (imageUrl) {
    return (
      <Image
        accessibilityLabel="Imagem ilustrativa do exercício"
        source={{ uri: imageUrl }}
        style={{
          backgroundColor: theme.colors.elevated,
          borderRadius: theme.radius.lg,
          height: theme.spacing['6xl'] + theme.spacing['5xl'],
          width: '100%',
        }}
      />
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.elevated,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        borderWidth: theme.sizes.border,
        height: theme.spacing['6xl'] + theme.spacing['5xl'],
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: theme.colors.primary,
          fontFamily: theme.typography.fontFamily.bold,
          fontSize: theme.typography.fontSize['3xl'],
          lineHeight: theme.typography.lineHeight['3xl'],
        }}
      >
        FIT
      </Text>
      <Text
        style={{
          color: theme.colors.secondary,
          fontFamily: theme.typography.fontFamily.regular,
          fontSize: theme.typography.fontSize.xs,
          lineHeight: theme.typography.lineHeight.sm,
        }}
      >
        Guia visual do movimento
      </Text>
    </View>
  );
}

function getExerciseId(exercise: Exercise): string {
  return exercise._id;
}

export default function EquipmentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    uuid?: string;
    major?: string;
    minor?: string;
  }>();
  const user = useAppStore((state) => state.user);
  const activeWorkout = useAppStore((state) => state.activeWorkout);
  const addWorkoutSet = useAppStore((state) => state.addWorkoutSet);
  const developerMode = useAppStore((state) => state.developerMode);
  const beaconRuntime = useStudentBeacon();
  const [activeTab, setActiveTab] = useState<EquipmentTab>('adjustments');
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const parsedBeacon = useMemo(
    () =>
      z
        .object({
          uuid: z.string().uuid(),
          major: z.coerce.number().int().min(0).max(65535),
          minor: z.coerce.number().int().min(0).max(65535),
        })
        .safeParse(params),
    [params],
  );
  const equipmentQuery = useQuery({
    queryKey: parsedBeacon.success
      ? [
          'equipment',
          parsedBeacon.data.uuid,
          parsedBeacon.data.major,
          parsedBeacon.data.minor,
        ]
      : ['equipment', 'invalid-beacon'],
    queryFn: () =>
      parsedBeacon.success
        ? fetchEquipmentByBeacon(parsedBeacon.data)
        : Promise.reject(new Error('Identificação do aparelho inválida.')),
    enabled: Boolean(user && parsedBeacon.success),
  });
  const equipment = equipmentQuery.data;
  const exercise = equipment?.exerciseIds[selectedExerciseIndex];
  const form = useForm<SetFormInput, undefined, SetValues>({
    resolver: zodResolver(setSchema),
    defaultValues: { load: 0, reps: 10 },
  });

  useEffect(() => {
    if (restSeconds === null || restSeconds <= 0) {
      return;
    }

    const timer = setTimeout(() => setRestSeconds((remaining) => (remaining ?? 1) - 1), 1_000);
    return () => clearTimeout(timer);
  }, [restSeconds]);

  const onSubmitSet = form.handleSubmit((values) => {
    if (!exercise) {
      return;
    }

    addWorkoutSet({
      exerciseId: getExerciseId(exercise),
      setNumber:
        (activeWorkout?.sets.filter(
          (set) => set.exerciseId === getExerciseId(exercise),
        ).length ?? 0) + 1,
      load: values.load,
      reps: values.reps,
    });
    setRestSeconds(90);
    form.setValue('load', values.load);
    setSessionMessage('Série registrada neste treino.');
  });

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <Button
          accessibilityLabel="Voltar para a tela inicial"
          label="Voltar"
          onPress={() => router.back()}
          variant="ghost"
        />
        {equipmentQuery.isLoading ? <Skeleton lines={3} /> : null}
        {equipmentQuery.isError ? (
          <Card>
            <ErrorState
              accessibilityLabel="Falha ao carregar o aparelho"
              description={equipmentQuery.error.message}
              onRetry={() => void equipmentQuery.refetch()}
              retryLabel="Tentar novamente"
              title="Não encontramos este aparelho"
            />
          </Card>
        ) : null}
        {equipment ? (
          <>
            <MediaPreview
              imageUrl={exercise?.media.imageUrl ?? equipment.media.imageUrl}
              videoUrl={exercise?.media.videoUrl}
            />
            <ScreenHeader
              eyebrow={equipment.areaId.name}
              subtitle={equipment.areaId.description}
              title={equipment.name}
            />
            {equipment.exerciseIds.length === 0 ? (
              <EmptyState
                accessibilityLabel="Aparelho sem exercícios cadastrados"
                description="A administração ainda não vinculou exercícios a este aparelho."
                title="Guia em preparação"
              />
            ) : (
              <Tabs
                accessibilityLabel="Seções do guia do aparelho"
                items={equipmentTabs}
                onChange={setActiveTab}
                value={activeTab}
              />
            )}
            {activeTab === 'adjustments' ? (
              <Card>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.fontFamily.semiBold,
                    fontSize: theme.typography.fontSize.lg,
                    lineHeight: theme.typography.lineHeight.lg,
                  }}
                >
                  Ajuste antes de começar
                </Text>
                {equipment.adjustments.length ? (
                  equipment.adjustments.map((adjustment, index) => (
                    <View
                      key={`${adjustment.name}-${index}`}
                      style={{
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.md,
                        borderWidth: theme.sizes.border,
                        gap: theme.spacing.xs,
                        padding: theme.spacing.md,
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
                        {index + 1}. {adjustment.name}
                      </Text>
                      <Text
                        style={{
                          color: theme.colors.secondary,
                          fontFamily: theme.typography.fontFamily.regular,
                          fontSize: theme.typography.fontSize.sm,
                          lineHeight: theme.typography.lineHeight.md,
                        }}
                      >
                        {adjustment.instructions}
                      </Text>
                    </View>
                  ))
                ) : (
                  <EmptyState
                    accessibilityLabel="Nenhuma regulagem cadastrada"
                    description="Você pode começar pelas instruções de execução."
                    title="Sem regulagens especiais"
                  />
                )}
              </Card>
            ) : null}
            {activeTab === 'execution' && exercise ? (
              <Card>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.fontFamily.semiBold,
                    fontSize: theme.typography.fontSize.lg,
                    lineHeight: theme.typography.lineHeight.lg,
                  }}
                >
                  {exercise.name} · {exercise.muscleGroup}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {equipment.exerciseIds.map((item, index) => (
                    <Button
                      accessibilityLabel={`Selecionar exercício ${item.name}`}
                      key={item._id}
                      label={item.name}
                      onPress={() => setSelectedExerciseIndex(index)}
                      variant={index === selectedExerciseIndex ? 'primary' : 'secondary'}
                    />
                  ))}
                </View>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.fontFamily.medium,
                    fontSize: theme.typography.fontSize.md,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  Execução passo a passo
                </Text>
                {exercise.steps.map((step, index) => (
                  <Text
                    key={`${step}-${index}`}
                    style={{
                      color: theme.colors.secondary,
                      fontFamily: theme.typography.fontFamily.regular,
                      fontSize: theme.typography.fontSize.sm,
                      lineHeight: theme.typography.lineHeight.lg,
                    }}
                  >
                    {index + 1}. {step}
                  </Text>
                ))}
                {exercise.commonMistakes.length ? (
                  <View
                    style={{
                      backgroundColor: theme.colors.elevated,
                      borderRadius: theme.radius.md,
                      gap: theme.spacing.sm,
                      padding: theme.spacing.md,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.warning,
                        fontFamily: theme.typography.fontFamily.semiBold,
                        fontSize: theme.typography.fontSize.sm,
                        lineHeight: theme.typography.lineHeight.md,
                      }}
                    >
                      Erros comuns
                    </Text>
                    {exercise.commonMistakes.map((mistake, index) => (
                      <Text
                        key={`${mistake}-${index}`}
                        style={{
                          color: theme.colors.text,
                          fontFamily: theme.typography.fontFamily.regular,
                          fontSize: theme.typography.fontSize.sm,
                          lineHeight: theme.typography.lineHeight.md,
                        }}
                      >
                        • {mistake}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <MediaPreview
                  imageUrl={exercise.media.imageUrl}
                  videoUrl={exercise.media.videoUrl}
                />
              </Card>
            ) : null}
            {activeTab === 'sets' && exercise ? (
              <Card>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.fontFamily.semiBold,
                    fontSize: theme.typography.fontSize.lg,
                    lineHeight: theme.typography.lineHeight.lg,
                  }}
                >
                  Séries · {exercise.name}
                </Text>
                <Text
                  style={{
                    color: theme.colors.secondary,
                    fontFamily: theme.typography.fontFamily.regular,
                    fontSize: theme.typography.fontSize.sm,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  Recomendação: {exercise.recommendedSets} séries de{' '}
                  {exercise.recommendedReps} repetições
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
                <Button
                  accessibilityLabel="Registrar série concluída"
                  label="Registrar série"
                  onPress={() => void onSubmitSet()}
                />
                {activeWorkout?.sets.map((set) => (
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
                      style={{
                        color: theme.colors.info,
                        fontFamily: theme.typography.fontFamily.semiBold,
                        fontSize: theme.typography.fontSize.lg,
                        lineHeight: theme.typography.lineHeight.lg,
                      }}
                    >
                      {restSeconds > 0
                        ? `Descanso · ${Math.floor(restSeconds / 60)}:${String(restSeconds % 60).padStart(2, '0')}`
                        : 'Descanso concluído'}
                    </Text>
                    <Button
                      accessibilityLabel="Encerrar temporizador de descanso"
                      label="Pular descanso"
                      onPress={() => setRestSeconds(null)}
                      variant="ghost"
                    />
                  </View>
                ) : null}
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
              </Card>
            ) : null}
            <Toast
              accessibilityLabel="Atualização da série ou treino"
              message={sessionMessage ?? ''}
              tone={sessionMessage?.startsWith('Não') ? 'error' : 'success'}
              visible={sessionMessage !== null}
            />
            {developerMode && beaconRuntime.isMock ? (
              <>
                <Button
                  accessibilityLabel="Simular saída do aparelho"
                  label="Simular afastamento"
                  onPress={() => beaconRuntime.simulate('exit')}
                  variant="ghost"
                />
                <Button
                  accessibilityLabel="Encerrar sessão agora"
                  label="Encerrar sessão agora"
                  onPress={beaconRuntime.forceEndSession}
                  variant="secondary"
                />
              </>
            ) : null}
          </>
        ) : null}
        {!equipment && equipmentQuery.isSuccess ? (
          <EmptyState
            accessibilityLabel="Aparelho sem dados disponíveis"
            description="A administração da academia ainda não cadastrou os detalhes deste aparelho."
            title="Conteúdo em preparação"
          />
        ) : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
