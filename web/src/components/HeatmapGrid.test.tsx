import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeatmapGrid } from './HeatmapGrid';

describe('HeatmapGrid', () => {
  it('mostra sessões por área e hora com tooltip acessível', () => {
    render(<HeatmapGrid rows={[
      { areaId: 'area-1', areaName: 'Peso livre', hour: 9, sessions: 4, totalDurationSec: 1200 },
    ]} />);

    expect(screen.getByRole('grid', { name: 'Sessões por área e hora' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Peso livre, 09:00 UTC: 4 sessões' })).toHaveAttribute(
      'title',
      'Peso livre · 09:00 UTC · 4 sessões · 1200 s',
    );
    expect(screen.getByLabelText('Legenda de intensidade')).toBeInTheDocument();
  });
});
