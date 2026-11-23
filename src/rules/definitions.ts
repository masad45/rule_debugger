import { formatAmount, formatHour, formatShare, formatType, ordinal } from "../format";
import type { Dataset, EnrichedTransaction } from "../types";
import { cashTypes, countSmallInWindow, denylist, thresholdsFor } from "./evaluate";
import { list, num, str } from "./params";
import type { ParamMap, RuleDefinition } from "./types";

function featureAmountNote(row: EnrichedTransaction): string {
  if (row.feature.amount === row.transaction.amount) return "";
  return ` Feature amount is ${formatAmount(row.feature.amount, row.feature.currency)}, which does not match the transaction.`;
}

function featureTypeNote(row: EnrichedTransaction): string {
  if (row.feature.transaction_type === row.transaction.transaction_type) return "";
  return ` Feature type is ${formatType(row.feature.transaction_type)}, which does not match the transaction.`;
}

function amountBasis(row: EnrichedTransaction, params: ParamMap, dataset: Dataset): { value: number; basis: string } {
  const currency = row.transaction.currency;
  if (str(params, "mode") === "absolute") {
    return {
      value: num(params, "absolute"),
      basis: "the single threshold shared by every currency",
    };
  }
  const percentile = num(params, "percentile");
  return {
    value: thresholdsFor(params, dataset, "percentile")[currency] ?? 0,
    basis: `the ${ordinal(percentile)} percentile for ${currency}`,
  };
}

export const ruleDefinitions: RuleDefinition[] = [
  {
    ruleId: "RULE_001",
    notice:
      "A single cutoff mixes scales: a typical PAB payment is about 13, while a typical COP payment is about 58,000. The default compares each amount with that currency's own percentile.",
    defaultParams: { mode: "percentile", percentile: 95, absolute: 2000 },
    params: [
      {
        key: "mode",
        kind: "select",
        label: "Threshold",
        options: [
          { value: "percentile", label: "Per currency percentile" },
          { value: "absolute", label: "Single amount, all currencies" },
        ],
      },
      {
        key: "percentile",
        kind: "number",
        label: "Percentile",
        min: 50,
        max: 99,
        step: 1,
        visible: (params) => str(params, "mode") === "percentile",
      },
      {
        key: "absolute",
        kind: "number",
        label: "Amount",
        min: 0,
        max: 20000000,
        step: 100,
        visible: (params) => str(params, "mode") === "absolute",
      },
    ],
    summary: (params) =>
      str(params, "mode") === "absolute"
        ? `Amount ≥ ${num(params, "absolute").toLocaleString("en-US")} in every currency`
        : `Amount ≥ the ${ordinal(num(params, "percentile"))} percentile of that currency`,
    successSummary: (row, params, dataset) => {
      const basis = amountBasis(row, params, dataset);
      return `${formatAmount(row.transaction.amount, row.transaction.currency)} ≥ ${formatAmount(basis.value, row.transaction.currency)}`;
    },
    checks: [
      {
        id: "amount",
        label: "Amount against the threshold",
        fields: ["amount", "currency"],
        passed: (row, params, dataset) => row.transaction.amount >= amountBasis(row, params, dataset).value,
        detail: (row, params, dataset) => {
          const basis = amountBasis(row, params, dataset);
          const passed = row.transaction.amount >= basis.value;
          return `${formatAmount(row.transaction.amount, row.transaction.currency)} is ${passed ? "at or above" : "below"} ${formatAmount(basis.value, row.transaction.currency)}, ${basis.basis}.${featureAmountNote(row)}`;
        },
      },
    ],
  },
  {
    ruleId: "RULE_002",
    notice:
      "The amount cutoff is one number for every currency, so peso and colón payments rarely qualify. transaction_count on the feature vector is the sender's running total, not the count inside this window.",
    defaultParams: { smallAmount: 50, windowMinutes: 60, minCount: 5 },
    params: [
      {
        key: "smallAmount",
        kind: "number",
        label: "Small amount cutoff",
        min: 0,
        max: 1000000,
        step: 5,
        hint: "Applied in the transaction currency, with no conversion.",
      },
      { key: "windowMinutes", kind: "number", label: "Window (minutes)", min: 1, max: 1440, step: 5 },
      { key: "minCount", kind: "number", label: "Minimum count", min: 2, max: 50, step: 1 },
    ],
    summary: (params) =>
      `Amount ≤ ${num(params, "smallAmount").toLocaleString("en-US")} and at least ${num(params, "minCount")} of those in the previous ${num(params, "windowMinutes")} minutes`,
    successSummary: (row, params) =>
      `${countSmallInWindow(row.sender.events, row.timeMs, num(params, "windowMinutes"), num(params, "smallAmount")).toLocaleString("en-US")} small payments in ${num(params, "windowMinutes")} minutes`,
    checks: [
      {
        id: "small",
        label: "Small amount",
        fields: ["amount", "currency"],
        passed: (row, params) => row.transaction.amount <= num(params, "smallAmount"),
        detail: (row, params) => {
          const cutoff = num(params, "smallAmount");
          const passed = row.transaction.amount <= cutoff;
          return `${formatAmount(row.transaction.amount, row.transaction.currency)} is ${passed ? "at or below" : "above"} the cutoff of ${cutoff.toLocaleString("en-US")} (not converted between currencies).${featureAmountNote(row)}`;
        },
      },
      {
        id: "burst",
        label: "Several small payments in the window",
        fields: ["txn_date_time", "amount", "transaction_count"],
        passed: (row, params) =>
          countSmallInWindow(row.sender.events, row.timeMs, num(params, "windowMinutes"), num(params, "smallAmount")) >=
          num(params, "minCount"),
        detail: (row, params) => {
          const windowMinutes = num(params, "windowMinutes");
          const smallAmount = num(params, "smallAmount");
          const minCount = num(params, "minCount");
          const count = countSmallInWindow(row.sender.events, row.timeMs, windowMinutes, smallAmount);
          return `${count.toLocaleString("en-US")} payment${count === 1 ? "" : "s"} at or below ${smallAmount.toLocaleString("en-US")} in the previous ${windowMinutes} minutes, including this one when it qualifies (need ${minCount}). Feature transaction_count is ${row.feature.transaction_count.toLocaleString("en-US")}, the sender's running total, not this window.`;
        },
      },
    ],
  },
  {
    ruleId: "RULE_003",
    notice:
      "A type is unusual when it is a known value and it accounts for less than the share cutoff of that sender's own transactions. Missing types stay visible as unknown and do not fire this rule.",
    defaultParams: { minHistory: 20, maxShare: 10 },
    params: [
      { key: "minHistory", kind: "number", label: "Minimum history", min: 1, max: 2000, step: 1 },
      { key: "maxShare", kind: "number", label: "Max share (%)", min: 1, max: 50, step: 1 },
    ],
    summary: (params) =>
      `Known type under ${num(params, "maxShare")}% of a sender with at least ${num(params, "minHistory")} transactions`,
    successSummary: (row, params) => {
      const key = row.transaction.transaction_type ?? "unknown";
      const count = row.sender.typeCounts[key] ?? 0;
      return `${formatType(row.transaction.transaction_type)} is ${formatShare(count, row.sender.total)} of this sender (cutoff ${num(params, "maxShare")}%)`;
    },
    checks: [
      {
        id: "known",
        label: "Known transaction type",
        fields: ["transaction_type"],
        passed: (row) => row.transaction.transaction_type != null && row.transaction.transaction_type !== "",
        detail: (row) => {
          const type = row.transaction.transaction_type;
          if (type == null || type === "") {
            return `Type is null, so there is no known type to compare with this sender's history.${featureTypeNote(row)}`;
          }
          return `Type ${formatType(type)} is present on the transaction.${featureTypeNote(row)}`;
        },
      },
      {
        id: "history",
        label: "Enough history",
        fields: ["sender_profile"],
        passed: (row, params) => row.sender.total >= num(params, "minHistory"),
        detail: (row, params) =>
          `This sender has ${row.sender.total.toLocaleString("en-US")} transactions (need ${num(params, "minHistory").toLocaleString("en-US")}).`,
      },
      {
        id: "rare",
        label: "Rare for this sender",
        fields: ["transaction_type", "sender_profile"],
        passed: (row, params) => {
          const key = row.transaction.transaction_type ?? "unknown";
          const count = row.sender.typeCounts[key] ?? 0;
          const share = row.sender.total === 0 ? 0 : count / row.sender.total;
          return share < num(params, "maxShare") / 100;
        },
        detail: (row, params) => {
          const key = row.transaction.transaction_type ?? "unknown";
          const count = row.sender.typeCounts[key] ?? 0;
          const cutoff = num(params, "maxShare");
          return `${formatType(row.transaction.transaction_type)} is ${formatShare(count, row.sender.total)} of this sender's ${row.sender.total.toLocaleString("en-US")} transactions (${count.toLocaleString("en-US")} of them). The cutoff is under ${cutoff}%.`;
        },
      },
    ],
  },
  {
    ruleId: "RULE_004",
    notice: (dataset) =>
      `No merchant risk flag is in the data. The list starts with the five highest-average merchant names that have at least 10 transactions (${dataset.seededHighRisk.join("; ")}). Those averages mix currencies, so treat the seed as a stand-in, not a risk score.`,
    defaultParams: { merchants: [] },
    params: [
      {
        key: "merchants",
        kind: "string-list",
        label: "High-risk merchants",
        placeholder: "Search merchant names",
        source: "merchants",
        hint: "The rule fires only when the condensed merchant name is on this list.",
      },
    ],
    summary: (params) => {
      const count = list(params, "merchants").length;
      return `Merchant name is on the high-risk list (${count.toLocaleString("en-US")})`;
    },
    successSummary: (row) => `${row.transaction.merchant_description_condensed} is on the high-risk list`,
    checks: [
      {
        id: "merchant",
        label: "Merchant on the denylist",
        fields: ["merchant_description_condensed"],
        passed: (row, params) => denylist(params).has(row.transaction.merchant_description_condensed),
        detail: (row, params) => {
          const name = row.transaction.merchant_description_condensed;
          const size = denylist(params).size;
          const onList = denylist(params).has(name);
          return `${name} is ${onList ? "" : "not "}on the high-risk list (${size.toLocaleString("en-US")} merchant${size === 1 ? "" : "s"}).`;
        },
      },
    ],
  },
  {
    ruleId: "RULE_005",
    notice:
      "Usual country is the merchant country this sender uses most often. Significant amount follows that currency's percentile, for the same reason a single cutoff would not.",
    defaultParams: { percentile: 90 },
    params: [
      { key: "percentile", kind: "number", label: "Significant percentile", min: 50, max: 99, step: 1 },
    ],
    summary: (params) =>
      `Country is not the sender's usual country, and amount ≥ the ${ordinal(num(params, "percentile"))} percentile for that currency`,
    successSummary: (row, params, dataset) => {
      const threshold = thresholdsFor(params, dataset, "percentile")[row.transaction.currency] ?? 0;
      return `${row.transaction.merchant_country} is outside usual country ${row.sender.modalCountry}; ${formatAmount(row.transaction.amount, row.transaction.currency)} ≥ ${formatAmount(threshold, row.transaction.currency)}`;
    },
    checks: [
      {
        id: "country",
        label: "Different from the usual country",
        fields: ["merchant_country", "sender_profile"],
        passed: (row) => row.transaction.merchant_country !== row.sender.modalCountry,
        detail: (row) => {
          const country = row.transaction.merchant_country;
          const modal = row.sender.modalCountry;
          const modalCount = row.sender.countryCounts[modal] ?? 0;
          const share = formatShare(modalCount, row.sender.total);
          if (country === modal) {
            return `Merchant country ${country} is this sender's usual country (${share} of ${row.sender.total.toLocaleString("en-US")} transactions).`;
          }
          return `Merchant country ${country} is not this sender's usual country ${modal} (${share} of ${row.sender.total.toLocaleString("en-US")} transactions).`;
        },
      },
      {
        id: "amount",
        label: "Significant amount",
        fields: ["amount", "currency"],
        passed: (row, params, dataset) =>
          row.transaction.amount >= (thresholdsFor(params, dataset, "percentile")[row.transaction.currency] ?? 0),
        detail: (row, params, dataset) => {
          const percentile = num(params, "percentile");
          const threshold = thresholdsFor(params, dataset, "percentile")[row.transaction.currency] ?? 0;
          const passed = row.transaction.amount >= threshold;
          return `${formatAmount(row.transaction.amount, row.transaction.currency)} is ${passed ? "at or above" : "below"} ${formatAmount(threshold, row.transaction.currency)}, the ${ordinal(percentile)} percentile for ${row.transaction.currency}.${featureAmountNote(row)}`;
        },
      },
    ],
  },
  {
    ruleId: "RULE_006",
    notice:
      "No timezone is stored on the transaction or the feature vector. hour_of_day is used as given. Business hours run from the start hour inclusive to the end hour exclusive.",
    defaultParams: { startHour: 8, endHour: 20 },
    params: [
      { key: "startHour", kind: "number", label: "Business starts", min: 0, max: 23, step: 1 },
      { key: "endHour", kind: "number", label: "Business ends", min: 1, max: 24, step: 1 },
    ],
    summary: (params) =>
      `Hour is before ${formatHour(num(params, "startHour"))} or at/after ${formatHour(num(params, "endHour"))}`,
    successSummary: (row, params) =>
      `Hour ${formatHour(row.feature.hour_of_day)} is outside ${formatHour(num(params, "startHour"))}–${formatHour(num(params, "endHour"))}`,
    checks: [
      {
        id: "hour",
        label: "Outside business hours",
        fields: ["hour_of_day"],
        passed: (row, params) => {
          const hour = row.feature.hour_of_day;
          return hour < num(params, "startHour") || hour >= num(params, "endHour");
        },
        detail: (row, params) => {
          const hour = row.feature.hour_of_day;
          const start = num(params, "startHour");
          const end = num(params, "endHour");
          const outside = hour < start || hour >= end;
          return `Hour ${formatHour(hour)} is ${outside ? "outside" : "inside"} ${formatHour(start)}–${formatHour(end)}, where the end hour is not included. No timezone is stored; hour_of_day is used as given.`;
        },
      },
    ],
  },
  {
    ruleId: "RULE_007",
    notice: (dataset) =>
      `Transaction types in this file: ${dataset.types.join(", ")}. None of them are cash or ATM withdrawals, so the default type list matches nothing.`,
    defaultParams: { types: ["atm", "cash", "withdrawal"], percentile: 95 },
    params: [
      {
        key: "types",
        kind: "string-list",
        label: "Cash-like types",
        placeholder: "Add a type, such as atm",
        source: "types",
        hint: "Matched against transaction_type, ignoring case. Add a type that exists in the file if you want this rule to fire.",
      },
      { key: "percentile", kind: "number", label: "Large percentile", min: 50, max: 99, step: 1 },
    ],
    summary: (params) => {
      const types = list(params, "types");
      const names = types.length > 0 ? types.join(", ") : "no types";
      return `Type is ${names}, and amount ≥ the ${ordinal(num(params, "percentile"))} percentile for that currency`;
    },
    successSummary: (row, params, dataset) => {
      const threshold = thresholdsFor(params, dataset, "percentile")[row.transaction.currency] ?? 0;
      return `${formatType(row.transaction.transaction_type)} is treated as cash and ${formatAmount(row.transaction.amount, row.transaction.currency)} ≥ ${formatAmount(threshold, row.transaction.currency)}`;
    },
    checks: [
      {
        id: "type",
        label: "Cash-like type",
        fields: ["transaction_type"],
        passed: (row, params) => cashTypes(params).has((row.transaction.transaction_type ?? "").toLowerCase()),
        detail: (row, params) => {
          const types = list(params, "types");
          const listed = types.length > 0 ? types.join(", ") : "the empty type list";
          const actual = formatType(row.transaction.transaction_type);
          const passed = cashTypes(params).has((row.transaction.transaction_type ?? "").toLowerCase());
          return `Type ${actual} is ${passed ? "" : "not "}in ${listed}.${featureTypeNote(row)}`;
        },
      },
      {
        id: "amount",
        label: "Large amount",
        fields: ["amount", "currency"],
        passed: (row, params, dataset) =>
          row.transaction.amount >= (thresholdsFor(params, dataset, "percentile")[row.transaction.currency] ?? 0),
        detail: (row, params, dataset) => {
          const percentile = num(params, "percentile");
          const threshold = thresholdsFor(params, dataset, "percentile")[row.transaction.currency] ?? 0;
          const passed = row.transaction.amount >= threshold;
          return `${formatAmount(row.transaction.amount, row.transaction.currency)} is ${passed ? "at or above" : "below"} ${formatAmount(threshold, row.transaction.currency)}, the ${ordinal(percentile)} percentile for ${row.transaction.currency}.${featureAmountNote(row)}`;
        },
      },
    ],
  },
];

export const ruleDefinitionById: Record<string, RuleDefinition> = Object.fromEntries(
  ruleDefinitions.map((definition) => [definition.ruleId, definition]),
);

function copyParams(params: ParamMap): ParamMap {
  const next: ParamMap = { ...params };
  for (const [key, value] of Object.entries(next)) {
    if (Array.isArray(value)) next[key] = [...value];
  }
  return next;
}

export function createInitialParams(dataset: Dataset): Record<string, ParamMap> {
  const params: Record<string, ParamMap> = {};
  for (const definition of ruleDefinitions) {
    const next = copyParams(definition.defaultParams);
    if (definition.ruleId === "RULE_004") next.merchants = [...dataset.seededHighRisk];
    params[definition.ruleId] = next;
  }
  return params;
}

export function defaultParamsFor(ruleId: string, dataset: Dataset): ParamMap {
  return createInitialParams(dataset)[ruleId] ?? {};
}

export function noticeText(definition: RuleDefinition, dataset: Dataset): string | undefined {
  if (!definition.notice) return undefined;
  return typeof definition.notice === "function" ? definition.notice(dataset) : definition.notice;
}
