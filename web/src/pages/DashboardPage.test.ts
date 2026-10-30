import { describe, expect, it } from 'vitest';
import { dashboardKpis } from './DashboardPage';
import type { ReportSummary } from '../lib/types';

const summary: ReportSummary = {
  period: { from: '', to: '' },
  totals: {
    sessions: 1234,
    totalDurationSec: 3600,
    averageDurationSec: 300,
    activeStudents: 18,
    occupancyRate: 12.5,
  },
  rankings: {
    equipment: [
      { _id: 'equipment-1', name: 'Leg press', sessions: 1, totalDurationSec: 1800 },
      { _id: 'equipment-2', name: 'Remada', sessions: 1, totalDurationSec: 1800 },
    ],
    areas: [],
  },
  hourlyUsage: [],
  idleEquipment: { thresholdDays: 7, equipment: [] },
};

describe('dashboardKpis', () => {
  it('formata contagem, tempo médio e taxa como pt-BR', () => {
    const cards = dashboardKpis(summary);

    expect(cards.map((card) => card.value)).toEqual(['1.234', '18', '30 min', '12,5%']);
  });
});
