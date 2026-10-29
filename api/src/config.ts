import 'dotenv/config';
import { z } from 'zod';

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/fitbeacon'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^[1-9]\d*[smhd]$/)
      .default('15m'),
    JWT_REFRESH_TTL: z
      .string()
      .regex(/^[1-9]\d*[smhd]$/)
      .default('30d'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    SEED_ADMIN_EMAIL: z.email().default('admin@fitbeacon.local'),
    SEED_ADMIN_PASSWORD: z.string().min(12).default('FitBeacon-Admin-2026!'),
    SEED_STUDENT_EMAIL: z.email().default('aluno@fitbeacon.local'),
    SEED_STUDENT_PASSWORD: z.string().min(12).default('FitBeacon-Aluno-2026!'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((config, context) => {
    if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'Use segredos diferentes para access e refresh tokens.',
      });
    }

    if (
      config.NODE_ENV === 'production' &&
      (config.JWT_ACCESS_SECRET.includes('development-only') ||
        config.JWT_REFRESH_SECRET.includes('development-only') ||
        config.SEED_ADMIN_PASSWORD === 'FitBeacon-Admin-2026!' ||
        config.SEED_STUDENT_PASSWORD === 'FitBeacon-Aluno-2026!' ||
        config.CORS_ORIGINS.includes('*') ||
        config.CORS_ORIGINS.includes('localhost'))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['NODE_ENV'],
        message: 'Remova credenciais e origens de desenvolvimento em produção.',
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function getConfig(): AppConfig {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuração inválida: ${details}`);
  }

  return result.data;
}

export function getCorsOrigins(config: AppConfig): string[] {
  return config.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
