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

  const events = machine.tick(31_000);
  const ended = events.find((event) => event.type === 'session-end');

  assert.equal(ended?.type, 'session-end');
  assert.equal(ended?.session.reason, 'signal-lost');
  assert.equal(ended?.session.endedAt, 31_000);
  assert.equal(machine.getSnapshot().activeBeaconKey, null);
});
