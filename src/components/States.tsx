import { focusRing } from "./ui";

export function LoadingState() {
  return (
    <div className="grid h-full place-items-center bg-paper px-6 text-ink">
      <div className="w-full max-w-md">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">Rule debugger</p>
        <h1 className="mt-2 text-2xl font-semibold">Loading transactions and feature vectors</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          The two files are about 40 MB. Invalid NaN tokens are replaced with null while they load.
        </p>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full w-1/3 bg-sidebar" style={{ animation: "indeterminate 1.1s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-full place-items-center bg-paper px-6 text-ink">
      <div className="w-full max-w-md">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">Rule debugger</p>
        <h1 className="mt-2 text-2xl font-semibold">The datasets could not be loaded</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className={`mt-6 h-10 rounded-md bg-sidebar px-4 text-sm font-medium text-white ${focusRing}`}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid min-h-48 place-items-center px-6 py-16 text-center">
      <div className="max-w-md">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{detail}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={`mt-4 h-9 rounded-md bg-sidebar px-3 text-sm font-medium text-white ${focusRing}`}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
