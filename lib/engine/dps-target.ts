/**
 * "Hit a DPS target": of everything one mix can forge, which weapons reach a DPS, and how likely a forge is to give one.
 *
 * Each forge gives exactly one weapon, so the chance of "any weapon at or above the target" is the sum of those
 * weapons' overall chances (class chance × chance inside the class). The tries maths in odds.ts then applies.
 * Enhancement multiplies DPS by 1 + 0.05 × level, the same as damage, because every DPS term scales with damage.
 */
export type TargetVariant = { id: string; name: string; overall: number; dps?: { total: number } | null };
export type TargetClass = { name: string; probability: number; variants: TargetVariant[] };

export type TargetRow = { cls: string; id: string; name: string; dps: number; chance: number; hits: boolean };

export const enhanceFactor = (level: number) => 1 + 0.05 * Math.min(10, Math.max(0, Math.round(level)));

/** Every weapon this mix can forge, best DPS first, marked by whether it reaches the target. Chances are 0 to 1. */
export function dpsTarget(classes: readonly TargetClass[], target: number, level = 0) {
  const k = enhanceFactor(level);
  const rows: TargetRow[] = classes
    .filter((c) => c.probability > 0)
    .flatMap((c) => c.variants.filter((v) => v.overall > 0 && v.dps).map((v) => {
      const dps = v.dps!.total * k;
      return { cls: c.name, id: v.id, name: v.name, dps, chance: v.overall / 100, hits: dps >= target - 1e-9 };
    }))
    .sort((a, b) => b.dps - a.dps || b.chance - a.chance);
  const chance = Math.min(1, rows.reduce((a, r) => a + (r.hits ? r.chance : 0), 0));
  return { rows, chance, best: rows[0] ?? null };
}
