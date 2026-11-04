import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MapPinned, Radio, Search, Signal } from 'lucide-react-native';
import {
  Card,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../src/components';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { fetchAreas, fetchGymEquipment } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import { getEquipmentRoute } from '../src/student/homePresentation';
import {
  filterEquipment,
  getEquipmentAreaFilter,
  type EquipmentAreaFilter,
} from '../src/student/equipmentPresentation';

export default function EquipmentListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const params = useLocalSearchParams<{ areaId?: string }>();
  const routeAreaId = typeof params.areaId === 'string' ? params.areaId : undefined;
  const [search, setSearch] = useState('');
  const [areaChip, setAreaChip] = useState<EquipmentAreaFilter>('Todos');
  const [showAllRouteAreas, setShowAllRouteAreas] = useState(false);
  const selectedAreaId = showAllRouteAreas ? undefined : routeAreaId;
  const areasQuery = useQuery({
    queryKey: ['student', 'areas'],
    queryFn: fetchAreas,
    enabled: Boolean(user),
  });
  const equipmentQuery = useQuery({
    queryKey: ['student', 'equipment'],
    queryFn: fetchGymEquipment,
    enabled: Boolean(user),
  });
  const selectedArea = useMemo(
    () => areasQuery.data?.find((area) => area._id === selectedAreaId),
    [areasQuery.data, selectedAreaId],
  );
  const selectedChip = routeAreaId && !showAllRouteAreas && areaChip === 'Todos' && selectedArea
    ? getEquipmentAreaFilter(selectedArea.name)
    : areaChip;

  const openEquipment = (equipment: NonNullable<typeof equipmentQuery.data>[number]) => {
    router.push(getEquipmentRoute(equipment));
  };
  const filteredEquipment = useMemo(() => {
    const base = (equipmentQuery.data ?? []).filter(
      (equipment) => !selectedAreaId || equipment.areaId._id === selectedAreaId,
    );
    return filterEquipment(base, areaChip, search);
  }, [areaChip, equipmentQuery.data, search, selectedAreaId]);

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <ScreenHeader
          eyebrow="FITBEACON · ACADEMIA"
          subtitle={selectedArea?.name ?? 'Explore os aparelhos disponíveis na academia.'}
          title="Equipamentos"
        />
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            borderWidth: theme.sizes.border,
            flexDirection: 'row',
            gap: theme.spacing.sm,
            minHeight: theme.sizes.controlHeight,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          <Search color={theme.colors.secondary} size={18} />
          <TextInput
            accessibilityLabel="Buscar equipamento"
            onChangeText={setSearch}
            placeholder="Buscar equipamento..."
            placeholderTextColor={theme.colors.secondary}
            style={{
              color: theme.colors.text,
              flex: 1,
              fontFamily: theme.typography.fontFamily.regular,
              fontSize: theme.typography.fontSize.md,
              minHeight: theme.sizes.controlHeight,
            }}
            value={search}
          />
        </View>
        <Button
          accessibilityLabel="Abrir mapa da academia"
          label="Ver mapa da academia"
          onPress={() => router.push('/gym-map')}
          variant="secondary"
          icon={<MapPinned color={theme.colors.primary} size={18} />}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip
              accessibilityLabel="Mostrar equipamentos de todas as áreas"
              label="Todos"
              onPress={() => {
                setShowAllRouteAreas(true);
                setAreaChip('Todos');
              }}
              selected={selectedChip === 'Todos'}
            />
            {(['Musculação', 'Cardio', 'Funcional', 'Livre'] as const).map((label) => (
              <Chip
                accessibilityLabel={`Filtrar área ${label}`}
                key={label}
                label={label}
                onPress={() => {
                  setShowAllRouteAreas(true);
                  setAreaChip(label);
                }}
                selected={selectedChip === label}
              />
            ))}
            </View>
          </ScrollView>
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
        {equipmentQuery.isSuccess && filteredEquipment.length === 0 ? (
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
          ? filteredEquipment.map((equipment) => (
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
                    {equipment.media.imageUrl ? (
                      <Image
                        accessibilityLabel={`Imagem de ${equipment.name}`}
                        source={{ uri: equipment.media.imageUrl }}
                        style={{
                          backgroundColor: theme.colors.elevated,
                          borderRadius: theme.radius.md,
                          height: 56,
                          width: 56,
                        }}
                      />
                    ) : (
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
                    )}
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
                        Área: {equipment.areaId.name} · Nº{' '}
                        {String(equipment.beacon.minor).padStart(2, '0')}
                      </Text>
                    </View>
                    <Signal color={theme.colors.primary} size={20} />
                    <ChevronRight color={theme.colors.secondary} size={18} />
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
