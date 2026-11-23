import { controlClass, cx, focusRing } from "./ui";

export type TxnFilters = {
  type: string;
  currency: string;
  min: string;
  max: string;
};

export function TransactionFilters({
  query,
  filters,
  types,
  currencies,
  shown,
  total,
  onQuery,
  onChange,
  onClear,
}: {
  query: string;
  filters: TxnFilters;
  types: string[];
  currencies: string[];
  shown: number;
  total: number;
  onQuery: (value: string) => void;
  onChange: (patch: Partial<TxnFilters>) => void;
  onClear: () => void;
}) {
  const dirty = query !== "" || filters.type !== "all" || filters.currency !== "all" || filters.min !== "" || filters.max !== "";

  return (
    <div className="max-h-[46%] shrink-0 overflow-auto border-b border-line px-4 py-3 md:max-h-none">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="text-lg font-semibold">Transactions</h1>
          <p className="text-sm text-stone-600">
            {shown.toLocaleString("en-US")} of {total.toLocaleString("en-US")} joined with their feature vectors.
          </p>
        </div>
        <label className="min-w-48 flex-1 basis-64">
          <span className="sr-only">Search transactions</span>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search id, merchant, city, sender"
            className={cx(controlClass, "w-full")}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Select label="Type" value={filters.type} onChange={(type) => onChange({ type })} options={types} allLabel="All types" />
        <Select
          label="Currency"
          value={filters.currency}
          onChange={(currency) => onChange({ currency })}
          options={currencies}
          allLabel="All currencies"
        />
        <NumberField label="Min amount" value={filters.min} onChange={(min) => onChange({ min })} />
        <NumberField label="Max amount" value={filters.max} onChange={(max) => onChange({ max })} />
        {dirty ? (
          <button type="button" onClick={onClear} className={cx("h-9 px-2 text-sm font-medium text-accent", focusRing)}>
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-stone-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={cx(controlClass, "min-w-36")}>
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-stone-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(controlClass, "w-32 tabular-nums")}
      />
    </label>
  );
}
