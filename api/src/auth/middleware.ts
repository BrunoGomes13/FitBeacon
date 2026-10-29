import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors.js';
import { User } from '../models/index.js';
import { isObjectId } from '../validation.js';
import type { AppConfig } from '../config.js';

export function requireAuth(config: AppConfig): RequestHandler {
  return async (request, _response, next) => {
    const authorization = request.get('authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      next(new AppError(401, 'UNAUTHORIZED', 'Autenticação necessária.'));
      return;
    }

    try {
      const payload = jwt.verify(match[1], config.JWT_ACCESS_SECRET);

      if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        !isObjectId(payload.sub)
      ) {
        throw new AppError(401, 'INVALID_TOKEN', 'O token de acesso é inválido.');
      }

      const user = await User.findById(payload.sub).select(
        '_id gymId role consentTracking',
      );

      if (!user) {
        throw new AppError(401, 'USER_NOT_FOUND', 'Usuário não encontrado.');
      }

      request.auth = {
        userId: user._id,
        gymId: user.gymId,
        role: user.role,
        consentTracking: user.consentTracking,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(config: AppConfig): RequestHandler {
  const authenticate = requireAuth(config);

  return (request, response, next) => {
    authenticate(request, response, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }

      if (request.auth?.role !== 'admin') {
        next(new AppError(403, 'FORBIDDEN', 'Acesso restrito à administração.'));
        return;
      }

      next();
    });
  };
}
