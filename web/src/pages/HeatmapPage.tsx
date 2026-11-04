import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { HeatmapGrid } from '../components/HeatmapGrid';
import { PeriodFilter } from '../components/PeriodFilter';
import { ReportDataFilters } from '../components/ReportDataFilters';
import { EmptyState, ErrorState, FormField, LoadingState, PageTitle } from '../components/shared';
import { apiFetch } from '../lib/api';
import { defaultPeriod } from '../lib/format';
import type { Area, Equipment, HeatmapRow } from '../lib/types';

type ListResult<T> = { data: T[] };
type HeatmapResult = { data: HeatmapRow[]; period: { from: string; to: string } };

export function HeatmapPage() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [areaId, setAreaId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [includeDemo, setIncludeDemo] = useState(false);
  const [origin, setOrigin] = useState<'' | 'beacon' | 'manual'>('');
  const areas = useQuery({ queryKey: ['admin', 'areas'], queryFn: () => apiFetch<ListResult<Area>>('/admin/areas?limit=100') });
  const equipment = useQuery({ queryKey: ['admin', 'equipment'], queryFn: () => apiFetch<ListResult<Equipment>>('/admin/equipment?limit=100') });
  const params = new URLSearchParams({
    from: period.from,
    to: period.to,
  });
  if (areaId) params.set('areaId', areaId);
  if (equipmentId) params.set('equipmentId', equipmentId);
  if (includeDemo) params.set('includeDemo', 'true');
  if (origin) params.set('origin', origin);
  const query = useQuery({
    queryKey: ['reports', 'heatmap', period.from, period.to, areaId, equipmentId, includeDemo, origin],
    queryFn: () => apiFetch<HeatmapResult>(`/reports/heatmap?${params}`),
  });

  return (
    <>
      <PageTitle title="Mapa de calor" description="Sessões agregadas por área e hora local da academia, sem identificação de alunos." />
      <section className="panel mb-5 grid gap-4 p-5 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <PeriodFilter from={period.from} to={period.to} setFrom={(from) => setPeriod((current) => ({ ...current, from }))} setTo={(to) => setPeriod((current) => ({ ...current, to }))} />
        <FormField htmlFor="heatmap-area" label="Área">
          <select className="field min-w-40" id="heatmap-area" onChange={(event) => setAreaId(event.target.value)} value={areaId}>
            <option value="">Todas</option>
            {(areas.data?.data ?? []).map((area) => <option key={area._id} value={area._id}>{area.name}</option>)}
          </select>
        </FormField>
        <FormField htmlFor="heatmap-equipment" label="Equipamento">
          <select className="field min-w-40" id="heatmap-equipment" onChange={(event) => setEquipmentId(event.target.value)} value={equipmentId}>
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
      <section className="panel p-5">
        <h2 className="mb-4 mt-0 text-lg font-semibold">Área × horário local</h2>
        {query.isPending ? <LoadingState label="Carregando mapa de calor" /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data.data.length === 0 ? <EmptyState>Não há sessões para os filtros selecionados.</EmptyState> : <HeatmapGrid rows={query.data.data} />}
      </section>
    </>
  );
}
