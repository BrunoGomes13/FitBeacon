import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadReportCsv, saveBlob } from './api';
import { setTokens } from './session';

describe('exportação CSV', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setTokens({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: '15m',
    });
  });

  it('busca CSV autenticado, recebe Blob e inicia download', async () => {
    const csv = new Blob(['nome,sessoes\nLeg press,4'], { type: 'text/csv' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => csv,
    } satisfies Partial<Response>);
    vi.stubGlobal('fetch', fetchMock);
    setTokens({ accessToken: 'access-test', refreshToken: 'refresh-test', expiresIn: '15m' });

    const blob = await downloadReportCsv({
      from: '2025-01-01',
      to: '2025-01-31',
      equipmentId: 'equipment-id',
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toContain('Leg press');

    const createUrl = vi.fn().mockReturnValue('blob:fitbeacon-report');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.useFakeTimers();
    saveBlob(blob, 'relatorio.csv');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/reports/export.csv?');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer access-test');
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(revokeUrl).toHaveBeenCalledWith('blob:fitbeacon-report');
  });
});
