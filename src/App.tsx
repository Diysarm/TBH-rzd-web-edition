import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUpload, loadStoredPassword } from "./components/FileUpload";
import { InventorySummary } from "./components/inventory/InventorySummary";
import { InventoryPriceBar } from "./components/inventory/InventoryPriceBar";
import { InventoryFilters } from "./components/inventory/InventoryFilters";
import { InventoryTable } from "./components/inventory/InventoryTable";
import { rowMatchesAnyLocation } from "./core/inventory/location";
import {
  defaultSortDir,
  filterAndSortRows,
  gradeOptionsFromInventory,
  typeOptionsFromInventory,
  type LocationFilter,
  type SortKey,
} from "./lib/inventoryFilters";
import { bulkCatalogStatus, ensureBulkCatalog } from "./lib/bulkMarketCatalog";
import { loadGameCatalog, mergeWikiIntoCatalog, refreshWikiCatalog } from "./lib/gameDataLoader";
import { priceService } from "./lib/priceService";
import {
  processSaveFile,
  refreshPricesForSave,
  resolveWithPrices,
  seedBulkPricesForInventory,
} from "./lib/saveProcessor";
import type { InventorySnapshot, PriceProgress, PriceStatus, ResolvedInventory } from "./types";

const DEFAULT_CURRENCY = "IDR";

export default function App() {
  const [inventory, setInventory] = useState<ResolvedInventory | null>(null);
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [marketNames, setMarketNames] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [priceStatus, setPriceStatus] = useState<PriceStatus | null>(null);
  const [priceProgress, setPriceProgress] = useState<PriceProgress | null>(null);
  const [priceMessage, setPriceMessage] = useState<string | null>(null);
  const [priceRunning, setPriceRunning] = useState(false);
  const [es3Password, setEs3Password] = useState(loadStoredPassword);

  const [query, setQuery] = useState("");
  const [tradableOnly, setTradableOnly] = useState(false);
  const [inUseOnly, setInUseOnly] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!localStorage.getItem("tbh-web-currency")) {
      localStorage.setItem("tbh-web-currency", DEFAULT_CURRENCY);
      priceService.setCurrency(DEFAULT_CURRENCY);
    }
    // Warm bulk catalog cache while user picks a save file.
    if (!bulkCatalogStatus().loaded) {
      void ensureBulkCatalog();
    }
  }, []);

  const updatePriceStatus = useCallback((names: string[]) => {
    setPriceStatus(priceService.status(names));
  }, []);

  const reresolveInventory = useCallback(async (snap: InventorySnapshot) => {
    const catalog = await loadGameCatalog();
    setInventory(resolveWithPrices(snap, catalog));
  }, []);

  const runInitialPriceLoad = useCallback(
    async (snap: InventorySnapshot, names: string[]) => {
      setPriceRunning(true);
      setPriceMessage("Loading Steam market prices…");
      try {
        await seedBulkPricesForInventory(names, setPriceProgress);
        await mergeWikiIntoCatalog();
        await reresolveInventory(snap);
        updatePriceStatus(names);
        const missing = names.filter((n) => !priceService.hasPrice(n)).length;
        if (missing > 0) {
          setPriceMessage(
            `${names.length - missing}/${names.length} items priced. ` +
              `${missing} not on market or missing ${priceService.getCurrency()} listing.`,
          );
        } else {
          setPriceMessage(null);
        }
      } finally {
        setPriceRunning(false);
        setPriceProgress(null);
      }
    },
    [reresolveInventory, updatePriceStatus],
  );

  const runPriceRefresh = useCallback(
    async (snap: InventorySnapshot, names: string[]) => {
      setPriceMessage(null);
      setPriceRunning(true);
      const result = await refreshPricesForSave(names, {
        force: true,
        bulkOnly: false,
        forceReloadBulk: bulkCatalogStatus().isStale,
        onProgress: setPriceProgress,
      });
      setPriceRunning(false);
      setPriceProgress(null);
      await reresolveInventory(snap);
      updatePriceStatus(names);
      if (result.rateLimited) {
        setPriceMessage(
          `Steam rate limit — updated ${result.priced} item(s) before stopping. Try again later.`,
        );
      } else if (result.priced > 0) {
        setPriceMessage(`Updated ${result.priced} price(s) from Steam Market.`);
      } else {
        setPriceMessage("No new prices from Steam.");
      }
      return result;
    },
    [reresolveInventory, updatePriceStatus],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setUploadError(null);
      setPriceMessage(null);
      setUploadStage("Decrypting save file…");
      try {
        const result = await processSaveFile(file, es3Password);
        setSnapshot(result.snapshot);
        setInventory(result.inventory);
        setMarketNames(result.marketNames);
        setFileName(file.name);
        updatePriceStatus(result.marketNames);
        void runInitialPriceLoad(result.snapshot, result.marketNames);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to read save file.");
      } finally {
        setBusy(false);
        setUploadStage(null);
      }
    },
    [es3Password, runInitialPriceLoad, updatePriceStatus],
  );

  useEffect(() => {
    if (!inventory) return;
    if (gradeFilter !== "ALL" && !inventory.rows.some((r) => r.grade === gradeFilter)) {
      setGradeFilter("ALL");
    }
    if (typeFilter !== "ALL" && !inventory.rows.some((r) => r.type === typeFilter)) {
      setTypeFilter("ALL");
    }
    if (locationFilter !== "ALL" && !rowMatchesAnyLocation(inventory.rows, locationFilter)) {
      setLocationFilter("ALL");
    }
  }, [inventory, gradeFilter, typeFilter, locationFilter]);

  const gradeOptions = useMemo(
    () => (inventory ? gradeOptionsFromInventory(inventory) : []),
    [inventory],
  );
  const typeOptions = useMemo(
    () => (inventory ? typeOptionsFromInventory(inventory) : []),
    [inventory],
  );

  const rows = useMemo(() => {
    if (!inventory) return [];
    return filterAndSortRows(inventory, {
      query,
      tradableOnly,
      inUseOnly,
      gradeFilter,
      typeFilter,
      locationFilter,
      sortKey,
      sortDir,
    });
  }, [
    inventory,
    query,
    tradableOnly,
    inUseOnly,
    gradeFilter,
    typeFilter,
    locationFilter,
    sortKey,
    sortDir,
  ]);

  function handleCurrencyChange(iso: string) {
    priceService.setCurrency(iso);
    localStorage.setItem("tbh-web-currency", iso);
    if (snapshot) void reresolveInventory(snapshot);
    updatePriceStatus(marketNames);
    setPriceMessage(null);
  }

  function handleRefreshPrices() {
    if (!snapshot || marketNames.length === 0) return;
    void runPriceRefresh(snapshot, marketNames);
  }

  function handleStopPrices() {
    priceService.cancel();
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultSortDir(key));
    }
  }

  function clearFilters() {
    setQuery("");
    setTradableOnly(false);
    setInUseOnly(false);
    setGradeFilter("ALL");
    setTypeFilter("ALL");
    setLocationFilter("ALL");
  }

  async function handleRefreshCatalog() {
    if (!snapshot) return;
    await refreshWikiCatalog();
    await reresolveInventory(snapshot);
  }

  const chestTotal = inventory?.chests.reduce((s, x) => s + x.quantity, 0) ?? 0;
  const currency = inventory?.currency ?? priceService.getCurrency();

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="border-b border-border bg-panel/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="m-0 text-lg font-bold tracking-tight">TBH Stash</h1>
            <p className="m-0 text-xs text-muted">Inventory & Steam Market</p>
          </div>
          <div className="flex items-center gap-3">
            {fileName && (
              <div className="text-sm text-muted">
                Save: <span className="text-fg">{fileName}</span>
              </div>
            )}
            {inventory && (
              <button
                type="button"
                onClick={() => {
                  setInventory(null);
                  setSnapshot(null);
                  setMarketNames([]);
                  setFileName(null);
                  setUploadError(null);
                  setPriceMessage(null);
                }}
                className="rounded-md border border-border px-2.5 py-1 text-sm text-muted hover:border-accent hover:text-fg"
              >
                New file
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
        {!inventory ? (
          <FileUpload
            onFile={handleFile}
            busy={busy}
            busyLabel={uploadStage ?? "Processing…"}
            error={uploadError}
            password={es3Password}
            onPasswordChange={setEs3Password}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <InventorySummary
              inv={inventory}
              chestTotal={chestTotal}
              currency={currency}
              onRefreshCatalog={handleRefreshCatalog}
            />
            <InventoryPriceBar
              status={priceStatus}
              progress={priceProgress}
              running={priceRunning}
              message={priceMessage}
              onCurrencyChange={handleCurrencyChange}
              onRefreshCatalog={handleRefreshPrices}
              onStop={handleStopPrices}
            />
            <InventoryFilters
              query={query}
              tradableOnly={tradableOnly}
              inUseOnly={inUseOnly}
              gradeFilter={gradeFilter}
              typeFilter={typeFilter}
              locationFilter={locationFilter}
              gradeOptions={gradeOptions}
              typeOptions={typeOptions}
              shownCount={rows.length}
              onQueryChange={setQuery}
              onTradableOnlyChange={setTradableOnly}
              onInUseOnlyChange={setInUseOnly}
              onGradeFilterChange={setGradeFilter}
              onTypeFilterChange={setTypeFilter}
              onLocationFilterChange={setLocationFilter}
            />
            <InventoryTable
              rows={rows}
              sortKey={sortKey}
              sortDir={sortDir}
              currency={currency}
              onSort={toggleSort}
              onClearFilters={clearFilters}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted">
        Unofficial tool — not affiliated with Tesseract Studio. Inspired by{" "}
        <a
          href="https://tbhindex.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          TBH Index
        </a>
        . Save files are processed locally in your browser.
      </footer>
    </div>
  );
}
