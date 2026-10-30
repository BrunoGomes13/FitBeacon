import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BeaconStateMachine } from '../src/beacon/BeaconStateMachine.ts';
import { MockBeaconProvider } from '../src/beacon/MockBeaconProvider.ts';

test('Mock exit ends a workout after a 25-second stay', async (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000 });

  const provider = new MockBeaconProvider();
  const machine = new BeaconStateMachine();
  const events = [];
  const ticker = globalThis.setInterval(
    () => events.push(...machine.tick(Date.now())),
    1_000,
  );
  const advance = (durationMs) => {
    for (let elapsed = 0; elapsed < durationMs; elapsed += 500) {
      context.mock.timers.tick(500);
    }
  };
  await provider.start(
    (reading) => events.push(...machine.update(reading)),
    () => {},
  );

  advance(25_000);
  assert.notEqual(machine.getSnapshot().activeBeaconKey, null);

  provider.simulate('exit');
  advance(20_000);

  const sessionEnd = events.find((event) => event.type === 'session-end');
  assert.ok(
    sessionEnd,
    `expected a completed session event; received ${events.map((event) => event.type + ('session' in event ? ':' + event.session.durationMs : '')).join(',')}`,
  );
  assert.equal(sessionEnd.session.reason, 'signal-lost');
  assert.ok(sessionEnd.session.durationMs >= 20_000);

  globalThis.clearInterval(ticker);
  await provider.stop();
});
