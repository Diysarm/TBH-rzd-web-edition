export type ItemLocation = "inventory" | "stash" | "trading" | "equipped" | "unknown";

export interface InventoryItemInstance {
  itemKey: number;
  isChaotic: boolean;
  inUse: boolean;
  location: ItemLocation;
}

export interface ChestHolding {
  type: number;
  quantity: number;
}

export interface InventorySnapshot {
  items: InventoryItemInstance[];
  chests: ChestHolding[];
  saveMtime: number;
  materialStacks?: Map<number, number>;
}

export interface ResolvedInventoryRow {
  itemKey: number;
  name: string;
  grade: string;
  type: string;
  level: number | null;
  marketTradable: boolean;
  marketHashName: string | null;
  iconUrl: string | null;
  count: number;
  inUseCount: number;
  chaoticCount: number;
  known: boolean;
  priceRaw: string | null;
  unitPrice: number | null;
  priceSource: "median" | "lowest" | null;
  priceChecked: boolean;
  value: number | null;
  inventoryCount: number;
  stashCount: number;
  tradingCount: number;
}

export interface InventoryPriceInfo {
  median: number | null;
  lowest: number | null;
  rawMedian: string | null;
  rawLowest: string | null;
}

export interface InventoryComposition {
  total: number;
  byGrade: Record<string, number>;
  byType: Record<string, number>;
  tradableCount: number;
  unknownCount: number;
  chaoticCount: number;
  inUseCount: number;
  priceableCount: number;
  valuedTotal: number;
  currency: string | null;
}

export interface ResolvedInventory {
  rows: ResolvedInventoryRow[];
  composition: InventoryComposition;
  chests: ChestHolding[];
  saveMtime: number;
  gameDataLoaded: boolean;
  currency: string | null;
}

export interface PriceEntry {
  lowest: number | null;
  median: number | null;
  volume: number;
  rawLowest: string | null;
  rawMedian: string | null;
  fetchedUtc: string;
  source?: "bulk" | "overview";
}

export interface PriceProgress {
  total: number;
  done: number;
  priced: number;
  failed: number;
  current: string;
}

export interface PriceStatus {
  currency: string;
  count: number;
  ownedTargets: number;
  freshCount: number;
  staleCount: number;
  fetchedUtc: string | null;
  running: boolean;
}

export interface GameItem {
  id: number;
  name: string;
  grade: string;
  type: string;
  level: number | null;
  marketTradable: boolean;
  iconUrl?: string | null;
}

export interface GameData {
  source: string;
  fetchedUtc: string;
  count: number;
  items: GameItem[];
}
