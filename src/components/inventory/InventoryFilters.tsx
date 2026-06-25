import type { LocationFilter, SortKey } from "../../lib/inventoryFilters";
import type { ItemLocation } from "../../types";

const LOCATIONS: { value: LocationFilter; label: string }[] = [
  { value: "ALL", label: "All locations" },
  { value: "inventory", label: "Inventory" },
  { value: "stash", label: "Stash" },
  { value: "trading", label: "Trading" },
  { value: "equipped", label: "Equipped" },
];

export function InventoryFilters({
  query,
  tradableOnly,
  inUseOnly,
  gradeFilter,
  typeFilter,
  locationFilter,
  gradeOptions,
  typeOptions,
  shownCount,
  onQueryChange,
  onTradableOnlyChange,
  onInUseOnlyChange,
  onGradeFilterChange,
  onTypeFilterChange,
  onLocationFilterChange,
}: {
  query: string;
  tradableOnly: boolean;
  inUseOnly: boolean;
  gradeFilter: string;
  typeFilter: string;
  locationFilter: LocationFilter;
  gradeOptions: string[];
  typeOptions: string[];
  shownCount: number;
  onQueryChange: (v: string) => void;
  onTradableOnlyChange: (v: boolean) => void;
  onInUseOnlyChange: (v: boolean) => void;
  onGradeFilterChange: (v: string) => void;
  onTypeFilterChange: (v: string) => void;
  onLocationFilterChange: (v: LocationFilter) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search items…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="min-w-[180px] flex-1 rounded-md border border-border bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select
          value={gradeFilter}
          onChange={(e) => onGradeFilterChange(e.target.value)}
          className="rounded-md border border-border bg-panel px-2 py-1.5 text-sm"
        >
          <option value="ALL">All grades</option>
          {gradeOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="rounded-md border border-border bg-panel px-2 py-1.5 text-sm"
        >
          <option value="ALL">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => onLocationFilterChange(e.target.value as ItemLocation | "ALL")}
          className="rounded-md border border-border bg-panel px-2 py-1.5 text-sm"
        >
          {LOCATIONS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={tradableOnly}
            onChange={(e) => onTradableOnlyChange(e.target.checked)}
          />
          Tradable only
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={inUseOnly}
            onChange={(e) => onInUseOnlyChange(e.target.checked)}
          />
          In use only
        </label>
        <span className="text-muted">{shownCount.toLocaleString()} shown</span>
      </div>
    </div>
  );
}

export type { SortKey };
