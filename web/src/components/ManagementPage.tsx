import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiFetch, ApiError } from '../lib/api';
import type { Area, Equipment, Exercise } from '../lib/types';
import { EquipmentEditorForm, toEquipmentPayload, type EquipmentFormValues } from './EquipmentEditorForm';
import { EmptyState, ErrorState, FormField, LoadingState, PageTitle } from './shared';

type EntityKind = 'equipment' | 'areas' | 'exercises';
type ListResult<T> = { data: T[]; pagination: { page: number; limit: number; total: number; pages: number } };

const areaSchema = z.object({
  name: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(100),
  description: z.string().max(1000),
});

const exerciseSchema = z.object({
  name: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(120),
  muscleGroup: z.string().trim().min(2, 'Informe o grupo muscular.').max(100),
  stepsText: z.string().trim().min(1, 'Informe ao menos um passo.'),
  mistakesText: z.string(),
  recommendedSets: z.coerce.number().int().min(1).max(20),
  recommendedReps: z.coerce.number().int().min(1).max(100),
  imageUrl: z.union([z.literal(''), z.url('Informe uma URL válida.')]),
  videoUrl: z.union([z.literal(''), z.url('Informe uma URL válida.')]),
  instructionUrl: z.union([z.literal(''), z.url('Informe uma URL válida.')]),
});

type AreaForm = z.infer<typeof areaSchema>;
type ExerciseForm = z.infer<typeof exerciseSchema>;

const paths: Record<EntityKind, string> = {
  equipment: '/admin/equipment',
  areas: '/admin/areas',
  exercises: '/admin/exercises',
};

const titles: Record<EntityKind, string> = {
  equipment: 'Equipamentos',
  areas: 'Áreas',
  exercises: 'Exercícios',
};

function AreaEditor({ value, onSave, saving }: { value?: Area; onSave: (value: AreaForm) => Promise<void>; saving: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AreaForm>({
    resolver: zodResolver(areaSchema),
    defaultValues: value ? { name: value.name, description: value.description } : { name: '', description: '' },
  });
  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSave)} noValidate>
      <FormField error={errors.name?.message} htmlFor="area-name" label="Nome da área">
        <input className="field" id="area-name" {...register('name')} />
      </FormField>
      <FormField error={errors.description?.message} htmlFor="area-description" label="Descrição">
        <textarea className="field min-h-24" id="area-description" {...register('description')} />
      </FormField>
      <button className="btn btn-primary w-fit" disabled={saving} type="submit">{saving ? 'Salvando…' : 'Salvar área'}</button>
    </form>
  );
}

function ExerciseEditor({ value, onSave, saving }: { value?: Exercise; onSave: (value: ExerciseForm) => Promise<void>; saving: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<z.input<typeof exerciseSchema>, unknown, ExerciseForm>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      name: value?.name ?? '',
      muscleGroup: value?.muscleGroup ?? '',
      stepsText: value?.steps.join('\n') ?? '',
      mistakesText: value?.commonMistakes.join('\n') ?? '',
      recommendedSets: value?.recommendedSets ?? 3,
      recommendedReps: value?.recommendedReps ?? 10,
      imageUrl: value?.media.imageUrl ?? '',
      videoUrl: value?.media.videoUrl ?? '',
      instructionUrl: value?.media.instructionUrl ?? '',
    },
  });
  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSave)} noValidate>
      <FormField error={errors.name?.message} htmlFor="exercise-name" label="Nome do exercício">
        <input className="field" id="exercise-name" {...register('name')} />
      </FormField>
      <FormField error={errors.muscleGroup?.message} htmlFor="exercise-muscle" label="Grupo muscular">
        <input className="field" id="exercise-muscle" {...register('muscleGroup')} />
      </FormField>
      <FormField error={errors.stepsText?.message} htmlFor="exercise-steps" label="Passos (um por linha)">
        <textarea className="field min-h-28" id="exercise-steps" {...register('stepsText')} />
      </FormField>
      <FormField error={errors.mistakesText?.message} htmlFor="exercise-mistakes" label="Erros comuns (um por linha)">
        <textarea className="field min-h-24" id="exercise-mistakes" {...register('mistakesText')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField error={errors.recommendedSets?.message} htmlFor="exercise-sets" label="Séries recomendadas">
          <input className="field" id="exercise-sets" type="number" {...register('recommendedSets')} />
        </FormField>
        <FormField error={errors.recommendedReps?.message} htmlFor="exercise-reps" label="Repetições recomendadas">
          <input className="field" id="exercise-reps" type="number" {...register('recommendedReps')} />
        </FormField>
      </div>
      {(['imageUrl', 'videoUrl', 'instructionUrl'] as const).map((field) => (
        <FormField htmlFor={`exercise-${field}`} key={field} label={field === 'imageUrl' ? 'URL da imagem' : field === 'videoUrl' ? 'URL do vídeo' : 'URL das instruções'}>
          <input className="field" id={`exercise-${field}`} type="url" {...register(field)} />
        </FormField>
      ))}
      <button className="btn btn-primary w-fit" disabled={saving} type="submit">{saving ? 'Salvando…' : 'Salvar exercício'}</button>
    </form>
  );
}

export function ManagementPage({ kind }: { kind: EntityKind }) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const equipmentQuery = useQuery({
    queryKey: ['admin', 'equipment'],
    queryFn: () => apiFetch<ListResult<Equipment>>(`${paths.equipment}?limit=100`),
    enabled: kind === 'equipment',
  });
  const areaQuery = useQuery({
    queryKey: ['admin', 'areas'],
    queryFn: () => apiFetch<ListResult<Area>>(`${paths.areas}?limit=100`),
  });
  const exerciseQuery = useQuery({
    queryKey: ['admin', 'exercises'],
    queryFn: () => apiFetch<ListResult<Exercise>>(`${paths.exercises}?limit=100`),
    enabled: kind === 'equipment' || kind === 'exercises',
  });

  const dataQuery = kind === 'equipment' ? equipmentQuery : kind === 'areas' ? areaQuery : exerciseQuery;
  const rows = dataQuery.data?.data ?? [];
  const selected = rows.find((row) => row._id === selectedId);
  const upsert = useMutation({
    mutationFn: async (payload: unknown) => {
      const method = selectedId ? 'PATCH' : 'POST';
      const path = selectedId ? `${paths[kind]}/${selectedId}` : paths[kind];
      return apiFetch(path, { method, body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'equipment'] }),
        client.invalidateQueries({ queryKey: ['admin', 'areas'] }),
        client.invalidateQueries({ queryKey: ['admin', 'exercises'] }),
      ]);
      setCreating(false);
      setSelectedId(null);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error instanceof ApiError && error.status === 409
        ? 'Este UUID, major e minor já estão vinculados a outro equipamento.'
        : error instanceof Error ? error.message : 'Não foi possível salvar.');
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`${paths[kind]}/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['admin'] });
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : 'Não foi possível excluir.'),
  });

  const onSave = async (value: EquipmentFormValues | AreaForm | ExerciseForm): Promise<void> => {
    if (kind === 'equipment') {
      upsert.mutate(toEquipmentPayload(value as EquipmentFormValues));
      return;
    }
    if (kind === 'areas') {
      upsert.mutate(value);
      return;
    }
    const form = value as ExerciseForm;
    upsert.mutate({
      name: form.name,
      muscleGroup: form.muscleGroup,
      steps: form.stepsText.split('\n').map((line) => line.trim()).filter(Boolean),
      commonMistakes: form.mistakesText.split('\n').map((line) => line.trim()).filter(Boolean),
      recommendedSets: form.recommendedSets,
      recommendedReps: form.recommendedReps,
      media: {
        ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
        ...(form.videoUrl ? { videoUrl: form.videoUrl } : {}),
        ...(form.instructionUrl ? { instructionUrl: form.instructionUrl } : {}),
      },
    });
  };

  if (dataQuery.isPending) return <LoadingState label={`Carregando ${titles[kind].toLowerCase()}`} />;
  if (dataQuery.isError) return <ErrorState error={dataQuery.error} retry={() => void dataQuery.refetch()} />;

  return (
    <>
      <PageTitle
        title={titles[kind]}
        description={`Gerencie ${titles[kind].toLowerCase()} da academia.`}
        action={
          <button className="btn btn-primary" onClick={() => { setSelectedId(null); setCreating(true); setErrorMessage(null); }} type="button">
            <Plus size={17} aria-hidden="true" /> Novo
          </button>
        }
      />
      {errorMessage ? <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{errorMessage}</p> : null}
      {creating || selectedId ? (
        <section className="panel mb-6 p-5" aria-labelledby="editor-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-semibold" id="editor-heading">{selectedId ? `Editar ${titles[kind].toLowerCase().slice(0, -1)}` : `Novo cadastro`}</h2>
            <button className="btn btn-ghost" onClick={() => { setCreating(false); setSelectedId(null); setErrorMessage(null); }} type="button">Cancelar</button>
          </div>
          {kind === 'equipment' ? (
            <EquipmentEditorForm
              areas={areaQuery.data?.data ?? []}
              exercises={exerciseQuery.data?.data ?? []}
              equipment={selected as Equipment | undefined}
              isSaving={upsert.isPending}
              onSubmit={onSave}
            />
          ) : kind === 'areas' ? (
            <AreaEditor value={selected as Area | undefined} onSave={onSave} saving={upsert.isPending} />
          ) : (
            <ExerciseEditor value={selected as Exercise | undefined} onSave={onSave} saving={upsert.isPending} />
          )}
        </section>
      ) : null}
      {rows.length === 0 ? <EmptyState>Nenhum registro cadastrado. Use “Novo” para começar.</EmptyState> : (
        <div className="panel overflow-hidden">
          <div className="mobile-card-table overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">{kind === 'equipment' ? 'Beacon' : kind === 'areas' ? 'Descrição' : 'Grupo muscular'}</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const name = 'name' in row ? row.name : '';
                  const detail = kind === 'equipment'
                    ? `${(row as Equipment).beacon.uuid} · ${(row as Equipment).beacon.major}/${(row as Equipment).beacon.minor}`
                    : kind === 'areas' ? (row as Area).description || '—' : (row as Exercise).muscleGroup;
                  return (
                    <tr key={row._id}>
                      <td className="font-medium">{name}</td>
                      <td className="max-w-72 truncate text-muted">{detail}</td>
                      <td>{row.isActive ? 'Ativo' : 'Inativo'}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button aria-label={`Editar ${name}`} className="btn btn-secondary min-h-10 px-3" onClick={() => { setCreating(false); setSelectedId(row._id); setErrorMessage(null); }} type="button">
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button aria-label={`Excluir ${name}`} className="btn btn-danger min-h-10 px-3" onClick={() => {
                            if (window.confirm(`Deseja excluir “${name}”?`)) remove.mutate(row._id);
                          }} type="button">
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="grid gap-3 p-3">
              {rows.map((row) => (
                <article className="rounded-md border border-border p-4" key={`${row._id}-mobile`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="m-0 truncate font-medium">{'name' in row ? row.name : ''}</h3>
                      <p className="mb-0 mt-1 truncate text-sm text-muted">
                        {kind === 'equipment'
                          ? `${(row as Equipment).beacon.major}/${(row as Equipment).beacon.minor}`
                          : kind === 'areas' ? (row as Area).description || 'Sem descrição' : (row as Exercise).muscleGroup}
                      </p>
                      <span className="mt-2 inline-block text-xs text-muted">{row.isActive ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button aria-label={`Editar ${'name' in row ? row.name : ''}`} className="btn btn-secondary min-h-10 px-3" onClick={() => { setCreating(false); setSelectedId(row._id); }} type="button"><Pencil size={15} /></button>
                      <button aria-label={`Excluir ${'name' in row ? row.name : ''}`} className="btn btn-danger min-h-10 px-3" onClick={() => {
                        if (window.confirm(`Deseja excluir “${'name' in row ? row.name : ''}”?`)) remove.mutate(row._id);
                      }} type="button"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
