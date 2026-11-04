import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { equipmentSchema, EquipmentEditorForm, toEquipmentPayload, type EquipmentFormValues } from './EquipmentEditorForm';
import type { Equipment } from '../lib/types';

afterEach(cleanup);

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

  it('posiciona o pin ao tocar na planta e inclui coordenadas válidas no envio', async () => {
    const onSubmit = vi.fn<(values: EquipmentFormValues) => Promise<void>>().mockResolvedValue(undefined);
    const equipment: Equipment = {
      _id: '0123456789abcdef01234567',
      gymId: '0123456789abcdef01234567',
      name: 'Leg press',
      areaId: {
        _id: 'abcdef0123456789abcdef01',
        name: 'Musculação',
        description: '',
        isActive: true,
      },
      position: undefined,
      beacon: {
        uuid: 'b6f2d3b0-2a7c-4c52-8e90-02bd52100001',
        major: 1,
        minor: 2,
        txPower: -59,
        rssiEnter: -70,
        rssiExit: -78,
      },
      adjustments: [],
      exerciseIds: [],
      media: {},
      isActive: true,
    };
    render(
      <EquipmentEditorForm
        areas={[]}
        equipment={equipment}
        exercises={[]}
        isSaving={false}
        onSubmit={onSubmit}
      />,
    );

    const floorPlan = screen.getByRole('img', { name: /planta da academia/i });
    vi.spyOn(floorPlan, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 360,
      bottom: 520,
      width: 360,
      height: 520,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(floorPlan, { clientX: 180, clientY: 260 });
    expect(screen.getByLabelText('Posição X (%)')).toHaveValue(50);
    expect(screen.getByLabelText('Posição Y (%)')).toHaveValue(50);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const values = onSubmit.mock.calls[0][0];
    expect(toEquipmentPayload(values).position).toEqual({ x: 50, y: 50 });
    expect(toEquipmentPayload({ ...values, positionX: '', positionY: '' }).position).toBeNull();
    expect(equipmentSchema.shape.positionX.safeParse(101).success).toBe(false);
    expect(equipmentSchema.shape.positionY.safeParse(-1).success).toBe(false);
  });
});
