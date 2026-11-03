import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatCpfInput,
  isValidCpf,
  isValidLoginIdentifier,
  normalizeCpf,
} from '../src/api/cpf.ts';

test('validates, normalizes and formats CPF without accepting invalid check digits', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(normalizeCpf('529.982.247-25'), '52998224725');
  assert.equal(formatCpfInput('52998224725'), '529.982.247-25');
  assert.equal(isValidCpf('529.982.247-24'), false);
  assert.equal(isValidCpf('111.111.111-11'), false);
});

test('accepts e-mail and valid CPF as login identifiers only', () => {
  assert.equal(isValidLoginIdentifier('atleta@example.com'), true);
  assert.equal(isValidLoginIdentifier('529.982.247-25'), true);
  assert.equal(isValidLoginIdentifier('529.982.247-24'), false);
});
