import { applyBulkCatalogToCache, ensureBulkCatalog, lookupBulkEntry } from "./bulkMarketCatalog";
import { formatPriceForCurrency, priceRawMatchesCurrency } from "./priceCurrency";
import { currencyCode, parseMoney } from "../core/steamPrice";
import type { InventoryPriceInfo, PriceEntry, PriceProgress, PriceStatus } from "../types";

const DEFAULT_DELAY_MS = 3500;
const MAX_DELAY_MS = 120_000;
const MAX_429_RETRIES = 3;
const MAX_ERROR_RETRIES = 2;
const OVERVIEW_CONCURRENCY = 5;
const STORAGE_PREFIX = "tbh-web-prices:";

type RefreshCallbacks = {
  force?: boolean;
  bulkOnly?: boolean;
  forceReloadBulk?: boolean;
  onProgress?: (progress: PriceProgress) => void;
};

type PriceCache = Record<string, PriceEntry>;

export type PriceFetchOutcome =
  | { kind: "priced"; entry: PriceEntry }
  | { kind: "empty"; entry: PriceEntry }
  | { kind: "rate_limited"; status: number }
  | { kind: "error"; status: number };

function cacheKey(currency: string): string {
  return `${STORAGE_PREFIX}${currency.toUpperCase()}`;
}

function loadCache(currency: string): PriceCache {
  try {
    const raw = localStorage.getItem(cacheKey(currency));
    if (!raw) return {};
    return JSON.parse(raw) as PriceCache;
  } catch {
    return {};
  }
}

function saveCache(currency: string, cache: PriceCache): void {
  localStorage.setItem(cacheKey(currency), JSON.stringify(cache));
}

function purgeMismatchedCurrency(cache: PriceCache, iso: string): PriceCache {
  const next: PriceCache = {};
  for (const [key, entry] of Object.entries(cache)) {
    const raw = entry.rawMedian ?? entry.rawLowest;
    if (raw && !priceRawMatchesCurrency(raw, iso)) continue;
    next[key] = entry;
  }
  return next;
}

function emptyEntry(): PriceEntry {
  return {
    lowest: null,
    median: null,
    volume: 0,
    rawLowest: null,
    rawMedian: null,
    fetchedUtc: new Date().toISOString(),
  };
}

export async function fetchSteamPrice(
  name: string,
  currency: string,
): Promise<PriceFetchOutcome> {
  const url =
    `/api/steam/priceoverview?currency=${currencyCode(currency)}` +
    `&market_hash_name=${encodeURIComponent(name)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (res.status === 429) return { kind: "rate_limited", status: 429 };

    const text = await res.text();
    let data: {
      success?: boolean;
      lowest_price?: string;
      median_price?: string;
      volume?: string;
      error?: string;
    };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      return { kind: "error", status: res.status || 0 };
    }

    if (data == null || typeof data !== "object") {
      return { kind: "error", status: res.status || 0 };
    }

    if (data.error === "rate_limited" || res.status === 429) {
      return { kind: "rate_limited", status: 429 };
    }

    if (!res.ok) return { kind: "error", status: res.status };

    if (!data.success) {
      return { kind: "empty", entry: emptyEntry() };
    }

    return {
      kind: "priced",
      entry: {
        lowest: parseMoney(data.lowest_price),
        median: parseMoney(data.median_price),
        volume: data.volume ? Number(data.volume.replace(/[^0-9]/g, "")) : 0,
        rawLowest: data.lowest_price ?? null,
        rawMedian: data.median_price ?? null,
        fetchedUtc: new Date().toISOString(),
        source: "overview",
      },
    };
  } catch {
    return { kind: "error", status: 0 };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sleepUntil(ms: number, isCancelled: () => boolean): Promise<void> {
  const step = 250;
  let remaining = ms;
  while (remaining > 0 && !isCancelled()) {
    await sleep(Math.min(step, remaining));
    remaining -= step;
  }
}

export class PriceService {
  private currency: string;
  private cache: PriceCache;
  private running = false;
  private cancelled = false;
  private rateLimited = false;

  constructor(currency = "IDR") {
    this.currency = currency.toUpperCase();
    this.cache = purgeMismatchedCurrency(loadCache(this.currency), this.currency);
  }

  setCurrency(iso: string): void {
    const next = iso.toUpperCase();
    if (next === this.currency) return;
    this.currency = next;
    this.cache = purgeMismatchedCurrency(loadCache(this.currency), this.currency);
  }

  getCurrency(): string {
    return this.currency;
  }

  get(name: string): PriceEntry | undefined {
    return this.cache[name];
  }

  /** Cached price, preferring per-item Steam overview over bulk catalog. */
  getPriceInfo(name: string): InventoryPriceInfo | undefined {
    const cached = this.get(name);
    if (cached) {
      const matched = formatPriceForCurrency(cached, this.currency);
      if (matched.raw) {
        return {
          median: matched.unit,
          lowest: matched.unit,
          rawMedian: matched.raw,
          rawLowest: matched.raw,
        };
      }
    }
    const bulk = lookupBulkEntry(name);
    if (bulk) {
      const matched = formatPriceForCurrency(bulk, this.currency);
      if (matched.raw) {
        return {
          median: matched.unit,
          lowest: matched.unit,
          rawMedian: matched.raw,
          rawLowest: matched.raw,
        };
      }
    }
    return undefined;
  }

  hasPrice(name: string): boolean {
    return this.getPriceInfo(name) != null;
  }

  isRunning(): boolean {
    return this.running;
  }

  wasRateLimited(): boolean {
    return this.rateLimited;
  }

  cancel(): void {
    this.cancelled = true;
  }

  status(ownedNames: string[]): PriceStatus {
    let freshCount = 0;
    let staleCount = 0;
    let latestUtc: string | null = null;

    for (const name of ownedNames) {
      if (this.hasPrice(name)) freshCount++;
      else staleCount++;
      const entry = this.get(name) ?? lookupBulkEntry(name);
      if (entry?.fetchedUtc && (!latestUtc || entry.fetchedUtc > latestUtc)) {
        latestUtc = entry.fetchedUtc;
      }
    }

    return {
      currency: this.currency,
      count: Object.keys(this.cache).length,
      ownedTargets: ownedNames.length,
      freshCount,
      staleCount,
      fetchedUtc: latestUtc,
      running: this.running,
    };
  }

  pendingNames(names: string[], force = false): string[] {
    if (force) return names.slice();
    return names.filter((name) => !this.hasPrice(name));
  }

  pruneCache(ownedNames: string[]): void {
    const keep = new Set(ownedNames);
    let changed = false;
    for (const key of Object.keys(this.cache)) {
      if (!keep.has(key)) {
        delete this.cache[key];
        changed = true;
      }
    }
    if (changed) saveCache(this.currency, this.cache);
  }

  seedFromBulkCatalog(names: string[]): number {
    this.cache = purgeMismatchedCurrency(this.cache, this.currency);
    const matched = applyBulkCatalogToCache(names, (name, entry) => {
      const raw = entry.rawMedian ?? entry.rawLowest;
      if (raw && !priceRawMatchesCurrency(raw, this.currency)) return;
      this.cache[name] = entry;
    });
    if (matched > 0) saveCache(this.currency, this.cache);
    return matched;
  }

  async refresh(
    names: string[],
    callbacks: RefreshCallbacks = {},
  ): Promise<{ priced: number; skipped: number; failed: number; rateLimited: boolean }> {
    if (this.running) return { priced: 0, skipped: 0, failed: 0, rateLimited: false };

    this.running = true;
    this.cancelled = false;
    this.rateLimited = false;

    const pending = this.pendingNames(names, callbacks.force);
    let skipped = names.length - pending.length;
    let bulkMatched = 0;

    await ensureBulkCatalog(
      callbacks.onProgress
        ? (p) =>
            callbacks.onProgress?.({
              total: p.total,
              done: p.done,
              priced: p.loaded,
              failed: 0,
              current:
                p.done < p.total
                  ? `Loading market catalog ${p.done}/${p.total}…`
                  : "Applying prices…",
            })
        : undefined,
      callbacks.forceReloadBulk ?? false,
    );
    bulkMatched = this.seedFromBulkCatalog(pending);
    if (bulkMatched > 0) saveCache(this.currency, this.cache);

    const stillPending = this.pendingNames(names, callbacks.force);
    skipped += pending.length - stillPending.length;
    let priced = bulkMatched;

    if (callbacks.bulkOnly || stillPending.length === 0) {
      saveCache(this.currency, this.cache);
      this.running = false;
      callbacks.onProgress?.({
        total: 0,
        done: 0,
        priced,
        failed: 0,
        current: bulkMatched > 0 ? `Loaded ${bulkMatched} prices from market catalog` : "",
      });
      return { priced, skipped, failed: 0, rateLimited: false };
    }

    let failed = 0;
    let delay = DEFAULT_DELAY_MS;
    let done = 0;
    let abortOverview = false;
    const pendingQueue = stillPending.slice();
    const problemItems = new Set<string>();

    const updateProgress = (current: string, problemName?: string) => {
      if (problemName) problemItems.add(problemName);
      callbacks.onProgress?.({
        total: stillPending.length,
        done,
        priced,
        failed,
        current,
        problemItems: Array.from(problemItems).slice(-5),
      });
    };

    callbacks.onProgress?.({
      total: stillPending.length,
      done: 0,
      priced,
      failed: 0,
      current:
        bulkMatched > 0
          ? `Loaded ${bulkMatched} from catalog — checking ${stillPending.length} on Steam…`
          : "",
    });

    const retryList: string[] = [];

    const worker = async () => {
      while (!this.cancelled && !abortOverview) {
        const name = pendingQueue.shift();
        if (!name) break;

        updateProgress(name);

        let retries429 = 0;
        let retriesError = 0;
        let outcome: PriceFetchOutcome | null = null;

        while (!this.cancelled && !abortOverview) {
          outcome = await fetchSteamPrice(name, this.currency);

          if (outcome.kind === "rate_limited") {
            retries429++;
            if (retries429 >= MAX_429_RETRIES) {
              this.rateLimited = true;
              abortOverview = true;
              break;
            }
            delay = Math.min(delay * 2, MAX_DELAY_MS);
            updateProgress(`Steam rate limit - pausing ${Math.round(delay / 1000)}s`, name);
            await sleepUntil(delay, () => this.cancelled);
            continue;
          }

          if (outcome.kind === "error") {
            retriesError++;
            if (retriesError > MAX_ERROR_RETRIES) {
              // give up on this item after retries
              break;
            }
            const errDelay = Math.min(1000 * Math.pow(2, retriesError - 1), MAX_DELAY_MS);
            updateProgress(
              `Error fetching ${name} - retrying (${retriesError}/${MAX_ERROR_RETRIES}) in ${Math.round(errDelay / 1000)}s`,
              name,
            );
            await sleepUntil(errDelay, () => this.cancelled);
            continue;
          }

          break;
        }

        if (this.cancelled || abortOverview) break;

        if (outcome?.kind === "priced" || outcome?.kind === "empty") {
          this.cache[name] = outcome.entry;
          priced++;
          delay = DEFAULT_DELAY_MS;
          if (priced % 5 === 0) saveCache(this.currency, this.cache);
        } else if (outcome?.kind === "error") {
          // mark failed for now and schedule a retry pass later
          failed++;
          retryList.push(name);
          updateProgress(
            `Failed fetching ${name} after ${retriesError} attempts; scheduled for retry pass`,
            name,
          );
        }

        done++;
        updateProgress(name);

        if (!this.cancelled && !abortOverview && pendingQueue.length > 0) {
          await sleepUntil(delay, () => this.cancelled);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(OVERVIEW_CONCURRENCY, stillPending.length) }, () =>
        worker(),
      ),
    );

    // If some items failed after per-item retries, try one additional retry pass
    if (retryList.length > 0 && !abortOverview && !this.cancelled) {
      callbacks.onProgress?.({
        total: stillPending.length,
        done,
        priced,
        failed,
          current: `Retrying ${retryList.length} failed item(s) once more...`,
          problemItems: Array.from(problemItems).slice(-5),
      });

      for (const name of retryList.slice()) {
        if (this.cancelled || abortOverview) break;
        updateProgress(name);

        let retries429 = 0;
        let retriesError = 0;
        let outcome: PriceFetchOutcome | null = null;

        while (!this.cancelled && !abortOverview) {
          outcome = await fetchSteamPrice(name, this.currency);
          if (outcome.kind === "rate_limited") {
            retries429++;
            if (retries429 >= MAX_429_RETRIES) {
              this.rateLimited = true;
              abortOverview = true;
              break;
            }
            const retryDelay = Math.min(DEFAULT_DELAY_MS * Math.pow(2, retries429), MAX_DELAY_MS);
            updateProgress(
              `Retry-pass Steam rate limit for ${name} - pausing ${Math.round(retryDelay / 1000)}s`,
              name,
            );
            await sleepUntil(retryDelay, () => this.cancelled);
            continue;
          }
          if (outcome.kind === "error") {
            retriesError++;
            if (retriesError > MAX_ERROR_RETRIES) break;
            const errDelay = Math.min(1000 * Math.pow(2, retriesError - 1), MAX_DELAY_MS);
            updateProgress(
              `Retry-pass error fetching ${name} - retrying (${retriesError}/${MAX_ERROR_RETRIES}) in ${Math.round(errDelay / 1000)}s`,
              name,
            );
            await sleepUntil(errDelay, () => this.cancelled);
            continue;
          }
          break;
        }

        if (this.cancelled || abortOverview) break;

        if (outcome?.kind === "priced" || outcome?.kind === "empty") {
          this.cache[name] = outcome.entry;
          priced++;
          failed = Math.max(0, failed - 1);
          if (priced % 5 === 0) saveCache(this.currency, this.cache);
        } else if (outcome?.kind === "error") {
          updateProgress(`Retry-pass failed for ${name}; leaving it unpriced`, name);
        }

        updateProgress(name);
        if (!this.cancelled && !abortOverview) await sleepUntil(DEFAULT_DELAY_MS, () => this.cancelled);
      }
    }

    saveCache(this.currency, this.cache);
    this.running = false;

    callbacks.onProgress?.({
      total: stillPending.length,
      done,
      priced,
      failed,
      current: abortOverview ? "Stopped — Steam rate limit (catalog prices still shown)" : "",
    });

    return { priced, skipped, failed, rateLimited: this.rateLimited };
  }
}

export const priceService = new PriceService(
  localStorage.getItem("tbh-web-currency") ?? "IDR",
);

export function priceLookupFromService(name: string): InventoryPriceInfo | undefined {
  return priceService.getPriceInfo(name);
}
