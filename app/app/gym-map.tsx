import { Fragment, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { Card, EmptyState, ErrorState, Skeleton } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchAreas, fetchGymEquipment } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import { getMapZones, getPositionedEquipment, isDetectedEquipment } from '../src/student/mapPresentation';

export default function GymMapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const detectedEquipment = useAppStore((state) => state.detectedEquipment);
  const equipmentQuery = useQuery({
    queryKey: ['student', 'equipment'],
    queryFn: fetchGymEquipment,
    enabled: Boolean(user),
  });
  const areasQuery = useQuery({
    queryKey: ['student', 'areas'],
    queryFn: fetchAreas,
    enabled: Boolean(user),
  });
  const areas = useMemo(() => areasQuery.data ?? [], [areasQuery.data]);
  const positionedEquipment = useMemo(
    () => getPositionedEquipment(equipmentQuery.data ?? [], areas, theme.mode),
    [areas, equipmentQuery.data, theme.mode],
  );
  const zones = useMemo(() => getMapZones(areas, theme.mode), [areas, theme.mode]);
  const mapHeight = positionedEquipment[0]?.height ?? Math.max(500, 48 + Math.ceil(areas.length / 2) * 150);

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <Pressable
          accessibilityLabel="Voltar para equipamentos"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm, minHeight: 48 }}
        >
          <ArrowLeft color={theme.colors.text} size={20} />
          <Text style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.fontSize.md }}>
            Mapa da academia
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {zones.map(({ _id, name, color }) => (
            <View key={_id} style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.xs }}>
              <View style={{ backgroundColor: color, borderRadius: theme.radius.pill, height: 10, width: 10 }} />
              <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>{name}</Text>
            </View>
          ))}
        </View>
        {equipmentQuery.isLoading || areasQuery.isLoading ? <Skeleton lines={3} /> : null}
        {equipmentQuery.isError ? (
          <ErrorState
            accessibilityLabel="Falha ao carregar o mapa"
            description={equipmentQuery.error.message}
            onRetry={() => void equipmentQuery.refetch()}
            retryLabel="Tentar novamente"
            title="Não carregamos o mapa"
          />
        ) : null}
        {areasQuery.isError ? (
          <ErrorState
            accessibilityLabel="Falha ao carregar as áreas do mapa"
            description={areasQuery.error.message}
            onRetry={() => void areasQuery.refetch()}
            retryLabel="Tentar novamente"
            title="Não carregamos as áreas"
          />
        ) : null}
        {equipmentQuery.isSuccess && areasQuery.isSuccess && positionedEquipment.length === 0 ? (
          <Card>
            <EmptyState
              accessibilityLabel="Nenhum equipamento cadastrado"
              description="Os equipamentos cadastrados aparecerão na planta."
              title="Nenhum equipamento disponível"
            />
          </Card>
        ) : null}
        {equipmentQuery.isSuccess && positionedEquipment.length > 0 ? (
          <Card>
            <Svg accessibilityLabel="Planta esquemática da academia" role="img" viewBox={`0 0 360 ${mapHeight}`} width="100%" height={Math.min(640, mapHeight)}>
              <Rect fill={theme.colors.surface} height={mapHeight} rx="18" stroke={theme.colors.border} strokeWidth="2" width="360" />
              {zones.map((zone) => (
                <Fragment key={zone._id}>
                  <Rect
                    fill={theme.colors.elevated}
                    height={zone.height}
                    rx="12"
                    stroke={zone.color}
                    strokeOpacity="0.65"
                    strokeWidth="2"
                    width={zone.width}
                    x={zone.x}
                    y={zone.y}
                  />
                  <SvgText fill={zone.color} fontSize="10" x={zone.x + 8} y={zone.y + 16}>
                    {zone.name.toLocaleUpperCase('pt-BR').slice(0, 24)}
                  </SvgText>
                </Fragment>
              ))}
              {positionedEquipment.map(({ equipment, position, color }) => {
                const isDetected = isDetectedEquipment(equipment._id, detectedEquipment?._id);
                return (
                  <Circle
                    accessibilityLabel={`${equipment.name}${isDetected ? ', você está aqui' : ''}`}
                    cx={position.x}
                    cy={position.y}
                    fill={color}
                    key={equipment._id}
                    onPress={() => router.push(`/equipment?equipmentId=${encodeURIComponent(equipment._id)}`)}
                    r={isDetected ? 12 : 8}
                    stroke={theme.colors.text}
                    strokeWidth={isDetected ? 3 : 1}
                  />
                );
              })}
            </Svg>
          </Card>
        ) : null}
        {detectedEquipment ? (
          <Card>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm }}>
              <MapPin color={theme.colors.primary} size={18} />
              <Text style={{ color: theme.colors.text, flex: 1, fontSize: theme.typography.fontSize.sm }}>
                Você está aqui: {detectedEquipment.name}
              </Text>
            </View>
          </Card>
        ) : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
