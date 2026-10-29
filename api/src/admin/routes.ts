import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { requireAdmin } from '../auth/middleware.js';
import { AppError } from '../errors.js';
import { getAuth, pagination, paginationSchema, toObjectId } from '../http.js';
import { Area, Equipment, Exercise } from '../models/index.js';
import { parseInput } from '../validation.js';

const mediaSchema = z
  .object({
    imageUrl: z.url().optional(),
    videoUrl: z.url().optional(),
    instructionUrl: z.url().optional(),
  })
  .default({});

const areaFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).default(''),
  isActive: z.boolean().default(true),
};

const areaCreateSchema = z.object(areaFields);
const areaUpdateSchema = z.object({
  name: areaFields.name.optional(),
  description: areaFields.description.optional(),
  isActive: areaFields.isActive.optional(),
});

const beaconSchema = z
  .object({
    uuid: z.uuid().toLowerCase(),
    major: z.number().int().min(0).max(65535),
    minor: z.number().int().min(0).max(65535),
    txPower: z.number().int().min(-127).max(20),
    rssiEnter: z.number().int().min(-127).max(0),
    rssiExit: z.number().int().min(-127).max(0),
  })
  .refine((value) => value.rssiEnter > value.rssiExit, {
    message: 'RSSI de entrada deve ser maior que o RSSI de saída.',
    path: ['rssiEnter'],
  });

const adjustmentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  instructions: z.string().trim().min(1).max(2000),
});

const equipmentCreateSchema = z.object({
  areaId: z.string().regex(/^[a-f\d]{24}$/i),
  name: z.string().trim().min(2).max(120),
  beacon: beaconSchema,
  adjustments: z.array(adjustmentSchema).max(30).default([]),
  exerciseIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .max(100)
    .default([]),
  media: mediaSchema,
  isActive: z.boolean().default(true),
});

const equipmentUpdateSchema = z.object({
  areaId: equipmentCreateSchema.shape.areaId.optional(),
  name: equipmentCreateSchema.shape.name.optional(),
  beacon: equipmentCreateSchema.shape.beacon.optional(),
  adjustments: equipmentCreateSchema.shape.adjustments.optional(),
  exerciseIds: equipmentCreateSchema.shape.exerciseIds.optional(),
  media: z
    .object({
      imageUrl: z.url().optional(),
      videoUrl: z.url().optional(),
      instructionUrl: z.url().optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

const exerciseCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  muscleGroup: z.string().trim().min(2).max(100),
  steps: z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
  commonMistakes: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  media: mediaSchema,
  recommendedSets: z.number().int().min(1).max(20),
  recommendedReps: z.number().int().min(1).max(100),
  isActive: z.boolean().default(true),
});

const exerciseUpdateSchema = z.object({
  name: exerciseCreateSchema.shape.name.optional(),
  muscleGroup: exerciseCreateSchema.shape.muscleGroup.optional(),
  steps: exerciseCreateSchema.shape.steps.optional(),
  commonMistakes: exerciseCreateSchema.shape.commonMistakes.optional(),
  media: z
    .object({
      imageUrl: z.url().optional(),
      videoUrl: z.url().optional(),
      instructionUrl: z.url().optional(),
    })
    .optional(),
  recommendedSets: exerciseCreateSchema.shape.recommendedSets.optional(),
  recommendedReps: exerciseCreateSchema.shape.recommendedReps.optional(),
  isActive: z.boolean().optional(),
});

async function ensureEquipmentReferences(
  gymId: Types.ObjectId,
  areaId: string,
  exerciseIds: readonly string[],
) {
  const area = await Area.exists({
    _id: toObjectId(areaId),
    gymId,
    isActive: true,
  });

  if (!area) {
    throw new AppError(400, 'INVALID_AREA', 'A área não existe ou está inativa.');
  }

  if (exerciseIds.length > 0) {
    const exerciseCount = await Exercise.countDocuments({
      _id: { $in: exerciseIds.map(toObjectId) },
      gymId,
      isActive: true,
    });

    if (exerciseCount !== new Set(exerciseIds).size) {
      throw new AppError(
        400,
        'INVALID_EXERCISES',
        'Um ou mais exercícios não existem ou estão inativos.',
      );
    }
  }
}

function listFilter(gymId: Types.ObjectId, search: unknown) {
  const parsed = z.string().trim().max(120).optional().safeParse(search);

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data
    ? { gymId, name: { $regex: escapeRegex(parsed.data), $options: 'i' } }
    : { gymId };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createAdminRouter(config: AppConfig): Router {
  const router = Router();
  router.use(requireAdmin(config));

  router.get('/areas', async (request, response) => {
    const { page, limit } = parseInput(paginationSchema, request.query);
    const filter = listFilter(getAuth(request).gymId, request.query.search);
    const [data, total] = await Promise.all([
      Area.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Area.countDocuments(filter),
    ]);

    response.json({ data, pagination: pagination(page, limit, total) });
  });

  router.post('/areas', async (request, response) => {
    const input = parseInput(areaCreateSchema, request.body);
    const area = await Area.create({ ...input, gymId: getAuth(request).gymId });
    response.status(201).json({ data: area });
  });

  router.get('/areas/:id', async (request, response) => {
    const area = await Area.findOne({
      _id: toObjectId(request.params.id),
      gymId: getAuth(request).gymId,
    }).lean();

    if (!area) {
      throw new AppError(404, 'AREA_NOT_FOUND', 'Área não encontrada.');
    }

    response.json({ data: area });
  });

  router.patch('/areas/:id', async (request, response) => {
    const input = parseInput(areaUpdateSchema, request.body);
    const area = await Area.findOneAndUpdate(
      { _id: toObjectId(request.params.id), gymId: getAuth(request).gymId },
      { $set: input },
      { returnDocument: 'after', runValidators: true },
    ).lean();

    if (!area) {
      throw new AppError(404, 'AREA_NOT_FOUND', 'Área não encontrada.');
    }

    response.json({ data: area });
  });

  router.delete('/areas/:id', async (request, response) => {
    const areaId = toObjectId(request.params.id);
    const gymId = getAuth(request).gymId;
    const area = await Area.findOneAndUpdate(
      { _id: areaId, gymId },
      { $set: { isActive: false } },
      { returnDocument: 'after' },
    ).lean();

    if (!area) {
      throw new AppError(404, 'AREA_NOT_FOUND', 'Área não encontrada.');
    }

    await Equipment.updateMany({ areaId, gymId }, { $set: { isActive: false } });
    response.status(204).end();
  });

  router.get('/equipment', async (request, response) => {
    const { page, limit } = parseInput(paginationSchema, request.query);
    const filter = listFilter(getAuth(request).gymId, request.query.search);
    const [data, total] = await Promise.all([
      Equipment.find(filter)
        .populate({ path: 'areaId', select: 'name description' })
        .populate({ path: 'exerciseIds', select: 'name muscleGroup' })
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Equipment.countDocuments(filter),
    ]);

    response.json({ data, pagination: pagination(page, limit, total) });
  });

  router.post('/equipment', async (request, response) => {
    const input = parseInput(equipmentCreateSchema, request.body);
    const { gymId } = getAuth(request);
    await ensureEquipmentReferences(gymId, input.areaId, input.exerciseIds);
    const equipment = await Equipment.create({
      ...input,
      areaId: toObjectId(input.areaId),
      exerciseIds: input.exerciseIds.map(toObjectId),
      gymId,
    });

    response.status(201).json({ data: equipment });
  });

  router.get('/equipment/:id', async (request, response) => {
    const equipment = await Equipment.findOne({
      _id: toObjectId(request.params.id),
      gymId: getAuth(request).gymId,
    })
      .populate({ path: 'areaId', select: 'name description' })
      .populate({
        path: 'exerciseIds',
        select:
          'name muscleGroup steps commonMistakes media recommendedSets recommendedReps',
      })
      .lean();

    if (!equipment) {
      throw new AppError(404, 'EQUIPMENT_NOT_FOUND', 'Equipamento não encontrado.');
    }

    response.json({ data: equipment });
  });

  router.patch('/equipment/:id', async (request, response) => {
    const input = parseInput(equipmentUpdateSchema, request.body);
    const { gymId } = getAuth(request);
    const current = await Equipment.findOne({
      _id: toObjectId(request.params.id),
      gymId,
    }).select('areaId exerciseIds');

    if (!current) {
      throw new AppError(404, 'EQUIPMENT_NOT_FOUND', 'Equipamento não encontrado.');
    }

    const areaId = input.areaId ?? current.areaId.toString();
    const exerciseIds =
      input.exerciseIds ?? current.exerciseIds.map((id) => id.toString());
    await ensureEquipmentReferences(gymId, areaId, exerciseIds);
    const equipment = await Equipment.findOneAndUpdate(
      { _id: current._id, gymId },
      {
        $set: {
          ...input,
          ...(input.areaId ? { areaId: toObjectId(input.areaId) } : {}),
          ...(input.exerciseIds
            ? { exerciseIds: input.exerciseIds.map(toObjectId) }
            : {}),
        },
      },
      { returnDocument: 'after', runValidators: true },
    ).lean();

    response.json({ data: equipment });
  });

  router.delete('/equipment/:id', async (request, response) => {
    const equipment = await Equipment.findOneAndUpdate(
      { _id: toObjectId(request.params.id), gymId: getAuth(request).gymId },
      { $set: { isActive: false } },
      { returnDocument: 'after' },
    );

    if (!equipment) {
      throw new AppError(404, 'EQUIPMENT_NOT_FOUND', 'Equipamento não encontrado.');
    }

    response.status(204).end();
  });

  router.get('/exercises', async (request, response) => {
    const { page, limit } = parseInput(paginationSchema, request.query);
    const filter = listFilter(getAuth(request).gymId, request.query.search);
    const [data, total] = await Promise.all([
      Exercise.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Exercise.countDocuments(filter),
    ]);

    response.json({ data, pagination: pagination(page, limit, total) });
  });

  router.post('/exercises', async (request, response) => {
    const input = parseInput(exerciseCreateSchema, request.body);
    const exercise = await Exercise.create({ ...input, gymId: getAuth(request).gymId });
    response.status(201).json({ data: exercise });
  });

  router.get('/exercises/:id', async (request, response) => {
    const exercise = await Exercise.findOne({
      _id: toObjectId(request.params.id),
      gymId: getAuth(request).gymId,
    }).lean();

    if (!exercise) {
      throw new AppError(404, 'EXERCISE_NOT_FOUND', 'Exercício não encontrado.');
    }

    response.json({ data: exercise });
  });

  router.patch('/exercises/:id', async (request, response) => {
    const input = parseInput(exerciseUpdateSchema, request.body);
    const exercise = await Exercise.findOneAndUpdate(
      { _id: toObjectId(request.params.id), gymId: getAuth(request).gymId },
      { $set: input },
      { returnDocument: 'after', runValidators: true },
    ).lean();

    if (!exercise) {
      throw new AppError(404, 'EXERCISE_NOT_FOUND', 'Exercício não encontrado.');
    }

    response.json({ data: exercise });
  });

  router.delete('/exercises/:id', async (request, response) => {
    const exerciseId = toObjectId(request.params.id);
    const gymId = getAuth(request).gymId;
    const exercise = await Exercise.findOneAndUpdate(
      { _id: exerciseId, gymId },
      { $set: { isActive: false } },
      { returnDocument: 'after' },
    );

    if (!exercise) {
      throw new AppError(404, 'EXERCISE_NOT_FOUND', 'Exercício não encontrado.');
    }

    await Equipment.updateMany({ gymId }, { $pull: { exerciseIds: exerciseId } });
    response.status(204).end();
  });

  return router;
}
