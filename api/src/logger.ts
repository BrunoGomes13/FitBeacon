import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body',
      'res.headers["set-cookie"]',
      'password',
      'passwordHash',
      'refreshToken',
      'token',
      'email',
      'name',
    ],
    censor: '[redigido]',
  },
});
