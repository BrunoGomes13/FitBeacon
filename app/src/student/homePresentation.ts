import type { Equipment } from '../api/schemas';

export function shouldShowNearbyEquipmentBanner(
  equipment: Equipment | null,
): equipment is Equipment {
  return equipment !== null;
}

export function getEquipmentRoute(equipment: Equipment): string {
  const { uuid, major, minor } = equipment.beacon;
  return `/equipment?equipmentId=${encodeURIComponent(equipment._id)}&uuid=${encodeURIComponent(uuid)}&major=${major}&minor=${minor}`;
}
