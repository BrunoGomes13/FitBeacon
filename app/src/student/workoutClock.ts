export type WorkoutClockState = {
  startedAt: string;
  resumedAt: string | null;
  accumulatedSeconds: number;
  pausedAt: string | null;
  timerStatus: 'running' | 'paused';
};

export function getWorkoutElapsedSeconds(
  workout: WorkoutClockState,
  now = Date.now(),
): number {
  if (workout.timerStatus === 'paused') return workout.accumulatedSeconds;
  const segmentStartedAt = Date.parse(workout.resumedAt ?? workout.startedAt);
  if (!Number.isFinite(segmentStartedAt)) return workout.accumulatedSeconds;
  return workout.accumulatedSeconds + Math.max(0, Math.floor((now - segmentStartedAt) / 1_000));
}

export function pauseWorkoutClock(
  workout: WorkoutClockState,
  at = Date.now(),
): WorkoutClockState {
  if (workout.timerStatus === 'paused') return workout;
  return {
    ...workout,
    accumulatedSeconds: getWorkoutElapsedSeconds(workout, at),
    pausedAt: new Date(at).toISOString(),
    resumedAt: null,
    timerStatus: 'paused',
  };
}

export function resumeWorkoutClock(
  workout: WorkoutClockState,
  at = Date.now(),
): WorkoutClockState {
  if (workout.timerStatus === 'running') return workout;
  return {
    ...workout,
    pausedAt: null,
    resumedAt: new Date(at).toISOString(),
    timerStatus: 'running',
  };
}
