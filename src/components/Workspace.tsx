import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { evaluateRule, ruleFires } from "../rules/evaluate";
import { createInitialParams, defaultParamsFor, ruleDefinitionById } from "../rules/definitions";
import type { ParamValue } from "../rules/types";
import type { Dataset, EnrichedTransaction } from "../types";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { DataTable } from "./DataTable";
import { Inspector } from "./Inspector";
import { RulesPanel } from "./RulesPanel";
import { RuleToolbar } from "./RuleToolbar";
import { TransactionFilters, type TxnFilters } from "./TransactionFilters";
import {
  compareRows,
  ruleColumns,
  transactionColumns,
  type SortKey,
  type SortState,
  type TableRow,
} from "./columns";
import { cx, focusRing } from "./ui";

const emptyFilters: TxnFilters = { type: "all", currency: "all", min: "", max: "" };

function matchesFilters(row: EnrichedTransaction, filters: TxnFilters): boolean {
  if (filters.type !== "all" && (row.transaction.transaction_type ?? "unknown") !== filters.type) return false;
  if (filters.currency !== "all" && row.transaction.currency !== filters.currency) return false;
  if (filters.min !== "") {
    const min = Number(filters.min);
    if (Number.isFinite(min) && row.transaction.amount < min) return false;
  }
  if (filters.max !== "") {
    const max = Number(filters.max);
    if (Number.isFinite(max) && row.transaction.amount > max) return false;
  }
  return true;
}

export function Workspace({ dataset }: { dataset: Dataset }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [mode, setMode] = useState<"rules" | "transactions">("rules");
  const [paramsByRule, setParamsByRule] = useState(() => createInitialParams(dataset));
  const [selectedRuleId, setSelectedRuleId] = useState(dataset.rules[0]?.rule_id ?? "");
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [severity, setSeverity] = useState("all");
  const [action, setAction] = useState("all");
  const [ruleQuery, setRuleQuery] = useState("");
  const [showMatches, setShowMatches] = useState(true);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [filters, setFilters] = useState<TxnFilters>(emptyFilters);
  const [sort, setSort] = useState<SortState>({ key: "time", dir: "desc" });

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const rule of dataset.rules) {
      const definition = ruleDefinitionById[rule.rule_id];
      const params = paramsByRule[rule.rule_id];
      if (!definition || !params) {
        out[rule.rule_id] = 0;
        continue;
      }
      let fired = 0;
      for (const row of dataset.rows) {
        if (ruleFires(definition, row, params, dataset)) fired += 1;
      }
      out[rule.rule_id] = fired;
    }
    return out;
  }, [dataset, paramsByRule]);

  const selectedRule = dataset.rules.find((rule) => rule.rule_id === selectedRuleId) ?? dataset.rules[0];
  const selectedDefinition = selectedRule ? ruleDefinitionById[selectedRule.rule_id] : undefined;
  const selectedParams = selectedRule ? paramsByRule[selectedRule.rule_id] : undefined;

  const evaluated = useMemo(() => {
    if (mode !== "rules" || !selectedDefinition || !selectedParams) return [];
    return dataset.rows.map((row) => ({
      row,
      evaluation: evaluateRule(selectedDefinition, row, selectedParams, dataset),
    }));
  }, [dataset, mode, selectedDefinition, selectedParams]);

  const columns = mode === "rules" ? ruleColumns : transactionColumns;
  const activeSort = useMemo<SortState>(() => {
    return columns.some((column) => column.key === sort.key) ? sort : { key: "time", dir: "desc" };
  }, [columns, sort]);

  const visible = useMemo(() => {
    let list: TableRow[] = mode === "rules" ? evaluated.filter((item) => item.evaluation.fired === showMatches) : dataset.rows.map((row) => ({ row }));
    if (mode === "transactions") list = list.filter((item) => matchesFilters(item.row, filters));
    if (deferredQuery) list = list.filter((item) => item.row.searchText.includes(deferredQuery));
    const sorted = [...list];
    sorted.sort((a, b) => compareRows(a, b, activeSort, columns));
    return sorted;
  }, [activeSort, columns, dataset.rows, deferredQuery, evaluated, filters, mode, showMatches]);

  const selectedRow = selectedTxnId ? (dataset.byId.get(selectedTxnId) ?? null) : null;
  const selectedTrace = useMemo(() => {
    if (!selectedRow || !selectedDefinition || !selectedParams) return null;
    return evaluateRule(selectedDefinition, selectedRow, selectedParams, dataset);
  }, [dataset, selectedDefinition, selectedParams, selectedRow]);

  useEffect(() => {
    if (!selectedTrace) {
      setStep(0);
      return;
    }
    const index = selectedTrace.checks.findIndex((check) => !check.passed);
    setStep(index === -1 ? 0 : index);
  }, [selectedRuleId, selectedTxnId]);

  const summaries = useMemo(() => {
    const out: Record<string, string> = {};
    for (const rule of dataset.rules) {
      const definition = ruleDefinitionById[rule.rule_id];
      const params = paramsByRule[rule.rule_id];
      out[rule.rule_id] = definition && params ? definition.summary(params) : "No evaluator linked";
    }
    return out;
  }, [dataset.rules, paramsByRule]);

  const visibleRules = useMemo(() => {
    const needle = ruleQuery.trim().toLowerCase();
    return dataset.rules.filter((rule) => {
      if (severity !== "all" && rule.severity !== severity) return false;
      if (action !== "all" && rule.action !== action) return false;
      if (!needle) return true;
      return (
        rule.name.toLowerCase().includes(needle) ||
        rule.description.toLowerCase().includes(needle) ||
        rule.rule_id.toLowerCase().includes(needle)
      );
    });
  }, [action, dataset.rules, ruleQuery, severity]);

  const selectRule = useCallback(
    (ruleId: string) => {
      setSelectedRuleId(ruleId);
      setMode("rules");
      setShowMatches((counts[ruleId] ?? 0) > 0);
    },
    [counts],
  );

  const chooseTraceRule = useCallback((ruleId: string) => {
    setSelectedRuleId(ruleId);
  }, []);

  const onSort = useCallback((key: SortKey) => {
    setSort((current) => {
      if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      const numeric = key === "amount" || key === "hour" || key === "day" || key === "count" || key === "userAvg" || key === "merchantAvg" || key === "time";
      return { key, dir: numeric ? "desc" : "asc" };
    });
  }, []);

  const onStep = useCallback((next: number) => setStep(next), []);
  const onClose = useCallback(() => setSelectedTxnId(null), []);

  const fired = selectedRule ? (counts[selectedRule.rule_id] ?? 0) : 0;
  const searching = deferredQuery.length > 0;
  let emptyTitle = "No transactions match this search";
  let emptyDetail = "Try a transaction id, merchant, city, sender, or country.";
  let emptyActionLabel: string | undefined;
  let onEmptyAction: (() => void) | undefined;

  if (mode === "transactions") {
    emptyTitle = "No transactions match";
    emptyDetail = "Adjust the type, currency, amount, or search.";
  } else if (showMatches && fired === 0 && !searching) {
    emptyTitle = "This rule did not fire";
    emptyDetail = "Every transaction failed at least one check. Open a transaction that did not fire to see which check stopped it.";
    emptyActionLabel = "Review transactions that did not fire";
    onEmptyAction = () => setShowMatches(false);
  } else if (!showMatches && fired === dataset.rows.length && !searching) {
    emptyTitle = "Every transaction fired";
    emptyDetail = "There is no counterexample in this dataset with the current parameters.";
  }

  const scrollToken = `${mode}|${selectedRuleId}|${showMatches}|${deferredQuery}|${activeSort.key}|${activeSort.dir}|${filters.type}|${filters.currency}|${filters.min}|${filters.max}`;

  if (!selectedRule || !selectedDefinition || !selectedParams) {
    return (
      <div className="grid h-full place-items-center bg-paper text-sm text-stone-600">No rules were found in example_rules.json.</div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar text-[11px] font-semibold tracking-wide text-white">
            RD
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Rule debugger</p>
            <p className="hidden truncate text-xs text-stone-500 sm:block">Why a fraud rule fires, or why it stays silent</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs tabular-nums text-stone-500 lg:block">
            {dataset.rows.length.toLocaleString("en-US")} transactions · {dataset.senderCount.toLocaleString("en-US")} senders
          </p>
          <div className="flex rounded-lg bg-stone-200/80 p-0.5">
            <ModeButton active={mode === "rules"} onClick={() => setMode("rules")}>
              Rules
            </ModeButton>
            <ModeButton active={mode === "transactions"} onClick={() => setMode("transactions")}>
              Transactions
            </ModeButton>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <RulesPanel
          className={mode === "transactions" ? "hidden md:flex" : "flex"}
          rules={visibleRules}
          summaries={summaries}
          counts={counts}
          selectedRuleId={selectedRule.rule_id}
          query={ruleQuery}
          severity={severity}
          action={action}
          senderCount={dataset.senderCount}
          transactionCount={dataset.rows.length}
          onQuery={setRuleQuery}
          onSeverity={setSeverity}
          onAction={setAction}
          onSelect={selectRule}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {mode === "rules" ? (
            <RuleToolbar
              rule={selectedRule}
              definition={selectedDefinition}
              dataset={dataset}
              params={selectedParams}
              fired={fired}
              total={dataset.rows.length}
              showMatches={showMatches}
              shown={visible.length}
              query={query}
              onQuery={setQuery}
              onShowMatches={setShowMatches}
              onChange={(key, value: ParamValue) => {
                setParamsByRule((current) => ({
                  ...current,
                  [selectedRule.rule_id]: { ...current[selectedRule.rule_id], [key]: value },
                }));
              }}
              onReset={() => {
                setParamsByRule((current) => ({
                  ...current,
                  [selectedRule.rule_id]: defaultParamsFor(selectedRule.rule_id, dataset),
                }));
              }}
            />
          ) : (
            <TransactionFilters
              query={query}
              filters={filters}
              types={dataset.types}
              currencies={dataset.currencies}
              shown={visible.length}
              total={dataset.rows.length}
              onQuery={setQuery}
              onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
              onClear={() => {
                setQuery("");
                setFilters(emptyFilters);
              }}
            />
          )}
          <DataTable
            key={isDesktop ? "desktop" : "mobile"}
            rows={visible}
            columns={columns}
            sort={activeSort}
            onSort={onSort}
            selectedId={selectedTxnId}
            onSelect={setSelectedTxnId}
            isDesktop={isDesktop}
            scrollToken={scrollToken}
            emptyTitle={emptyTitle}
            emptyDetail={emptyDetail}
            emptyActionLabel={emptyActionLabel}
            onEmptyAction={onEmptyAction}
          />
        </main>
        {selectedRow && selectedTrace ? (
          <Inspector
            dataset={dataset}
            row={selectedRow}
            rule={selectedRule}
            evaluation={selectedTrace}
            step={step}
            paramsByRule={paramsByRule}
            onStep={onStep}
            onSelectRule={chooseTraceRule}
            onClose={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx("h-8 rounded-md px-3 text-sm font-medium", focusRing, active ? "bg-white text-ink shadow-sm" : "text-stone-600")}
    >
      {children}
    </button>
  );
}
