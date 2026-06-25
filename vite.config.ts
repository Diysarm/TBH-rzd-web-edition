import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fetchWikiCatalogItems } from "./server/wikiCatalog.mjs";

const STEAM_APP_ID = 3678970;
const STEAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  Referer: "https://steamcommunity.com/market/",
  "Accept-Language": "en-US,en;q=0.9",
};

function apiProxyPlugin(): Plugin {
  return {
    name: "api-proxy",
    configureServer(server) {
      server.middlewares.use(apiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiMiddleware);
    },
  };
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function forwardSteam(
  res: ServerResponse,
  steamRes: Response,
  body: string,
  fallbackError: string,
): void {
  const trimmed = body.trim();
  if (!trimmed || trimmed === "null") {
    jsonResponse(res, steamRes.status, {
      success: false,
      error: steamRes.status === 429 ? "rate_limited" : fallbackError,
      steamStatus: steamRes.status,
    });
    return;
  }

  res.statusCode = steamRes.status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(body);
}

function apiMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  if (!req.url?.startsWith("/api/")) {
    next();
    return;
  }

  if (req.url.startsWith("/api/wiki/catalog")) {
    void fetchWikiCatalogItems()
      .then((items) => {
        jsonResponse(res, 200, {
          source: "taskbarhero.wiki",
          fetchedUtc: new Date().toISOString(),
          count: items.length,
          items,
        });
      })
      .catch((err: Error) => {
        jsonResponse(res, 502, { error: err.message ?? "wiki_catalog_failed" });
      });
    return;
  }

  if (!req.url.startsWith("/api/steam/")) {
    next();
    return;
  }

  const url = new URL(req.url, "http://localhost");

  if (req.url.startsWith("/api/steam/search")) {
    const start = url.searchParams.get("start") ?? "0";
    const count = url.searchParams.get("count") ?? "10";
    const steamUrl =
      "https://steamcommunity.com/market/search/render/" +
      `?query=&start=${encodeURIComponent(start)}&count=${encodeURIComponent(count)}` +
      "&search_descriptions=0&sort_column=popular&sort_dir=desc" +
      `&appid=${STEAM_APP_ID}&norender=1&currency=10`;

    void fetch(steamUrl, { headers: STEAM_HEADERS })
      .then(async (steamRes) => forwardSteam(res, steamRes, await steamRes.text(), "empty_search_response"))
      .catch(() => jsonResponse(res, 502, { success: false, error: "steam_unreachable" }));
    return;
  }

  if (!req.url.startsWith("/api/steam/priceoverview")) {
    next();
    return;
  }

  const marketHashName = url.searchParams.get("market_hash_name");
  const currency = url.searchParams.get("currency") ?? "1";

  if (!marketHashName) {
    jsonResponse(res, 400, { success: false, error: "market_hash_name required" });
    return;
  }

  const steamUrl =
    `https://steamcommunity.com/market/priceoverview/?appid=${STEAM_APP_ID}` +
    `&currency=${encodeURIComponent(currency)}` +
    `&market_hash_name=${encodeURIComponent(marketHashName)}`;

  void fetch(steamUrl, { headers: STEAM_HEADERS })
    .then(async (steamRes) => forwardSteam(res, steamRes, await steamRes.text(), "empty_price_response"))
    .catch(() => jsonResponse(res, 502, { success: false, error: "steam_unreachable" }));
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiProxyPlugin()],
});
