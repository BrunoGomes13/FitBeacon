import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTrainingProgress } from '../src/api/trainingProgress.ts';
import { BeaconStateMachine } from '../src/beacon/BeaconStateMachine.ts';
import { MockBeaconProvider } from '../src/beacon/MockBeaconProvider.ts';
import { SessionConclusionController } from '../src/student/SessionConclusionController.ts';
import {
  getEquipmentRoute,
  shouldShowNearbyEquipmentBanner,
} from '../src/student/homePresentation.ts';

const equipment = {
  _id: 'equipment-id',
  gymId: 'gym-id',
  name: 'Leg press',
  areaId: { _id: 'area-id', name: 'Musculação', description: '' },
  beacon: {
    uuid: 'b6f2d3b0-2a7c-4c52-8e90-02bd52100001',
    major: 12,
    minor: 34,
    txPower: -59,
    rssiEnter: -65,
    rssiExit: -75,
  },
  adjustments: [],
  exerciseIds: [],
  media: {},
};

test('exibe o banner somente após detectar equipamento e abre o detalhe correto', () => {
  assert.equal(shouldShowNearbyEquipmentBanner(null), false);
  assert.equal(shouldShowNearbyEquipmentBanner(equipment), true);
  assert.equal(
    getEquipmentRoute(equipment),
    '/equipment?uuid=b6f2d3b0-2a7c-4c52-8e90-02bd52100001&major=12&minor=34',
  );
});

test('calcula progresso real semanal e mensal a partir do histórico', () => {
  const sessions = [
    {
      startedAt: '2026-11-02T10:00:00.000Z',
      durationSec: 3_600,
      sets: [{}, {}],
    },
    {
      startedAt: '2026-10-25T10:00:00.000Z',
      durationSec: 1_800,
      sets: [{}],
    },
  ];
  const now = new Date('2026-11-02T12:00:00.000Z');

  assert.deepEqual(getTrainingProgress(sessions, 'week', now), {
    workouts: 1,
    durationMinutes: 60,
    sets: 2,
  });
  assert.deepEqual(getTrainingProgress(sessions, 'month', now), {
    workouts: 1,
    durationMinutes: 60,
    sets: 2,
  });
});

test('Mock: aproximar, abrir, treinar, finalizar, aproximar de novo e afastar', async (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000 });
  const provider = new MockBeaconProvider();
  const machine = new BeaconStateMachine();
  const routes = ['/home'];
  const savedSessions = [];
  const registeredSets = [];
  const sessionByBeacon = new Map();
  const conclusion = new SessionConclusionController(() => {
    routes.splice(0, routes.length, '/home');
  });
  const handleEvents = (events) => {
    for (const event of events) {
      if (event.type === 'session-start') {
        const clientSessionId = `session-${event.at}`;
        sessionByBeacon.set(event.beacon.key, clientSessionId);
        conclusion.begin(clientSessionId);
      }
      if (event.type === 'zone-enter') {
        routes.splice(0, routes.length, '/home', getEquipmentRoute(equipment));
      }
      if (event.type === 'session-end' || event.type === 'session-discarded') {
        const clientSessionId = sessionByBeacon.get(event.session.beacon.key);
        sessionByBeacon.delete(event.session.beacon.key);
        if (!clientSessionId) continue;
        conclusion.conclude(clientSessionId, () => {
          if (event.type === 'session-end') savedSessions.push(clientSessionId);
        });
      }
    }
  };
  const ticker = globalThis.setInterval(
    () => handleEvents(machine.tick(Date.now())),
    1_000,
  );
  await provider.start(
    (reading) => handleEvents(machine.update(reading)),
    () => {},
  );
  const advance = (durationMs) => {
    for (let elapsed = 0; elapsed < durationMs; elapsed += 500) {
      context.mock.timers.tick(500);
    }
  };

  try {
    provider.simulate('approach');
    advance(35_000);
    assert.equal(routes.length, 2);
    assert.match(routes[1], /^\/equipment\?/);
    routes.push('/workout');
    assert.equal(routes.at(-1), '/workout');
    registeredSets.push({ exerciseId: 'exercise-id', setNumber: 1, load: 20, reps: 12 });
    assert.equal(registeredSets.length, 1);

    provider.simulate('exit');
    handleEvents(machine.reset(Date.now()));
    assert.deepEqual(routes, ['/home']);
    assert.equal(savedSessions.length, 1);

    provider.simulate('approach');
    advance(35_000);
    assert.equal(routes.length, 2);
    provider.simulate('exit');
    advance(15_000);
    assert.deepEqual(routes, ['/home']);
    assert.equal(savedSessions.length, 2);
    assert.equal(registeredSets[0].reps, 12);
  } finally {
    globalThis.clearInterval(ticker);
    await provider.stop();
  }
});
