import type { Equipment } from '../api/schemas';

export const areaMapColors = {
  strength: '#168CFF',
  cardio: '#28DB9E',
  functional: '#E0B24A',
  other: '#8FA3BA',
} as const;

export function getAreaMapColor(areaName: string): string {
  const normalized = areaName.toLocaleLowerCase('pt-BR');
  if (normalized.includes('cardio')) return areaMapColors.cardio;
  if (normalized.includes('funcional')) return areaMapColors.functional;
  if (
    normalized.includes('muscula')
    || normalized.includes('força')
    || normalized.includes('membro')
  ) {
    return areaMapColors.strength;
  }
  return areaMapColors.other;
}

export function getPositionedEquipment(equipment: readonly Equipment[]) {
  return equipment.flatMap((item) =>
    item.position ? [{ equipment: item, position: item.position }] : [],
  );
}

export function isDetectedEquipment(
  equipmentId: string,
  detectedEquipmentId: string | undefined,
): boolean {
  return Boolean(detectedEquipmentId && equipmentId === detectedEquipmentId);
}
