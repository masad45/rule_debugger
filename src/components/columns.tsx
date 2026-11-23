import { DAY_NAMES, formatAmount, formatDateTime, formatHour, formatType } from "../format";
import type { EnrichedTransaction } from "../types";
import type { Evaluation } from "../rules/types";

export type SortKey =
  | "time"
  | "id"
  | "amount"
  | "currency"
  | "type"
  | "hour"
  | "day"
  | "count"
  | "userAvg"
  | "merchantAvg"
  | "country"
  | "merchant"
  | "why";

export type SortState = { key: SortKey; dir: "asc" | "desc" };

export type TableRow = {
  row: EnrichedTransaction;
  evaluation?: Evaluation;
};

export type Column = {
  key: SortKey;
  label: string;
  width: string;
  min: number;
  align?: "right";
  render: (item: TableRow) => string;
  value: (item: TableRow) => string | number | null;
  tone?: "why";
};

function amountText(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const time: Column = {
  key: "time",
  label: "Time",
  width: "168px",
  min: 168,
  render: (item) => formatDateTime(item.row.transaction.txn_date_time),
  value: (item) => item.row.timeMs,
};

const id: Column = {
  key: "id",
  label: "Transaction",
  width: "140px",
  min: 140,
  render: (item) => item.row.transaction.transaction_id,
  value: (item) => item.row.transaction.transaction_id,
};

const amount: Column = {
  key: "amount",
  label: "Amount",
  width: "120px",
  min: 120,
  align: "right",
  render: (item) => amountText(item.row.transaction.amount),
  value: (item) => item.row.transaction.amount,
};

const currency: Column = {
  key: "currency",
  label: "Currency",
  width: "84px",
  min: 84,
  render: (item) => item.row.transaction.currency,
  value: (item) => item.row.transaction.currency,
};

const type: Column = {
  key: "type",
  label: "Type",
  width: "120px",
  min: 120,
  render: (item) => formatType(item.row.transaction.transaction_type),
  value: (item) => item.row.transaction.transaction_type,
};

const hour: Column = {
  key: "hour",
  label: "Hour",
  width: "72px",
  min: 72,
  align: "right",
  render: (item) => formatHour(item.row.feature.hour_of_day),
  value: (item) => item.row.feature.hour_of_day,
};

const day: Column = {
  key: "day",
  label: "Day",
  width: "64px",
  min: 64,
  render: (item) => DAY_NAMES[item.row.feature.day_of_week] ?? "unknown",
  value: (item) => item.row.feature.day_of_week,
};

const country: Column = {
  key: "country",
  label: "Country",
  width: "80px",
  min: 80,
  render: (item) => item.row.transaction.merchant_country,
  value: (item) => item.row.transaction.merchant_country,
};

const merchant: Column = {
  key: "merchant",
  label: "Merchant",
  width: "minmax(180px, 1fr)",
  min: 180,
  render: (item) => item.row.transaction.merchant_description_condensed,
  value: (item) => item.row.transaction.merchant_description_condensed,
};

const why: Column = {
  key: "why",
  label: "Why",
  width: "minmax(260px, 1.4fr)",
  min: 260,
  tone: "why",
  render: (item) => item.evaluation?.summary ?? "",
  value: (item) => item.evaluation?.summary ?? null,
};

const count: Column = {
  key: "count",
  label: "Count",
  width: "80px",
  min: 80,
  align: "right",
  render: (item) => item.row.feature.transaction_count.toLocaleString("en-US"),
  value: (item) => item.row.feature.transaction_count,
};

const userAvg: Column = {
  key: "userAvg",
  label: "User avg",
  width: "132px",
  min: 132,
  align: "right",
  render: (item) => formatAmount(item.row.feature.avg_transaction_amount, item.row.transaction.currency),
  value: (item) => item.row.feature.avg_transaction_amount,
};

const merchantAvg: Column = {
  key: "merchantAvg",
  label: "Merchant avg",
  width: "140px",
  min: 140,
  align: "right",
  render: (item) => formatAmount(item.row.feature.merchant_avg_transaction_amount, item.row.transaction.currency),
  value: (item) => item.row.feature.merchant_avg_transaction_amount,
};

export const ruleColumns: Column[] = [time, amount, currency, why, merchant, id, type, country, hour, day];
export const transactionColumns: Column[] = [
  time,
  amount,
  currency,
  type,
  count,
  userAvg,
  merchantAvg,
  hour,
  day,
  id,
  country,
  merchant,
];

export function gridTemplate(columns: Column[]): string {
  return columns.map((column) => column.width).join(" ");
}

export function tableMinWidth(columns: Column[]): number {
  return columns.reduce((sum, column) => sum + column.min, 0);
}

export function compareRows(a: TableRow, b: TableRow, sort: SortState, columns: Column[]): number {
  const column = columns.find((item) => item.key === sort.key);
  const left = column ? column.value(a) : null;
  const right = column ? column.value(b) : null;
  if (left == null && right == null) return a.row.transaction.transaction_id.localeCompare(b.row.transaction.transaction_id);
  if (left == null) return 1;
  if (right == null) return -1;
  let result = 0;
  if (typeof left === "number" && typeof right === "number") result = left - right;
  else result = String(left).localeCompare(String(right));
  if (result === 0) result = a.row.transaction.transaction_id.localeCompare(b.row.transaction.transaction_id);
  return sort.dir === "asc" ? result : -result;
}
