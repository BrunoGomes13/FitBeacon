import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Radio } from 'lucide-react-native';
import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../src/components';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { fetchAreas, fetchEquipments } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import { getEquipmentRoute } from '../src/student/homePresentation';

export default function EquipmentListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const params = useLocalSearchParams<{ areaId?: string }>();
  const routeAreaId = typeof params.areaId === 'string' ? params.areaId : undefined;
  const [areaSelection, setAreaSelection] = useState<
    { type: 'route' } | { type: 'all' } | { type: 'area'; id: string }
  >({ type: 'route' });
  const selectedAreaId =
    areaSelection.type === 'route'
      ? routeAreaId
      : areaSelection.type === 'area'
        ? areaSelection.id
        : undefined;
  const areasQuery = useQuery({
    queryKey: ['student', 'areas'],
    queryFn: fetchAreas,
    enabled: Boolean(user),
  });
  const equipmentQuery = useQuery({
    queryKey: ['student', 'equipment', selectedAreaId],
    queryFn: () => fetchEquipments(selectedAreaId),
    enabled: Boolean(user),
  });
  const selectedArea = useMemo(
    () => areasQuery.data?.find((area) => area._id === selectedAreaId),
    [areasQuery.data, selectedAreaId],
  );

  const openEquipment = (equipment: NonNullable<typeof equipmentQuery.data>[number]) => {
    router.push(getEquipmentRoute(equipment));
  };

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <ScreenHeader
          eyebrow="FITBEACON · ACADEMIA"
          subtitle={selectedArea?.name ?? 'Explore os aparelhos disponíveis na academia.'}
          title="Equipamentos"
        />
        {areasQuery.isLoading ? <Skeleton lines={2} /> : null}
        {areasQuery.isError ? (
          <Card>
            <ErrorState
              accessibilityLabel="Falha ao carregar filtros de área"
              description={areasQuery.error.message}
              onRetry={() => void areasQuery.refetch()}
              retryLabel="Tentar novamente"
              title="Não carregamos as áreas"
            />
          </Card>
        ) : null}
        {areasQuery.isSuccess && areasQuery.data.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Chip
              accessibilityLabel="Mostrar equipamentos de todas as áreas"
              label="Todas"
              onPress={() => setAreaSelection({ type: 'all' })}
              selected={areaSelection.type === 'all' || !selectedAreaId}
            />
            {areasQuery.data.map((area) => (
              <Chip
                accessibilityLabel={`Filtrar área ${area.name}`}
                key={area._id}
                label={area.name}
                onPress={() => setAreaSelection({ type: 'area', id: area._id })}
                selected={selectedAreaId === area._id}
              />
            ))}
          </View>
        ) : null}
        {equipmentQuery.isLoading ? <Skeleton lines={3} /> : null}
        {equipmentQuery.isError ? (
          <Card>
            <ErrorState
              accessibilityLabel="Falha ao carregar equipamentos"
              description={equipmentQuery.error.message}
              onRetry={() => void equipmentQuery.refetch()}
              retryLabel="Tentar novamente"
              title="Não carregamos os equipamentos"
            />
          </Card>
        ) : null}
        {equipmentQuery.isSuccess && equipmentQuery.data.length === 0 ? (
          <Card>
            <EmptyState
              accessibilityLabel="Nenhum equipamento encontrado"
              description={
                selectedArea
                  ? `Ainda não há equipamentos ativos em ${selectedArea.name}.`
                  : 'Os equipamentos ativos da academia aparecerão aqui.'
              }
              title="Nenhum equipamento disponível"
            />
          </Card>
        ) : null}
        {equipmentQuery.isSuccess
          ? equipmentQuery.data.map((equipment) => (
              <Pressable
                accessibilityLabel={`Abrir ${equipment.name}, área ${equipment.areaId.name}`}
                accessibilityRole="button"
                key={equipment._id}
                onPress={() => openEquipment(equipment)}
                style={({ pressed }) => ({
                  opacity: pressed ? theme.interactionOpacity.pressed : 1,
                })}
              >
                <Card>
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: theme.spacing.md,
                    }}
                  >
                    <View
                      style={{
                        alignItems: 'center',
                        backgroundColor: theme.colors.elevated,
                        borderRadius: theme.radius.md,
                        height: 56,
                        justifyContent: 'center',
                        width: 56,
                      }}
                    >
                      <Radio color={theme.colors.primary} size={28} />
                    </View>
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontFamily: theme.typography.fontFamily.semiBold,
                          fontSize: theme.typography.fontSize.md,
                          lineHeight: theme.typography.lineHeight.md,
                        }}
                      >
                        {equipment.name}
                      </Text>
                      <Text
                        style={{
                          color: theme.colors.secondary,
                          fontFamily: theme.typography.fontFamily.regular,
                          fontSize: theme.typography.fontSize.sm,
                          lineHeight: theme.typography.lineHeight.md,
                        }}
                      >
                        {equipment.areaId.name} · Equipamento{' '}
                        {String(equipment.beacon.minor).padStart(2, '0')}
                      </Text>
                    </View>
                    <ChevronRight color={theme.colors.secondary} size={20} />
                  </View>
                  {equipment.exerciseIds.length ? (
                    <Text
                      style={{
                        color: theme.colors.secondary,
                        fontFamily: theme.typography.fontFamily.regular,
                        fontSize: theme.typography.fontSize.xs,
                        lineHeight: theme.typography.lineHeight.md,
                      }}
                    >
                      {equipment.exerciseIds.length} exercício
                      {equipment.exerciseIds.length === 1 ? '' : 's'} guiado
                      {equipment.exerciseIds.length === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            ))
          : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
