import type { Area, Equipment } from './types';

import type { ThemeMode } from '../design/theme';

export const gymMapColors = {
  dark: ['#2A96FF', '#28DB9E', '#E0B24A', '#00B6F7', '#B68CFF', '#FF6B4A', '#43C59E', '#F08CB8'],
  light: ['#0069D9', '#0E7D59', '#805400', '#006A8A', '#6941C6', '#C13D22', '#0B6B52', '#9C2D61'],
} as const;

export function getGymMapLayout(areas: Area[], equipment: Equipment[], mode: ThemeMode = 'dark') {
  const rows = Math.max(1, Math.ceil(areas.length / 2));
  const zoneHeight = Math.min(150, 440 / rows);
  const height = Math.max(500, 48 + rows * 150);
  const zones = areas.map((area, index) => ({
    ...area,
    color: gymMapColors[mode][index % gymMapColors[mode].length],
    x: 12 + (index % 2) * 174,
    y: 38 + Math.floor(index / 2) * zoneHeight,
    width: 162,
    height: Math.max(84, zoneHeight - 8),
  }));
  const zoneByArea = new Map(zones.map((zone) => [zone._id, zone]));
  const totals = new Map<string, number>();
  const offsets = new Map<string, number>();
  for (const item of equipment) {
    const areaId = typeof item.areaId === 'string' ? item.areaId : item.areaId._id;
    totals.set(areaId, (totals.get(areaId) ?? 0) + 1);
  }
  const pins = equipment.flatMap((item) => {
    const areaId = typeof item.areaId === 'string' ? item.areaId : item.areaId._id;
    const zone = zoneByArea.get(areaId);
    if (!zone) return [];
    const index = offsets.get(areaId) ?? 0;
    offsets.set(areaId, index + 1);
    const total = totals.get(areaId) ?? 1;
    const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
    const rowsForArea = Math.ceil(total / columns);
    const automatic = {
      x: zone.x + zone.width * ((index % columns + 1) / (columns + 1)),
      y: zone.y + zone.height * (Math.floor(index / columns) + 1) / (rowsForArea + 1),
    };
    const position = item.position
      ? { x: item.position.x * 3.6, y: item.position.y * height / 100 }
      : automatic;
    return [{
      equipment: item,
      areaId,
      color: zone.color,
      automatic: !item.position,
      x: position.x,
      y: position.y,
    }];
  });
  return { zones, pins, height };
}

export function percentagePosition(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (bounds.width <= 0 || bounds.height <= 0) throw new Error('A planta está indisponível para posicionamento.');
  const x = ((clientX - bounds.left) / bounds.width) * 100;
  const y = ((clientY - bounds.top) / bounds.height) * 100;
  if (x < 0 || x > 100 || y < 0 || y > 100) {
    throw new Error('A posição deve ficar dentro dos limites da planta.');
  }
  return { x: Math.round(x), y: Math.round(y) };
}
