import { STEAM_CURRENCIES } from "../../core/steamPrice";
import type { PriceProgress, PriceStatus } from "../../types";
import { PriceProgressBar } from "../market/PriceProgressBar";

const CURRENCIES = [...STEAM_CURRENCIES].sort((a, b) => {
  if (a.iso === "IDR") return -1;
  if (b.iso === "IDR") return 1;
  return a.iso.localeCompare(b.iso);
});

function fmtAge(iso: string | null): string {
  if (!iso) return "never";
  const secs = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function InventoryPriceBar({
  status,
  progress,
  running,
  message,
  onCurrencyChange,
  onRefreshCatalog,
  onStop,
}: {
  status: PriceStatus | null;
  progress: PriceProgress | null;
  running: boolean;
  message: string | null;
  onCurrencyChange: (iso: string) => void;
  onRefreshCatalog: () => void;
  onStop: () => void;
}) {
  const currency = status?.currency ?? "IDR";
  const fresh = status?.freshCount ?? 0;
  const total = status?.ownedTargets ?? 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-panel px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Currency</span>
          <select
            value={currency}
            disabled={running}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.iso}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={running}
          onClick={onRefreshCatalog}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Loading…" : "Refresh prices"}
        </button>

        <span className="text-xs text-muted">
          {total > 0 ? `${fresh}/${total} priced` : "—"} · updated {fmtAge(status?.fetchedUtc ?? null)}
        </span>
      </div>

      <p className="m-0 text-xs text-muted">
        Upload uses cached market catalog (fast). Refresh prices checks each item on Steam Market
        (~3s per item) — watch the progress bar and Network tab for priceoverview requests.
      </p>

      {running && <PriceProgressBar progress={progress} onStop={onStop} />}
      {message && <p className="m-0 text-sm text-muted">{message}</p>}
    </div>
  );
}
