import type { ErrorRequestHandler, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
const { JsonWebTokenError, TokenExpiredError } = jwt;
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada.'));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Os dados enviados são inválidos.',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Os dados enviados são inválidos.',
      details: Object.keys(error.errors).map((path) => ({
        path,
        message: error.errors[path]?.message ?? 'Valor inválido.',
      })),
    });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    response.status(400).json({
      code: 'INVALID_ID',
      message: 'O identificador enviado é inválido.',
      details: null,
    });
    return;
  }

  if (isHttpError(error, 413)) {
    response.status(413).json({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'A solicitação excede o tamanho permitido.',
      details: null,
    });
    return;
  }

  if (isHttpError(error, 400)) {
    response.status(400).json({
      code: 'INVALID_JSON',
      message: 'O corpo da solicitação não contém JSON válido.',
      details: null,
    });
    return;
  }

  if (error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
    response.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'A sessão expirou ou o token é inválido.',
      details: null,
    });
    return;
  }

  if (isDuplicateKeyError(error)) {
    response.status(409).json({
      code: 'CONFLICT',
      message: 'Já existe um registro com esses dados.',
      details: null,
    });
    return;
  }

  logger.error(
    {
      error:
        error instanceof Error
          ? { name: error.name }
          : { message: 'Erro não identificado' },
      method: request.method,
      path: request.path,
    },
    'Falha ao processar solicitação',
  );
  response.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Ocorreu um erro interno. Tente novamente.',
    details: null,
  });
};

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
  );
}

function isHttpError(error: unknown, status: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === status
  );
}
