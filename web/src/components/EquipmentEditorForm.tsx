import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import type { Area, Equipment, Exercise } from '../lib/types';
import { FormField } from './shared';

export const equipmentSchema = z.object({
  name: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(120),
  areaId: z.string().min(1, 'Selecione uma área.'),
  positionX: z.union([z.literal(''), z.coerce.number().min(0).max(100)]),
  positionY: z.union([z.literal(''), z.coerce.number().min(0).max(100)]),
  uuid: z.string().uuid('Informe um UUID válido.'),
  major: z.coerce.number().int().min(0).max(65535),
  minor: z.coerce.number().int().min(0).max(65535),
  txPower: z.coerce.number().int().min(-127).max(20),
  rssiEnter: z.coerce.number().int().min(-127).max(0),
  rssiExit: z.coerce.number().int().min(-127).max(0),
  imageUrl: z.union([z.literal(''), z.url('Informe uma URL válida.')]),
  videoUrl: z.union([z.literal(''), z.url('Informe uma URL válida.')]),
  instructionUrl: z.union([z.literal(''), z.url('Informe uma URL válida.')]),
  exerciseIds: z.array(z.string()),
  adjustments: z.array(z.object({
    name: z.string().trim().min(1, 'Informe o nome da regulagem.'),
    instructions: z.string().trim().min(1, 'Informe como ajustar.'),
  })).max(30),
})
  .refine((value) => value.rssiEnter > value.rssiExit, {
    message: 'A entrada deve ser mais próxima que a saída.',
    path: ['rssiEnter'],
  })
  .refine(
    (value) => (value.positionX === '') === (value.positionY === ''),
    { message: 'Informe as duas coordenadas ou deixe o equipamento sem posição.', path: ['positionY'] },
  );
export type EquipmentFormInput = z.input<typeof equipmentSchema>;
export type EquipmentFormValues = z.output<typeof equipmentSchema>;

const emptyValues: EquipmentFormValues = {
  name: '',
  areaId: '',
  positionX: '',
  positionY: '',
  uuid: '',
  major: 0,
  minor: 0,
  txPower: -59,
  rssiEnter: -70,
  rssiExit: -78,
  imageUrl: '',
  videoUrl: '',
  instructionUrl: '',
  exerciseIds: [],
  adjustments: [],
};

export function toEquipmentPayload(values: EquipmentFormValues) {
  return {
    name: values.name,
    areaId: values.areaId,
    position: typeof values.positionX === 'number' && typeof values.positionY === 'number'
      ? { x: values.positionX, y: values.positionY }
      : null,
    beacon: {
      uuid: values.uuid,
      major: values.major,
      minor: values.minor,
      txPower: values.txPower,
      rssiEnter: values.rssiEnter,
      rssiExit: values.rssiExit,
    },
    exerciseIds: values.exerciseIds,
    adjustments: values.adjustments,
    media: {
      ...(values.imageUrl ? { imageUrl: values.imageUrl } : {}),
      ...(values.videoUrl ? { videoUrl: values.videoUrl } : {}),
      ...(values.instructionUrl ? { instructionUrl: values.instructionUrl } : {}),
    },
  };
}

export function equipmentFormValues(equipment?: Equipment): EquipmentFormValues {
  if (!equipment) return emptyValues;
  return {
    name: equipment.name,
    areaId: typeof equipment.areaId === 'string' ? equipment.areaId : equipment.areaId._id,
    positionX: equipment.position?.x ?? '',
    positionY: equipment.position?.y ?? '',
    uuid: equipment.beacon.uuid,
    major: equipment.beacon.major,
    minor: equipment.beacon.minor,
    txPower: equipment.beacon.txPower,
    rssiEnter: equipment.beacon.rssiEnter,
    rssiExit: equipment.beacon.rssiExit,
    imageUrl: equipment.media.imageUrl ?? '',
    videoUrl: equipment.media.videoUrl ?? '',
    instructionUrl: equipment.media.instructionUrl ?? '',
    exerciseIds: equipment.exerciseIds.map((exercise) => typeof exercise === 'string' ? exercise : exercise._id),
    adjustments: equipment.adjustments.map((adjustment) => ({ ...adjustment })),
  };
}

export function EquipmentEditorForm({
  areas,
  exercises,
  equipment,
  isSaving,
  onSubmit,
}: {
  areas: Area[];
  exercises: Exercise[];
  equipment?: Equipment;
  isSaving: boolean;
  onSubmit: (values: EquipmentFormValues) => Promise<void>;
}) {
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<EquipmentFormInput, unknown, EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: equipmentFormValues(equipment),
  });
  const adjustments = useFieldArray({ control, name: 'adjustments' });
  const positionX = useWatch({ control, name: 'positionX' });
  const positionY = useWatch({ control, name: 'positionY' });
  const placePin = (event: React.PointerEvent<SVGSVGElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setValue('positionX', Math.round(((event.clientX - bounds.left) / bounds.width) * 100), { shouldValidate: true });
    setValue('positionY', Math.round(((event.clientY - bounds.top) / bounds.height) * 100), { shouldValidate: true });
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField error={errors.name?.message} htmlFor="equipment-name" label="Nome do aparelho">
        <input className="field" id="equipment-name" {...register('name')} />
      </FormField>
      <FormField error={errors.areaId?.message} htmlFor="equipment-area" label="Área">
        <select className="field" id="equipment-area" {...register('areaId')}>
          <option value="">Selecione uma área</option>
          {areas.filter((area) => area.isActive).map((area) => <option key={area._id} value={area._id}>{area.name}</option>)}
        </select>
      </FormField>
      <fieldset className="grid gap-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Posição no mapa da academia (opcional)</legend>
        <p className="m-0 text-sm text-muted">Toque ou clique na planta para posicionar este equipamento. As coordenadas também podem ser ajustadas numericamente.</p>
        <svg
          aria-label="Planta da academia; selecione para posicionar o equipamento"
          className="w-full cursor-crosshair rounded-md border border-border bg-surface"
          onPointerDown={placePin}
          role="img"
          viewBox="0 0 360 520"
        >
          <path d="M12 12H218V166H348V326H234V508H12Z" fill="var(--surface-raised)" stroke="var(--border)" strokeWidth="2" />
          <path d="M16 16H214V160H16ZM222 170H344V322H222ZM16 172H216V504H16ZM222 330H344V504H222Z" fill="var(--surface)" stroke="var(--border)" />
          <text fill="var(--text-muted)" fontSize="12" x="30" y="40">MUSCULAÇÃO</text>
          <text fill="var(--text-muted)" fontSize="12" x="242" y="195">CARDIO</text>
          <text fill="var(--text-muted)" fontSize="12" x="34" y="206">FUNCIONAL</text>
          <text fill="var(--text-muted)" fontSize="12" x="242" y="364">LIVRE</text>
          {typeof positionX === 'number' && typeof positionY === 'number' ? (
            <circle cx={`${positionX}%`} cy={`${positionY}%`} fill="var(--primary)" r="12" stroke="white" strokeWidth="3" />
          ) : null}
        </svg>
        <div className="grid grid-cols-2 gap-3">
          <FormField error={errors.positionX?.message} htmlFor="equipment-position-x" label="Posição X (%)">
            <input className="field" id="equipment-position-x" inputMode="numeric" max="100" min="0" type="number" {...register('positionX')} />
          </FormField>
          <FormField error={errors.positionY?.message} htmlFor="equipment-position-y" label="Posição Y (%)">
            <input className="field" id="equipment-position-y" inputMode="numeric" max="100" min="0" type="number" {...register('positionY')} />
          </FormField>
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField error={errors.uuid?.message} htmlFor="equipment-uuid" label="UUID do beacon">
          <input className="field" id="equipment-uuid" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...register('uuid')} />
        </FormField>
        <FormField error={errors.major?.message} htmlFor="equipment-major" label="Major">
          <input className="field" id="equipment-major" inputMode="numeric" type="number" {...register('major')} />
        </FormField>
        <FormField error={errors.minor?.message} htmlFor="equipment-minor" label="Minor">
          <input className="field" id="equipment-minor" inputMode="numeric" type="number" {...register('minor')} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField error={errors.txPower?.message} htmlFor="equipment-tx" label="TX Power (dBm)">
          <input className="field" id="equipment-tx" inputMode="decimal" type="number" {...register('txPower')} />
        </FormField>
        <FormField error={errors.rssiEnter?.message} htmlFor="equipment-enter" label="RSSI de entrada">
          <input className="field" id="equipment-enter" inputMode="decimal" type="number" {...register('rssiEnter')} />
        </FormField>
        <FormField error={errors.rssiExit?.message} htmlFor="equipment-exit" label="RSSI de saída">
          <input className="field" id="equipment-exit" inputMode="decimal" type="number" {...register('rssiExit')} />
        </FormField>
      </div>
      <fieldset className="grid gap-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Exercícios vinculados</legend>
        {exercises.filter((exercise) => exercise.isActive).length === 0 ? (
          <p className="m-0 text-sm text-muted">Cadastre exercícios para vinculá-los ao aparelho.</p>
        ) : exercises.filter((exercise) => exercise.isActive).map((exercise) => (
          <label className="flex items-center gap-2 text-sm" key={exercise._id}>
            <input type="checkbox" value={exercise._id} {...register('exerciseIds')} />
            {exercise.name}
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Regulagens do aparelho</legend>
        {adjustments.fields.map((field, index) => (
          <div className="grid gap-3 rounded-sm border border-border p-3 sm:grid-cols-[1fr_2fr_auto]" key={field.id}>
            <FormField
              error={errors.adjustments?.[index]?.name?.message}
              htmlFor={`equipment-adjustment-name-${index}`}
              label="Regulagem"
            >
              <input className="field" id={`equipment-adjustment-name-${index}`} {...register(`adjustments.${index}.name`)} />
            </FormField>
            <FormField
              error={errors.adjustments?.[index]?.instructions?.message}
              htmlFor={`equipment-adjustment-instructions-${index}`}
              label="Instruções"
            >
              <input className="field" id={`equipment-adjustment-instructions-${index}`} {...register(`adjustments.${index}.instructions`)} />
            </FormField>
            <button className="btn btn-ghost self-end" onClick={() => adjustments.remove(index)} type="button">Remover</button>
          </div>
        ))}
        <button className="btn btn-secondary w-fit" disabled={adjustments.fields.length >= 30} onClick={() => adjustments.append({ name: '', instructions: '' })} type="button">
          Adicionar regulagem
        </button>
      </fieldset>
      {(['imageUrl', 'videoUrl', 'instructionUrl'] as const).map((key) => (
        <FormField htmlFor={`equipment-${key}`} key={key} label={key === 'imageUrl' ? 'URL da mídia / imagem' : key === 'videoUrl' ? 'URL do vídeo' : 'URL das instruções'}>
          <input className="field" id={`equipment-${key}`} type="url" {...register(key)} />
        </FormField>
      ))}
      {errors.rssiEnter?.message ? <p role="alert" className="m-0 text-sm text-danger">{errors.rssiEnter.message}</p> : null}
      <button className="btn btn-primary w-fit" disabled={isSaving} type="submit">
        {isSaving ? 'Salvando…' : equipment ? 'Salvar alterações' : 'Criar aparelho'}
      </button>
    </form>
  );
}
