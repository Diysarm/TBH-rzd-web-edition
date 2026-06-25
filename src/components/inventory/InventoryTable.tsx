import { memo } from "react";
import { gradeLabel, typeLabel } from "../../core/labels";
import { formatStackValue } from "../../core/steamPrice";
import type { ResolvedInventoryRow } from "../../types";
import type { SortKey } from "../../lib/inventoryFilters";
import { cn } from "../../lib/cn";
import { gradeColor } from "./gradeColor";
import { ItemIcon } from "./ItemIcon";
import { MarketListingLink } from "./MarketListingLink";

function priceSourceTitle(source: ResolvedInventoryRow["priceSource"]): string | undefined {
  if (source === "median") return "Recent sale median on Steam Market";
  if (source === "lowest") return "Lowest listing (no recent sales on Steam)";
  return undefined;
}

function emptyPriceDisplay(row: ResolvedInventoryRow): { label: string; title: string } {
  if (row.priceChecked) {
    return {
      label: "No listings",
      title: "No active Steam Market listings or recent sales for this item",
    };
  }
  return {
    label: "—",
    title: "Steam price not loaded yet",
  };
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  return <>{dir === "asc" ? " ▲" : " ▼"}</>;
}

const thClass =
  "sticky top-0 z-[1] bg-panel px-2 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted cursor-pointer select-none border-b border-border font-semibold";
const thNumClass = cn(thClass, "text-right");
const tdClass = "px-2 py-1.5 border-b border-border";
const tdNumClass = cn(tdClass, "text-right tabular-nums");

const InventoryRow = memo(function InventoryRow({
  row,
  currency,
}: {
  row: ResolvedInventoryRow;
  currency: string;
}) {
  const inUse = row.inUseCount ?? 0;
  const emptyPrice = row.marketHashName ? emptyPriceDisplay(row) : null;

  return (
    <tr className={cn("hover:bg-card", !row.known && "opacity-70")}>
      <td className={cn(tdClass, "max-w-[14rem]")} title={row.name}>
        <div className="flex min-w-0 items-center gap-2">
          <ItemIcon url={row.iconUrl} name={row.name} grade={row.grade} />
          <div className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 truncate">{row.name}</span>
            {row.chaoticCount > 0 && (
              <span className="shrink-0 text-gold" title="Chaotic">
                ◆
              </span>
            )}
          </div>
        </div>
      </td>
      <td className={tdClass} style={{ color: gradeColor(row.grade) }}>
        {gradeLabel(row.grade)}
      </td>
      <td className={tdNumClass}>
        {row.level != null ? row.level : <span className="text-muted">-</span>}
      </td>
      <td className={cn(tdClass, "text-[12px] text-muted")}>{typeLabel(row.type)}</td>
      <td className={tdNumClass}>{row.count}</td>
      <td className={tdNumClass}>
        {inUse > 0 ? (
          <span className="text-accent">
            {inUse}
            {inUse < row.count ? `/${row.count}` : ""}
          </span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td className={cn(tdNumClass, "whitespace-nowrap")}>
        {row.marketHashName ? (
          row.priceRaw ? (
            <MarketListingLink hash={row.marketHashName} title={priceSourceTitle(row.priceSource)}>
              {row.priceRaw}
            </MarketListingLink>
          ) : (
            <MarketListingLink hash={row.marketHashName} title={emptyPrice!.title}>
              <span className="text-[12px] text-muted">{emptyPrice!.label}</span>
            </MarketListingLink>
          )
        ) : (
          <span className="text-muted" title="Not priced (non-tradable or below Legendary gear)">
            -
          </span>
        )}
      </td>
      <td className={cn(tdNumClass, "whitespace-nowrap text-gold")}>
        {row.value != null ? (
          row.priceRaw ? (
            <span title="Total value">{formatStackValue(row.priceRaw, row.unitPrice, row.count, currency)}</span>
          ) : (
            "—"
          )
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
});

export function InventoryTable({
  rows,
  sortKey,
  sortDir,
  currency,
  onSort,
  onClearFilters,
}: {
  rows: ResolvedInventoryRow[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  currency: string;
  onSort: (key: SortKey) => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="min-h-[200px] flex-1 overflow-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={thClass} onClick={() => onSort("name")}>
              Name
              <SortArrow active={sortKey === "name"} dir={sortDir} />
            </th>
            <th className={thClass} onClick={() => onSort("grade")}>
              Grade
              <SortArrow active={sortKey === "grade"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("level")}>
              Level
              <SortArrow active={sortKey === "level"} dir={sortDir} />
            </th>
            <th className={thClass} onClick={() => onSort("type")}>
              Type
              <SortArrow active={sortKey === "type"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("count")}>
              Count
              <SortArrow active={sortKey === "count"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("inUse")}>
              In use
              <SortArrow active={sortKey === "inUse"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("price")}>
              Price
              <SortArrow active={sortKey === "price"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("value")}>
              Value
              <SortArrow active={sortKey === "value"} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-muted">
                No items match these filters.{" "}
                <button
                  type="button"
                  className="ml-1.5 rounded border border-border bg-panel px-2 py-0.5 text-sm hover:border-accent"
                  onClick={onClearFilters}
                >
                  Clear filters
                </button>
              </td>
            </tr>
          ) : (
            rows.map((row) => <InventoryRow key={row.itemKey} row={row} currency={currency} />)
          )}
        </tbody>
      </table>
    </div>
  );
}
