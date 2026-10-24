import type { CatalogueOre } from "@/lib/engine/forge";

export type OreSort = "high" | "low" | "armour" | "weapon" | null;
export type OreFilterState = { sort: OreSort; range: [number, number] | null };
export const EMPTY_FILTER: OreFilterState = { sort: null, range: null };

/** Which items an ore's trait helps: weapons, armour, both, or neither. */
export function oreCategory(o: CatalogueOre) {
  const weapon = o.traits.some((t) => t.kinds.includes("weapon"));
  const armour = o.traits.some((t) => t.kinds.includes("armour"));
  return { weapon, armour, none: !weapon && !armour };
}

export function multiplierBounds(ores: CatalogueOre[]): [number, number] {
  if (!ores.length) return [0, 1];
  const ms = ores.map((o) => o.multiplier);
  return [Math.floor(Math.min(...ms) * 10) / 10, Math.ceil(Math.max(...ms) * 10) / 10];
}

/** Applies the filter to ores already narrowed to the chosen world (or all ores). Default order: lowest multiplier first. */
export function applyOreFilter(ores: CatalogueOre[], f: OreFilterState): CatalogueOre[] {
  let list = ores;
  if (f.range) {
    const [lo, hi] = f.range;
    list = list.filter((o) => o.multiplier >= lo - 1e-9 && o.multiplier <= hi + 1e-9);
  }
  if (f.sort === "armour") list = list.filter((o) => oreCategory(o).armour);
  if (f.sort === "weapon") list = list.filter((o) => oreCategory(o).weapon);
  const desc = f.sort === "high" || f.sort === "armour" || f.sort === "weapon";
  return [...list].sort((a, b) => (desc ? b.multiplier - a.multiplier : a.multiplier - b.multiplier) || a.name.localeCompare(b.name));
}
