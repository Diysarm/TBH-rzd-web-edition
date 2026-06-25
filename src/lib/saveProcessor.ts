import { decryptToText, Es3Error } from "../core/es3";
import { parseInventory, resolveInventory, ownedPrimaryMarketNames } from "../core/inventory";
import {
  getCatalogItem,
  isMaterialKey,
  isStageBoxKey,
  loadGameCatalog,
} from "./gameDataLoader";
import { priceLookupFromService, priceService } from "./priceService";
import { ensureBulkCatalog, type BulkCatalogProgress } from "./bulkMarketCatalog";
import type { InventorySnapshot, PriceProgress, ResolvedInventory } from "../types";

export async function processSaveFile(
  file: File,
  password?: string,
): Promise<{
  snapshot: InventorySnapshot;
  inventory: ResolvedInventory;
  marketNames: string[];
}> {
  const buffer = await file.arrayBuffer();
  let decrypted: string;
  try {
    decrypted = await decryptToText(buffer, password);
  } catch (err) {
    if (err instanceof Es3Error) throw err;
    throw new Es3Error("Could not decrypt save file.");
  }

  // Bundled gamedata only — wiki overlay loads in background after UI is shown.
  const catalog = await loadGameCatalog({ skipWiki: true });
  const snapshot = parseInventory(decrypted, file.lastModified, (key) =>
    isMaterialKey(catalog, key),
  );

  const lookup = (key: number) => getCatalogItem(catalog, key);
  const exclude = (key: number) => isStageBoxKey(catalog, key);
  const marketNames = ownedPrimaryMarketNames(snapshot, lookup, exclude);

  const inventory = resolveInventory(snapshot, lookup, true, priceLookupFromService, {
    excludeItemKey: exclude,
  });
  inventory.currency = priceService.getCurrency();
  inventory.composition.currency = priceService.getCurrency();

  return { snapshot, inventory, marketNames };
}

function bulkProgressToPriceProgress(p: BulkCatalogProgress): PriceProgress {
  return {
    total: p.total,
    done: p.done,
    priced: p.loaded,
    failed: 0,
    current:
      p.done < p.total
        ? `Loading market catalog ${p.done}/${p.total}…`
        : "Applying prices…",
  };
}

/** Background step after upload — bulk catalog + price seed (does not block UI). */
export async function seedBulkPricesForInventory(
  marketNames: string[],
  onProgress?: (p: PriceProgress) => void,
): Promise<number> {
  await ensureBulkCatalog(
    onProgress ? (p) => onProgress(bulkProgressToPriceProgress(p)) : undefined,
  );
  return priceService.seedFromBulkCatalog(marketNames);
}

export function resolveWithPrices(
  snapshot: InventorySnapshot,
  catalog: Awaited<ReturnType<typeof loadGameCatalog>>,
): ResolvedInventory {
  const lookup = (key: number) => getCatalogItem(catalog, key);
  const inventory = resolveInventory(snapshot, lookup, true, priceLookupFromService, {
    excludeItemKey: (key) => isStageBoxKey(catalog, key),
  });
  inventory.currency = priceService.getCurrency();
  inventory.composition.currency = priceService.getCurrency();
  return inventory;
}

export async function refreshPricesForSave(
  marketNames: string[],
  options: {
    force?: boolean;
    bulkOnly?: boolean;
    forceReloadBulk?: boolean;
    onProgress?: (p: PriceProgress) => void;
  } = {},
): Promise<{ priced: number; skipped: number; failed: number; rateLimited: boolean }> {
  if (!options.force) priceService.pruneCache(marketNames);
  return priceService.refresh(marketNames, options);
}
