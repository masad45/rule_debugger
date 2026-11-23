const amountFormatters = new Map<string, Intl.NumberFormat>();

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function parseTxnTime(value: string): number {
  return Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
}

export function formatAmount(amount: number, currency: string): string {
  let formatter = amountFormatters.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "code",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
    } catch {
      formatter = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
    }
    amountFormatters.set(currency, formatter);
  }
  const formatted = formatter.format(amount);
  if (formatter.resolvedOptions().style !== "currency") return `${formatted} ${currency}`;
  return formatted;
}

export function formatDateTime(value: string): string {
  const time = parseTxnTime(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(time);
}

export function formatHour(hour: number): string {
  const whole = Math.round(hour);
  return `${String(whole).padStart(2, "0")}:00`;
}

export function formatType(type: string | null | undefined): string {
  if (!type) return "unknown";
  return type.replaceAll("_", " ");
}

export function formatReceiver(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "null";
  return value.toFixed(0);
}

export function ordinal(value: number): string {
  const rounded = Math.round(value);
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
  switch (rounded % 10) {
    case 1:
      return `${rounded}st`;
    case 2:
      return `${rounded}nd`;
    case 3:
      return `${rounded}rd`;
    default:
      return `${rounded}th`;
  }
}

export function formatShare(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function formatField(name: string, value: unknown, currency: string): string {
  if (value == null) return "null";
  if (
    (name === "amount" || name === "avg_transaction_amount" || name === "merchant_avg_transaction_amount") &&
    typeof value === "number"
  ) {
    return formatAmount(value, currency);
  }
  if (name === "receiver_account_id") return formatReceiver(typeof value === "number" ? value : null);
  if (name === "hour_of_day" && typeof value === "number") return `${formatHour(value)} (${value})`;
  if (name === "day_of_week" && typeof value === "number") {
    return `${DAY_NAMES[value] ?? "unknown"} (${value})`;
  }
  if (name === "txn_date_time" && typeof value === "string") return formatDateTime(value);
  if (name === "transaction_type") return formatType(typeof value === "string" ? value : null);
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString("en-US")
      : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return String(value);
}
