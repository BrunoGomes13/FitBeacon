import type { Equipment } from '../api/schemas';
import type { ThemeMode } from '../theme';

export const areaColorPalette = {
  dark: ['#2A96FF', '#28DB9E', '#E0B24A', '#00B6F7', '#B68CFF', '#FF6B4A', '#43C59E', '#F08CB8'],
  light: ['#0069D9', '#0E7D59', '#805400', '#006A8A', '#6941C6', '#C13D22', '#0B6B52', '#9C2D61'],
} as const;

export type MapArea = { _id: string; name: string };
export type MapZone = MapArea & {
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getMapZones(areas: readonly MapArea[], mode: ThemeMode = 'dark'): MapZone[] {
  const rows = Math.max(1, Math.ceil(areas.length / 2));
  const zoneHeight = Math.min(150, 440 / rows);
  return areas.map((area, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    return {
      ...area,
      color: areaColorPalette[mode][index % areaColorPalette[mode].length],
      x: 12 + column * 174,
      y: 38 + row * zoneHeight,
      width: 162,
      height: Math.max(84, zoneHeight - 8),
    };
  });
}

export function getPositionedEquipment(
  equipment: readonly Equipment[],
  areas: readonly MapArea[],
  mode: ThemeMode = 'dark',
) {
  const zones = getMapZones(areas, mode);
  const zoneByArea = new Map(zones.map((zone) => [zone._id, zone]));
  const counts = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const item of equipment) {
    const areaId = item.areaId._id;
    totals.set(areaId, (totals.get(areaId) ?? 0) + 1);
  }
  const height = Math.max(500, 48 + Math.ceil(areas.length / 2) * 150);
  return equipment.map((item) => {
    const areaId = item.areaId._id;
    const zone = zoneByArea.get(areaId);
    if (!zone) return null;
    const index = counts.get(areaId) ?? 0;
    counts.set(areaId, index + 1);
    const total = totals.get(areaId) ?? 1;
    const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
    const row = Math.floor(index / columns);
    const column = index % columns;
    const autoPosition = {
      x: zone.x + zone.width * ((column + 1) / (columns + 1)),
      y: zone.y + zone.height * ((row + 1) / (Math.ceil(total / columns) + 1)),
    };
    const position = item.position
      ? { x: item.position.x * 3.6, y: item.position.y * height / 100 }
      : autoPosition;
    return {
      equipment: item,
      position,
      color: zone.color,
      height,
      automatic: !item.position,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

export function isDetectedEquipment(
  equipmentId: string,
  detectedEquipmentId: string | undefined,
): boolean {
  return Boolean(detectedEquipmentId && equipmentId === detectedEquipmentId);
}
