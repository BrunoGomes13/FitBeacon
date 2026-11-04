export function ReportDataFilters({
  includeDemo,
  setIncludeDemo,
  origin,
  setOrigin,
}: {
  includeDemo: boolean;
  setIncludeDemo: (value: boolean) => void;
  origin: '' | 'beacon' | 'manual';
  setOrigin: (value: '' | 'beacon' | 'manual') => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          checked={includeDemo}
          onChange={(event) => setIncludeDemo(event.target.checked)}
          type="checkbox"
        />
        Incluir dados de demonstração
      </label>
      <label className="grid gap-1 text-sm" htmlFor="report-origin">
        Origem
        <select
          className="field min-w-36"
          id="report-origin"
          onChange={(event) => setOrigin(event.target.value as '' | 'beacon' | 'manual')}
          value={origin}
        >
          <option value="">Todas</option>
          <option value="beacon">Beacon</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      {includeDemo ? (
        <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          Incluindo demonstração
        </span>
      ) : null}
    </div>
  );
}
