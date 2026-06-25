import { parseMoney } from "../core/steamPrice";
import type { PriceEntry } from "../types";

const CATALOG_STORAGE_KEY = "tbh-web-bulk-catalog";
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 10;
const PAGE_DELAY_MS = 900;

interface SearchRenderResult {
  name: string;
  hash_name: string;
  sell_listings: number;
  sell_price: number;
  sell_price_text: string;
}

interface SearchRenderResponse {
  success: boolean;
  start: number;
  pagesize: number;
  total_count: number;
  results?: SearchRenderResult[];
}

interface StoredCatalog {
  fetchedUtc: string;
  totalCount: number;
  prices: Record<string, PriceEntry>;
}

function entryFromResult(result: SearchRenderResult): PriceEntry {
  const raw = result.sell_price_text || null;
  const parsed = parseMoney(raw);
  const fromMinor = result.sell_price > 0 ? result.sell_price / 100 : null;
  return {
    lowest: parsed ?? fromMinor,
    median: parsed ?? fromMinor,
    volume: result.sell_listings ?? 0,
    rawLowest: raw,
    rawMedian: raw,
    fetchedUtc: new Date().toISOString(),
    source: "bulk",
  };
}

function loadStoredCatalog(): StoredCatalog | null {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCatalog;
    if (!parsed?.prices || !parsed.fetchedUtc) return null;
    if (Date.now() - Date.parse(parsed.fetchedUtc) > CATALOG_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredCatalog(catalog: StoredCatalog): void {
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
}

async function fetchSearchPage(start: number): Promise<SearchRenderResponse | null> {
  const url = `/api/steam/search?start=${start}&count=${PAGE_SIZE}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim() === "null") return null;
    const data = JSON.parse(text) as SearchRenderResponse;
    return data.success ? data : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BulkCatalogProgress = {
  done: number;
  total: number;
  loaded: number;
};

let memoryCatalog: StoredCatalog | null = loadStoredCatalog();
let loadPromise: Promise<StoredCatalog | null> | null = null;

export function getBulkCatalogEntry(hashName: string): PriceEntry | undefined {
  return memoryCatalog?.prices[hashName];
}

/** Gear Steam listings use a trailing variant letter (A–E); bulk may only list one variant. */
export function gearVariantHashes(hashName: string): string[] {
  const match = hashName.match(/^(.+) [A-E]$/);
  if (!match) return [hashName];
  const base = match[1];
  return ["A", "B", "C", "D", "E"].map((letter) => `${base} ${letter}`);
}

export function lookupBulkEntry(hashName: string): PriceEntry | undefined {
  for (const variant of gearVariantHashes(hashName)) {
    const entry = getBulkCatalogEntry(variant);
    if (entry) return entry;
  }
  return undefined;
}

export function bulkCatalogStatus(): {
  loaded: boolean;
  count: number;
  fetchedUtc: string | null;
  isStale: boolean;
} {
  const fetchedUtc = memoryCatalog?.fetchedUtc ?? null;
  const isStale =
    !fetchedUtc || Date.now() - Date.parse(fetchedUtc) > CATALOG_TTL_MS;
  return {
    loaded: Boolean(memoryCatalog),
    count: memoryCatalog ? Object.keys(memoryCatalog.prices).length : 0,
    fetchedUtc,
    isStale,
  };
}

export async function ensureBulkCatalog(
  onProgress?: (p: BulkCatalogProgress) => void,
  force = false,
): Promise<StoredCatalog | null> {
  if (!force && memoryCatalog) return memoryCatalog;
  if (!force && loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!force) {
      const stored = loadStoredCatalog();
      if (stored) {
        memoryCatalog = stored;
        onProgress?.({
          done: Math.ceil(stored.totalCount / PAGE_SIZE),
          total: Math.ceil(stored.totalCount / PAGE_SIZE),
          loaded: Object.keys(stored.prices).length,
        });
        return stored;
      }
    }

    const prices: Record<string, PriceEntry> = {};
    let start = 0;
    let totalCount = PAGE_SIZE;
    let page = 0;

    while (start < totalCount) {
      onProgress?.({ done: page, total: Math.ceil(totalCount / PAGE_SIZE), loaded: Object.keys(prices).length });

      const data = await fetchSearchPage(start);
      if (!data?.results?.length) break;

      totalCount = data.total_count || totalCount;
      for (const item of data.results) {
        if (item.hash_name) {
          prices[item.hash_name] = entryFromResult(item);
        }
      }

      start += PAGE_SIZE;
      page++;
      if (start < totalCount) await sleep(PAGE_DELAY_MS);
    }

    if (Object.keys(prices).length === 0) {
      return memoryCatalog;
    }

    memoryCatalog = {
      fetchedUtc: new Date().toISOString(),
      totalCount,
      prices,
    };
    saveStoredCatalog(memoryCatalog);
    return memoryCatalog;
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

export function applyBulkCatalogToCache(
  names: string[],
  setEntry: (name: string, entry: PriceEntry) => void,
): number {
  let matched = 0;
  for (const name of names) {
    const entry = lookupBulkEntry(name);
    if (entry) {
      setEntry(name, { ...entry, fetchedUtc: new Date().toISOString() });
      matched++;
    }
  }
  return matched;
}
