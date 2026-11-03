import { z } from 'zod';
import { cpfSchema, isValidLoginIdentifier } from './cpf.ts';

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .refine(isValidLoginIdentifier, 'Informe um e-mail ou CPF válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome completo.').max(100),
    email: z.email('Informe um e-mail válido.'),
    cpf: cpfSchema,
    password: z.string().min(12, 'Use pelo menos 12 caracteres.').max(128),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
    gymId: z.string().regex(/^[a-f\d]{24}$/i, 'Academia não configurada.'),
    consentTracking: z.boolean(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });
