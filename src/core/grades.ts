export const GRADE_ORDER = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "LEGENDARY",
  "IMMORTAL",
  "ARCANA",
  "BEYOND",
  "CELESTIAL",
  "DIVINE",
  "COSMIC",
] as const;

export const GRADE_RANK: Record<string, number> = Object.fromEntries(
  GRADE_ORDER.map((g, i) => [g, i]),
);

export const MIN_PRICEABLE_GEAR_GRADE = "LEGENDARY";
export const MIN_PRICEABLE_GEAR_RANK = GRADE_RANK[MIN_PRICEABLE_GEAR_GRADE];

export function gradeRank(grade: string): number {
  const key = grade.toUpperCase().replace(/\s+/g, "_");
  const r = GRADE_RANK[key];
  return r === undefined ? -1 : r;
}

export function isPriceableGrade(grade: string): boolean {
  return gradeRank(grade) >= MIN_PRICEABLE_GEAR_RANK;
}

export function gradeTitle(grade: string): string {
  if (!grade) return grade;
  return grade[0] + grade.slice(1).toLowerCase();
}
