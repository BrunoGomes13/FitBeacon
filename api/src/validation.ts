import type { ZodType } from 'zod';

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

export const objectIdSchema = /^[a-f\d]{24}$/i;

export function isObjectId(value: string): boolean {
  return objectIdSchema.test(value);
}
