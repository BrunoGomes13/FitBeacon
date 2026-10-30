import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteQueueProvider, deleteUndoWindowMs, useDeleteQueue } from './DeleteQueueProvider';
import { setTokens } from '../lib/session';

function DeleteHarness() {
  const { enqueue, pendingIds } = useDeleteQueue();
  const [present, setPresent] = useState(true);
  const id = 'equipment-1';
  return (
    <>
      {present && !pendingIds.has(`equipment:${id}`) ? <p data-testid="managed-item">Leg press</p> : null}
      <button onClick={() => enqueue('equipment', id, 'Leg press')} type="button">Excluir item</button>
      <button onClick={() => setPresent(true)} type="button">Restaurar item</button>
    </>
  );
}

function renderQueue() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DeleteQueueProvider><DeleteHarness /></DeleteQueueProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DeleteQueueProvider', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setTokens({ accessToken: 'access-test', refreshToken: 'refresh-test', expiresIn: '15m' });
  });

  it('oculta o item imediatamente e desfaz sem enviar DELETE', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderQueue();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir item' }));
    expect(screen.queryByTestId('managed-item')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia DELETE depois de seis segundos e mantém o item oculto', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    renderQueue();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir item' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(deleteUndoWindowMs);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(screen.getByTestId('managed-item')).toBeInTheDocument();
  });

  it('restaura o item e exibe o motivo quando a API recusa o DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ code: 'CONFLICT', message: 'Existem sessões vinculadas.' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    renderQueue();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir item' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(deleteUndoWindowMs);
    });

    expect(screen.getByTestId('managed-item')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Existem sessões vinculadas.');
  });
});
