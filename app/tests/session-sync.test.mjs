import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { extname } from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../state/store') {
      const storeStub =
        'export const useAppStore={getState:()=>({accessToken:"test-access-token",refreshToken:null,setTokens(){},clearSession(){}})}';
      return {
        url: `data:text/javascript,${encodeURIComponent(storeStub)}`,
        shortCircuit: true,
      };
    }

    if (specifier.startsWith('.') && !extname(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') {
          throw error;
        }
      }
    }

    return nextResolve(specifier, context);
  },
});

const { recordTrainingSession } = await import('../src/api/services.ts');

test('sends a valid completed session to the batch API', async () => {
  const session = {
    clientSessionId: '01234567-89ab-4cde-8fab-0123456789ab',
    equipmentId: '0123456789abcdef01234567',
    areaId: 'abcdef0123456789abcdef01',
    startedAt: '2026-10-29T12:00:00.000Z',
    endedAt: '2026-10-29T12:00:25.000Z',
    sets: [],
  };
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new globalThis.Response(
      JSON.stringify({
        data: [{ data: session, created: true }],
        created: 1,
        idempotent: 0,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    await recordTrainingSession(session);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/sessions\/batch$/);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(
    new globalThis.Headers(calls[0].init.headers).get('Authorization'),
    'Bearer test-access-token',
  );
  assert.deepEqual(JSON.parse(calls[0].init.body), { sessions: [session] });
});
