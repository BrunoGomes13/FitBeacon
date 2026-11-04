import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, Timer } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchAllTrainingSessions } from '../src/api/services';
import { filterSessionsByPeriod, formatDurationMinutes, getUsageRanking } from '../src/api/trainingProgress';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';

type ReportTab = 'equipment' | 'area';
type Period = 'week' | 'month' | 'all';

const reportTabs = [
  { label: 'Uso de equipamentos', value: 'equipment' },
  { label: 'Uso de áreas', value: 'area' },
] as const;

export default function StudentReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const [tab, setTab] = useState<ReportTab>('equipment');
  const [period, setPeriod] = useState<Period>('month');
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: fetchAllTrainingSessions,
    enabled: Boolean(user),
  });
  const sessions = useMemo(() => {
    return filterSessionsByPeriod(sessionsQuery.data ?? [], period);
  }, [period, sessionsQuery.data]);
  const ranking = useMemo(
    () => getUsageRanking(sessions, tab),
    [sessions, tab],
  );

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <Pressable
          accessibilityLabel="Voltar ao histórico"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm, minHeight: 48 }}
        >
          <ArrowLeft color={theme.colors.text} size={20} />
          <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.md }}>Voltar</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.fontSize['2xl'] }}>
          Relatórios
        </Text>
        <Tabs
          accessibilityLabel="Relatórios de uso pessoal"
          items={reportTabs}
          onChange={setTab}
          value={tab}
        />
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
              style={{ alignItems: 'center', backgroundColor: period === value ? theme.colors.primary : theme.colors.elevated, borderRadius: theme.radius.pill, justifyContent: 'center', minHeight: 40, paddingHorizontal: theme.spacing.md }}
            >
              <Text style={{ color: period === value ? theme.colors.onPrimary : theme.colors.text, fontSize: theme.typography.fontSize.xs }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {sessionsQuery.isLoading ? <Skeleton lines={3} /> : null}
        {sessionsQuery.isError ? (
          <ErrorState
            accessibilityLabel="Falha ao carregar seus relatórios"
            description={sessionsQuery.error.message}
            onRetry={() => void sessionsQuery.refetch()}
            retryLabel="Tentar novamente"
            title="Não carregamos seus relatórios"
          />
        ) : null}
        {sessionsQuery.isSuccess && ranking.length === 0 ? (
          <Card>
            <EmptyState
              accessibilityLabel="Nenhum dado para o relatório"
              description="Os relatórios mostram somente suas próprias sessões registradas."
              title="Sem dados neste período"
            />
          </Card>
        ) : null}
        {sessionsQuery.isSuccess
          ? ranking.map((row, index) => (
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
                      {formatDurationMinutes(Math.round(row.durationSec / 60))} · {row.percentage.toFixed(0)}% · {row.sessions} visitas
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
