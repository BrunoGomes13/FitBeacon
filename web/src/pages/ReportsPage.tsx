import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { PeriodFilter } from '../components/PeriodFilter';
import { ReportDataFilters } from '../components/ReportDataFilters';
import { EmptyState, ErrorState, FormField, LoadingState, PageTitle } from '../components/shared';
import { apiFetch, downloadReportCsv, saveBlob } from '../lib/api';
import { defaultPeriod, formatCount, formatDuration } from '../lib/format';
import type { Area, Equipment, GymSettings, ReportSummary, ReportFilters, UsageRow } from '../lib/types';

type ListResult<T> = { data: T[] };
type UsageResult = { data: UsageRow[]; period: { from: string; to: string }; groupBy: string };

function rangeQuery(period: { from: string; to: string }, filters: Omit<ReportFilters, 'from' | 'to'>): string {
  const params = new URLSearchParams({
    from: period.from,
    to: period.to,
    groupBy: filters.equipmentId ? 'equipment' : filters.areaId ? 'area' : 'equipment',
  });
  if (filters.areaId) params.set('areaId', filters.areaId);
  if (filters.equipmentId) params.set('equipmentId', filters.equipmentId);
  if (filters.includeDemo) params.set('includeDemo', 'true');
  if (filters.origin) params.set('origin', filters.origin);
  return params.toString();
}

export function ReportsPage() {
  const client = useQueryClient();
  const [period, setPeriod] = useState(defaultPeriod);
  const [areaId, setAreaId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [includeDemo, setIncludeDemo] = useState(false);
  const [origin, setOrigin] = useState<'' | 'beacon' | 'manual'>('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const filters: ReportFilters = {
    from: period.from,
    to: period.to,
    ...(areaId ? { areaId } : {}),
    ...(equipmentId ? { equipmentId } : {}),
    ...(includeDemo ? { includeDemo } : {}),
    ...(origin ? { origin } : {}),
  };
  const params = rangeQuery(period, filters);
  const areas = useQuery({ queryKey: ['admin', 'areas'], queryFn: () => apiFetch<ListResult<Area>>('/admin/areas?limit=100') });
  const equipment = useQuery({ queryKey: ['admin', 'equipment'], queryFn: () => apiFetch<ListResult<Equipment>>('/admin/equipment?limit=100') });
  const usage = useQuery({
    queryKey: ['reports', 'usage', params],
    queryFn: () => apiFetch<UsageResult>(`/reports/usage?${params}`),
  });
  const summary = useQuery({
    queryKey: ['reports', 'summary', period.from, period.to, includeDemo, origin],
    queryFn: () => apiFetch<ReportSummary>(`/reports/summary?${new URLSearchParams({
      from: period.from,
      to: period.to,
      ...(includeDemo ? { includeDemo: 'true' } : {}),
      ...(origin ? { origin } : {}),
    })}`),
  });
  const gymSettings = useQuery({
    queryKey: ['admin', 'gym', 'settings'],
    queryFn: () => apiFetch<{ data: GymSettings }>('/admin/gym/settings'),
  });
  const saveSettings = useMutation({
    mutationFn: (settings: Pick<GymSettings, 'timeZone' | 'openingHour' | 'closingHour'>) =>
      apiFetch<{ data: GymSettings }>('/admin/gym/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      }),
    onSuccess: async () => {
      setSettingsMessage('Fuso horário e funcionamento atualizados.');
      await client.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => setSettingsMessage(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.'),
  });

  const exportCsv = async (): Promise<void> => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadReportCsv(filters);
      saveBlob(blob, 'fitbeacon-relatorio.csv');
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Não foi possível exportar o arquivo.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Relatórios"
        description="Uso por equipamento, filtros e aparelhos ociosos. Nenhum dado pessoal é exibido."
        action={<button className="btn btn-primary" disabled={isDownloading} onClick={() => void exportCsv()} type="button"><Download size={16} aria-hidden="true" />{isDownloading ? 'Exportando…' : 'Exportar CSV'}</button>}
      />
      {downloadError ? <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{downloadError}</p> : null}
      <section className="panel mb-5 grid gap-4 p-5 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <PeriodFilter from={period.from} to={period.to} setFrom={(from) => setPeriod((current) => ({ ...current, from }))} setTo={(to) => setPeriod((current) => ({ ...current, to }))} />
        <FormField htmlFor="report-area" label="Área">
          <select className="field min-w-40" id="report-area" onChange={(event) => setAreaId(event.target.value)} value={areaId}>
            <option value="">Todas</option>
            {(areas.data?.data ?? []).map((area) => <option key={area._id} value={area._id}>{area.name}</option>)}
          </select>
        </FormField>
        <FormField htmlFor="report-equipment" label="Equipamento">
          <select className="field min-w-40" id="report-equipment" onChange={(event) => setEquipmentId(event.target.value)} value={equipmentId}>
            <option value="">Todos</option>
            {(equipment.data?.data ?? []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
        </FormField>
        <ReportDataFilters
          includeDemo={includeDemo}
          setIncludeDemo={setIncludeDemo}
          origin={origin}
          setOrigin={setOrigin}
        />
      </section>
      <section className="panel mb-5 grid gap-4 p-5">
        <div>
          <h2 className="m-0 text-lg font-semibold">Fuso e horário de funcionamento</h2>
          <p className="mb-0 mt-1 text-sm text-muted">Usados nos agrupamentos locais e no cálculo da taxa de ocupação.</p>
        </div>
        {gymSettings.isPending ? <LoadingState label="Carregando configurações da academia" /> : gymSettings.isError ? <ErrorState error={gymSettings.error} retry={() => void gymSettings.refetch()} /> : (
          <form
            className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              saveSettings.mutate({
                timeZone: String(form.get('timeZone')),
                openingHour: Number(form.get('openingHour')),
                closingHour: Number(form.get('closingHour')),
              });
            }}
          >
            <FormField htmlFor="gym-time-zone" label="Fuso IANA">
              <input className="field" defaultValue={gymSettings.data.data.timeZone} id="gym-time-zone" name="timeZone" required />
            </FormField>
            <FormField htmlFor="gym-opening-hour" label="Abre às">
              <input className="field" defaultValue={gymSettings.data.data.openingHour} id="gym-opening-hour" max="23" min="0" name="openingHour" required type="number" />
            </FormField>
            <FormField htmlFor="gym-closing-hour" label="Fecha às">
              <input className="field" defaultValue={gymSettings.data.data.closingHour} id="gym-closing-hour" max="24" min="1" name="closingHour" required type="number" />
            </FormField>
            <button className="btn btn-secondary" disabled={saveSettings.isPending} type="submit">
              {saveSettings.isPending ? 'Salvando…' : 'Salvar horário'}
            </button>
          </form>
        )}
        {settingsMessage ? <p aria-live="polite" className="m-0 text-sm text-muted">{settingsMessage}</p> : null}
      </section>
      {usage.isPending ? <LoadingState label="Carregando relatório" /> : usage.isError ? <ErrorState error={usage.error} retry={() => void usage.refetch()} /> : (
        <section className="panel mb-5 p-5">
          <h2 className="mb-4 mt-0 text-lg font-semibold">Uso por {usage.data.groupBy === 'area' ? 'área' : 'equipamento'}</h2>
          {usage.data.data.length === 0 ? <EmptyState>Nenhuma utilização encontrada para os filtros selecionados.</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th scope="col">Nome</th><th scope="col">Sessões</th><th scope="col">Tempo total</th></tr></thead>
                <tbody>{usage.data.data.map((row) => <tr key={row._id}><td>{row.name}</td><td>{formatCount(row.sessions)}</td><td>{formatDuration(row.totalDurationSec)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <section className="panel p-5">
        <h2 className="mb-4 mt-0 text-lg font-semibold">Equipamentos ociosos</h2>
        {summary.isPending ? <LoadingState label="Carregando equipamentos ociosos" /> : summary.isError ? <ErrorState error={summary.error} retry={() => void summary.refetch()} /> : summary.data.idleEquipment.equipment.length === 0 ? <EmptyState>Nenhum equipamento ocioso há mais de {summary.data.idleEquipment.thresholdDays} dias.</EmptyState> : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {summary.data.idleEquipment.equipment.map((item) => <li className="flex flex-wrap justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0" key={item.id}><span>{item.name}</span><span className="text-sm text-muted">Sem sessões nos últimos {summary.data.idleEquipment.thresholdDays} dias</span></li>)}
          </ul>
        )}
      </section>
    </>
  );
}
