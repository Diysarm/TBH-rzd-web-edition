import { fetchWikiCatalogItems } from "../../server/wikiCatalog.mjs";
import { jsonResponse } from "../../server/steamProxy.mjs";

const WIKI_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export default async function handler(_req, res) {
  try {
    const items = await fetchWikiCatalogItems();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", WIKI_CACHE);
    res.end(
      JSON.stringify({
        source: "taskbarhero.wiki",
        fetchedUtc: new Date().toISOString(),
        count: items.length,
        items,
      }),
    );
  } catch (err) {
    jsonResponse(res, 502, {
      error: err instanceof Error ? err.message : "wiki_catalog_failed",
    });
  }
}
