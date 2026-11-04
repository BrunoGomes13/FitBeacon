import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Dumbbell, Timer } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, ErrorState, Skeleton, Tabs } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { SessionOutboxPanel } from '../src/student/SessionOutboxPanel';
import { fetchAllTrainingSessions } from '../src/api/services';
import {
  filterSessionsByPeriod,
  formatDurationMinutes,
  getSessionExerciseCount,
  getTrainingTitle,
  getUsageRanking,
} from '../src/api/trainingProgress';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

type HistoryTab = 'workouts' | 'equipment' | 'areas';
type Period = 'all' | 'week' | 'month';

const historyTabs = [
  { label: 'Treinos', value: 'workouts' },
  { label: 'Equipamentos', value: 'equipment' },
  { label: 'Áreas', value: 'areas' },
] as const;

function formatDuration(seconds: number): string {
  return formatDurationMinutes(Math.round(seconds / 60));
}

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const consent = useAppStore((state) => state.trackingConsent);
  const [tab, setTab] = useState<HistoryTab>('workouts');
  const [period, setPeriod] = useState<Period>('month');
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: fetchAllTrainingSessions,
    enabled: Boolean(user),
  });
  const sessions = useMemo(
    () => [...(sessionsQuery.data ?? [])].sort(
      (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
    ),
    [sessionsQuery.data],
  );
  const periodSessions = useMemo(
    () => filterSessionsByPeriod(sessions, period),
    [period, sessions],
  );
  const rankings = useMemo(
    () => tab === 'equipment'
      ? getUsageRanking(periodSessions, 'equipment')
      : getUsageRanking(periodSessions, 'area'),
    [periodSessions, tab],
  );

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <ScreenHeader
          accessory={<SessionOutboxPanel consent={consent} ownerId={user?.id} />}
          eyebrow="FITBEACON · EVOLUÇÃO"
          subtitle="Seus aparelhos, séries e tempo de treino."
          title="Histórico"
        />
        <Button
          accessibilityLabel="Abrir relatórios pessoais de uso"
          label="Relatórios de uso"
          onPress={() => router.push('/reports')}
          variant="secondary"
        />
        <Tabs
          accessibilityLabel="Seção do histórico"
          items={historyTabs}
          onChange={setTab}
          value={tab}
        />
        {tab !== 'workouts' ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {([
              ['week', '7 dias'],
              ['month', '30 dias'],
              ['all', 'Tudo'],
            ] as const).map(([value, label]) => (
              <Pressable
                accessibilityLabel={`Período: ${label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: period === value }}
                key={value}
                onPress={() => setPeriod(value)}
                style={{
                  backgroundColor: period === value ? theme.colors.primary : theme.colors.elevated,
                  borderRadius: theme.radius.pill,
                  justifyContent: 'center',
                  minHeight: 40,
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                <Text style={{ color: period === value ? theme.colors.onPrimary : theme.colors.text, fontSize: theme.typography.fontSize.xs }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
        {sessionsQuery.isSuccess && tab === 'workouts' && sessions.length === 0 ? (
          <Card>
            <EmptyState
              accessibilityLabel="Nenhum treino registrado"
              description="Quando você terminar uma sessão, ela aparecerá aqui."
              title="Seu histórico está vazio"
            />
          </Card>
        ) : null}
        {sessionsQuery.isSuccess && tab === 'workouts'
          ? sessions.map((session) => (
              <Pressable
                accessibilityLabel={`Ver ${getTrainingTitle(session)}`}
                accessibilityRole="button"
                key={session._id}
                onPress={() => router.push(`/history-detail?sessionId=${encodeURIComponent(session._id)}`)}
              >
                <Card>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}>
                    <View style={{ alignItems: 'center', backgroundColor: theme.colors.elevated, borderRadius: theme.radius.pill, height: 44, justifyContent: 'center', width: 44 }}>
                      <Dumbbell color={theme.colors.primary} size={20} />
                    </View>
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>
                        {new Date(session.startedAt).toLocaleDateString('pt-BR')}
                      </Text>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.fontSize.md }}>
                        {getTrainingTitle(session)}
                      </Text>
                      <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>
                        {formatDuration(session.durationSec)} · {getSessionExerciseCount(session)} exercícios
                      </Text>
                    </View>
                    <ChevronRight color={theme.colors.secondary} size={20} />
                  </View>
                </Card>
              </Pressable>
            ))
          : null}
        {sessionsQuery.isSuccess && tab !== 'workouts' && rankings.length === 0 ? (
          <Card>
            <EmptyState
              accessibilityLabel={`Nenhum uso de ${tab === 'equipment' ? 'equipamento' : 'área'} neste período`}
              description="Registre treinos para ver seu relatório pessoal de uso."
              title="Sem dados neste período"
            />
          </Card>
        ) : null}
        {sessionsQuery.isSuccess && tab !== 'workouts'
          ? rankings.map((row, index) => (
              <Card key={row.id}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}>
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.fontSize.lg, width: 28 }}>
                    {index + 1}
                  </Text>
                  <View style={{ flex: 1, gap: theme.spacing.xs }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.fontSize.md }}>
                      {row.name}
                    </Text>
                    <View style={{ backgroundColor: theme.colors.elevated, borderRadius: theme.radius.pill, height: 8, overflow: 'hidden' }}>
                      <View style={{ backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, height: '100%', width: `${row.percentage}%` }} />
                    </View>
                    <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>
                      {formatDuration(row.durationSec)} · {row.percentage.toFixed(0)}% · {row.sessions} visitas
                    </Text>
                  </View>
                  <Timer color={theme.colors.info} size={18} />
                </View>
              </Card>
            ))
          : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
