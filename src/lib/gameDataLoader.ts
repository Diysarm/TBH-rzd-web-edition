import { indexById, normalizeGameItem } from "../core/gamedata";
import { mergeCatalogMaps, normalizeWikiCatalog, type WikiRawItem } from "../core/wikiCatalog";
import type { GameData, GameItem } from "../types";

const WIKI_CACHE_KEY = "tbh-web-wiki-catalog";
const WIKI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let catalog: Map<number, GameItem> | null = null;
let loadPromise: Promise<Map<number, GameItem>> | null = null;
let wikiOverlay: Map<number, GameItem> | null = null;

interface WikiCachePayload {
  fetchedUtc: string;
  items: GameItem[];
}

function loadWikiCache(): Map<number, GameItem> | null {
  try {
    const raw = localStorage.getItem(WIKI_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WikiCachePayload;
    if (!parsed?.items?.length || !parsed.fetchedUtc) return null;
    if (Date.now() - Date.parse(parsed.fetchedUtc) > WIKI_CACHE_TTL_MS) return null;
    return indexById(parsed.items);
  } catch {
    return null;
  }
}

function saveWikiCache(items: GameItem[]): void {
  localStorage.setItem(
    WIKI_CACHE_KEY,
    JSON.stringify({ fetchedUtc: new Date().toISOString(), items } satisfies WikiCachePayload),
  );
}

async function fetchWikiCatalogFromApi(): Promise<GameItem[]> {
  const res = await fetch("/api/wiki/catalog", { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Wiki catalog fetch failed (${res.status})`);
  const data = (await res.json()) as { items?: WikiRawItem[] | GameItem[]; error?: string };
  if (data.error) throw new Error(data.error);
  const raw = data.items ?? [];
  if (raw.length === 0) throw new Error("Wiki catalog empty");
  if ("iconUrl" in (raw[0] ?? {})) return raw as GameItem[];
  return normalizeWikiCatalog(raw as WikiRawItem[]);
}

async function ensureWikiOverlay(force = false): Promise<Map<number, GameItem>> {
  if (!force && wikiOverlay) return wikiOverlay;

  const cached = force ? null : loadWikiCache();
  if (cached) {
    wikiOverlay = cached;
    return cached;
  }

  const items = await fetchWikiCatalogFromApi();
  wikiOverlay = indexById(items);
  saveWikiCache(items);
  return wikiOverlay;
}

async function loadBundledCatalog(): Promise<Map<number, GameItem>> {
  const res = await fetch("/data/gamedata.json");
  if (!res.ok) throw new Error(`Failed to load bundled catalog (${res.status})`);
  const data = (await res.json()) as GameData;
  const items = data.items
    .map((raw) => normalizeGameItem(raw as unknown as Record<string, unknown>))
    .filter((item): item is GameItem => item !== null);
  return indexById(items);
}

export async function loadGameCatalog(options?: {
  forceWiki?: boolean;
  skipWiki?: boolean;
}): Promise<Map<number, GameItem>> {
  if (catalog && !options?.forceWiki && !options?.skipWiki) return catalog;
  if (loadPromise && !options?.forceWiki && !options?.skipWiki) return loadPromise;

  loadPromise = (async () => {
    const bundled = await loadBundledCatalog();
    if (options?.skipWiki) {
      catalog = bundled;
      return catalog;
    }
    try {
      const wiki = await ensureWikiOverlay(options?.forceWiki ?? false);
      catalog = mergeCatalogMaps(bundled, wiki);
    } catch {
      catalog = bundled;
    }
    return catalog;
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

/** Merge wiki icons/names into an already-loaded bundled catalog (background). */
export async function mergeWikiIntoCatalog(): Promise<Map<number, GameItem>> {
  const bundled = catalog ?? (await loadBundledCatalog());
  try {
    const wiki = await ensureWikiOverlay(false);
    catalog = mergeCatalogMaps(bundled, wiki);
  } catch {
    catalog = bundled;
  }
  return catalog;
}

export async function refreshWikiCatalog(): Promise<{ count: number; merged: number }> {
  wikiOverlay = null;
  catalog = null;
  const wiki = await ensureWikiOverlay(true);
  const bundled = await loadBundledCatalog();
  catalog = mergeCatalogMaps(bundled, wiki);
  return { count: wiki.size, merged: catalog.size };
}

export function getCatalogItem(catalogMap: Map<number, GameItem>, key: number): GameItem | undefined {
  return catalogMap.get(key);
}

export function isMaterialKey(catalogMap: Map<number, GameItem>, key: number): boolean {
  return catalogMap.get(key)?.type === "MATERIAL";
}

export function isStageBoxKey(catalogMap: Map<number, GameItem>, key: number): boolean {
  return catalogMap.get(key)?.type === "STAGEBOX";
}

export function catalogStatus(): { loaded: boolean; count: number; wikiCount: number } {
  return {
    loaded: Boolean(catalog),
    count: catalog?.size ?? 0,
    wikiCount: wikiOverlay?.size ?? 0,
  };
}
