const res = await fetch("https://taskbarhero.wiki/gear", {
  headers: { "User-Agent": "Mozilla/5.0" },
});
const html = await res.text();
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];

for (const [i, m] of scripts.entries()) {
  const body = m[1].trim();
  if (!body.startsWith("{") || body.length < 100000) continue;
  try {
    const outer = JSON.parse(body);
    if (typeof outer.body !== "string" || !outer.body.startsWith("[")) continue;
    const items = JSON.parse(outer.body);
    if (!items[0]?.id) continue;
    console.log("script", i, "count", items.length);
    console.log("sample", JSON.stringify(items[0], null, 2));
    console.log("types", [...new Set(items.map((x) => x.type))]);
    const gearSample = items.find((x) => x.type === "GEAR");
    console.log("gear sample", JSON.stringify(gearSample, null, 2));
  } catch (e) {
    console.log("script", i, "parse err", e.message);
  }
}

// materials page
const res2 = await fetch("https://taskbarhero.wiki/materials");
const html2 = await res2.text();
const scripts2 = [...html2.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
for (const [i, m] of scripts2.entries()) {
  const body = m[1].trim();
  if (!body.startsWith("{") || body.length < 10000) continue;
  try {
    const outer = JSON.parse(body);
    if (typeof outer.body !== "string" || !outer.body.startsWith("[")) continue;
    const items = JSON.parse(outer.body);
    if (!items[0]?.id && !items[0]?.ItemKey) continue;
    console.log("materials script", i, "count", items.length);
    console.log("sample", JSON.stringify(items[0], null, 2));
  } catch {}
}

// tbh.city for comparison
const res3 = await fetch("https://tbh.city/items");
const html3 = await res3.text();
const start = html3.indexOf('[{"id":');
let depth = 0;
let end = -1;
for (let i = start; i < html3.length; i++) {
  if (html3[i] === "[") depth++;
  else if (html3[i] === "]") {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
const city = JSON.parse(html3.slice(start, end + 1));
console.log("tbh.city count", city.length);
console.log("city sample", city[0]);
