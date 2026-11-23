import { useState } from "react";
import type { Dataset } from "../types";
import { list, num, str } from "../rules/params";
import type { ParamMap, ParamSpec, ParamValue } from "../rules/types";
import { controlClass, cx, focusRing } from "./ui";

export function ParameterEditor({
  spec,
  params,
  dataset,
  onChange,
  onReset,
}: {
  spec: ParamSpec[];
  params: ParamMap;
  dataset: Dataset;
  onChange: (key: string, value: ParamValue) => void;
  onReset: () => void;
}) {
  const visible = spec.filter((item) => (item.visible ? item.visible(params) : true));
  const scalars = visible.filter((item) => item.kind !== "string-list");
  const lists = visible.filter((item) => item.kind === "string-list");

  return (
    <div className="border-b border-line px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Parameters</h2>
        <button type="button" onClick={onReset} className={cx("text-xs font-medium text-accent", focusRing)}>
          Reset
        </button>
      </div>
      {scalars.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          {scalars.map((item) =>
            item.kind === "number" ? (
              <label key={item.key} className="block">
                <span className="mb-1 block text-xs text-stone-500">{item.label}</span>
                <input
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={num(params, item.key)}
                  onChange={(event) => {
                    const next = event.target.valueAsNumber;
                    if (!Number.isFinite(next)) return;
                    onChange(item.key, Math.min(item.max, Math.max(item.min, next)));
                  }}
                  className={cx(controlClass, "w-36 tabular-nums")}
                />
                {item.hint ? <span className="mt-1 block max-w-56 text-xs leading-5 text-stone-500">{item.hint}</span> : null}
              </label>
            ) : item.kind === "select" ? (
              <label key={item.key} className="block">
                <span className="mb-1 block text-xs text-stone-500">{item.label}</span>
                <select
                  value={str(params, item.key)}
                  onChange={(event) => onChange(item.key, event.target.value)}
                  className={cx(controlClass, "min-w-56")}
                >
                  {item.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {item.hint ? <span className="mt-1 block max-w-56 text-xs leading-5 text-stone-500">{item.hint}</span> : null}
              </label>
            ) : null,
          )}
        </div>
      ) : null}
      {lists.map((item) =>
        item.kind === "string-list" ? (
          <StringListField
            key={item.key}
            label={item.label}
            placeholder={item.placeholder}
            hint={item.hint}
            values={list(params, item.key)}
            suggestions={suggestionsFor(item.source, dataset)}
            onChange={(values) => onChange(item.key, values)}
          />
        ) : null,
      )}
    </div>
  );
}

function suggestionsFor(source: "merchants" | "types", dataset: Dataset): string[] {
  if (source === "merchants") return dataset.merchants;
  const extras = ["atm", "cash", "withdrawal"];
  return [...extras, ...dataset.types.filter((type) => !extras.includes(type))];
}

function StringListField({
  label,
  placeholder,
  hint,
  values,
  suggestions,
  onChange,
}: {
  label: string;
  placeholder: string;
  hint?: string;
  values: string[];
  suggestions: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const query = draft.trim().toLowerCase();
  const matches = query
    ? suggestions.filter((item) => item.toLowerCase().includes(query) && !values.includes(item)).slice(0, 8)
    : [];

  function add(value: string) {
    const next = value.trim();
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
    setDraft("");
    setOpen(false);
  }

  return (
    <div className="mt-3">
      <label className="block text-xs text-stone-500" htmlFor={label}>
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={label}
            value={draft}
            placeholder={placeholder}
            onChange={(event) => {
              setDraft(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add(matches[0] ?? draft);
              }
            }}
            className={cx(controlClass, "w-full")}
          />
          {open && matches.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-white py-1 shadow-lg">
              {matches.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      add(item);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-stone-100"
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => add(draft)}
          className={cx("h-9 shrink-0 rounded-md bg-sidebar px-3 text-sm font-medium text-white", focusRing)}
        >
          Add
        </button>
      </div>
      {hint ? <p className="mt-1 text-xs leading-5 text-stone-500">{hint}</p> : null}
      <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-auto">
        {values.length === 0 ? <p className="text-xs text-stone-500">Nothing on this list, so the check cannot pass.</p> : null}
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs ring-1 ring-line">
            <span>{value}</span>
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Remove ${value}`}
              className={cx("text-stone-500 hover:text-ink", focusRing)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
