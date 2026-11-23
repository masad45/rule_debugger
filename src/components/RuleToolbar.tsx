import type { Dataset, Rule } from "../types";
import { num } from "../rules/params";
import { noticeText } from "../rules/definitions";
import type { ParamMap, ParamValue, RuleDefinition } from "../rules/types";
import { ParameterEditor } from "./ParameterEditor";
import { ActionBadge, SeverityBadge } from "./Badges";
import { controlClass, cx, focusRing } from "./ui";

export function RuleToolbar({
  rule,
  definition,
  dataset,
  params,
  fired,
  total,
  showMatches,
  shown,
  query,
  onQuery,
  onShowMatches,
  onChange,
  onReset,
}: {
  rule: Rule;
  definition: RuleDefinition;
  dataset: Dataset;
  params: ParamMap;
  fired: number;
  total: number;
  showMatches: boolean;
  shown: number;
  query: string;
  onQuery: (value: string) => void;
  onShowMatches: (value: boolean) => void;
  onChange: (key: string, value: ParamValue) => void;
  onReset: () => void;
}) {
  const notice = noticeText(definition, dataset);
  const hoursInverted = definition.ruleId === "RULE_006" && num(params, "startHour") >= num(params, "endHour");

  return (
    <div className="max-h-[42%] shrink-0 overflow-auto md:max-h-none">
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold leading-6">{rule.name}</h1>
          <SeverityBadge severity={rule.severity} />
          <ActionBadge action={rule.action} />
          <span className="font-mono text-xs text-stone-500">{rule.rule_id}</span>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">{rule.description}</p>
        <p className="mt-2 font-mono text-xs leading-5 text-accent">{definition.summary(params)}</p>
        {notice ? (
          <p className="mt-3 max-w-4xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-950">
            {notice}
          </p>
        ) : null}
        {hoursInverted ? (
          <p className="mt-2 text-sm text-rose-700">
            The start hour is not earlier than the end hour, so almost every hour falls outside the window.
          </p>
        ) : null}
      </div>
      <ParameterEditor spec={definition.params} params={params} dataset={dataset} onChange={onChange} onReset={onReset} />
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <CountButton active={showMatches} label="Fired" count={fired} onClick={() => onShowMatches(true)} />
        <CountButton active={!showMatches} label="Did not fire" count={total - fired} onClick={() => onShowMatches(false)} />
        <p className="text-xs tabular-nums text-stone-500">{shown.toLocaleString("en-US")} shown</p>
        <label className="ml-auto min-w-48 flex-1">
          <span className="sr-only">Search transactions</span>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search id, merchant, city, sender"
            className={cx(controlClass, "w-full")}
          />
        </label>
      </div>
    </div>
  );
}

function CountButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "h-9 rounded-md px-3 text-sm",
        focusRing,
        active ? "bg-sidebar text-white" : "border border-line bg-white text-stone-600",
      )}
    >
      {label}
      <span className="ml-2 tabular-nums">{count.toLocaleString("en-US")}</span>
    </button>
  );
}
