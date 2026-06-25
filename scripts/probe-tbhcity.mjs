const res = await fetch("https://tbh.city/items", { headers: { "User-Agent": "Mozilla/5.0" } });
const html = await res.text();
const start = html.indexOf('[{"id":');
console.log("start", start);
const snippet = html.slice(start, start + 500);
console.log(snippet);

// count items
let depth = 0;
let end = -1;
for (let i = start; i < html.length; i++) {
  if (html[i] === "[") depth++;
  else if (html[i] === "]") {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
const arr = JSON.parse(html.slice(start, end + 1));
console.log("count", arr.length);
console.log("sample", arr[0]);
console.log("sample icon", arr[0]?.icon);
