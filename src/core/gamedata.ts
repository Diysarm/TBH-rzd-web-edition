import type { GameItem } from "../types";

const SAVE_CATALOG_ITEM_KEY_MIN = 110_001;
const SAVE_CATALOG_ITEM_KEY_MAX = 939_999;

export function catalogItemKeyFromSave(itemKey: number): number {
  if (itemKey < 1_000_000) return itemKey;
  const base = Math.trunc(itemKey / 1000);
  if (base >= SAVE_CATALOG_ITEM_KEY_MIN && base <= SAVE_CATALOG_ITEM_KEY_MAX) return base;
  return itemKey;
}

export function indexById(items: GameItem[]): Map<number, GameItem> {
  const m = new Map<number, GameItem>();
  for (const it of items) m.set(it.id, it);
  return m;
}

export function normalizeGameItem(raw: Record<string, unknown>): GameItem | null {
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  const levelRaw = raw.level;
  return {
    id,
    name: String(raw.name ?? `#${id}`),
    grade: String(raw.grade ?? "UNKNOWN"),
    type: String(raw.type ?? "UNKNOWN"),
    level:
      levelRaw === null || levelRaw === undefined
        ? null
        : Number.isFinite(Number(levelRaw))
          ? Number(levelRaw)
          : null,
    marketTradable: Boolean(raw.marketTradable ?? raw.is_market_tradable ?? raw.marketable),
    iconUrl:
      typeof raw.iconUrl === "string"
        ? raw.iconUrl
        : typeof raw.icon === "string"
          ? raw.icon.startsWith("http")
            ? raw.icon
            : `https://taskbarhero.wiki${raw.icon}`
          : null,
  };
}

export function isStageBoxItem(item: GameItem | undefined): boolean {
  return item?.type === "STAGEBOX";
}
