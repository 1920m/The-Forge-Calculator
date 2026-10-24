/** Pure calculation functions. No framework, network, or database dependencies. */
export type Kind = "weapon" | "armour";
export type World = 1 | 2 | 3 | 4;
export type Ore = { slug: string; multiplier: number; rarity: string; multiplierRule?: "average-other-ores" };
export type Ingredient<T extends Ore = Ore> = { ore: T; count: number };
export type CategoryRow = { kind: Kind; oreCount: number; slot: number; probability: number };

function nonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a finite non-negative number.`);
}

function validMix(mix: readonly Ingredient[]) {
  const seen = new Set<string>();
  for (const { ore, count } of mix) {
    nonNegative(ore.multiplier, "Multiplier");
    nonNegative(count, "Count");
    if (!Number.isSafeInteger(count)) throw new RangeError("Ore counts must be safe whole numbers.");
    if (seen.has(ore.slug)) throw new RangeError("Combine repeated ore entries before calculating.");
    seen.add(ore.slug);
  }
}

/** Retain exact precision; round the display separately. Empty mixes return null. */
export function averageMultiplier(mix: readonly Ingredient[]): number | null {
  validMix(mix);
  // Fichilliumorite inherits the non-filler ores' weighted average. It therefore
  // leaves that average unchanged. An all-filler mix has no known multiplier.
  const ordinary = mix.filter((item) => item.ore.multiplierRule !== "average-other-ores");
  const total = ordinary.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return null;
  return ordinary.reduce((sum, item) => sum + item.ore.multiplier * item.count, 0) / total;
}

export function primaryOre<T extends Ore>(mix: readonly Ingredient<T>[]): T | null {
  validMix(mix);
  let best: Ingredient<T> | null = null;
  for (const item of mix) {
    if (item.count > 0 && (!best || item.count > best.count || (item.count === best.count && item.ore.multiplier > best.ore.multiplier))) best = item;
  }
  return best?.ore ?? null;
}

export function traitStrength(share: number): number {
  nonNegative(share, "Share");
  if (share > 1) throw new RangeError("Share must be between zero and one.");
  if (share >= 0.3) return 1;
  return share < 0.1 ? 0 : Math.min(1, 0.1 + 4.5 * (share - 0.1));
}

/** Negative and positive effect amounts use the same strength factor. */
export function scaledEffect(amount: number, share: number) {
  if (!Number.isFinite(amount)) throw new RangeError("Effect must be finite.");
  return amount * traitStrength(share);
}

export function roundStat(value: number, kind: Kind): number {
  nonNegative(value, "Stat");
  // Both round to nearest (Tachi 247.7223 shows 247.72, Uchigatana 234.889 shows 234.89). Armour to a whole number, weapons to 2 decimals.
  return kind === "armour" ? Math.round(value) : Math.round(value * 100 + 1e-7) / 100;
}

/** Keep the underlying value available so enhancement never compounds display rounding. */
export function rawStat(base: number, multiplier: number, quality: number): number {
  nonNegative(base, "Base stat");
  nonNegative(multiplier, "Multiplier");
  nonNegative(quality, "Quality");
  if (quality > 1) throw new RangeError("Quality must be between zero and one.");
  return 2 * base * multiplier * quality;
}

export function stat(base: number, multiplier: number, quality: number, kind: Kind): number {
  return roundStat(rawStat(base, multiplier, quality), kind);
}

/** Pass rawStat(...), not the rounded card value. Rounding order remains provisional. */
export function enhancementTable(levelZero: number, kind: Kind) {
  nonNegative(levelZero, "Level zero stat");
  return Array.from({ length: 11 }, (_, level) => ({ level, multiplier: 1 + 0.05 * level, stat: roundStat(levelZero * (1 + 0.05 * level), kind) }));
}

/** Inputs are 1/N denominators; outputs are conditional percentages. */
export function variantOdds(denominators: readonly number[]): number[] {
  for (const denominator of denominators) {
    if (!Number.isFinite(denominator) || denominator <= 0) throw new RangeError("Variant denominators must be finite and positive.");
  }
  const total = denominators.reduce((sum, value) => sum + 1 / value, 0);
  return denominators.map((value) => 100 / value / total);
}

const weaponClasses = {
  early: ["Dagger", "Straight Sword", "Gauntlets", "Katana", "Greatsword", "Great Axe", "Colossal Sword"],
  late: ["Dagger", "Straight Sword", "Mace", "Axe", "Spear", "Great Axe", "Colossal Sword"]
} as const;
const armourClasses = ["Light Helmet", "Light Leggings", "Light Chestplate", "Medium Helmet", "Medium Leggings", "Medium Chestplate", "Heavy Helmet", "Heavy Leggings", "Heavy Chestplate"] as const;

/** Data is injected so patches do not require engine changes. No interpolation. */
export function classOdds(kind: Kind, world: World, total: number, rows: readonly CategoryRow[]) {
  if (![1, 2, 3, 4].includes(world)) throw new RangeError("World must be 1, 2, 3, or 4.");
  nonNegative(total, "Ore count");
  if (!Number.isInteger(total)) throw new RangeError("Ore count must be a whole number.");
  if (total < 3) return { status: "too-few" as const, capped: false, classes: [] };
  const count = Math.min(total, 55);
  const names = kind === "weapon" ? weaponClasses[world < 3 ? "early" : "late"] : armourClasses;
  const matching = rows.filter((row) => row.kind === kind && row.oreCount === count);
  if (matching.length !== names.length || new Set(matching.map((row) => row.slot)).size !== names.length) {
    return { status: "unavailable" as const, capped: total > 55, classes: [] };
  }
  const classes = names.map((name, index) => {
    const row = matching.find((candidate) => candidate.slot === index + 1);
    if (!row || !Number.isFinite(row.probability) || row.probability < 0 || row.probability > 100) throw new RangeError("Invalid category odds dataset.");
    return { name, probability: row.probability };
  });
  return { status: "available" as const, capped: total > 55, classes };
}
