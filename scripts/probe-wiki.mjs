const urls = [
  "https://taskbarhero.wiki/gear",
  "https://taskbarhero.wiki/materials",
  "https://tbh.city/items",
];

for (const u of urls) {
  const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await res.text();
  console.log("\n===", u, res.status, html.length);

  for (const p of ["__NEXT_DATA__", '[{"id":', "icon_url", "/api/", "gearItems", "window.__"]) {
    const i = html.indexOf(p);
    if (i >= 0) console.log(" ", p, "@", i, html.slice(i, i + 120).replace(/\s+/g, " "));
  }

  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    const data = JSON.parse(m[1]);
    console.log(" NEXT props keys:", Object.keys(data.props?.pageProps ?? {}));
  }
}

// try common wiki API paths
for (const p of ["/api/gear", "/api/materials", "/api/items", "/api/search/gear"]) {
  const res = await fetch("https://taskbarhero.wiki" + p);
  console.log(p, res.status, (await res.text()).slice(0, 100));
}
