import type { BeaconIdentity } from './types';

export const DEFAULT_BEACON_THRESHOLDS = {
  medianWindowSize: 5,
  emaAlpha: 0.3,
  rssiEnter: -70,
  rssiExit: -78,
  entryConfirmations: 3,
  switchMarginDb: 6,
  switchDelayMs: 2_000,
  noSignalTimeoutMs: 15_000,
  minimumSessionDurationMs: 20_000,
} as const;

export type BeaconThresholds = {
  medianWindowSize: number;
  emaAlpha: number;
  rssiEnter: number;
  rssiExit: number;
  entryConfirmations: number;
  switchMarginDb: number;
  switchDelayMs: number;
  noSignalTimeoutMs: number;
  minimumSessionDurationMs: number;
};

export type BeaconThresholdOverrides = Partial<BeaconThresholds>;

export type BeaconMachineOptions = {
  defaultThresholds?: BeaconThresholdOverrides;
  equipmentThresholds?: Readonly<Record<string, BeaconThresholdOverrides>>;
  thresholdsForEquipment?: (
    beacon: BeaconIdentity,
  ) => BeaconThresholdOverrides | undefined;
};

export function getGymBeaconUuid(): string {
  const configured = process.env.EXPO_PUBLIC_BEACON_GYM_UUID?.trim().toLowerCase();
  const uuid = configured ?? '00000000-0000-4000-8000-000000000001';

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
    throw new Error('EXPO_PUBLIC_BEACON_GYM_UUID precisa ser um UUID válido.');
  }

  return uuid;
}

export function resolveBeaconThresholds(
  beacon: BeaconIdentity,
  options: BeaconMachineOptions,
): BeaconThresholds {
  const configured = {
    ...DEFAULT_BEACON_THRESHOLDS,
    ...options.defaultThresholds,
    ...options.equipmentThresholds?.[beacon.key],
    ...options.thresholdsForEquipment?.(beacon),
  };

  if (
    !Number.isInteger(configured.medianWindowSize) ||
    configured.medianWindowSize < 1 ||
    !Number.isFinite(configured.emaAlpha) ||
    configured.emaAlpha <= 0 ||
    configured.emaAlpha > 1 ||
    !Number.isFinite(configured.rssiEnter) ||
    !Number.isFinite(configured.rssiExit) ||
    configured.rssiExit >= configured.rssiEnter ||
    !Number.isInteger(configured.entryConfirmations) ||
    configured.entryConfirmations < 1 ||
    !Number.isFinite(configured.switchMarginDb) ||
    configured.switchMarginDb < 0 ||
    !Number.isFinite(configured.switchDelayMs) ||
    configured.switchDelayMs < 0 ||
    !Number.isFinite(configured.noSignalTimeoutMs) ||
    configured.noSignalTimeoutMs <= 0 ||
    !Number.isFinite(configured.minimumSessionDurationMs) ||
    configured.minimumSessionDurationMs < 0
  ) {
    throw new Error(`Limiares inválidos para o equipamento ${beacon.key}.`);
  }

  return configured;
}
