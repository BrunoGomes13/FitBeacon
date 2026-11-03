import type { TrainingSession } from './schemas';

export type TrainingPeriod = 'week' | 'month';

export type TrainingProgress = {
  workouts: number;
  durationMinutes: number;
  sets: number;
};

export function getTrainingProgress(
  sessions: readonly TrainingSession[],
  period: TrainingPeriod,
  now = new Date(),
): TrainingProgress {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'week') {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  } else {
    start.setDate(1);
  }

  const matchingSessions = sessions.filter(
    (session) => new Date(session.startedAt).getTime() >= start.getTime(),
  );
  const durationSeconds = matchingSessions.reduce(
    (total, session) => total + session.durationSec,
    0,
  );

  return {
    workouts: matchingSessions.length,
    durationMinutes: Math.floor(durationSeconds / 60),
    sets: matchingSessions.reduce((total, session) => total + session.sets.length, 0),
  };
}

export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}
