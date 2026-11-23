import { cx } from "./ui";

const severityStyles: Record<string, string> = {
  Critical: "bg-rose-100 text-rose-800",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-amber-100 text-amber-900",
  Low: "bg-stone-200 text-stone-700",
};

const actionStyles: Record<string, string> = {
  Block: "bg-rose-800 text-white",
  Alert: "bg-orange-800 text-white",
  Investigate: "bg-sky-900 text-white",
  Review: "bg-stone-600 text-white",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-medium", severityStyles[severity] ?? "bg-stone-200 text-stone-700")}>
      {severity}
    </span>
  );
}

export function ActionBadge({ action }: { action: string }) {
  return (
    <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-medium", actionStyles[action] ?? "bg-stone-600 text-white")}>
      {action}
    </span>
  );
}
