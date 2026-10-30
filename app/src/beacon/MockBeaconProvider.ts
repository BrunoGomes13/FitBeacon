import type {
  BeaconProvider,
  BeaconProviderState,
  BeaconReading,
  MockScenario,
} from './types';

export class MockBeaconProvider implements BeaconProvider {
  readonly kind = 'mock' as const;
  readonly simulate = (scenario: MockScenario): void => {
    this.scenario = scenario;
    this.step = 0;

    if (scenario === 'exit') {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      return;
    }

    if (this.onReading && !this.interval) {
      this.interval = setInterval(() => this.emitReading(), 500);
      this.emitReading();
    }
  };
  private interval: ReturnType<typeof setInterval> | null = null;
  private onReading: ((reading: BeaconReading) => void) | null = null;
  private onState: ((state: BeaconProviderState) => void) | null = null;
  private scenario: MockScenario = 'approach';
  private step = 0;

  async start(
    onReading: (reading: BeaconReading) => void,
    onState: (state: BeaconProviderState) => void,
  ): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.onReading = onReading;
    this.onState = onState;
    this.onState({ status: 'scanning' });
    this.interval = setInterval(() => this.emitReading(), 500);
    this.emitReading();
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.onReading = null;
    this.onState = null;
  }

  private emitReading(): void {
    this.step += 1;
    const observedAt = Date.now();
    const firstBeaconRssi =
      this.scenario === 'approach'
        ? Math.min(-54, -94 + this.step * 4)
        : this.scenario === 'exit'
          ? Math.max(-94, -54 - this.step * 5)
          : this.scenario === 'switch'
            ? -69 + Math.round(Math.sin(this.step) * 2)
            : -66 + Math.round(Math.sin(this.step * 1.7) * 7);

    const firstBeacon = this.getMockBeacon(1);
    this.onReading?.({ ...firstBeacon, rssi: firstBeaconRssi, observedAt });

    if (this.scenario === 'switch' && this.step > 6) {
      const secondBeacon = this.getMockBeacon(2);
      this.onReading?.({
        ...secondBeacon,
        rssi: -58 + Math.round(Math.sin(this.step) * 2),
        observedAt,
      });
    }
  }

  private getMockBeacon(minor: number) {
    const configuredUuid = process.env.EXPO_PUBLIC_BEACON_GYM_UUID?.trim().toLowerCase();
    const uuid = configuredUuid ?? '00000000-0000-4000-8000-000000000001';

    return {
      key: `${uuid}:1:${minor}`,
      uuid,
      major: 1,
      minor,
      txPower: -59,
    };
  }
}
