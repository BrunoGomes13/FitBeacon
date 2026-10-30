import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EquipmentEditorForm } from './EquipmentEditorForm';

describe('EquipmentEditorForm', () => {
  it('valida campos obrigatórios e o formato do UUID', async () => {
    const onSubmit = vi.fn();
    render(<EquipmentEditorForm areas={[]} exercises={[]} isSaving={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Criar aparelho' }));

    expect(await screen.findByText('Informe ao menos 2 caracteres.')).toBeInTheDocument();
    expect(await screen.findByText('Selecione uma área.')).toBeInTheDocument();
    expect(await screen.findByText('Informe um UUID válido.')).toBeInTheDocument();
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });
});
