import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileUpload, loadStoredPassword } from "./components/FileUpload";
import { Analytics } from "@vercel/analytics/react";
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
  const priceProgressPricedRef = useRef(0);
  const snapshotRef = useRef<InventorySnapshot | null>(null);
  const progressReresolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const marqueeTextRef = useRef<HTMLSpanElement | null>(null);
  const marqueeAnimRef = useRef<Animation | null>(null); // ← BARU

  const [query, setQuery] = useState("");
  const [tradableOnly, setTradableOnly] = useState(false);
  const [showUsedGear, setShowUsedGear] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ─── MARQUEE BOUNCE ────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    function startMarquee() {
      const text = marqueeTextRef.current;
      if (!text) return;

      const container = text.closest(".marquee-container") as HTMLElement;
      if (!container) return;

      const maxTravel = container.offsetWidth - text.offsetWidth;

      // Kalau teks lebih lebar dari container, diam saja
      if (maxTravel <= 0) {
        text.style.transform = "translateX(0)";
        return;
      }

      const duration = (maxTravel / 100) * 1000; //  per detik

      marqueeAnimRef.current?.cancel();
      marqueeAnimRef.current = text.animate(
        [
          { transform: "translateX(0)" },
          { transform: `translateX(${maxTravel}px)` },
        ],
        {
          duration,
          direction: "alternate",
          iterations: Infinity,
          easing: "ease-in-out",
        }
      );
    }

    startMarquee();
    window.addEventListener("resize", startMarquee);
    return () => {
      window.removeEventListener("resize", startMarquee);
      marqueeAnimRef.current?.cancel();
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!localStorage.getItem("tbh-web-currency")) {
      localStorage.setItem("tbh-web-currency", DEFAULT_CURRENCY);
      priceService.setCurrency(DEFAULT_CURRENCY);
    }
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

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(
    () => () => {
      if (progressReresolveTimerRef.current) {
        clearTimeout(progressReresolveTimerRef.current);
      }
    },
    [],
  );

  const handleProgress = useCallback(
    (progress: PriceProgress) => {
      setPriceProgress(progress);
      const activeSnapshot = snapshotRef.current;
      if (activeSnapshot && progress.priced > priceProgressPricedRef.current) {
        priceProgressPricedRef.current = progress.priced;
        if (progressReresolveTimerRef.current) clearTimeout(progressReresolveTimerRef.current);
        progressReresolveTimerRef.current = setTimeout(() => {
          void reresolveInventory(activeSnapshot);
        }, 150);
      }
    },
    [reresolveInventory],
  );

  const runInitialPriceLoad = useCallback(
    async (snap: InventorySnapshot, names: string[]) => {
      setPriceRunning(true);
      setPriceMessage("Loading Steam market prices…");
      priceProgressPricedRef.current = 0;
      try {
        await seedBulkPricesForInventory(names, handleProgress);
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
    [handleProgress, reresolveInventory, updatePriceStatus],
  );

  const runPriceRefresh = useCallback(
    async (snap: InventorySnapshot, names: string[]) => {
      setPriceMessage(null);
      setPriceRunning(true);
      priceProgressPricedRef.current = 0;
      const result = await refreshPricesForSave(names, {
        force: true,
        bulkOnly: false,
        forceReloadBulk: bulkCatalogStatus().isStale,
        onProgress: handleProgress,
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
    [handleProgress, reresolveInventory, updatePriceStatus],
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
      showUsedGear,
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
    showUsedGear,
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
    setShowUsedGear(false);
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

      {/* ── MARQUEE SECTION ── */}
      <div className="w-full overflow-hidden border-b border-border bg-panel/70 backdrop-blur">
        <div className="flex w-full px-4 py-4">
          <div className="marquee-container relative overflow-hidden w-full rounded-full border border-border bg-gradient-to-r from-fuchsia-500/10 via-amber-400/10 to-cyan-500/10 px-4 py-6">
            <div className="relative flex items-center h-12">
              {/* Transform diterapkan pada wrapper ini, BUKAN pada elemen
                  bg-clip-text — kalau digabung, di Firefox teks gradasi
                  hilang saat digeser (bug background-clip:text + translate). */}
              <span
                ref={marqueeTextRef}
                className="inline-block whitespace-nowrap"
                style={{ willChange: "transform" }}
              >
                <span className="text-4xl font-extrabold uppercase tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-amber-300 to-cyan-300">
                  CIKUY MENCARI RECEH
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

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
              onRefresh={handleRefreshPrices}
              onStop={handleStopPrices}
            />
            <InventoryFilters
              query={query}
              tradableOnly={tradableOnly}
              showUsedGear={showUsedGear}
              gradeFilter={gradeFilter}
              typeFilter={typeFilter}
              locationFilter={locationFilter}
              gradeOptions={gradeOptions}
              typeOptions={typeOptions}
              shownCount={rows.length}
              onQueryChange={setQuery}
              onTradableOnlyChange={setTradableOnly}
              onShowUsedGearChange={setShowUsedGear}
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
      <Analytics />
    </div>
  );
}