import { FormField } from './shared';

export function PeriodFilter({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:flex sm:items-end">
      <FormField htmlFor="period-from" label="De">
        <input aria-label="Data inicial" className="field" id="period-from" max={to} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
      </FormField>
      <FormField htmlFor="period-to" label="Até">
        <input aria-label="Data final" className="field" id="period-to" min={from} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
      </FormField>
    </div>
  );
}
