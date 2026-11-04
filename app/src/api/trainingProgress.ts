import type { TrainingSession } from './schemas';

export type TrainingPeriod = 'week' | 'month';

export type TrainingProgress = {
  workouts: number;
  durationMinutes: number;
  sets: number;
};

export type UsageDimension = 'equipment' | 'area';
export type UsagePeriod = 'week' | 'month' | 'all';

export type UsageRanking = {
  id: string;
  name: string;
  sessions: number;
  durationSec: number;
  percentage: number;
};

function populatedName(value: string | { _id: string; name: string } | null): string | null {
  return value && typeof value !== 'string' ? value.name : null;
}

function populatedId(value: string | { _id: string; name: string } | null): string | null {
  return value && typeof value !== 'string' ? value._id : null;
}

export function getTrainingTitle(session: TrainingSession): string {
  const muscleGroups = session.sets.flatMap((set) =>
    typeof set.exerciseId === 'string' || !set.exerciseId.muscleGroup
      ? []
      : [set.exerciseId.muscleGroup],
  );
  const mostCommon = muscleGroups
    .map((group) => ({
      group,
      count: muscleGroups.filter((candidate) => candidate === group).length,
    }))
    .sort((left, right) => right.count - left.count)[0]?.group;

  if (mostCommon) return `Treino de ${mostCommon}`;

  const date = new Date(session.startedAt).toLocaleDateString('pt-BR');
  return `Treino de ${date}`;
}

export function getSessionExerciseCount(session: TrainingSession): number {
  return new Set(
    session.sets.map((set) =>
      typeof set.exerciseId === 'string' ? set.exerciseId : set.exerciseId._id,
    ),
  ).size;
}

export function getUsageRanking(
  sessions: readonly TrainingSession[],
  dimension: UsageDimension,
): UsageRanking[] {
  const grouped = new Map<string, UsageRanking>();

  for (const session of sessions) {
    const value = dimension === 'equipment' ? session.equipmentId : session.areaId;
    const id = populatedId(value);
    const name = populatedName(value);
    if (!id || !name) continue;

    const row = grouped.get(id) ?? { id, name, sessions: 0, durationSec: 0, percentage: 0 };
    row.sessions += 1;
    row.durationSec += session.durationSec;
    grouped.set(id, row);
  }

  const ranking = [...grouped.values()].sort(
    (left, right) => right.durationSec - left.durationSec || left.name.localeCompare(right.name),
  );
  const totalDuration = ranking.reduce((total, row) => total + row.durationSec, 0);

  return ranking.map((row) => ({
    ...row,
    percentage: totalDuration === 0 ? 0 : (row.durationSec / totalDuration) * 100,
  }));
}

export function filterSessionsByPeriod(
  sessions: readonly TrainingSession[],
  period: UsagePeriod,
  now = Date.now(),
): TrainingSession[] {
  if (period === 'all') return [...sessions];
  const days = period === 'week' ? 7 : 30;
  const cutoff = now - days * 24 * 60 * 60 * 1_000;
  return sessions.filter((session) => new Date(session.startedAt).getTime() >= cutoff);
}

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
