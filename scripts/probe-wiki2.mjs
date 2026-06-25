const res = await fetch("https://taskbarhero.wiki/gear", {
  headers: { "User-Agent": "Mozilla/5.0" },
});
const html = await res.text();

const needles = [
  "icon",
  "imageUrl",
  "image_url",
  "thumbnail",
  "gear/",
  "items/",
  "id\":",
  "steamstatic",
  "fastly",
  "data-item",
  "application/ld+json",
];

for (const n of needles) {
  let idx = 0;
  let count = 0;
  while ((idx = html.indexOf(n, idx)) !== -1 && count < 2) {
    console.log(n, ":", html.slice(Math.max(0, idx - 40), idx + 100).replace(/\s+/g, " "));
    idx += n.length;
    count++;
  }
}

// find script tags with json
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
console.log("script count", scripts.length);
for (const [i, m] of scripts.entries()) {
  const body = m[1].trim();
  if (body.startsWith("{") && body.includes("gear")) {
    console.log("script", i, "len", body.length, body.slice(0, 200));
  }
  if (body.startsWith("[") && body.length > 10000) {
    console.log("array script", i, "len", body.length, body.slice(0, 200));
  }
}

// img src patterns
const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].slice(0, 10);
console.log("sample imgs", imgs.map((m) => m[1]));
