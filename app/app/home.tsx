import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatCard,
} from '../src/components';
import { ProximityRadar } from '../src/components/ProximityRadar';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchTrainingSessions } from '../src/api/services';
import type { TrainingSession } from '../src/api/schemas';
import { useStudentBeacon } from '../src/student/StudentBeaconRuntime';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

function getEquipmentName(session: TrainingSession): string {
  return typeof session.equipmentId === 'string'
    ? 'Equipamento'
    : session.equipmentId.name;
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const consent = useAppStore((state) => state.trackingConsent);
  const developerMode = useAppStore((state) => state.developerMode);
  const beacon = useStudentBeacon();
  const historyQuery = useQuery({
    queryKey: ['sessions', 1],
    queryFn: () => fetchTrainingSessions(1),
    enabled: Boolean(user && consent),
  });
  const latestSession = historyQuery.data?.data[0];

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <ScreenHeader
          eyebrow="FITBEACON · SEU ESPAÇO"
          subtitle={`Olá, ${user?.name.split(' ')[0] ?? 'atleta'}. Vamos treinar?`}
          title="Seu próximo movimento."
        />
        <ProximityRadar
          message={
            beacon.status === 'scanning'
              ? 'Procurando aparelhos próximos'
              : beacon.status === 'error'
                ? 'Verifique o Bluetooth e as permissões'
                : 'Detecção pausada'
          }
          scanning={beacon.status === 'scanning'}
        />
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
                fontSize: theme.typography.fontSize.lg,
                lineHeight: theme.typography.lineHeight.lg,
              }}
            >
              Você está no controle
            </Text>
            <Text
              style={{
                color: theme.colors.secondary,
                fontFamily: theme.typography.fontFamily.regular,
                fontSize: theme.typography.fontSize.sm,
                lineHeight: theme.typography.lineHeight.md,
              }}
            >
              Ative o consentimento de atividade para procurar equipamentos e guardar seus
              treinos. Você pode revogar quando quiser.
            </Text>
            <Button
              accessibilityLabel="Abrir configurações de privacidade"
              label="Configurar consentimento"
              onPress={() => router.push('/profile')}
            />
          </Card>
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard
            detail="No histórico"
            label="Sessões"
            value={
              historyQuery.isSuccess
                ? String(historyQuery.data.pagination.total)
                : '—'
            }
          />
          <StatCard
            detail="Veja sua evolução"
            label="Último treino"
            value={
              latestSession
                ? `${Math.max(1, Math.round(latestSession.durationSec / 60))} min`
                : '—'
            }
          />
        </View>
        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.lg,
              lineHeight: theme.typography.lineHeight.lg,
            }}
          >
            Último treino
          </Text>
          {historyQuery.isLoading ? <Skeleton lines={2} /> : null}
          {historyQuery.isError ? (
            <ErrorState
              accessibilityLabel="Erro ao carregar treino recente"
              description={historyQuery.error.message}
              onRetry={() => void historyQuery.refetch()}
              retryLabel="Tentar novamente"
              title="Não carregamos seu treino"
            />
          ) : null}
          {historyQuery.isSuccess && latestSession ? (
            <>
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.typography.fontFamily.semiBold,
                  fontSize: theme.typography.fontSize.md,
                  lineHeight: theme.typography.lineHeight.md,
                }}
              >
                {getEquipmentName(latestSession)}
              </Text>
              <Text
                style={{
                  color: theme.colors.secondary,
                  fontFamily: theme.typography.fontFamily.regular,
                  fontSize: theme.typography.fontSize.sm,
                  lineHeight: theme.typography.lineHeight.md,
                }}
              >
                {new Date(latestSession.startedAt).toLocaleDateString('pt-BR')} ·{' '}
                {latestSession.sets.length} séries registradas
              </Text>
            </>
          ) : null}
          {historyQuery.isSuccess && !latestSession ? (
            <EmptyState
              accessibilityLabel="Ainda não há treinos"
              description="Aproxime-se de um aparelho para começar seu primeiro treino."
              title="Seu histórico começa aqui"
            />
          ) : null}
          <Button
            accessibilityLabel="Abrir histórico de treinos"
            label="Ver histórico"
            onPress={() => router.push('/history')}
            variant="secondary"
          />
        </Card>
        {developerMode && beacon.isMock ? (
          <Card>
            <Text
              style={{
                color: theme.colors.warning,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.md,
                lineHeight: theme.typography.lineHeight.md,
              }}
            >
              Modo desenvolvedor{beacon.isMock ? ' · Mock ativo' : ''}
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
                label="Afastar"
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
        <Button
          accessibilityLabel="Abrir seu perfil e configurações"
          label="Perfil e configurações"
          onPress={() => router.push('/profile')}
          variant="ghost"
        />
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
