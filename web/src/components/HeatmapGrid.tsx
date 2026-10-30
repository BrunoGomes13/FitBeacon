import type { HeatmapRow } from '../lib/types';
import { EmptyState } from './shared';

const hours = Array.from({ length: 24 }, (_, hour) => hour);

function colorFor(value: number, max: number): string {
  if (value === 0 || max === 0) return 'color-mix(in srgb, var(--surface-raised) 85%, var(--border))';
  const intensity = Math.max(12, Math.round((value / max) * 90));
  return `color-mix(in srgb, var(--primary) ${intensity}%, var(--surface-raised))`;
}

export function HeatmapGrid({ rows }: { rows: HeatmapRow[] }) {
  if (rows.length === 0) return <EmptyState>Não há sessões para montar o mapa de calor.</EmptyState>;

  const areaNames = [...new Set(rows.map((row) => row.areaName))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const maximum = Math.max(...rows.map((row) => row.sessions));
  const rowMap = new Map(rows.map((row) => [`${row.areaName}:${row.hour}`, row]));

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-md border border-border p-3">
        <div className="grid min-w-[54rem] grid-cols-[8rem_repeat(24,minmax(1.5rem,1fr))] gap-1" role="grid" aria-label="Sessões por área e hora">
          <span className="sr-only">Área e hora UTC</span>
          {hours.map((hour) => (
            <span className="text-center text-[0.625rem] text-muted" key={`hour-${hour}`} role="columnheader">
              {String(hour).padStart(2, '0')}
            </span>
          ))}
          {areaNames.flatMap((areaName) => [
            <span className="truncate self-center text-xs font-medium" key={`${areaName}-label`} role="rowheader">{areaName}</span>,
            ...hours.map((hour) => {
              const row = rowMap.get(`${areaName}:${hour}`);
              const count = row?.sessions ?? 0;
              return (
                <span
                  aria-label={`${areaName}, ${String(hour).padStart(2, '0')}:00 UTC: ${count} sessões`}
                  className="aspect-square min-h-6 rounded-[0.25rem]"
                  key={`${areaName}-${hour}`}
                  role="gridcell"
                  style={{ backgroundColor: colorFor(count, maximum) }}
                  title={`${areaName} · ${String(hour).padStart(2, '0')}:00 UTC · ${count} sessões · ${row?.totalDurationSec ?? 0} s`}
                />
              );
            }),
          ])}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 text-xs text-muted" aria-label="Legenda de intensidade">
        <span>Menos</span>
        {[0, 0.25, 0.5, 0.75, 1].map((level) => (
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded"
            key={level}
            style={{ backgroundColor: colorFor(Math.ceil(maximum * level), maximum) }}
          />
        ))}
        <span>Mais</span>
      </div>
    </div>
  );
}
