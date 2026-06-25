async function extractWikiCatalog(path) {
  const res = await fetch(`https://taskbarhero.wiki${path}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const html = await res.text();
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  for (const m of scripts) {
    const body = m[1].trim();
    if (!body.startsWith("{") || !body.includes('"body":"[')) continue;
    const outer = JSON.parse(body);
    const items = JSON.parse(outer.body);
    console.log(path, "items", items.length);
    const gear = items.filter((x) => x.type === "GEAR" || path.includes("gear"));
    const mat = items.filter((x) => x.type === "MATERIAL" || path.includes("material"));
    console.log(" types", [...new Set(items.map((x) => x.type))].slice(0, 15));
    console.log(" sample", items[0]);
    const withIcon = items.find((x) => x.icon || x.image || x.gear?.icon);
    console.log(" withIcon", withIcon);
    return items;
  }
  throw new Error("catalog not found in " + path);
}

const gear = await extractWikiCatalog("/gear");
const materials = await extractWikiCatalog("/materials");

// ids in gear not in bundled gamedata?
import { readFileSync } from "node:fs";
const bundled = JSON.parse(readFileSync("public/data/gamedata.json", "utf8"));
const bundledIds = new Set(bundled.items.map((x) => x.id));
const wikiAll = [...gear, ...materials];
const missingInBundled = wikiAll.filter((x) => !bundledIds.has(x.id));
const missingInWiki = [...bundledIds].filter((id) => !wikiAll.some((x) => x.id === id)).slice(0, 10);
console.log("wiki total unique", new Set(wikiAll.map((x) => x.id)).size);
console.log("missing in bundled from wiki", missingInBundled.length, missingInBundled.slice(0, 5));
console.log("sample bundled missing from wiki pages", missingInWiki);

// icon URL pattern from img tags
const res = await fetch("https://taskbarhero.wiki/gear");
const html = await res.text();
const imgMatch = html.match(/src="(\/game\/gear[^"]+\.png)"/);
console.log("img path", imgMatch?.[1]);
