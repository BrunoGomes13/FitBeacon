import type { Equipment } from '../api/schemas';

export const equipmentAreaFilters = ['Todos', 'Musculação', 'Cardio', 'Funcional', 'Livre'] as const;
export type EquipmentAreaFilter = (typeof equipmentAreaFilters)[number];

export function getEquipmentAreaFilter(areaName: string): EquipmentAreaFilter {
  const normalized = areaName.toLocaleLowerCase('pt-BR');
  if (normalized.includes('cardio')) return 'Cardio';
  if (normalized.includes('funcional')) return 'Funcional';
  if (normalized.includes('livre')) return 'Livre';
  if (normalized.includes('muscula') || normalized.includes('membro') || normalized.includes('força')) {
    return 'Musculação';
  }
  return 'Todos';
}

function areaMatchesFilter(areaName: string, filter: EquipmentAreaFilter): boolean {
  if (filter === 'Todos') return true;
  const normalized = areaName.toLocaleLowerCase('pt-BR');
  if (filter === 'Musculação') {
    return normalized.includes('muscula') || normalized.includes('membro') || normalized.includes('força');
  }
  if (filter === 'Livre') {
    return normalized.includes('livre') || normalized.includes('peso livre');
  }
  return normalized.includes(filter.toLocaleLowerCase('pt-BR'));
}

export function filterEquipment(
  equipment: readonly Equipment[],
  area: EquipmentAreaFilter,
  search: string,
): Equipment[] {
  const query = search.trim().toLocaleLowerCase('pt-BR');

  return equipment.filter((item) => {
    const areaMatches = areaMatchesFilter(item.areaId.name, area);
    const queryMatches = !query
      || `${item.name} ${item.areaId.name} ${item.beacon.minor}`
        .toLocaleLowerCase('pt-BR')
        .includes(query);
    return areaMatches && queryMatches;
  });
}
