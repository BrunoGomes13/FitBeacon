import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Settings2 } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
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
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { fetchEquipmentByBeacon, fetchGymEquipment } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useStudentBeacon } from '../src/student/StudentBeaconRuntime';
import { getWorkoutRoute } from '../src/student/workoutPresentation';
import { useTheme } from '../src/theme/ThemeProvider';

type EquipmentTab = 'adjustments' | 'execution';

const equipmentTabs: readonly TabItem<EquipmentTab>[] = [
  { label: 'Regulagem', value: 'adjustments' },
  { label: 'Execução', value: 'execution' },
];

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
          height: 220,
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
          height: 220,
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
        height: 220,
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

export default function EquipmentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    equipmentId?: string;
    uuid?: string;
    major?: string;
    minor?: string;
  }>();
  const user = useAppStore((state) => state.user);
  const equipmentId = typeof params.equipmentId === 'string' ? params.equipmentId : undefined;
  const hasActiveWorkoutForEquipment = useAppStore(
    (state) => state.activeWorkout?.equipment._id === equipmentId,
  );
  const beaconRuntime = useStudentBeacon();
  const [activeTab, setActiveTab] = useState<EquipmentTab>('adjustments');
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(0);
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
    queryKey: equipmentId
      ? ['equipment', 'id', equipmentId]
      : parsedBeacon.success
      ? [
          'equipment',
          parsedBeacon.data.uuid,
          parsedBeacon.data.major,
          parsedBeacon.data.minor,
        ]
      : ['equipment', 'invalid-beacon'],
    queryFn: async () => {
      if (equipmentId) {
        const equipmentList = await fetchGymEquipment();
        const selected = equipmentList.find((item) => item._id === equipmentId);
        if (!selected) throw new Error('O equipamento escolhido não foi encontrado.');
        return selected;
      }
      if (!parsedBeacon.success) throw new Error('Identificação do aparelho inválida.');
      return fetchEquipmentByBeacon(parsedBeacon.data);
    },
    enabled: Boolean(user && (equipmentId || parsedBeacon.success)),
  });
  const equipment = equipmentQuery.data;
  const exercise = equipment?.exerciseIds[selectedExerciseIndex];
  const goBack = (): void => {
    router.back();
  };
  const startWorkout = async (): Promise<void> => {
    if (!equipment || !exercise) return;
    try {
      await beaconRuntime.startWorkout(equipment, exercise._id);
      const workout = useAppStore.getState().activeWorkout;
      if (!workout) throw new Error('O treino não ficou ativo.');
      router.push(getWorkoutRoute(workout));
    } catch (error) {
      setSessionMessage(
        error instanceof Error ? 'Não foi possível iniciar o treino. Tente novamente.' : 'Não foi possível iniciar o treino.',
      );
    }
  };
  useEffect(() => {
    if (!sessionMessage) return;
    const timer = setTimeout(() => setSessionMessage(null), 3_000);
    return () => clearTimeout(timer);
  }, [sessionMessage]);

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <Pressable
          accessibilityLabel="Voltar para a tela anterior"
        accessibilityRole="button"
          onPress={goBack}
        style={{
          alignItems: 'center',
          alignSelf: 'flex-start',
          flexDirection: 'row',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.controlHeight,
          minWidth: theme.sizes.controlHeight,
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
          Equipamento próximo
        </Text>
        </Pressable>
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
              subtitle={`Área: ${equipment.areaId.name}  |  Equipamento: ${String(equipment.beacon.minor).padStart(2, '0')}`}
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
                  Regulagem do equipamento
                </Text>
                {equipment.adjustments.length ? (
                  equipment.adjustments.map((adjustment, index) => (
                    <View
                      key={`${adjustment.name}-${index}`}
                      style={{
                        borderBottomColor: theme.colors.border,
                        borderBottomWidth:
                          index === equipment.adjustments.length - 1
                            ? 0
                            : theme.sizes.border,
                        gap: theme.spacing.xs,
                        paddingVertical: theme.spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          alignItems: 'center',
                          flexDirection: 'row',
                          gap: theme.spacing.sm,
                        }}
                      >
                        <Settings2 color={theme.colors.primary} size={20} />
                        <Text
                          style={{
                            color: theme.colors.text,
                            flex: 1,
                            fontFamily: theme.typography.fontFamily.semiBold,
                            fontSize: theme.typography.fontSize.sm,
                            lineHeight: theme.typography.lineHeight.md,
                          }}
                        >
                          {adjustment.name}
                        </Text>
                        <ChevronRight color={theme.colors.secondary} size={18} />
                      </View>
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
            {exercise ? (
              <Card>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.typography.fontFamily.semiBold,
                    fontSize: theme.typography.fontSize.md,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  Séries e repetições
                </Text>
                <View
                  style={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: theme.spacing.md,
                    minHeight: theme.sizes.controlHeight,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.primary,
                      flex: 1,
                      fontFamily: theme.typography.fontFamily.medium,
                      fontSize: theme.typography.fontSize.sm,
                      lineHeight: theme.typography.lineHeight.md,
                    }}
                  >
                    {exercise.recommendedSets} séries de {exercise.recommendedReps} repetições
                  </Text>
                  <ChevronRight color={theme.colors.primary} size={20} />
                </View>
              </Card>
            ) : null}
            <Button
              accessibilityLabel="Iniciar treino"
              label={
                hasActiveWorkoutForEquipment
                  ? 'Retomar treino'
                  : 'Iniciar treino'
              }
              onPress={() => void startWorkout()}
            />
            <Toast
              accessibilityLabel="Atualização da série ou treino"
              message={sessionMessage ?? ''}
              tone={sessionMessage?.startsWith('Não') ? 'error' : 'success'}
              visible={sessionMessage !== null}
            />
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
    </View>
  );
}
