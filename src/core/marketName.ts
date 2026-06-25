import type { GameItem } from "../types";
import { gradeTitle, isPriceableGrade } from "./grades";

export function isPriceableItem(type: string, grade: string, marketTradable: boolean): boolean {
  if (!marketTradable) return false;
  if (type === "MATERIAL") return true;
  if (type === "GEAR") return isPriceableGrade(grade);
  return false;
}

const GEAR_VARIANT_LETTERS = ["A", "B", "C", "D", "E"] as const;

export function gearMarketHash(
  itemName: string,
  catalogGrade: string,
  variantLetter = "A",
): string {
  return `${itemName} (${gradeTitle(catalogGrade)}) ${variantLetter}`;
}

export function gearMarketHashCandidates(itemName: string, catalogGrade: string): string[] {
  return GEAR_VARIANT_LETTERS.map((v) => gearMarketHash(itemName, catalogGrade, v));
}

export function marketHashCandidates(item: GameItem): string[] {
  if (!isPriceableItem(item.type, item.grade, item.marketTradable)) return [];
  if (item.type === "MATERIAL") return [item.name];
  if (item.type === "GEAR") return gearMarketHashCandidates(item.name, item.grade);
  return [];
}
