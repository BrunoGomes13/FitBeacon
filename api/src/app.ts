import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config.js';
import { getCorsOrigins } from './config.js';
import { createAdminRouter } from './admin/routes.js';
import { createAuthRouter } from './auth/routes.js';
import { AppError, errorHandler, notFoundHandler } from './errors.js';
import { logger as applicationLogger } from './logger.js';
import { createReportsRouter } from './reports/routes.js';
import { createStudentRouter } from './student/routes.js';
import mongoose from 'mongoose';

export function createApp(config: AppConfig) {
  const app = express();
  const allowedOrigins = getCorsOrigins(config);
  const log = config.NODE_ENV === 'test' ? pino({ level: 'silent' }) : applicationLogger;

  if (config.NODE_ENV === 'production' && allowedOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS não pode permitir todas as origens em produção.');
  }

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origem não permitida.'));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  );
  app.use(
    pinoHttp({
      logger: log,
      serializers: {
        req(request) {
          return {
            method: request.method,
            path: (request.url ?? '').split('?')[0],
          };
        },
        res(response) {
          return { statusCode: response.statusCode };
        },
      },
    }),
  );
  app.use(express.json({ limit: '256kb', strict: true }));

  app.get('/health', (_request, response) => {
    const ready = mongoose.connection.readyState === 1;
    response.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'unavailable',
      database: ready ? 'connected' : 'disconnected',
    });
  });

  const api = express.Router();
  api.use('/auth', createAuthRouter(config));
  api.use('/', createStudentRouter(config));
  api.use('/admin', createAdminRouter(config));
  api.use('/reports', createReportsRouter(config));
  api.use(notFoundHandler);
  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
