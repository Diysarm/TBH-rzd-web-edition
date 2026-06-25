import { useState } from "react";
import type { ReactNode } from "react";
import { formatMoney } from "../../core/steamPrice";
import type { ResolvedInventory } from "../../types";
import { GradeBars } from "./GradeBars";

export function InventorySummary({
  inv,
  chestTotal,
  currency,
  onRefreshCatalog,
}: {
  inv: ResolvedInventory;
  chestTotal: number;
  currency: string;
  onRefreshCatalog?: () => Promise<void>;
}) {
  const c = inv.composition;
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);

  async function handleRefreshCatalog() {
    if (!onRefreshCatalog) return;
    setCatalogBusy(true);
    setCatalogMessage(null);
    try {
      await onRefreshCatalog();
      setCatalogMessage("Catalog updated from taskbarhero.wiki.");
    } catch (err) {
      setCatalogMessage(err instanceof Error ? err.message : "Catalog refresh failed.");
    } finally {
      setCatalogBusy(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Items owned" value={(c.total ?? 0).toLocaleString()} />
        <StatCard label="Distinct" value={inv.rows.length.toLocaleString()} />
        <StatCard
          highlight
          label={
            <>
              Steam value <span className="font-normal text-muted">(priced)</span>
            </>
          }
          value={
            c.valuedTotal != null && Number.isFinite(c.valuedTotal)
              ? formatMoney(c.valuedTotal, currency)
              : "—"
          }
        />
        <StatCard label="Unopened chests" value={chestTotal.toLocaleString()} />
      </div>
      <GradeBars composition={c} />
      {(c.unknownCount ?? 0) > 0 && (
        <p className="m-0 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted">
          {c.unknownCount} item(s) not in catalog (Unknown #id).{" "}
          {onRefreshCatalog && (
            <button
              type="button"
              disabled={catalogBusy}
              onClick={() => void handleRefreshCatalog()}
              className="ml-1 rounded border border-border bg-bg px-2 py-0.5 text-xs hover:border-accent disabled:opacity-50"
            >
              {catalogBusy ? "Refreshing…" : "Refresh from wiki"}
            </button>
          )}
        </p>
      )}
      {catalogMessage && (
        <p className="m-0 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted">
          {catalogMessage}
        </p>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: ReactNode;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-lg border border-gold/20 bg-gradient-to-br from-gold/5 to-card px-3 py-2.5"
          : "rounded-lg border border-border bg-card px-3 py-2.5"
      }
    >
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
