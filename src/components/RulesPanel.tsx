import type { Rule } from "../types";
import { ActionBadge, SeverityBadge } from "./Badges";
import { controlClass, cx, focusRing } from "./ui";

const severities = ["all", "Critical", "High", "Medium", "Low"] as const;
const actions = ["all", "Alert", "Review", "Investigate", "Block"] as const;

export function RulesPanel({
  rules,
  summaries,
  counts,
  selectedRuleId,
  query,
  severity,
  action,
  senderCount,
  transactionCount,
  onQuery,
  onSeverity,
  onAction,
  onSelect,
  className,
}: {
  rules: Rule[];
  summaries: Record<string, string>;
  counts: Record<string, number>;
  selectedRuleId: string;
  query: string;
  severity: string;
  action: string;
  senderCount: number;
  transactionCount: number;
  onQuery: (value: string) => void;
  onSeverity: (value: string) => void;
  onAction: (value: string) => void;
  onSelect: (ruleId: string) => void;
  className?: string;
}) {
  return (
    <aside
      className={cx(
        "w-full shrink-0 flex-col bg-sidebar text-white md:flex md:h-full md:min-h-0 md:w-80 md:overflow-hidden",
        className,
      )}
    >
      <div className="shrink-0 space-y-3 px-3 py-3">
        <label className="block">
          <span className="sr-only">Search rules</span>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search name, description, or id"
            className={cx(controlClass, "w-full")}
          />
        </label>
        <ChipRow label="Severity" options={severities} value={severity} onChange={onSeverity} />
        <ChipRow label="Action" options={actions} value={action} onChange={onAction} />
      </div>
      <div className="flex h-40 shrink-0 gap-2 overflow-x-auto px-3 pb-3 md:h-auto md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto">
        {rules.length === 0 ? (
          <p className="px-1 py-6 text-sm text-slate-300">No rules match this search or filter.</p>
        ) : (
          rules.map((rule) => {
            const selected = rule.rule_id === selectedRuleId;
            return (
              <button
                key={rule.rule_id}
                type="button"
                onClick={() => onSelect(rule.rule_id)}
                aria-pressed={selected}
                className={cx(
                  "h-[136px] w-64 shrink-0 overflow-hidden rounded-lg px-3 py-2.5 text-left md:h-auto md:w-auto md:overflow-visible md:py-3",
                  focusRing,
                  selected ? "bg-white text-ink" : "bg-white/5 text-white hover:bg-white/10",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className={cx("font-mono text-[11px]", selected ? "text-stone-500" : "text-slate-400")}>
                    {rule.rule_id}
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums">{(counts[rule.rule_id] ?? 0).toLocaleString("en-US")}</span>
                    <span className={cx("block text-[10px] uppercase tracking-wide", selected ? "text-stone-500" : "text-slate-400")}>
                      fired
                    </span>
                  </span>
                </span>
                <span className="mt-1 block text-sm font-medium leading-5">{rule.name}</span>
                <span className="mt-2 flex flex-wrap gap-1">
                  <SeverityBadge severity={rule.severity} />
                  <ActionBadge action={rule.action} />
                </span>
                <span className={cx("mt-2 hidden text-xs leading-5 md:block", selected ? "text-stone-600" : "text-slate-300")}>
                  {summaries[rule.rule_id]}
                </span>
              </button>
            );
          })
        )}
      </div>
      <p className="hidden border-t border-white/10 px-3 py-3 text-xs leading-5 text-slate-400 md:block">
        {transactionCount.toLocaleString("en-US")} transactions · {senderCount.toLocaleString("en-US")} senders. Postcode is null on every row. Terminal id is always 0.
      </p>
    </aside>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              className={cx(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                focusRing,
                active ? "bg-white text-ink" : "text-slate-300 hover:bg-white/10",
              )}
            >
              {option === "all" ? "All" : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
