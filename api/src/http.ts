import type { Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from './errors.js';
import { isObjectId } from './validation.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function getAuth(request: Request) {
  if (!request.auth) {
    throw new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
  }

  return request.auth;
}

export function toObjectId(value: string): Types.ObjectId {
  if (!isObjectId(value)) {
    throw new AppError(400, 'INVALID_ID', 'O identificador enviado é inválido.');
  }

  return new Types.ObjectId(value);
}

export function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
