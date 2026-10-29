import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { requireAuth } from '../auth/middleware.js';
import { AppError } from '../errors.js';
import { getAuth, pagination, paginationSchema, toObjectId } from '../http.js';
import { Area, Equipment, Exercise, SetLog, UsageSession } from '../models/index.js';
import { parseInput } from '../validation.js';

const beaconQuerySchema = z.object({
  uuid: z.uuid().toLowerCase(),
  major: z.coerce.number().int().min(0).max(65535),
  minor: z.coerce.number().int().min(0).max(65535),
});

const setSchema = z.object({
  exerciseId: z.string().regex(/^[a-f\d]{24}$/i),
  setNumber: z.number().int().min(1).max(50),
  load: z.number().finite().min(0).max(2000),
  reps: z.number().int().min(1).max(1000),
});

const sessionDateSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const sessionSchema = z
  .object({
    clientSessionId: z.uuid(),
    equipmentId: z.string().regex(/^[a-f\d]{24}$/i),
    areaId: z.string().regex(/^[a-f\d]{24}$/i),
    startedAt: sessionDateSchema,
    endedAt: sessionDateSchema,
    sets: z
      .array(setSchema)
      .max(100)
      .default([])
      .refine(
        (sets) =>
          new Set(sets.map((set) => `${set.exerciseId}:${set.setNumber}`)).size ===
          sets.length,
        { message: 'Não repita exercício e número de série na mesma sessão.' },
      ),
  })
  .refine((session) => session.endedAt > session.startedAt, {
    message: 'O término deve ocorrer após o início.',
    path: ['endedAt'],
  })
  .refine((session) => session.endedAt.getTime() - session.startedAt.getTime() >= 1000, {
    message: 'A duração da sessão deve ser de pelo menos um segundo.',
    path: ['endedAt'],
  })
  .refine((session) => session.endedAt.getTime() <= Date.now() + 5 * 60 * 1000, {
    message: 'O término da sessão não pode estar no futuro.',
    path: ['endedAt'],
  })
  .refine(
    (session) =>
      session.endedAt.getTime() - session.startedAt.getTime() <= 24 * 60 * 60 * 1000,
    {
      message: 'A duração da sessão não pode exceder 24 horas.',
      path: ['endedAt'],
    },
  );

const batchSchema = z.object({
  sessions: z.array(sessionSchema).min(1).max(100),
});

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
  );
}

function sameSession(
  existing: {
    userId: Types.ObjectId;
    equipmentId: Types.ObjectId;
    areaId: Types.ObjectId;
    startedAt: Date;
    endedAt: Date;
  },
  expected: {
    userId: Types.ObjectId;
    equipmentId: Types.ObjectId;
    areaId: Types.ObjectId;
    startedAt: Date;
    endedAt: Date;
  },
): boolean {
  return (
    existing.userId.equals(expected.userId) &&
    existing.equipmentId.equals(expected.equipmentId) &&
    existing.areaId.equals(expected.areaId) &&
    existing.startedAt.getTime() === expected.startedAt.getTime() &&
    existing.endedAt.getTime() === expected.endedAt.getTime()
  );
}

async function saveSetLogs(sessionId: Types.ObjectId, sets: z.infer<typeof setSchema>[]) {
  const existingLogs = await SetLog.find({ sessionId });

  for (const existing of existingLogs) {
    const requested = sets.find(
      (set) =>
        existing.exerciseId.equals(set.exerciseId) &&
        existing.setNumber === set.setNumber,
    );

    if (
      !requested ||
      existing.load !== requested.load ||
      existing.reps !== requested.reps
    ) {
      throw new AppError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'O identificador da sessão já foi usado com séries diferentes.',
      );
    }
  }

  for (const set of sets) {
    const exists = existingLogs.some(
      (log) => log.exerciseId.equals(set.exerciseId) && log.setNumber === set.setNumber,
    );

    if (exists) {
      continue;
    }

    try {
      await SetLog.create({
        sessionId,
        exerciseId: toObjectId(set.exerciseId),
        setNumber: set.setNumber,
        load: set.load,
        reps: set.reps,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const log = await SetLog.findOne({
        sessionId,
        exerciseId: toObjectId(set.exerciseId),
        setNumber: set.setNumber,
      });

      if (!log || log.load !== set.load || log.reps !== set.reps) {
        throw new AppError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'O identificador da sessão já foi usado com séries diferentes.',
        );
      }
    }
  }

  if (sets.length < existingLogs.length) {
    throw new AppError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'O identificador da sessão já foi usado com séries diferentes.',
    );
  }
}

export function createStudentRouter(config: AppConfig): Router {
  const router = Router();

  router.get('/equipment/beacon', requireAuth(config), async (request, response) => {
    const input = parseInput(beaconQuerySchema, request.query);
    const auth = getAuth(request);

    if (!auth.consentTracking) {
      throw new AppError(
        403,
        'TRACKING_CONSENT_REQUIRED',
        'É necessário consentir com o registro de atividade para buscar equipamentos.',
      );
    }

    const { gymId } = auth;
    const equipment = await Equipment.findOne({
      gymId,
      isActive: true,
      'beacon.uuid': input.uuid,
      'beacon.major': input.major,
      'beacon.minor': input.minor,
    })
      .populate({ path: 'areaId', select: 'name description' })
      .populate({
        path: 'exerciseIds',
        select:
          'name muscleGroup steps commonMistakes media recommendedSets recommendedReps',
        match: { gymId, isActive: true },
      })
      .lean();

    if (!equipment) {
      throw new AppError(
        404,
        'EQUIPMENT_NOT_FOUND',
        'Nenhum equipamento corresponde ao beacon.',
      );
    }

    response.json({ data: equipment });
  });

  router.post('/sessions/batch', requireAuth(config), async (request, response) => {
    const input = parseInput(batchSchema, request.body);
    const auth = getAuth(request);

    if (!auth.consentTracking) {
      throw new AppError(
        403,
        'TRACKING_CONSENT_REQUIRED',
        'É necessário consentir com o registro de atividade para registrar sessões.',
      );
    }

    const { userId, gymId } = auth;
    const userSessions = new Map<string, string>();

    for (const item of input.sessions) {
      const canonical = JSON.stringify({
        equipmentId: item.equipmentId,
        areaId: item.areaId,
        startedAt: item.startedAt.toISOString(),
        endedAt: item.endedAt.toISOString(),
        sets: [...item.sets].sort(
          (left, right) =>
            left.exerciseId.localeCompare(right.exerciseId) ||
            left.setNumber - right.setNumber,
        ),
      });
      const prior = userSessions.get(item.clientSessionId);

      if (prior !== undefined && prior !== canonical) {
        throw new AppError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'O lote repete um identificador com dados diferentes.',
        );
      }

      userSessions.set(item.clientSessionId, canonical);
    }

    const results = [];

    for (const item of input.sessions) {
      const expected = {
        userId,
        equipmentId: toObjectId(item.equipmentId),
        areaId: toObjectId(item.areaId),
        startedAt: item.startedAt,
        endedAt: item.endedAt,
      };
      let existing = await UsageSession.findOne({
        clientSessionId: item.clientSessionId,
      });
      let created = false;

      if (existing) {
        if (!sameSession(existing, expected) || !existing.userId.equals(userId)) {
          throw new AppError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'O identificador da sessão já foi usado com outros dados.',
          );
        }
      } else {
        const [equipment, area] = await Promise.all([
          Equipment.findOne({
            _id: expected.equipmentId,
            gymId,
            isActive: true,
          }).select('areaId exerciseIds'),
          Area.exists({ _id: expected.areaId, gymId, isActive: true }),
        ]);

        if (!equipment || !area || !equipment.areaId.equals(expected.areaId)) {
          throw new AppError(
            400,
            'INVALID_EQUIPMENT',
            'O equipamento ou a área não existe ou está inativa.',
          );
        }

        const allowedExercises = new Set(
          equipment.exerciseIds.map((id) => id.toString()),
        );

        if (item.sets.some((set) => !allowedExercises.has(set.exerciseId))) {
          throw new AppError(
            400,
            'INVALID_EXERCISE',
            'As séries devem pertencer aos exercícios do equipamento.',
          );
        }

        try {
          existing = await UsageSession.create({
            clientSessionId: item.clientSessionId,
            ...expected,
            durationSec: Math.round(
              (item.endedAt.getTime() - item.startedAt.getTime()) / 1000,
            ),
          });
          created = true;
        } catch (error) {
          if (!isDuplicateKeyError(error)) {
            throw error;
          }

          existing = await UsageSession.findOne({
            clientSessionId: item.clientSessionId,
          });

          if (
            !existing ||
            !sameSession(existing, expected) ||
            !existing.userId.equals(userId)
          ) {
            throw new AppError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'O identificador da sessão já foi usado com outros dados.',
            );
          }
        }
      }

      if (!existing) {
        throw new AppError(
          500,
          'SESSION_SAVE_FAILED',
          'Não foi possível registrar a sessão.',
        );
      }

      const [equipment, validExerciseCount] = await Promise.all([
        Equipment.findOne({ _id: expected.equipmentId, gymId }).select('exerciseIds'),
        Exercise.countDocuments({
          _id: { $in: item.sets.map((set) => toObjectId(set.exerciseId)) },
          gymId,
          isActive: true,
        }),
      ]);
      const allowedExercises = new Set(
        (equipment?.exerciseIds ?? []).map((id) => id.toString()),
      );

      if (
        validExerciseCount !== new Set(item.sets.map((set) => set.exerciseId)).size ||
        item.sets.some((set) => !allowedExercises.has(set.exerciseId))
      ) {
        throw new AppError(
          400,
          'INVALID_EXERCISE',
          'As séries devem pertencer aos exercícios do equipamento.',
        );
      }

      await saveSetLogs(existing._id, item.sets);
      results.push({ data: existing, created });
    }

    response.status(201).json({
      data: results,
      created: results.filter((result) => result.created).length,
      idempotent: results.filter((result) => !result.created).length,
    });
  });

  router.get('/sessions', requireAuth(config), async (request, response) => {
    const { page, limit } = parseInput(paginationSchema, request.query);
    const { userId, gymId } = getAuth(request);
    const filter = { userId };
    const [sessions, total] = await Promise.all([
      UsageSession.find(filter)
        .populate({
          path: 'equipmentId',
          select: 'name areaId',
          match: { gymId },
          populate: { path: 'areaId', select: 'name' },
        })
        .populate({ path: 'areaId', select: 'name' })
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UsageSession.countDocuments(filter),
    ]);
    const sessionIds = sessions.map((session) => session._id);
    const setLogs = await SetLog.find({ sessionId: { $in: sessionIds } })
      .populate({
        path: 'exerciseId',
        select: 'name muscleGroup',
        match: { gymId },
      })
      .lean();
    const setsBySession = new Map<string, typeof setLogs>();

    for (const setLog of setLogs) {
      const key = setLog.sessionId.toString();
      const logs = setsBySession.get(key) ?? [];
      logs.push(setLog);
      setsBySession.set(key, logs);
    }

    response.json({
      data: sessions.map((session) => ({
        ...session,
        sets: setsBySession.get(session._id.toString()) ?? [],
      })),
      pagination: pagination(page, limit, total),
    });
  });

  return router;
}
