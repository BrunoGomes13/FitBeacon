import { AlertCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="m-0 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-0 mt-2 text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Carregando dados' }: { label?: string }) {
  return (
    <div aria-label={label} aria-busy="true" className="grid gap-4">
      <div className="h-28 animate-pulse rounded-lg border border-border bg-surface-raised" />
      <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-raised" />
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  const message = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
  return (
    <div role="alert" className="panel flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 text-danger" />
        <div>
          <strong>Não foi possível carregar os dados</strong>
          <p className="mb-0 mt-1 text-sm text-muted">{message}</p>
        </div>
      </div>
      <button className="btn btn-secondary" onClick={retry} type="button">
        <RefreshCw size={16} aria-hidden="true" /> Tentar novamente
      </button>
    </div>
  );
}

export function EmptyState({ children = 'Ainda não há dados para este período.' }: { children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return <p role="alert" className="mb-0 mt-1 text-xs text-danger">{children}</p>;
}

export function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
    </div>
  );
}
