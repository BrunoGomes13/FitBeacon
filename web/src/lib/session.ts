import type { AuthTokens } from './types';

let tokens: AuthTokens | null = null;

export function getTokens(): AuthTokens | null {
  return tokens;
}

export function setTokens(value: AuthTokens): void {
  tokens = value;
  window.dispatchEvent(new CustomEvent('fitbeacon:tokens', { detail: value }));
}

export function clearTokens(): void {
  tokens = null;
  window.dispatchEvent(new Event('fitbeacon:session-expired'));
}
