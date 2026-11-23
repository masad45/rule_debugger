import { useEffect } from "react";
import { formatField, formatShare, formatType } from "../format";
import { ruleFires } from "../rules/evaluate";
import { ruleDefinitionById } from "../rules/definitions";
import type { ParamMap } from "../rules/types";
import type { Evaluation } from "../rules/types";
import type { Dataset, EnrichedTransaction, Rule } from "../types";
import { cx, focusRing } from "./ui";

const transactionFields = [
  "transaction_id",
  "txn_date_time",
  "sender_account_id",
  "receiver_account_id",
  "amount",
  "currency",
  "transaction_type",
  "terminal_id",
  "merchant_city",
  "merchant_country",
  "merchant_postcode",
  "merchant_description_condensed",
] as const;

const featureFields = [
  "transaction_id",
  "sender_account_id",
  "receiver_account_id",
  "amount",
  "currency",
  "transaction_type",
  "transaction_count",
  "avg_transaction_amount",
  "hour_of_day",
  "day_of_week",
  "merchant_avg_transaction_amount",
] as const;

export function Inspector({
  dataset,
  row,
  rule,
  evaluation,
  step,
  paramsByRule,
  onStep,
  onSelectRule,
  onClose,
}: {
  dataset: Dataset;
  row: EnrichedTransaction;
  rule: Rule;
  evaluation: Evaluation;
  step: number;
  paramsByRule: Record<string, ParamMap>;
  onStep: (step: number) => void;
  onSelectRule: (ruleId: string) => void;
  onClose: () => void;
}) {
  const stepIndex = Math.min(Math.max(step, 0), Math.max(evaluation.checks.length - 1, 0));
  const active = evaluation.checks[stepIndex];
  const activeFields = new Set(active?.fields ?? []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onStep(Math.min(evaluation.checks.length - 1, stepIndex + 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onStep(Math.max(0, stepIndex - 1));
      } else if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [evaluation.checks.length, onClose, onStep, stepIndex]);

  const countries = Object.entries(row.sender.countryCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const types = Object.entries(row.sender.typeCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <aside className="fixed inset-0 z-40 flex min-h-0 flex-col border-line bg-paper md:static md:z-auto md:w-[400px] md:shrink-0 md:border-l">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium">{row.transaction.transaction_id}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Trace for {rule.rule_id}. Left and right arrows step through the checks.
          </p>
        </div>
        <button type="button" onClick={onClose} className={cx("h-8 shrink-0 rounded-md px-2 text-sm text-stone-600", focusRing)}>
          Close
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onStep(stepIndex - 1)}
            disabled={stepIndex === 0}
            className={cx("h-8 rounded-md border border-line bg-white px-2 text-xs disabled:opacity-40", focusRing)}
          >
            Previous
          </button>
          <p className="text-center text-xs text-stone-500">
            Check {stepIndex + 1} of {evaluation.checks.length}
            {active ? ` · ${active.label}` : ""}
          </p>
          <button
            type="button"
            onClick={() => onStep(stepIndex + 1)}
            disabled={stepIndex >= evaluation.checks.length - 1}
            className={cx("h-8 rounded-md border border-line bg-white px-2 text-xs disabled:opacity-40", focusRing)}
          >
            Next
          </button>
        </div>

        <ol className="mt-3 space-y-2">
          {evaluation.checks.map((check, index) => {
            const current = index === stepIndex;
            return (
              <li key={check.id}>
                <button
                  type="button"
                  onClick={() => onStep(index)}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-left",
                    focusRing,
                    current ? "border-accent bg-white" : "border-line bg-white/70",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{check.label}</span>
                    <span className={cx("text-xs font-semibold", check.passed ? "text-emerald-700" : "text-rose-700")}>
                      {check.passed ? "Pass" : "Fail"}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-stone-600">{check.detail}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <section
          data-field="sender_profile"
          className={cx("mt-5 rounded-lg border border-line p-3", activeFields.has("sender_profile") && "bg-amber-100")}
        >
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Sender profile</h2>
          <p className="mt-2 text-sm">
            {row.sender.total.toLocaleString("en-US")} transactions · usual country {row.sender.modalCountry} (
            {formatShare(row.sender.countryCounts[row.sender.modalCountry] ?? 0, row.sender.total)})
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-600">
            Countries: {countries.map(([country, count]) => `${country} ${formatShare(count, row.sender.total)}`).join(" · ")}
          </p>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            Types: {types.map(([type, count]) => `${formatType(type === "unknown" ? null : type)} ${formatShare(count, row.sender.total)}`).join(" · ")}
          </p>
        </section>

        <FieldGroup
          title="Transaction"
          fields={transactionFields}
          record={row.transaction}
          currency={row.transaction.currency}
          activeFields={activeFields}
        />
        <FieldGroup
          title="Feature vector"
          fields={featureFields}
          record={row.feature}
          currency={row.feature.currency}
          activeFields={activeFields}
        />
        <p className="mt-2 text-xs leading-5 text-stone-500">
          Joined on transaction_id. Day 0 is Monday. Averages are the raw feature values and can mix currencies for a sender.
        </p>

        <section className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Rules on this transaction</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
            {dataset.rules.map((item) => {
              const definition = ruleDefinitionById[item.rule_id];
              const params = paramsByRule[item.rule_id];
              const fired = definition && params ? ruleFires(definition, row, params, dataset) : false;
              const current = item.rule_id === rule.rule_id;
              return (
                <li key={item.rule_id}>
                  <button
                    type="button"
                    onClick={() => onSelectRule(item.rule_id)}
                    className={cx("flex w-full items-center justify-between gap-3 px-3 py-2 text-left", focusRing, current && "bg-teal-50")}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] text-stone-500">{item.rule_id}</span>
                      <span className="block truncate text-sm">{item.name}</span>
                    </span>
                    <span className={cx("shrink-0 text-xs font-semibold", fired ? "text-emerald-700" : "text-stone-400")}>
                      {fired ? "Fired" : "Silent"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </aside>
  );
}

function FieldGroup({
  title,
  fields,
  record,
  currency,
  activeFields,
}: {
  title: string;
  fields: readonly string[];
  record: object;
  currency: string;
  activeFields: Set<string>;
}) {
  return (
    <section className="mt-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{title}</h2>
      <dl className="mt-2 overflow-hidden rounded-lg border border-line bg-white">
        {fields.map((name) => {
          const value = formatField(name, (record as Record<string, unknown>)[name], currency);
          const active = activeFields.has(name);
          return (
            <div
              key={`${title}-${name}`}
              data-field={name}
              className={cx("grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2 border-b border-line px-2 py-1.5 text-xs last:border-b-0", active && "bg-amber-100")}
            >
              <dt className="truncate text-stone-500" title={name}>
                {name}
              </dt>
              <dd className={cx("truncate text-right font-mono", value === "null" ? "text-stone-400" : "text-ink")} title={value}>
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
