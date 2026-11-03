import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginSchema, registerSchema } from '../src/api/accountValidation.ts';

test('login accepts an e-mail or a CPF as identifier', () => {
  const credentials = { password: 'strong-password' };

  assert.equal(
    loginSchema.safeParse({ ...credentials, identifier: 'student@example.test' }).success,
    true,
  );
  assert.equal(
    loginSchema.safeParse({ ...credentials, identifier: '529.982.247-25' }).success,
    true,
  );
  assert.equal(
    loginSchema.safeParse({ ...credentials, identifier: '529.982.247-24' }).success,
    false,
  );
});

test('registration rejects invalid CPF and mismatched passwords', () => {
  const form = {
    name: 'Aluno de teste',
    email: 'student@example.test',
    cpf: '529.982.247-25',
    password: 'Senha-Forte-Teste-2026!',
    confirmPassword: 'Senha-Forte-Teste-2026!',
    gymId: '0123456789abcdef01234567',
    consentTracking: true,
  };

  assert.equal(registerSchema.safeParse(form).success, true);
  assert.equal(
    registerSchema.safeParse({ ...form, cpf: '529.982.247-24' }).success,
    false,
  );
  const mismatch = registerSchema.safeParse({
    ...form,
    confirmPassword: 'Outra-Senha-Forte-2026!',
  });
  assert.equal(mismatch.success, false);
  if (!mismatch.success) {
    assert.ok(mismatch.error.issues.some((issue) => issue.path[0] === 'confirmPassword'));
  }
});
