export const STEAM_APP_ID = 3678970;

export const STEAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  Referer: "https://steamcommunity.com/market/",
  "Accept-Language": "en-US,en;q=0.9",
};

/** CDN shared cache — all Vercel users reuse the same cached Steam response per URL. */
export const STEAM_CACHE = {
  priceoverview: "public, s-maxage=3600, stale-while-revalidate=86400",
  search: "public, s-maxage=86400, stale-while-revalidate=604800",
};

/** @type {Promise<import("@upstash/redis").Redis | null> | undefined} */
let redisPromise;

async function getRedis() {
  if (redisPromise !== undefined) return redisPromise;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisPromise = Promise.resolve(null);
    return null;
  }
  redisPromise = import("@upstash/redis")
    .then(({ Redis }) => new Redis({ url, token }))
    .catch(() => null);
  return redisPromise;
}

/** @param {string | null | undefined} key */
export async function kvGet(key) {
  if (!key) return null;
  const redis = await getRedis();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

/** @param {string} key @param {string} value @param {number} ttlSeconds */
export async function kvSet(key, value, ttlSeconds) {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // optional — CDN cache still applies
  }
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
export function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {Response} steamRes
 * @param {string} body
 * @param {string} fallbackError
 * @param {string} cacheControl
 */
export function forwardSteam(res, steamRes, body, fallbackError, cacheControl) {
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
  res.setHeader("Cache-Control", cacheControl);
  res.end(body);
}

/**
 * @param {URL} url
 * @param {import("node:http").ServerResponse} res
 */
export async function handleSteamSearch(url, res) {
  const start = url.searchParams.get("start") ?? "0";
  const count = url.searchParams.get("count") ?? "10";
  const cacheKey = `steam:search:${STEAM_APP_ID}:${start}:${count}`;

  const cached = await kvGet(cacheKey);
  if (cached && typeof cached === "string") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", STEAM_CACHE.search);
    res.setHeader("X-Cache", "KV-HIT");
    res.end(cached);
    return;
  }

  const steamUrl =
    "https://steamcommunity.com/market/search/render/" +
    `?query=&start=${encodeURIComponent(start)}&count=${encodeURIComponent(count)}` +
    "&search_descriptions=0&sort_column=popular&sort_dir=desc" +
    `&appid=${STEAM_APP_ID}&norender=1&currency=10`;

  try {
    const steamRes = await fetch(steamUrl, { headers: STEAM_HEADERS });
    const body = await steamRes.text();
    if (steamRes.ok && body.trim() && body.trim() !== "null") {
      await kvSet(cacheKey, body, 86_400);
    }
    forwardSteam(res, steamRes, body, "empty_search_response", STEAM_CACHE.search);
  } catch {
    jsonResponse(res, 502, { success: false, error: "steam_unreachable" });
  }
}

/**
 * @param {URL} url
 * @param {import("node:http").ServerResponse} res
 */
export async function handleSteamPriceOverview(url, res) {
  const marketHashName = url.searchParams.get("market_hash_name");
  const currency = url.searchParams.get("currency") ?? "1";

  if (!marketHashName) {
    jsonResponse(res, 400, { success: false, error: "market_hash_name required" });
    return;
  }

  const cacheKey = `steam:price:${STEAM_APP_ID}:${currency}:${marketHashName}`;

  const cached = await kvGet(cacheKey);
  if (cached && typeof cached === "string") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", STEAM_CACHE.priceoverview);
    res.setHeader("X-Cache", "KV-HIT");
    res.end(cached);
    return;
  }

  const steamUrl =
    `https://steamcommunity.com/market/priceoverview/?appid=${STEAM_APP_ID}` +
    `&currency=${encodeURIComponent(currency)}` +
    `&market_hash_name=${encodeURIComponent(marketHashName)}`;

  try {
    const steamRes = await fetch(steamUrl, { headers: STEAM_HEADERS });
    const body = await steamRes.text();
    if (steamRes.ok && body.trim() && body.trim() !== "null" && steamRes.status !== 429) {
      await kvSet(cacheKey, body, 3600);
    }
    forwardSteam(res, steamRes, body, "empty_price_response", STEAM_CACHE.priceoverview);
  } catch {
    jsonResponse(res, 502, { success: false, error: "steam_unreachable" });
  }
}

/**
 * Vite dev/preview middleware — same routes as Vercel `/api/*`.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {() => void} next
 */
export function createApiMiddleware(fetchWikiCatalogItems) {
  return function apiMiddleware(req, res, next) {
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
        .catch((err) => {
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
      void handleSteamSearch(url, res);
      return;
    }

    if (req.url.startsWith("/api/steam/priceoverview")) {
      void handleSteamPriceOverview(url, res);
      return;
    }

    next();
  };
}
