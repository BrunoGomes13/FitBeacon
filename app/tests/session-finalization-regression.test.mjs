import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BeaconStateMachine } from '../src/beacon/BeaconStateMachine.ts';
import { MockBeaconProvider } from '../src/beacon/MockBeaconProvider.ts';
import { SessionConclusionController } from '../src/student/SessionConclusionController.ts';

class MockSessionController {
  constructor() {
    this.machine = new BeaconStateMachine();
    this.provider = new MockBeaconProvider();
    this.stack = ['/home'];
    this.notices = [];
    this.persistedSessionIds = [];
    this.sessionIds = new Map();
    this.exitRequested = false;
    this.conclusions = new SessionConclusionController(() => {
      this.stack = ['/home'];
    });
  }

  async start() {
    this.ticker = globalThis.setInterval(() => this.process(this.machine.tick(Date.now())), 1_000);
    await this.provider.start(
      (reading) => this.process(this.machine.update(reading)),
      () => {},
    );
  }

  process(events) {
    for (const event of events) {
      if (event.type === 'session-start') {
        const sessionId = `session-${event.at}`;
        this.sessionIds.set(event.beacon.key, sessionId);
        this.conclusions.begin(sessionId);
        this.exitRequested = false;
        this.stack = ['/home', '/equipment'];
      } else if (event.type === 'session-end' || event.type === 'session-discarded') {
        const sessionId = this.sessionIds.get(event.session.beacon.key);
        this.sessionIds.delete(event.session.beacon.key);
        if (!sessionId) continue;

        this.exitRequested = true;
        this.conclusions.conclude(sessionId, () => {
          if (event.type === 'session-end') {
            this.persistedSessionIds.push(sessionId);
          }
        });
      }
    }
  }

  get canSimulateExit() {
    return this.machine.getSnapshot().activeBeaconKey !== null && !this.exitRequested;
  }

  simulateApproach() {
    this.exitRequested = false;
    this.provider.simulate('approach');
  }

  simulateExit() {
    if (!this.canSimulateExit) return;
    this.exitRequested = true;
    this.provider.simulate('exit');
  }

  finishManually() {
    if (!this.machine.getSnapshot().activeBeaconKey) return;
    this.exitRequested = true;
    this.provider.simulate('exit');
    this.process(this.machine.reset(Date.now()));
  }

  get route() {
    return this.stack.at(-1);
  }

  async stop() {
    globalThis.clearInterval(this.ticker);
    await this.provider.stop();
  }
}

async function withMockSession(name, run) {
  await test(name, async (context) => {
    context.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000 });
    const controller = new MockSessionController();
    await controller.start();
    const advance = (durationMs) => {
      for (let elapsed = 0; elapsed < durationMs; elapsed += 500) {
        context.mock.timers.tick(500);
      }
    };

    try {
      await run(controller, advance);
    } finally {
      await controller.stop();
    }
  });
}

withMockSession('encerrar duas vezes seguidas é idempotente e silencioso', async (controller, advance) => {
  advance(35_000);
  controller.finishManually();
  controller.finishManually();

  assert.deepEqual(controller.notices, []);
  assert.equal(controller.persistedSessionIds.length, 1);
  assert.equal(controller.route, '/home');
});

withMockSession('afastar depois de encerrar manualmente não duplica nem mostra erro', async (controller, advance) => {
  advance(35_000);
  controller.finishManually();
  controller.simulateExit();
  advance(20_000);

  assert.deepEqual(controller.notices, []);
  assert.equal(controller.persistedSessionIds.length, 1);
  assert.equal(controller.route, '/home');
});

withMockSession('encerrar manualmente depois do afastamento é silencioso', async (controller, advance) => {
  advance(35_000);
  controller.simulateExit();
  advance(15_000);
  controller.finishManually();

  assert.deepEqual(controller.notices, []);
  assert.equal(controller.persistedSessionIds.length, 1);
  assert.equal(controller.route, '/home');
});

withMockSession('é possível aproximar novamente depois do encerramento', async (controller, advance) => {
  advance(35_000);
  controller.finishManually();
  controller.simulateApproach();
  advance(10_000);

  assert.equal(controller.persistedSessionIds.length, 1);
  assert.notEqual(
    controller.machine.getSnapshot().activeBeaconKey,
    null,
    JSON.stringify(controller.machine.getSnapshot()),
  );
  assert.equal(controller.route, '/equipment');
});

withMockSession('afastar sem sessão ativa é um no-op silencioso', async (controller) => {
  controller.simulateExit();
  assert.deepEqual(controller.notices, []);
  assert.equal(controller.canSimulateExit, false);
  assert.equal(controller.machine.getSnapshot().activeBeaconKey, null);
});

withMockSession('perda de sinal e encerramento manual no mesmo instante concluem uma vez', async (controller, advance) => {
  advance(35_000);
  controller.simulateExit();
  advance(15_000);
  controller.finishManually();

  assert.deepEqual(controller.notices, []);
  assert.equal(controller.persistedSessionIds.length, 1);
  assert.equal(controller.route, '/home');
});

withMockSession('finalizar ou afastar limpa a pilha e não reabre o equipamento com voltar', async (controller, advance) => {
  advance(35_000);
  controller.finishManually();
  assert.deepEqual(controller.stack, ['/home']);
  assert.equal(controller.route, '/home');

  controller.simulateApproach();
  advance(35_000);
  controller.simulateExit();
  advance(15_000);

  assert.deepEqual(controller.stack, ['/home']);
  assert.equal(controller.route, '/home');
  assert.equal(controller.persistedSessionIds.length, 2);
});

withMockSession('o botão de afastamento volta a funcionar depois de três ciclos completos', async (controller, advance) => {
  for (let cycle = 0; cycle < 3; cycle += 1) {
    controller.simulateApproach();
    advance(35_000);
    assert.equal(controller.canSimulateExit, true);
    controller.simulateExit();
    advance(15_000);
    assert.equal(controller.route, '/home');
    assert.equal(controller.canSimulateExit, false);
  }

  assert.equal(controller.persistedSessionIds.length, 3);
  assert.equal(new Set(controller.persistedSessionIds).size, 3);
});
