import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  gymId: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum(['student', 'admin']),
  consentTracking: z.boolean(),
});

export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.string(),
});

export const meResponseSchema = z.object({ user: userSchema });

export const areaSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional().default(''),
});

export const exerciseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  muscleGroup: z.string(),
  steps: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  media: z
    .object({
      imageUrl: z.string().url().optional(),
      videoUrl: z.string().url().optional(),
      instructionUrl: z.string().url().optional(),
    })
    .default({}),
  recommendedSets: z.number().int().positive(),
  recommendedReps: z.number().int().positive(),
});

export const equipmentSchema = z.object({
  _id: z.string(),
  gymId: z.string(),
  areaId: areaSchema,
  name: z.string(),
  beacon: z.object({
    uuid: z.string().uuid(),
    major: z.number().int(),
    minor: z.number().int(),
    txPower: z.number(),
    rssiEnter: z.number(),
    rssiExit: z.number(),
  }),
  adjustments: z.array(
    z.object({
      name: z.string(),
      instructions: z.string(),
    }),
  ),
  exerciseIds: z.array(exerciseSchema),
  media: z
    .object({
      imageUrl: z.string().url().optional(),
      videoUrl: z.string().url().optional(),
      instructionUrl: z.string().url().optional(),
    })
    .default({}),
});

export const equipmentResponseSchema = z.object({ data: equipmentSchema });

export const sessionSetSchema = z.object({
  _id: z.string().optional(),
  sessionId: z.string().optional(),
  exerciseId: z.union([
    z.string(),
    z.object({
      _id: z.string(),
      name: z.string(),
      muscleGroup: z.string().optional(),
    }),
  ]),
  setNumber: z.number().int().positive(),
  load: z.number().nonnegative(),
  reps: z.number().int().positive(),
});

export const trainingSessionSchema = z.object({
  _id: z.string(),
  clientSessionId: z.string(),
  userId: z.string(),
  equipmentId: z.union([
    z.string(),
    z.object({
      _id: z.string(),
      name: z.string(),
      areaId: z
        .union([
          z.string(),
          z.object({ _id: z.string(), name: z.string() }),
        ])
        .nullable(),
    }),
  ]),
  areaId: z.union([z.string(), areaSchema]).nullable(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  durationSec: z.number().nonnegative(),
  sets: z.array(sessionSetSchema),
});

export const sessionListResponseSchema = z.object({
  data: z.array(trainingSessionSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }),
});

export type AppUser = z.infer<typeof userSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type TrainingSession = z.infer<typeof trainingSessionSchema>;
export type SessionSet = z.infer<typeof sessionSetSchema>;

export type SessionSetInput = {
  exerciseId: string;
  setNumber: number;
  load: number;
  reps: number;
};
