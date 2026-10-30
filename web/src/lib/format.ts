export function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  return `${new Intl.NumberFormat('pt-BR').format(Math.round(seconds / 60))} min`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`;
}

export function defaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}
