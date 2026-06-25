const WIKI_ORIGIN = "https://taskbarhero.wiki";

/** @param {string} html */
export function extractWikiCatalogFromHtml(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  for (const match of scripts) {
    const body = match[1].trim();
    if (!body.startsWith("{") || body.length < 100_000) continue;
    try {
      const outer = JSON.parse(body);
      if (typeof outer.body !== "string" || !outer.body.startsWith("[")) continue;
      const items = JSON.parse(outer.body);
      if (items[0]?.id) return items;
    } catch {
      // try next script block
    }
  }
  throw new Error("Wiki item catalog not found in page HTML");
}

/** @param {Record<string, unknown>} raw */
export function pickWikiName(raw) {
  const name = raw.name;
  if (!name) return "";
  if (typeof name === "string") return name;
  if (typeof name === "object") {
    const map = /** @type {Record<string, string>} */ (name);
    return map["en-US"] ?? map.en ?? Object.values(map)[0] ?? "";
  }
  return "";
}

/** @param {Record<string, unknown>} raw */
export function normalizeWikiItem(raw) {
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  const icon = typeof raw.icon === "string" ? raw.icon : null;
  const levelRaw = raw.level;
  return {
    id,
    name: pickWikiName(raw) || `#${id}`,
    grade: String(raw.grade ?? "UNKNOWN"),
    type: String(raw.type ?? "UNKNOWN"),
    level:
      levelRaw === null || levelRaw === undefined
        ? null
        : Number.isFinite(Number(levelRaw))
          ? Number(levelRaw)
          : null,
    marketTradable: Boolean(raw.marketable ?? raw.is_market_tradable ?? raw.marketTradable),
    iconUrl: icon ? `${WIKI_ORIGIN}${icon}` : null,
  };
}

/** @param {Record<string, unknown>[]} rawItems */
export function normalizeWikiCatalog(rawItems) {
  const items = [];
  for (const raw of rawItems) {
    const item = normalizeWikiItem(raw);
    if (item) items.push(item);
  }
  return items;
}

export async function fetchWikiCatalogItems() {
  const res = await fetch(`${WIKI_ORIGIN}/gear`, {
    headers: { "User-Agent": "Mozilla/5.0 (TBH Web Inventory)" },
  });
  if (!res.ok) throw new Error(`Wiki fetch failed (${res.status})`);
  const html = await res.text();
  return normalizeWikiCatalog(extractWikiCatalogFromHtml(html));
}
