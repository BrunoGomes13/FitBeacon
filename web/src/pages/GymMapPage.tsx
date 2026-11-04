import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../components/shared';
import { apiFetch } from '../lib/api';
import { getGymMapLayout, percentagePosition } from '../lib/gymMap';
import { useAppTheme } from '../design/ThemeProvider';
import type { Area, Equipment } from '../lib/types';

type ListResult<T> = {
  data: T[];
  pagination: { page: number; pages: number };
};
type Position = { x: number; y: number } | null;

async function fetchAll<T>(path: string): Promise<T[]> {
  const first = await apiFetch<ListResult<T>>(`${path}?page=1&limit=100`);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.pagination.pages - 1) }, (_, index) =>
      apiFetch<ListResult<T>>(`${path}?page=${index + 2}&limit=100`),
    ),
  );
  return [first.data, ...rest.map((page) => page.data)].flat();
}

export function GymMapPage() {
  const client = useQueryClient();
  const { mode } = useAppTheme();
  const areas = useQuery({
    queryKey: ['admin', 'areas', 'map'],
    queryFn: () => fetchAll<Area>('/admin/areas'),
  });
  const equipment = useQuery({
    queryKey: ['admin', 'equipment', 'map'],
    queryFn: () => fetchAll<Equipment>('/admin/equipment'),
  });
  const [positionState, setPositionState] = useState<{
    source: string;
    values: Record<string, Position>;
  } | null>(null);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const data = useMemo(() => equipment.data ?? [], [equipment.data]);
  const areaData = useMemo(() => areas.data ?? [], [areas.data]);
  const dataSource = data.map((item) =>
    `${item._id}:${item.position?.x ?? ''}:${item.position?.y ?? ''}`,
  ).join('|');
  const initialPositions = Object.fromEntries(data.map((item) => [
    item._id,
    item.position ?? null,
  ]));
  const positions = positionState?.source === dataSource
    ? positionState.values
    : initialPositions;

  const displayedEquipment = useMemo(
    () => data.map((item) => ({
      ...item,
      position: Object.hasOwn(positions, item._id) ? positions[item._id] : item.position ?? null,
    })),
    [data, positions],
  );
  const layout = useMemo(
    () => getGymMapLayout(areaData, displayedEquipment, mode),
    [areaData, displayedEquipment, mode],
  );
  const save = useMutation({
    mutationFn: (nextPositions: { equipmentId: string; position: Position }[]) => apiFetch<{ updated: number }>('/admin/equipment/positions', {
      method: 'PUT',
      body: JSON.stringify({ positions: nextPositions }),
    }),
    onSuccess: async ({ updated }) => {
      setSaveMessage(`${updated} posições salvas.`);
      await client.invalidateQueries({ queryKey: ['admin', 'equipment'] });
    },
    onError: (error) => {
      setSaveMessage(error instanceof Error ? error.message : 'Não foi possível salvar as posições.');
    },
  });

  const updatePosition = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (!activePin) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    try {
      const position = percentagePosition(event.clientX, event.clientY, bounds);
      setPositionState({
        source: dataSource,
        values: { ...positions, [activePin]: position },
      });
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Posição inválida.');
    }
  };

  const isPending = areas.isPending || equipment.isPending;
  const error = areas.error ?? equipment.error;

  return (
    <>
      <PageTitle
        title="Mapa da academia"
        description="Arraste os equipamentos pela planta. Os pins sem posição salva usam distribuição automática por área."
        action={(
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-secondary"
              disabled={data.length === 0}
              onClick={() => {
                setPositionState({
                  source: dataSource,
                  values: Object.fromEntries(data.map((item) => [item._id, null])),
                });
                setSaveMessage(null);
                save.mutate(data.map((item) => ({ equipmentId: item._id, position: null })));
              }}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} /> Redefinir para automático
            </button>
            <button
              className="btn btn-primary"
              disabled={save.isPending || data.length === 0}
              onClick={() => save.mutate(data.map((item) => ({
                equipmentId: item._id,
                position: Object.hasOwn(positions, item._id)
                  ? positions[item._id]
                  : item.position ?? null,
              })))}
              type="button"
            >
              <Save aria-hidden="true" size={16} /> {save.isPending ? 'Salvando…' : 'Salvar posições'}
            </button>
          </div>
        )}
      />
      {saveMessage ? <p aria-live="polite" className="mb-4 text-sm text-muted">{saveMessage}</p> : null}
      {isPending ? <LoadingState label="Carregando mapa da academia" /> : null}
      {error ? <ErrorState error={error} retry={() => {
        void areas.refetch();
        void equipment.refetch();
      }} /> : null}
      {!isPending && !error && data.length === 0 ? <EmptyState>Nenhum equipamento cadastrado.</EmptyState> : null}
      {!isPending && !error && data.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <section aria-label="Planta da academia" className="panel min-w-0 p-4 sm:p-6">
            <svg
              aria-label="Planta da academia com equipamentos arrastáveis"
              className="h-auto max-h-[75vh] w-full touch-none rounded-xl"
              onPointerMove={updatePosition}
              onPointerUp={() => setActivePin(null)}
              onPointerCancel={() => setActivePin(null)}
              role="img"
              viewBox={`0 0 360 ${layout.height}`}
            >
              <rect fill="var(--surface)" height={layout.height} rx="18" stroke="var(--border)" strokeWidth="2" width="360" />
              {layout.zones.map((zone) => (
                <g key={zone._id}>
                  <rect fill="var(--surface-raised)" height={zone.height} rx="12" stroke={zone.color} strokeOpacity="0.7" strokeWidth="2" width={zone.width} x={zone.x} y={zone.y} />
                  <text fill={zone.color} fontSize="10" x={zone.x + 8} y={zone.y + 16}>{zone.name.toLocaleUpperCase('pt-BR').slice(0, 24)}</text>
                </g>
              ))}
              {layout.pins.map((pin) => (
                <g
                  aria-label={`${pin.equipment.name}${pin.automatic ? ', posição automática' : ', posição definida'}`}
                  key={pin.equipment._id}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActivePin(pin.equipment._id);
                    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <circle cx={pin.x} cy={pin.y} fill={pin.color} r="15" stroke="white" strokeWidth={activePin === pin.equipment._id ? 4 : 2} />
                  <title>{pin.equipment.name}</title>
                </g>
              ))}
            </svg>
            <ul aria-label="Legenda das áreas" className="m-0 mt-4 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
              {layout.zones.map((zone) => (
                <li className="flex items-center gap-2 text-sm" key={zone._id}>
                  <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: zone.color }} />
                  {zone.name}
                </li>
              ))}
            </ul>
          </section>
          <section className="panel p-4 sm:p-6">
            <h2 className="mb-4 mt-0 text-lg font-semibold">Equipamentos</h2>
            <ul className="m-0 grid list-none gap-3 p-0">
              {layout.pins.map((pin) => (
                <li className="flex min-w-0 items-center justify-between gap-3 border-b border-border pb-3 last:border-0" key={pin.equipment._id}>
                  <span className="min-w-0 truncate">{pin.equipment.name}</span>
                  <span className={pin.automatic ? 'shrink-0 text-xs text-muted' : 'shrink-0 text-xs text-primary'}>
                    {pin.automatic ? 'Automática' : 'Definida'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </>
  );
}
