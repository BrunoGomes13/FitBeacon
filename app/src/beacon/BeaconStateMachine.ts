import {
  DEFAULT_BEACON_THRESHOLDS,
  resolveBeaconThresholds,
  type BeaconMachineOptions,
  type BeaconThresholds,
} from './config.ts';
import type {
  BeaconEvent,
  BeaconIdentity,
  BeaconReading,
  BeaconSession,
  BeaconSnapshot,
  BeaconZoneState,
} from './types';

type SignalTracker = {
  beacon: BeaconIdentity;
  readings: number[];
  smoothedRssi: number;
  lastReadingAt: number;
  rawRssi: number;
  txPower: number;
  state: BeaconZoneState;
  entryReadings: number;
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function identityOf(reading: BeaconReading): BeaconIdentity {
  return {
    key: reading.key,
    uuid: reading.uuid,
    major: reading.major,
    minor: reading.minor,
  };
}

function isValidReading(reading: BeaconReading): boolean {
  return (
    Number.isFinite(reading.rssi) &&
    Number.isFinite(reading.txPower) &&
    Number.isFinite(reading.observedAt) &&
    reading.observedAt >= 0 &&
    reading.key.length > 0
  );
}

export class BeaconStateMachine {
  private readonly options: BeaconMachineOptions;
  private readonly signals = new Map<string, SignalTracker>();
  private activeBeaconKey: string | null = null;
  private activeSession: { beacon: BeaconIdentity; startedAt: number } | null = null;
  private candidateBeaconKey: string | null = null;
  private candidateSince: number | null = null;
  private lastEvents: BeaconEvent[] = [];
  private readonly completedSessions: BeaconSession[] = [];

  constructor(options: BeaconMachineOptions = {}) {
    this.options = options;
  }

  update(reading: BeaconReading): BeaconEvent[] {
    if (!isValidReading(reading)) {
      return this.finish([]);
    }

    const events = this.collectExpiredSignals(reading.observedAt);
    let tracker = this.signals.get(reading.key);
    const thresholds = this.thresholdsFor(reading);

    if (!tracker) {
      tracker = {
        beacon: identityOf(reading),
        readings: [],
        smoothedRssi: reading.rssi,
        lastReadingAt: reading.observedAt,
        rawRssi: reading.rssi,
        txPower: reading.txPower,
        state: 'outside',
        entryReadings: 0,
      };
      this.signals.set(reading.key, tracker);
    }

    tracker.readings.push(reading.rssi);

    if (tracker.readings.length > thresholds.medianWindowSize) {
      tracker.readings.shift();
    }

    const medianRssi = median(tracker.readings);
    tracker.smoothedRssi =
      tracker.readings.length === 1
        ? medianRssi
        : thresholds.emaAlpha * medianRssi +
          (1 - thresholds.emaAlpha) * tracker.smoothedRssi;
    tracker.rawRssi = reading.rssi;
    tracker.txPower = reading.txPower;
    tracker.lastReadingAt = reading.observedAt;

    if (tracker.state === 'inside') {
      if (tracker.smoothedRssi < thresholds.rssiExit) {
        tracker.state = 'outside';
        tracker.entryReadings = 0;
        events.push({
          type: 'zone-exit',
          beacon: tracker.beacon,
          at: reading.observedAt,
          smoothedRssi: tracker.smoothedRssi,
        });

        if (this.activeBeaconKey === reading.key) {
          this.endActiveSession(reading.observedAt, 'zone-exit', events);
        }
      }
    } else if (tracker.smoothedRssi > thresholds.rssiEnter) {
      tracker.entryReadings += 1;
      tracker.state = 'entering';

      if (tracker.entryReadings >= thresholds.entryConfirmations) {
        tracker.state = 'inside';
        tracker.entryReadings = 0;
        events.push({
          type: 'zone-enter',
          beacon: tracker.beacon,
          at: reading.observedAt,
          smoothedRssi: tracker.smoothedRssi,
        });

        if (this.activeBeaconKey === null) {
          this.beginActiveSession(tracker, reading.observedAt, events);
        }
      }
    } else {
      tracker.state = 'outside';
      tracker.entryReadings = 0;
    }

    this.evaluateSwitch(reading.observedAt, events);
    return this.finish(events);
  }

  tick(now: number): BeaconEvent[] {
    if (!Number.isFinite(now) || now < 0) {
      return this.finish([]);
    }

    const events = this.collectExpiredSignals(now);
    this.evaluateSwitch(now, events);
    return this.finish(events);
  }

  getSnapshot(): BeaconSnapshot {
    return {
      activeBeaconKey: this.activeBeaconKey,
      zoneState: this.activeBeaconKey
        ? (this.signals.get(this.activeBeaconKey)?.state ?? 'outside')
        : 'outside',
      nearby: [...this.signals.values()]
        .sort((first, second) => second.lastReadingAt - first.lastReadingAt)
        .map((tracker) => ({
          ...tracker.beacon,
          txPower: tracker.txPower,
          rssi: tracker.rawRssi,
          observedAt: tracker.lastReadingAt,
          smoothedRssi: tracker.smoothedRssi,
          state:
            tracker.state === 'inside'
              ? 'inside'
              : tracker.state === 'entering'
                ? 'candidate'
                : 'outside',
        })),
      candidateBeaconKey: this.candidateBeaconKey,
      events: [...this.lastEvents],
      completedSessions: [...this.completedSessions],
    };
  }

  reset(now: number): BeaconEvent[] {
    const events: BeaconEvent[] = [];

    if (this.activeSession) {
      this.endActiveSession(now, 'stopped', events);
    }

    this.signals.clear();
    this.candidateBeaconKey = null;
    this.candidateSince = null;
    this.activeBeaconKey = null;
    return this.finish(events);
  }

  private thresholdsFor(beacon: BeaconIdentity): BeaconThresholds {
    return resolveBeaconThresholds(beacon, this.options);
  }

  private collectExpiredSignals(now: number): BeaconEvent[] {
    const events: BeaconEvent[] = [];

    for (const [key, tracker] of this.signals) {
      const thresholds = this.thresholdsFor(tracker.beacon);

      if (now - tracker.lastReadingAt < thresholds.noSignalTimeoutMs) {
        continue;
      }

      const hadEnteredZone = tracker.state === 'inside';

      if (tracker.state === 'inside' || tracker.state === 'entering') {
        tracker.state = 'outside';
        tracker.entryReadings = 0;
      }

      const endedAt = tracker.lastReadingAt + thresholds.noSignalTimeoutMs;

      if (hadEnteredZone && this.activeBeaconKey !== key) {
        events.push({
          type: 'zone-exit',
          beacon: tracker.beacon,
          at: endedAt,
          smoothedRssi: tracker.smoothedRssi,
        });
      }

      if (this.candidateBeaconKey === key) {
        this.candidateBeaconKey = null;
        this.candidateSince = null;
      }

      if (this.activeBeaconKey === key) {
        events.push({
          type: 'zone-exit',
          beacon: tracker.beacon,
          at: endedAt,
          smoothedRssi: tracker.smoothedRssi,
        });
        this.endActiveSession(endedAt, 'signal-lost', events);
      }

      this.signals.delete(key);
    }

    return events;
  }

  private evaluateSwitch(now: number, events: BeaconEvent[]): void {
    if (!this.activeBeaconKey || !this.activeSession) {
      this.candidateBeaconKey = null;
      this.candidateSince = null;
      return;
    }

    const active = this.signals.get(this.activeBeaconKey);

    if (!active) {
      return;
    }

    const activeThresholds = this.thresholdsFor(active.beacon);
    const challenger = [...this.signals.values()]
      .filter(
        (tracker) =>
          tracker.beacon.key !== this.activeBeaconKey &&
          tracker.state === 'inside' &&
          now - tracker.lastReadingAt <
            this.thresholdsFor(tracker.beacon).noSignalTimeoutMs &&
          tracker.smoothedRssi >= active.smoothedRssi + activeThresholds.switchMarginDb,
      )
      .sort((first, second) => second.smoothedRssi - first.smoothedRssi)[0];

    if (!challenger) {
      this.candidateBeaconKey = null;
      this.candidateSince = null;
      return;
    }

    if (this.candidateBeaconKey !== challenger.beacon.key) {
      this.candidateBeaconKey = challenger.beacon.key;
      this.candidateSince = now;
      return;
    }

    const switchThresholds = this.thresholdsFor(challenger.beacon);

    if (
      this.candidateSince !== null &&
      now - this.candidateSince >= switchThresholds.switchDelayMs
    ) {
      this.endActiveSession(now, 'beacon-switch', events);
      this.beginActiveSession(challenger, now, events);
    }
  }

  private beginActiveSession(
    tracker: SignalTracker,
    at: number,
    events: BeaconEvent[],
  ): void {
    this.activeBeaconKey = tracker.beacon.key;
    this.activeSession = { beacon: tracker.beacon, startedAt: at };
    this.candidateBeaconKey = null;
    this.candidateSince = null;
    events.push({
      type: 'session-start',
      beacon: tracker.beacon,
      at,
    });
  }

  private endActiveSession(
    at: number,
    reason: BeaconSession['reason'],
    events: BeaconEvent[],
  ): void {
    if (!this.activeSession) {
      this.activeBeaconKey = null;
      return;
    }

    const session: BeaconSession = {
      beacon: this.activeSession.beacon,
      startedAt: this.activeSession.startedAt,
      endedAt: at,
      durationMs: Math.max(0, at - this.activeSession.startedAt),
      reason,
    };
    const minimumDuration = this.thresholdsFor(
      this.activeSession.beacon,
    ).minimumSessionDurationMs;

    if (session.durationMs < minimumDuration) {
      events.push({ type: 'session-discarded', session });
    } else {
      this.completedSessions.push(session);
      events.push({ type: 'session-end', session });

      if (this.completedSessions.length > 20) {
        this.completedSessions.shift();
      }
    }

    this.activeSession = null;
    this.activeBeaconKey = null;
  }

  private finish(events: BeaconEvent[]): BeaconEvent[] {
    this.lastEvents = events;
    return events;
  }
}

export { DEFAULT_BEACON_THRESHOLDS };
