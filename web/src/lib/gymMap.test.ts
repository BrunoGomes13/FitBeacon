import { describe, expect, it } from 'vitest';
import { getGymMapLayout, percentagePosition } from './gymMap';
import { getContrastRatio } from '../design/theme';
import type { Area, Equipment } from './types';

const areas: Area[] = [
  { _id: 'lower', name: 'Membros inferiores', description: '', isActive: true },
  { _id: 'upper', name: 'Membros superiores', description: '', isActive: true },
  { _id: 'cardio', name: 'Cardio', description: '', isActive: true },
  { _id: 'functional', name: 'Funcional', description: '', isActive: true },
];

const equipment: Equipment[] = areas.map((area, index) => ({
  _id: `equipment-${index}`,
  name: `Equipamento ${index}`,
  gymId: 'gym',
  areaId: area,
  position: null,
  beacon: { uuid: '00000000-0000-4000-8000-000000000001', major: 1, minor: index + 1, txPower: -59, rssiEnter: -70, rssiExit: -78 },
  adjustments: [],
  exerciseIds: [],
  media: {},
  isActive: true,
}));

describe('gymMap', () => {
  it('creates a zone and an automatic pin for every real area and equipment', () => {
    const layout = getGymMapLayout(areas, equipment);
    expect(layout.zones.map(({ _id }) => _id)).toEqual(areas.map(({ _id }) => _id));
    expect(layout.pins.map(({ equipment: item, automatic }) => [item._id, automatic])).toEqual(
      equipment.map((item) => [item._id, true]),
    );
    expect(new Set(layout.pins.map(({ color }) => color)).size).toBe(4);
  });

  it('uses admin positions and resets to automatic by receiving null', () => {
    const manuallyPositioned = { ...equipment[0], position: { x: 80, y: 25 } };
    const manualLayout = getGymMapLayout(areas, [manuallyPositioned]);
    expect(manualLayout.pins[0]).toMatchObject({ automatic: false, x: 288, y: 125 });
    const resetLayout = getGymMapLayout(areas, [{ ...manuallyPositioned, position: null }]);
    expect(resetLayout.pins[0].automatic).toBe(true);
    expect(resetLayout.pins[0].x).not.toBe(288);
  });

  it('validates map coordinates before they are saved', () => {
    expect(percentagePosition(50, 25, { left: 0, top: 0, width: 100, height: 100 })).toEqual({ x: 50, y: 25 });
    expect(() => percentagePosition(101, 25, { left: 0, top: 0, width: 100, height: 100 })).toThrow(/limites/);
    expect(() => percentagePosition(10, 10, { left: 0, top: 0, width: 0, height: 100 })).toThrow(/indisponível/);
  });

  it('uses area colors with readable contrast in light and dark themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const layout = getGymMapLayout(areas, equipment, mode);
      const surface = mode === 'light' ? '#EEF4FA' : '#0C2744';
      for (const zone of layout.zones) {
        expect(getContrastRatio(zone.color, surface), `${mode}: ${zone.name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
