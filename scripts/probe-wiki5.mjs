const res = await fetch("https://taskbarhero.wiki/gear");
const html = await res.text();
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
let items = null;
for (const m of scripts) {
  const body = m[1].trim();
  if (!body.startsWith("{") || body.length < 100000) continue;
  const outer = JSON.parse(body);
  if (typeof outer.body === "string" && outer.body.startsWith("[")) {
    const parsed = JSON.parse(outer.body);
    if (parsed[0]?.id) {
      items = parsed;
      break;
    }
  }
}

const mats = items.filter((x) => x.type === "MATERIAL");
console.log("materials in wiki catalog", mats.length);
console.log("sample mat", mats[0]);

import { readFileSync } from "node:fs";
const bundled = JSON.parse(readFileSync("public/data/gamedata.json", "utf8"));
const bundledMap = new Map(bundled.items.map((x) => [x.id, x]));
const wikiMap = new Map(items.map((x) => [x.id, x]));

const inWikiNotBundled = items.filter((x) => !bundledMap.has(x.id));
const inBundledNotWiki = bundled.items.filter((x) => !wikiMap.has(x.id));
console.log("wiki only", inWikiNotBundled.length, inWikiNotBundled.slice(0, 10).map((x) => x.id));
console.log("bundled only", inBundledNotWiki.length, inBundledNotWiki.slice(0, 10).map((x) => ({ id: x.id, name: x.name, type: x.type })));

// check if unknown ids might be suffix keys
for (const x of inBundledNotWiki.slice(0, 5)) {
  const base = Math.trunc(x.id / 1000);
  console.log("base lookup", x.id, "->", wikiMap.has(base), wikiMap.has(x.id));
}
