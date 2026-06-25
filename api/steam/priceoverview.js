import { handleSteamPriceOverview, jsonResponse } from "../../server/steamProxy.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    jsonResponse(res, 405, { error: "method_not_allowed" });
    return;
  }

  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  await handleSteamPriceOverview(url, res);
}
