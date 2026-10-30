import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { SessionOutboxPanel } from '../src/student/SessionOutboxPanel';
import { fetchTrainingSessions } from '../src/api/services';
import type { TrainingSession } from '../src/api/schemas';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

type HistoryFilter = 'all' | 'week' | 'month';

function getEquipmentName(session: TrainingSession): string {
  return typeof session.equipmentId === 'string'
    ? 'Equipamento'
    : session.equipmentId.name;
}

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const consent = useAppStore((state) => state.trackingConsent);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [cutoff, setCutoff] = useState(0);
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 1],
    queryFn: () => fetchTrainingSessions(1),
    enabled: Boolean(user),
  });
  const filteredSessions =
    sessionsQuery.data?.data.filter(
      (session) => new Date(session.startedAt).getTime() >= cutoff,
    ) ?? [];

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <ScreenHeader
          eyebrow="FITBEACON · EVOLUÇÃO"
          subtitle="Seus aparelhos, séries e tempo de treino."
          title="Histórico de treinos"
        />
        <SessionOutboxPanel consent={consent} ownerId={user?.id} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip
            accessibilityLabel="Filtrar todos os treinos"
            label="Todos"
            onPress={() => {
              setFilter('all');
              setCutoff(0);
            }}
            selected={filter === 'all'}
          />
          <Chip
            accessibilityLabel="Filtrar últimos sete dias"
            label="7 dias"
            onPress={() => {
              setFilter('week');
              setCutoff(Date.now() - 7 * 24 * 60 * 60 * 1_000);
            }}
            selected={filter === 'week'}
          />
          <Chip
            accessibilityLabel="Filtrar últimos trinta dias"
            label="30 dias"
            onPress={() => {
              setFilter('month');
              setCutoff(Date.now() - 30 * 24 * 60 * 60 * 1_000);
            }}
            selected={filter === 'month'}
          />
        </View>
        {sessionsQuery.isLoading ? <Skeleton lines={3} /> : null}
        {sessionsQuery.isError ? (
          <Card>
            <ErrorState
              accessibilityLabel="Falha ao carregar o histórico"
              description={sessionsQuery.error.message}
              onRetry={() => void sessionsQuery.refetch()}
              retryLabel="Tentar novamente"
              title="Não carregamos seus treinos"
            />
          </Card>
        ) : null}
        {sessionsQuery.isSuccess && filteredSessions.length === 0 ? (
          <Card>
            <EmptyState
              accessibilityLabel="Nenhum treino no período selecionado"
              description={
                filter === 'all'
                  ? 'Quando você terminar uma sessão, ela aparecerá aqui.'
                  : 'Escolha outro período ou registre um novo treino.'
              }
              title="Nenhum treino neste período"
            />
          </Card>
        ) : null}
        {sessionsQuery.isSuccess
          ? filteredSessions.map((session) => (
              <Card key={session._id}>
                <View
                  style={{
                    alignItems: 'flex-start',
                    flexDirection: 'row',
                    gap: theme.spacing.md,
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, gap: theme.spacing.xs }}>
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontFamily: theme.typography.fontFamily.semiBold,
                        fontSize: theme.typography.fontSize.md,
                        lineHeight: theme.typography.lineHeight.md,
                      }}
                    >
                      {getEquipmentName(session)}
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.secondary,
                        fontFamily: theme.typography.fontFamily.regular,
                        fontSize: theme.typography.fontSize.xs,
                        lineHeight: theme.typography.lineHeight.sm,
                      }}
                    >
                      {new Date(session.startedAt).toLocaleDateString('pt-BR')} ·{' '}
                      {new Date(session.startedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: theme.colors.primary,
                      fontFamily: theme.typography.fontFamily.semiBold,
                      fontSize: theme.typography.fontSize.sm,
                      lineHeight: theme.typography.lineHeight.md,
                    }}
                  >
                    {Math.max(1, Math.round(session.durationSec / 60))} min
                  </Text>
                </View>
                <Text
                  style={{
                    color: theme.colors.secondary,
                    fontFamily: theme.typography.fontFamily.regular,
                    fontSize: theme.typography.fontSize.sm,
                    lineHeight: theme.typography.lineHeight.md,
                  }}
                >
                  {session.sets.length} séries registradas
                </Text>
                <Button
                  accessibilityLabel={`Ver detalhes do treino em ${getEquipmentName(session)}`}
                  label="Ver detalhes"
                  onPress={() =>
                    router.push(`/history-detail?sessionId=${encodeURIComponent(session._id)}`)
                  }
                  variant="secondary"
                />
              </Card>
            ))
          : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
