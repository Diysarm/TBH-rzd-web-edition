/**
 * Quick script to decrypt and inspect the local SaveFile_Live.es3
 * without running the full web app.
 * 
 * Usage: node scripts/check-save.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { webcrypto } from "crypto";

const crypto = webcrypto;

// --- ES3 Decrypt (same logic as core/es3.ts) ---
const DEFAULT_PASSWORD = "emuMqG3bLYJ938ZDCfieWJ";
const IV_SIZE = 16;
const PBKDF2_ITERATIONS = 100;

async function deriveKey(password, iv) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const keyBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: iv, iterations: PBKDF2_ITERATIONS, hash: "SHA-1" },
    keyMaterial,
    128
  );
  return crypto.subtle.importKey("raw", keyBits, { name: "AES-CBC", length: 128 }, false, [
    "decrypt",
  ]);
}

async function decryptToText(data, password = DEFAULT_PASSWORD) {
  if (!data || data.byteLength <= IV_SIZE) throw new Error("File too small");
  const iv = data.slice(0, IV_SIZE);
  const ciphertext = data.slice(IV_SIZE);
  if (ciphertext.byteLength % 16 !== 0)
    throw new Error("Ciphertext not aligned to AES block size");
  const key = await deriveKey(password, iv);
  const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  return new TextDecoder("utf-8", { fatal: true }).decode(plain);
}

// --- Catalog helpers (same logic as core/gamedata.ts) ---
const SAVE_CATALOG_ITEM_KEY_MIN = 110_001;
const SAVE_CATALOG_ITEM_KEY_MAX = 939_999;

function catalogItemKeyFromSave(itemKey) {
  if (itemKey < 1_000_000) return itemKey;
  const base = Math.trunc(itemKey / 1000);
  if (base >= SAVE_CATALOG_ITEM_KEY_MIN && base <= SAVE_CATALOG_ITEM_KEY_MAX) return base;
  return itemKey;
}

// --- Parse items from save (same logic as core/inventory/parse.ts) ---
const ITEM_TRIPLE_RE =
  /"ItemKey"\s*:\s*(\d+)\s*,\s*"UniqueId"\s*:\s*(\d+)\s*,\s*"IsChaotic"\s*:\s*(true|false)/g;

function parseItemsFromPlayerString(playerStr) {
  const items = [];
  for (const m of playerStr.matchAll(ITEM_TRIPLE_RE)) {
    const rawItemKey = Math.trunc(Number(m[1]));
    const itemKey = catalogItemKeyFromSave(rawItemKey);
    if (itemKey <= 0) continue;
    items.push({
      rawItemKey,
      itemKey,
      uniqueId: m[2],
      isChaotic: m[3] === "true",
    });
  }
  return items;
}

// --- Main ---
async function main() {
  const savePath = join(
    homedir(),
    "AppData",
    "LocalLow",
    "TesseractStudio",
    "TaskbarHero",
    "SaveFile_Live.es3"
  );
  console.log(`Reading: ${savePath}`);
  const buffer = readFileSync(savePath);
  console.log(`File size: ${buffer.length} bytes`);

  console.log("Decrypting...");
  let text;
  try {
    text = await decryptToText(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  } catch (e) {
    console.error("Decrypt failed:", e.message);
    process.exit(1);
  }
  console.log("Decrypt OK, text length:", text.length);

  // Parse root JSON
  const root = JSON.parse(text);
  const playerEntry = root?.PlayerSaveData;
  const playerStr = typeof playerEntry?.value === "string" ? playerEntry.value : null;

  if (!playerStr) {
    console.error("No PlayerSaveData.value string found in save file");
    process.exit(1);
  }

  // Load game catalog
  const gamedataPath = join(
    process.cwd(),
    "public",
    "data",
    "gamedata.json"
  );
  const catalog = JSON.parse(readFileSync(gamedataPath, "utf-8"));
  const catalogMap = new Map();
  for (const item of catalog.items) {
    catalogMap.set(item.id, item);
  }
  console.log(`Catalog loaded: ${catalogMap.size} items (game version ${catalog.gameVersion})`);

  // Parse items from save
  const items = parseItemsFromPlayerString(playerStr);
  console.log(`\nTotal items in save: ${items.length}`);

  // Group by itemKey
  const byKey = new Map();
  for (const item of items) {
    if (!byKey.has(item.itemKey)) byKey.set(item.itemKey, []);
    byKey.get(item.itemKey).push(item);
  }

  // Check specific items the user mentioned
  const searchNames = ["Dimensional Shield", "Dimensional Scepter", "Tempest Staff", "Dimensional Orb", "Platinum Ring"];
  
  console.log("\n=== Checking items that should have been sold ===");
  for (const name of searchNames) {
    const catalogItem = [...catalogMap.values()].find(
      (it) => it.name.toLowerCase() === name.toLowerCase()
    );
    if (!catalogItem) {
      console.log(`  ❌ '${name}' — NOT in game catalog`);
      continue;
    }
    const inSave = byKey.get(catalogItem.id);
    if (inSave && inSave.length > 0) {
      console.log(`  ⚠️  '${name}' (id=${catalogItem.id}) — FOUND in save file: ${inSave.length} instance(s)`);
      for (const inst of inSave) {
        console.log(`      rawKey=${inst.rawItemKey}, uniqueId=${inst.uniqueId}, isChaotic=${inst.isChaotic}`);
      }
    } else {
      console.log(`  ✅ '${name}' (id=${catalogItem.id}) — NOT in save file (correctly removed)`);
    }
  }

  // Check for equipped / slot arrays
  const equippedMatch = playerStr.match(/"equippedItemIds"\s*:\s*\[([^\]]*)\]/g);
  const inventorySlots = playerStr.match(/"inventorySaveDatas"\s*:\s*\[/);
  const stashSlots = playerStr.match(/"stashSaveDatas"\s*:\s*\[/);
  const tradingSlots = playerStr.match(/"tradingStashSaveDatas"\s*:\s*\[/);

  console.log("\n=== Save file structure ===");
  console.log(`  equippedItemIds matches: ${equippedMatch?.length ?? 0}`);
  console.log(`  inventorySaveDatas present: ${!!inventorySlots}`);
  console.log(`  stashSaveDatas present: ${!!stashSlots}`);
  console.log(`  tradingStashSaveDatas present: ${!!tradingSlots}`);

  // Show unknown items
  const unknowns = [...byKey.entries()]
    .filter(([key]) => !catalogMap.has(key))
    .map(([key, instances]) => ({ key, count: instances.length }));
  
  console.log(`\n=== Items NOT in catalog (unknown): ${unknowns.length} unique item keys ===`);
  for (const u of unknowns.slice(0, 20)) {
    console.log(`  Unknown #${u.key} — ${u.count} instance(s)`);
  }
  if (unknowns.length > 20) console.log(`  ... and ${unknowns.length - 20} more`);

  // Summary
  const knownCount = [...byKey.entries()].filter(([key]) => catalogMap.has(key)).length;
  console.log(`\n=== Summary ===`);
  console.log(`  Unique item keys in save: ${byKey.size}`);
  console.log(`  Known in catalog: ${knownCount}`);
  console.log(`  Unknown: ${unknowns.length}`);
  console.log(`  Total instances: ${items.length}`);
}

main().catch(console.error);
