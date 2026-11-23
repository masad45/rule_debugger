import type { Dataset, EnrichedTransaction, SenderEvent } from "../types";
import { list, num } from "./params";
import type { Evaluation, ParamMap, RuleDefinition } from "./types";

const thresholdCache = new WeakMap<ParamMap, Map<string, Record<string, number>>>();
const denylistCache = new WeakMap<ParamMap, { source: string[]; values: Set<string> }>();
const typeCache = new WeakMap<ParamMap, { source: string[]; values: Set<string> }>();

export function percentileOf(sorted: number[] | undefined, percentile: number): number {
  if (!sorted || sorted.length === 0) return 0;
  const bounded = Math.min(100, Math.max(0, percentile));
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * (bounded / 100)));
  return sorted[index];
}

export function thresholdsFor(params: ParamMap, dataset: Dataset, paramKey: string): Record<string, number> {
  const percentile = num(params, paramKey);
  let byKey = thresholdCache.get(params);
  if (!byKey) {
    byKey = new Map();
    thresholdCache.set(params, byKey);
  }
  const id = `${paramKey}:${percentile}`;
  const hit = byKey.get(id);
  if (hit) return hit;
  const next: Record<string, number> = {};
  for (const [currency, amounts] of Object.entries(dataset.amountsByCurrency)) {
    next[currency] = percentileOf(amounts, percentile);
  }
  byKey.set(id, next);
  return next;
}

export function denylist(params: ParamMap): Set<string> {
  const source = list(params, "merchants");
  const hit = denylistCache.get(params);
  if (hit && hit.source === source) return hit.values;
  const values = new Set(source);
  denylistCache.set(params, { source, values });
  return values;
}

export function cashTypes(params: ParamMap): Set<string> {
  const source = list(params, "types");
  const hit = typeCache.get(params);
  if (hit && hit.source === source) return hit.values;
  const values = new Set(source.map((type) => type.trim().toLowerCase()).filter(Boolean));
  typeCache.set(params, { source, values });
  return values;
}

export function countSmallInWindow(
  events: SenderEvent[],
  timeMs: number,
  windowMinutes: number,
  smallAmount: number,
): number {
  if (!Number.isFinite(timeMs)) return 0;
  const start = timeMs - windowMinutes * 60_000;
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].timeMs < start) lo = mid + 1;
    else hi = mid;
  }
  let count = 0;
  for (let index = lo; index < events.length && events[index].timeMs <= timeMs; index += 1) {
    if (events[index].amount <= smallAmount) count += 1;
  }
  return count;
}

export function evaluateRule(
  definition: RuleDefinition,
  row: EnrichedTransaction,
  params: ParamMap,
  dataset: Dataset,
): Evaluation {
  const checks = definition.checks.map((check) => ({
    id: check.id,
    label: check.label,
    fields: check.fields,
    passed: check.passed(row, params, dataset),
    detail: check.detail(row, params, dataset),
  }));
  const fired = checks.every((check) => check.passed);
  const failed = checks.find((check) => !check.passed);
  return {
    ruleId: definition.ruleId,
    fired,
    checks,
    summary: fired ? definition.successSummary(row, params, dataset) : (failed?.detail ?? "Did not fire"),
  };
}

export function ruleFires(
  definition: RuleDefinition,
  row: EnrichedTransaction,
  params: ParamMap,
  dataset: Dataset,
): boolean {
  return definition.checks.every((check) => check.passed(row, params, dataset));
}
