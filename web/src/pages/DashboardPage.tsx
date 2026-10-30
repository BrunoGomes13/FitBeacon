import { useQuery } from '@tanstack/react-query';
import { Activity, Clock3, Dumbbell, Users } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../lib/api';
import { defaultPeriod, formatCount, formatDuration, formatPercent } from '../lib/format';
import type { ReportSummary } from '../lib/types';
import { PeriodFilter } from '../components/PeriodFilter';
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../components/shared';

type Kpi = { label: string; value: string; icon: typeof Activity; note: string };

export function dashboardKpis(summary: ReportSummary): Kpi[] {
  const usedEquipmentCount = summary.rankings.equipment.length;
  const averagePerEquipment = usedEquipmentCount > 0
    ? summary.totals.totalDurationSec / usedEquipmentCount
    : 0;
  return [
    { label: 'Sessões no período', value: formatCount(summary.totals.sessions), icon: Activity, note: 'sessões registradas' },
    { label: 'Alunos ativos', value: formatCount(summary.totals.activeStudents), icon: Users, note: 'identidades não exibidas' },
    { label: 'Tempo médio por aparelho', value: formatDuration(averagePerEquipment), icon: Clock3, note: 'no período, por aparelho utilizado' },
    { label: 'Taxa de ocupação', value: formatPercent(summary.totals.occupancyRate), icon: Dumbbell, note: 'do tempo disponível' },
  ];
}

function queryString(from: string, to: string): string {
  const params = new URLSearchParams({ from: new Date(`${from}T00:00:00Z`).toISOString(), to: new Date(`${to}T23:59:59.999Z`).toISOString() });
  return params.toString();
}

function RankedList({ title, rows }: { title: string; rows: ReportSummary['rankings']['equipment'] }) {
  if (rows.length === 0) return <section className="panel p-5"><h2 className="mb-4 mt-0 text-lg font-semibold">{title}</h2><EmptyState>Nenhuma utilização registrada.</EmptyState></section>;
  return (
    <section className="panel p-5">
      <h2 className="mb-4 mt-0 text-lg font-semibold">{title}</h2>
      <ol className="m-0 grid list-none gap-3 p-0">
        {rows.map((row, index) => (
          <li className="flex items-center justify-between gap-3" key={row._id}>
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-raised text-xs font-semibold text-muted">{index + 1}</span>
              <span className="truncate">{row.name}</span>
            </span>
            <span className="shrink-0 text-sm text-muted">{formatCount(row.sessions)} sessões</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState(defaultPeriod);
  const summaryQuery = useQuery({
    queryKey: ['reports', 'summary', period.from, period.to],
    queryFn: () => apiFetch<ReportSummary>(`/reports/summary?${queryString(period.from, period.to)}`),
  });

  return (
    <>
      <PageTitle title="Visão geral" description="Indicadores agregados da academia; dados de alunos permanecem anonimizados." />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="m-0 text-sm text-muted">Selecione o período dos indicadores.</p>
        <PeriodFilter from={period.from} to={period.to} setFrom={(from) => setPeriod((current) => ({ ...current, from }))} setTo={(to) => setPeriod((current) => ({ ...current, to }))} />
      </div>
      {summaryQuery.isPending ? <LoadingState label="Carregando indicadores" /> : summaryQuery.isError ? <ErrorState error={summaryQuery.error} retry={() => void summaryQuery.refetch()} /> : (
        <div className="grid gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardKpis(summaryQuery.data).map(({ label, value, icon: Icon, note }) => (
              <article className="panel p-5" key={label}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">{label}</span>
                  <Icon aria-hidden="true" className="text-primary" size={18} />
                </div>
                <p className="mb-0 mt-5 text-3xl font-semibold tracking-tight">{value}</p>
                <p className="mb-0 mt-1 text-xs text-muted">{note}</p>
              </article>
            ))}
          </div>
          <section className="panel p-5">
            <div className="mb-4">
              <h2 className="m-0 text-lg font-semibold">Uso por hora</h2>
              <p className="mb-0 mt-1 text-xs text-muted">Horário UTC · sessões iniciadas</p>
            </div>
            {summaryQuery.data.hourlyUsage.length === 0 ? <EmptyState>Nenhuma sessão no período.</EmptyState> : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryQuery.data.hourlyUsage} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="_id" tickFormatter={(hour: number) => `${String(hour).padStart(2, '0')}h`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} labelFormatter={(hour) => `${String(hour).padStart(2, '0')}:00 UTC`} />
                    <Bar dataKey="sessions" name="Sessões" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <RankedList title="Equipamentos mais utilizados" rows={summaryQuery.data.rankings.equipment.slice(0, 5)} />
            <RankedList title="Equipamentos menos utilizados" rows={[...summaryQuery.data.rankings.equipment].reverse().slice(0, 5)} />
            <RankedList title="Uso por área" rows={summaryQuery.data.rankings.areas} />
          </div>
        </div>
      )}
    </>
  );
}
