import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HourRow } from '../lib/types';
import { EmptyState } from './shared';

export function UsageChart({ rows }: { rows: HourRow[] }) {
  if (rows.length === 0) return <EmptyState>Nenhuma sessão no período.</EmptyState>;

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
          <Bar dataKey="sessions" name="Sessões" fill="var(--primary)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
