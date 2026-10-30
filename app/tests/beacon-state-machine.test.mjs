import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BeaconStateMachine } from '../src/beacon/BeaconStateMachine.ts';

const beacon = (minor) => ({
  key: `b9407f30-f5f8-466e-aff9-25556b57fe6d:1:${minor}`,
  uuid: 'b9407f30-f5f8-466e-aff9-25556b57fe6d',
  major: 1,
  minor,
  txPower: -59,
});

function createMachine() {
  return new BeaconStateMachine({
    defaultThresholds: {
      medianWindowSize: 1,
      emaAlpha: 1,
    },
  });
}

function reading(minor, rssi, observedAt) {
  return { ...beacon(minor), rssi, observedAt };
}

function enter(machine, minor, rssi = -65, startAt = 1_000) {
  machine.update(reading(minor, rssi, startAt));
  machine.update(reading(minor, rssi, startAt + 500));
  return machine.update(reading(minor, rssi, startAt + 1_000));
}

test('enters after three consecutive readings above the entry threshold', () => {
  const machine = createMachine();

  assert.equal(
    enter(machine, 3).some((event) => event.type === 'zone-enter'),
    true,
  );
  assert.equal(machine.getSnapshot().activeBeaconKey, beacon(3).key);
  assert.equal(machine.getSnapshot().zoneState, 'inside');
});

test('requires a signal strictly stronger than the exact -70 dBm entry threshold', () => {
  const machine = createMachine();

  machine.update(reading(3, -70, 1_000));
  machine.update(reading(3, -70, 1_500));
  const boundaryEvents = machine.update(reading(3, -70, 2_000));

  assert.equal(boundaryEvents.some((event) => event.type === 'zone-enter'), false);
  assert.equal(machine.getSnapshot().activeBeaconKey, null);
  assert.equal(
    enter(machine, 3, -69, 2_500).some((event) => event.type === 'zone-enter'),
    true,
  );
});

test('does not exit at exactly -78 dBm, but exits below the threshold', () => {
  const machine = createMachine();
  enter(machine, 3, -65);

  const boundaryEvents = machine.update(reading(3, -78, 2_500));
  assert.equal(boundaryEvents.some((event) => event.type === 'zone-exit'), false);
  assert.equal(machine.getSnapshot().activeBeaconKey, beacon(3).key);

  const exitEvents = machine.update(reading(3, -79, 3_000));
  assert.equal(exitEvents.some((event) => event.type === 'zone-exit'), true);
});

test('exits below the exit threshold and discards a short session', () => {
  const machine = createMachine();
  enter(machine, 3);

  const events = machine.update(reading(3, -80, 2_500));

  assert.equal(
    events.some((event) => event.type === 'zone-exit'),
    true,
  );
  assert.equal(
    events.some((event) => event.type === 'session-discarded'),
    true,
  );
  assert.equal(machine.getSnapshot().activeBeaconKey, null);
});

test('switches beacons only after a six dB advantage persists for two seconds', () => {
  const machine = createMachine();
  enter(machine, 3, -69);
  enter(machine, 4, -60, 2_000);

  assert.equal(machine.getSnapshot().activeBeaconKey, beacon(3).key);

  const events = machine.tick(5_000);

  assert.equal(
    events.some((event) => event.type === 'session-start' && event.beacon.minor === 4),
    true,
  );
  assert.equal(machine.getSnapshot().activeBeaconKey, beacon(4).key);
});

test('switches when the challenger has exactly a six dB advantage for two seconds', () => {
  const machine = createMachine();
  enter(machine, 3, -66);
  enter(machine, 4, -60, 2_000);

  assert.equal(machine.getSnapshot().activeBeaconKey, beacon(3).key);
  assert.equal(machine.tick(4_999).some((event) => event.type === 'session-start'), false);
  assert.equal(
    machine.tick(5_000).some(
      (event) => event.type === 'session-start' && event.beacon.minor === 4,
    ),
    true,
  );
});

test('does not start a session for a brief signal flicker', () => {
  const machine = createMachine();

  machine.update(reading(3, -65, 1_000));
  const events = machine.update(reading(3, -80, 1_500));

  assert.equal(
    events.some((event) => event.type === 'session-start'),
    false,
  );
  assert.equal(machine.getSnapshot().activeBeaconKey, null);
});

test('ends a session after fifteen seconds without signal', () => {
  const machine = createMachine();
  enter(machine, 3, -65, 1_000);
  machine.update(reading(3, -65, 16_000));

  assert.equal(machine.tick(30_999).some((event) => event.type === 'session-end'), false);

  const events = machine.tick(31_000);
  const ended = events.find((event) => event.type === 'session-end');

  assert.equal(ended?.type, 'session-end');
  assert.equal(ended?.session.reason, 'signal-lost');
  assert.equal(ended?.session.endedAt, 31_000);
  assert.equal(machine.getSnapshot().activeBeaconKey, null);
});

test('ticks without further readings and ends exactly at the signal timeout', () => {
  const machine = createMachine();
  enter(machine, 3, -65, 1_000);
  machine.update(reading(3, -65, 7_000));

  assert.deepEqual(machine.tick(21_999), []);

  const events = machine.tick(22_000);
  const ended = events.find((event) => event.type === 'session-end');

  assert.equal(ended?.type, 'session-end');
  assert.equal(ended?.session.reason, 'signal-lost');
  assert.equal(ended?.session.endedAt, 22_000);
  assert.equal(ended?.session.durationMs, 20_000);
});

test('discards a session one millisecond short of the minimum duration', () => {
  const machine = createMachine();
  enter(machine, 3, -65, 1_000);
  machine.update(reading(3, -65, 6_999));

  const events = machine.tick(21_999);
  const discarded = events.find((event) => event.type === 'session-discarded');

  assert.equal(discarded?.type, 'session-discarded');
  assert.equal(discarded?.session.durationMs, 19_999);
});
