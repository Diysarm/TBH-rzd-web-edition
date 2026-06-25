import { STEAM_CURRENCIES } from "../../core/steamPrice";
import type { PriceProgress, PriceStatus } from "../../types";

function fmtAge(iso: string | null): string {
  if (!iso) return "never";
  const secs = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function formatStatusLine(status: PriceStatus): string {
  const { ownedTargets, freshCount, staleCount } = status;
  if (ownedTargets === 0) return "No priceable items in inventory yet";
  const stalePart = staleCount > 0 ? ` · ${staleCount} need update` : "";
  return `${freshCount} of ${ownedTargets} items priced${stalePart}`;
}

export function MarketPanel({
  status,
  progress,
  running,
  message,
  onCurrencyChange,
  onRefresh,
  onStop,
}: {
  status: PriceStatus | null;
  progress: PriceProgress | null;
  running: boolean;
  message: string | null;
  onCurrencyChange: (iso: string) => void;
  onRefresh: (force: boolean) => void;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-lg font-semibold">Market prices</h2>
        <p className="mt-1 text-sm text-muted">
          Steam Community Market prices in your chosen currency. Prices are cached for 24 hours.
        </p>
      </div>

      <ul className="m-0 list-disc pl-[18px] text-sm text-muted [&>li]:mb-1">
        <li>Prices load automatically from the Steam market catalog (no rate limits).</li>
        <li>
          <strong>Refresh prices</strong> fetches per-item prices from Steam — slow and may hit rate
          limits (429). Use only when you need a specific currency.
        </li>
        <li>Force refresh re-fetches everything from Steam (can take 10+ minutes).</li>
      </ul>

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Currency</span>
          <select
            value={status?.currency ?? "USD"}
            disabled={running}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="rounded-md border border-border bg-panel px-2 py-1.5"
          >
            {STEAM_CURRENCIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.iso} — {c.label}
              </option>
            ))}
          </select>
        </label>

        {!running && (
          <>
            <button
              type="button"
              onClick={() => onRefresh(false)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
            >
              Refresh prices
            </button>
            <button
              type="button"
              title="Re-price everything, ignoring the 24h cache"
              onClick={() => onRefresh(true)}
              className="rounded-lg border border-border bg-panel px-4 py-2 text-sm hover:border-accent"
            >
              Force full refresh
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-4 text-sm">
        <span>{status ? formatStatusLine(status) : "—"}</span>
        <span className="text-muted">currency {status?.currency ?? "-"}</span>
        <span className="text-muted">updated {fmtAge(status?.fetchedUtc ?? null)}</span>
      </div>

      {running && progress && (
        <div className="rounded-lg border border-border bg-panel px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>
              {progress.done}/{progress.total} — priced {progress.priced}, failed {progress.failed}
            </span>
            <button
              type="button"
              onClick={onStop}
              className="rounded border border-danger/40 px-2 py-0.5 text-xs text-danger"
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
              style={{
                width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {message && <p className="m-0 text-sm">{message}</p>}
    </div>
  );
}
