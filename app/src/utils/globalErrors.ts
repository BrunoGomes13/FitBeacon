export type GlobalErrorRecord = {
  name: string;
  message: string;
  fatal: boolean;
};

type GlobalErrorUtils = {
  setGlobalHandler: (
    handler: (error: Error, isFatal?: boolean) => void,
  ) => void;
};

const listeners = new Set<(record: GlobalErrorRecord) => void>();
let installed = false;

export function subscribeGlobalErrors(
  listener: (record: GlobalErrorRecord) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function installGlobalErrorHandler(): void {
  if (installed) return;
  const runtime = globalThis as typeof globalThis & {
    ErrorUtils?: GlobalErrorUtils;
  };
  if (!runtime.ErrorUtils) return;

  runtime.ErrorUtils.setGlobalHandler((error, isFatal = false) => {
    const record = {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: sanitize(error instanceof Error ? error.message : 'Erro inesperado.'),
      fatal: isFatal,
    };
    console.warn('Erro inesperado capturado pelo app.', record);
    for (const listener of listeners) listener(record);
  });
  installed = true;
}

function sanitize(message: string): string {
  return message
    .replace(/[A-Z]:\\Users\\[^\\]+/gi, '[private-path]')
    .replace(/file:\/\/\/[^\s]+/gi, '[private-path]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, 240);
}
