export type BeaconIdentity = {
  key: string;
  uuid: string;
  major: number;
  minor: number;
};

export type BeaconAdvertisement = BeaconIdentity & {
  txPower: number;
};

export type BeaconReading = BeaconAdvertisement & {
  rssi: number;
  observedAt: number;
};

export type BeaconZoneState = 'outside' | 'entering' | 'inside';

export type BeaconSessionEndReason =
  'signal-lost' | 'zone-exit' | 'beacon-switch' | 'stopped';

export type BeaconSession = {
  beacon: BeaconIdentity;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  reason: BeaconSessionEndReason;
};

export type BeaconEvent =
  | {
      type: 'zone-enter';
      beacon: BeaconIdentity;
      at: number;
      smoothedRssi: number;
    }
  | {
      type: 'zone-exit';
      beacon: BeaconIdentity;
      at: number;
      smoothedRssi: number;
    }
  | {
      type: 'session-start';
      beacon: BeaconIdentity;
      at: number;
    }
  | {
      type: 'session-end';
      session: BeaconSession;
    }
  | {
      type: 'session-discarded';
      session: BeaconSession;
    };

export type BeaconSnapshot = {
  activeBeaconKey: string | null;
  zoneState: BeaconZoneState;
  nearby: Array<
    BeaconReading & {
      smoothedRssi: number;
      state: 'inside' | 'outside' | 'candidate';
    }
  >;
  candidateBeaconKey: string | null;
  events: BeaconEvent[];
  completedSessions: BeaconSession[];
};

export type BeaconAdapterState =
  'unknown' | 'poweredOn' | 'poweredOff' | 'unauthorized' | 'unsupported' | 'error';

export type BeaconProviderState =
  { status: 'idle' } | { status: 'scanning' } | { status: 'error'; message: string };

export type MockScenario = 'approach' | 'exit' | 'vary' | 'switch';

export interface BeaconProvider {
  readonly kind: 'real' | 'mock';
  start(
    onReading: (reading: BeaconReading) => void,
    onState: (state: BeaconProviderState) => void,
  ): Promise<void>;
  stop(): Promise<void>;
  readonly simulate?: (scenario: MockScenario) => void;
}

export type BeaconPermissionStatus =
  'unknown' | 'granted' | 'denied' | 'denied-permanently';

export type BeaconPermissionSnapshot = {
  status: BeaconPermissionStatus;
  locationServicesEnabled: boolean | null;
  message: string | null;
};
