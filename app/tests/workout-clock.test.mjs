import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getWorkoutElapsedSeconds,
  pauseWorkoutClock,
  resumeWorkoutClock,
} from '../src/student/workoutClock.ts';

test('cronômetro exclui o intervalo pausado do tempo total', () => {
  const initial = {
    startedAt: new Date(1_000).toISOString(),
    resumedAt: new Date(1_000).toISOString(),
    accumulatedSeconds: 0,
    pausedAt: null,
    timerStatus: 'running',
  };
  const paused = pauseWorkoutClock(initial, 91_000);
  assert.equal(getWorkoutElapsedSeconds(paused, 111_000), 90);

  const resumed = resumeWorkoutClock(paused, 111_000);
  assert.equal(getWorkoutElapsedSeconds(resumed, 141_000), 120);
});

test('cronômetro por horários contabiliza o período em segundo plano ao voltar', () => {
  const running = {
    startedAt: new Date(1_000).toISOString(),
    resumedAt: new Date(1_000).toISOString(),
    accumulatedSeconds: 0,
    pausedAt: null,
    timerStatus: 'running',
  };

  assert.equal(getWorkoutElapsedSeconds(running, 61_000), 60);
});
