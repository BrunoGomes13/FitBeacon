import type { Equipment } from '../api/schemas';
import type { ActiveWorkout } from '../state/store';

export function createWorkoutStart(
  equipment: Equipment,
  exerciseId: string,
  existingWorkout: ActiveWorkout | null,
  beaconSession: { clientSessionId: string; startedAt: number } | undefined,
  createClientSessionId: () => string,
  now: () => number = Date.now,
): ActiveWorkout {
  const exerciseIndex = equipment.exerciseIds.findIndex(
    (exercise) => exercise._id === exerciseId,
  );
  if (exerciseIndex < 0) {
    throw new Error('O exercício escolhido não pertence a este equipamento.');
  }
  if (existingWorkout && existingWorkout.equipment._id !== equipment._id) {
    throw new Error('Finalize ou retome o treino em andamento antes de trocar de aparelho.');
  }
  if (existingWorkout) {
    return { ...existingWorkout, exerciseId, exerciseIndex };
  }

  const nowAt = now();
  const resumedAt = new Date(nowAt).toISOString();
  const startedAt = new Date(beaconSession?.startedAt ?? nowAt).toISOString();
  return {
    clientSessionId: beaconSession?.clientSessionId ?? createClientSessionId(),
    equipment,
    origin: beaconSession ? 'beacon' : 'manual',
    exerciseId,
    startedAt,
    resumedAt,
    accumulatedSeconds: 0,
    pausedAt: null,
    timerStatus: 'running',
    exerciseIndex,
    sets: [],
  };
}

export function getWorkoutRoute(
  workout: Pick<ActiveWorkout, 'equipment' | 'exerciseId' | 'origin'>,
): string {
  return `/workout?equipmentId=${encodeURIComponent(workout.equipment._id)}&exerciseId=${encodeURIComponent(workout.exerciseId)}&origin=${workout.origin}`;
}
