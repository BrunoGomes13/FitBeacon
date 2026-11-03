import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HourRow } from '../lib/types';
import { EmptyState } from './shared';

export function UsageChart({ rows }: { rows: HourRow[] }) {
  if (rows.length === 0) return <EmptyState>Nenhuma sessão no período.</EmptyState>;
  const peakIndex = rows.reduce(
    (peak, row, index) => row.sessions > rows[peak].sessions ? index : peak,
    0,
  );
  const leastUsedIndex = rows.reduce(
    (least, row, index) => row.sessions < rows[least].sessions ? index : least,
    0,
  );

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="_id"
            tickFormatter={(hour: number) => `${String(hour).padStart(2, '0')}h`}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '0.875rem',
            }}
            labelFormatter={(hour) => `${String(hour).padStart(2, '0')}:00 UTC`}
          />
          <defs>
            <linearGradient id="usageGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--primary-end)" />
            </linearGradient>
          </defs>
          <Bar dataKey="sessions" name="Sessões" radius={[6, 6, 0, 0]}>
            {rows.map((row, index) => (
              <Cell
                fill={
                  index === peakIndex
                    ? 'var(--success)'
                    : index === leastUsedIndex
                      ? 'var(--warning)'
                      : 'url(#usageGradient)'
                }
                key={`${row._id}-${index}`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
