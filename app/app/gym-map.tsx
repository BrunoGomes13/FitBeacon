import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { Card, EmptyState, ErrorState, Skeleton } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchGymEquipment } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import { areaMapColors, getAreaMapColor, getPositionedEquipment, isDetectedEquipment } from '../src/student/mapPresentation';

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
  const positionedEquipment = useMemo(
    () => getPositionedEquipment(equipmentQuery.data ?? []),
    [equipmentQuery.data],
  );
  const withoutPosition = (equipmentQuery.data?.length ?? 0) - positionedEquipment.length;

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
          {[
            ['Musculação', areaMapColors.strength],
            ['Cardio', areaMapColors.cardio],
            ['Funcional', areaMapColors.functional],
          ].map(([label, color]) => (
            <View key={label} style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.xs }}>
              <View style={{ backgroundColor: color, borderRadius: theme.radius.pill, height: 10, width: 10 }} />
              <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>{label}</Text>
            </View>
          ))}
        </View>
        {equipmentQuery.isLoading ? <Skeleton lines={3} /> : null}
        {equipmentQuery.isError ? (
          <ErrorState
            accessibilityLabel="Falha ao carregar o mapa"
            description={equipmentQuery.error.message}
            onRetry={() => void equipmentQuery.refetch()}
            retryLabel="Tentar novamente"
            title="Não carregamos o mapa"
          />
        ) : null}
        {equipmentQuery.isSuccess && positionedEquipment.length === 0 ? (
          <Card>
            <EmptyState
              accessibilityLabel="Mapa ainda sem equipamentos posicionados"
              description="A administração ainda não posicionou equipamentos na planta."
              title="Mapa em preparação"
            />
          </Card>
        ) : null}
        {equipmentQuery.isSuccess && positionedEquipment.length > 0 ? (
          <Card>
            <Svg accessibilityLabel="Planta esquemática da academia" role="img" viewBox="0 0 360 520" width="100%" height={440}>
              <Rect fill={theme.colors.surface} height="520" rx="18" stroke={theme.colors.border} strokeWidth="2" width="360" />
              <Path d="M12 12H218V166H348V326H234V508H12Z" fill={theme.colors.elevated} stroke={theme.colors.border} strokeWidth="2" />
              <Path d="M16 16H214V160H16Z" fill={theme.colors.surface} stroke={theme.colors.border} strokeWidth="1" />
              <Path d="M222 170H344V322H222Z" fill={theme.colors.surface} stroke={theme.colors.border} strokeWidth="1" />
              <Path d="M16 172H216V504H16Z" fill={theme.colors.surface} stroke={theme.colors.border} strokeWidth="1" />
              <Path d="M222 330H344V504H222Z" fill={theme.colors.surface} stroke={theme.colors.border} strokeWidth="1" />
              <Path d="M214 162H222V330H214Z" fill={theme.colors.background} />
              <SvgText fill={theme.colors.secondary} fontSize="12" x="30" y="40">MUSCULAÇÃO</SvgText>
              <SvgText fill={theme.colors.secondary} fontSize="12" x="242" y="195">CARDIO</SvgText>
              <SvgText fill={theme.colors.secondary} fontSize="12" x="34" y="206">FUNCIONAL</SvgText>
              <SvgText fill={theme.colors.secondary} fontSize="12" x="242" y="364">LIVRE</SvgText>
              {positionedEquipment.map(({ equipment, position }) => {
                const color = getAreaMapColor(equipment.areaId.name);
                const isDetected = isDetectedEquipment(equipment._id, detectedEquipment?._id);
                return (
                  <Circle
                    accessibilityLabel={`${equipment.name}${isDetected ? ', você está aqui' : ''}`}
                    cx={`${position.x}%`}
                    cy={`${position.y}%`}
                    fill={isDetected ? theme.colors.primary : color}
                    key={equipment._id}
                    onPress={() => router.push(`/equipment?uuid=${encodeURIComponent(equipment.beacon.uuid)}&major=${equipment.beacon.major}&minor=${equipment.beacon.minor}`)}
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
        {equipmentQuery.isSuccess && withoutPosition > 0 ? (
          <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>
            {withoutPosition} equipamento{withoutPosition === 1 ? '' : 's'} sem posição não aparece{withoutPosition === 1 ? '' : 'm'} no mapa.
          </Text>
        ) : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
