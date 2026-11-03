import { z } from 'zod';

export function normalizeCpf(value: string): string | null {
  const digits = value.replace(/\D/g, '');

  if (
    !/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value) ||
    digits.length !== 11 ||
    /^(\d)\1{10}$/.test(digits)
  ) {
    return null;
  }

  const calculateDigit = (slice: string, startWeight: number): number => {
    const sum = [...slice].reduce(
      (total, digit, index) => total + Number(digit) * (startWeight - index),
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const firstDigit = calculateDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateDigit(digits.slice(0, 9) + firstDigit, 11);

  return digits.slice(-2) === `${firstDigit}${secondDigit}` ? digits : null;
}

export function isValidCpf(value: string): boolean {
  return normalizeCpf(value) !== null;
}

export function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export const cpfSchema = z.string().refine(isValidCpf, 'Informe um CPF válido.');

export function isValidLoginIdentifier(value: string): boolean {
  return z.email().safeParse(value.trim()).success || isValidCpf(value.trim());
}
