import type { GameItem } from "../types";

const WIKI_ORIGIN = "https://taskbarhero.wiki";

export interface WikiRawItem {
  id: number;
  name?: Record<string, string> | string;
  grade?: string;
  type?: string;
  level?: number | null;
  icon?: string;
  marketable?: boolean;
  is_market_tradable?: boolean;
}

export function pickWikiName(name: WikiRawItem["name"]): string {
  if (!name) return "";
  if (typeof name === "string") return name;
  return name["en-US"] ?? name.en ?? Object.values(name)[0] ?? "";
}

export function normalizeWikiItem(raw: WikiRawItem): GameItem | null {
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  const icon = raw.icon ?? null;
  const levelRaw = raw.level;
  return {
    id,
    name: pickWikiName(raw.name) || `#${id}`,
    grade: String(raw.grade ?? "UNKNOWN"),
    type: String(raw.type ?? "UNKNOWN"),
    level:
      levelRaw === null || levelRaw === undefined
        ? null
        : Number.isFinite(Number(levelRaw))
          ? Number(levelRaw)
          : null,
    marketTradable: Boolean(raw.marketable ?? raw.is_market_tradable),
    iconUrl: icon ? `${WIKI_ORIGIN}${icon}` : null,
  };
}

export function normalizeWikiCatalog(rawItems: WikiRawItem[]): GameItem[] {
  return rawItems
    .map((raw) => normalizeWikiItem(raw))
    .filter((item): item is GameItem => item !== null);
}

export function mergeCatalogMaps(
  base: Map<number, GameItem>,
  overlay: Map<number, GameItem>,
): Map<number, GameItem> {
  const merged = new Map(base);
  overlay.forEach((item, id) => {
    merged.set(id, { ...(merged.get(id) ?? {}), ...item, id });
  });
  return merged;
}
