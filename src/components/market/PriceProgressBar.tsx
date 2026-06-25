import type { PriceProgress } from "../../types";

export function PriceProgressBar({
  progress,
  onStop,
}: {
  progress: PriceProgress | null;
  onStop: () => void;
}) {
  if (!progress || progress.total === 0) return null;

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-panel px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          Fetching Steam prices: {progress.done}/{progress.total} ({progress.priced} priced
          {progress.failed > 0 ? `, ${progress.failed} failed` : ""})
        </span>
        <button
          type="button"
          onClick={onStop}
          className="rounded border border-danger/40 px-2 py-0.5 text-xs text-danger hover:bg-danger/10"
        >
          Stop
        </button>
      </div>
      {progress.current && (
        <p className="mt-1 truncate text-xs text-muted">{progress.current}</p>
      )}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
