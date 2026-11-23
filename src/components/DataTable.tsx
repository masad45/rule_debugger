import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DAY_NAMES, formatDateTime, formatHour, formatType } from "../format";
import { EmptyState } from "./States";
import { gridTemplate, tableMinWidth, type Column, type SortState, type TableRow } from "./columns";
import { cx, focusRing } from "./ui";

export function DataTable({
  rows,
  columns,
  sort,
  onSort,
  selectedId,
  onSelect,
  isDesktop,
  scrollToken,
  emptyTitle,
  emptyDetail,
  emptyActionLabel,
  onEmptyAction,
}: {
  rows: TableRow[];
  columns: Column[];
  sort: SortState;
  onSort: (key: SortState["key"]) => void;
  selectedId: string | null;
  onSelect: (transactionId: string) => void;
  isDesktop: boolean;
  scrollToken: string;
  emptyTitle: string;
  emptyDetail: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isDesktop ? 40 : 148),
    overscan: 12,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [scrollToken]);

  const template = gridTemplate(columns);

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} detail={emptyDetail} actionLabel={emptyActionLabel} onAction={onEmptyAction} />
      ) : (
        <div style={{ minWidth: isDesktop ? tableMinWidth(columns) : undefined }}>
          {isDesktop ? (
            <div
              role="row"
              className="sticky top-0 z-10 grid h-9 items-center border-b border-line bg-paper text-[11px] font-semibold uppercase tracking-wide text-stone-500"
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((column, index) => {
                const active = sort.key === column.key;
                const pinned = index === 0;
                return (
                  <div
                    key={column.key}
                    role="columnheader"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={cx("h-9 bg-paper", pinned && "sticky left-0 z-20 border-r border-line")}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={cx(
                        "flex h-9 w-full items-center gap-1 px-2",
                        column.align === "right" && "justify-end",
                        focusRing,
                      )}
                    >
                      <span>{column.label}</span>
                      {active ? <span className="text-[10px] text-ink">{sort.dir === "asc" ? "▲" : "▼"}</span> : null}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div role="table" aria-rowcount={rows.length} className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = rows[virtualRow.index];
              if (!item) return null;
              const id = item.row.transaction.transaction_id;
              const selected = id === selectedId;
              return (
                <div
                  key={id}
                  role="row"
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(id);
                    }
                  }}
                  className="absolute left-0 w-full"
                  style={{ height: virtualRow.size, top: virtualRow.start }}
                >
                  {isDesktop ? (
                    <DesktopRow item={item} columns={columns} template={template} selected={selected} zebra={virtualRow.index % 2 === 1} />
                  ) : (
                    <MobileCard item={item} selected={selected} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DesktopRow({
  item,
  columns,
  template,
  selected,
  zebra,
}: {
  item: TableRow;
  columns: Column[];
  template: string;
  selected: boolean;
  zebra: boolean;
}) {
  return (
    <div
      className={cx(
        "grid h-10 cursor-pointer items-center border-b border-line text-[13px]",
        selected ? "bg-teal-50" : zebra ? "bg-[#faf8f4]" : "bg-white",
      )}
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((column, index) => {
        const text = column.render(item);
        const pinned = index === 0;
        const pinnedClass = pinned
          ? cx(
              "sticky left-0 z-10 h-10 border-r border-line",
              selected ? "bg-teal-50" : zebra ? "bg-[#faf8f4]" : "bg-white",
            )
          : "";
        if (column.tone === "why") {
          const fired = item.evaluation?.fired;
          return (
            <div key={column.key} className={cx("flex min-w-0 items-center gap-2 px-2", pinnedClass)} title={text}>
              <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", fired ? "bg-emerald-600" : "bg-rose-600")} />
              <span className="truncate">{text}</span>
            </div>
          );
        }
        return (
          <div
            key={column.key}
            title={text}
            className={cx(
              "min-w-0 truncate px-2",
              pinnedClass,
              column.align === "right" && "text-right tabular-nums",
              column.key === "id" && "font-mono text-xs",
            )}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}

function MobileCard({ item, selected }: { item: TableRow; selected: boolean }) {
  const txn = item.row.transaction;
  const feature = item.row.feature;
  return (
    <div className="h-full px-3 py-1">
      <div className={cx("h-[140px] overflow-hidden rounded-lg border px-3 py-2", selected ? "border-accent bg-teal-50" : "border-line bg-white")}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-xs">{txn.transaction_id}</span>
          <span className="text-sm font-semibold tabular-nums">
            {txn.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {txn.currency}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500">{formatDateTime(txn.txn_date_time)}</p>
        <p className="mt-1 truncate text-xs text-stone-700">
          {formatType(txn.transaction_type)} · {txn.merchant_country} · {formatHour(feature.hour_of_day)} · {DAY_NAMES[feature.day_of_week] ?? "unknown"}
        </p>
        <p className="mt-1 truncate text-sm">{txn.merchant_description_condensed}</p>
        {item.evaluation ? (
          <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-stone-600" title={item.evaluation.summary}>
            <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", item.evaluation.fired ? "bg-emerald-600" : "bg-rose-600")} />
            <span className="truncate">{item.evaluation.summary}</span>
          </p>
        ) : (
          <p className="mt-1 truncate text-xs text-stone-500">
            Count {feature.transaction_count.toLocaleString("en-US")} · user avg {feature.avg_transaction_amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        )}
      </div>
    </div>
  );
}
