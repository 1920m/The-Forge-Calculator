import { forge, type Catalogue, type CatalogueOre } from "./engine/forge";
import type { SavedForge } from "./saved-forges";
import { decodeRunes, dpsAtLevel } from "./engine/runes";
import { combatDps, type CombatConditions, type CombatResult, type GolemInput } from "./engine/loadout-dps";

export type Worked = ReturnType<typeof work>;

/** Stats for a save from today's game data. The item can vanish if the game data changes; cards say so. */
export function work(cat: Catalogue, oreById: Map<string, CatalogueOre>, f: SavedForge) {
  const mix = f.ores.flatMap((e) => { const ore = oreById.get(e.id); return ore ? [{ ore, count: e.count }] : []; });
  const r = forge(cat, mix, f.kind, f.world, f.quality / 100);
  const cls = r.classes.find((c) => c.name === f.class_name);
  const v = cls?.variants.find((x) => x.id === f.variant_id);
  // Saved weapon runes: DPS at the saved enhancement level with them (the cards show the level).
  const runed = f.kind === "weapon" && f.runes && v?.raw != null && v.interval
    ? dpsAtLevel({ ores: mix.map((m) => ({ id: m.ore.id, count: m.count })), raw: v.raw, interval: v.interval, cls: f.class_name }, f.enhance ?? 9, decodeRunes(f.runes, "weapon")).total
    : null;
  return {
    mix, missingOres: mix.length < f.ores.length,
    /** DPS with the saved runes at `runeLevel`, when the save has weapon runes. */
    runeDps: runed, runeLevel: runed != null ? f.enhance ?? 9 : null, hasRunes: !!f.runes,
    rarity: r.rarity, multiplier: r.multiplier, traits: r.traits.filter((t) => t.strength > 0).map((t) => t.ore.name),
    variantName: v?.name ?? null, value: v?.value ?? null, raw: v?.raw ?? null, dps: v?.dps?.total ?? null, speed: v?.interval ?? null, // real swing time, not the card's index value
    chance: cls ? (cls.lockable ? "Guaranteed" : `${cls.probability}% class`) : null,
  };
}

type Worn = { f: SavedForge; r: Worked };

/** A worked Golemite as combat input (null when it has no rarity yet, so no traits carry over). */
export const golemInput = (r: { mix: readonly { ore: { id: string }; count: number }[]; traitScale: number | null } | null | undefined): GolemInput =>
  r && r.traitScale ? { ores: r.mix.map((m) => ({ id: m.ore.id, count: m.count })), traitScale: r.traitScale } : null;
const oreCounts = (r: Worked) => r.mix.map((m) => ({ id: m.ore.id, count: m.count }));

/**
 * A saved weapon's DPS with armour and a race on top (the same engine as the calculator). The weapon is counted at
 * its saved runes' enhancement level, or +0 without runes, the same as its card. Null for armour or missing data.
 */
export function forgeCombat(weapon: Worn | null, armour: readonly (Worn | null)[], raceId: string | null, conditions?: CombatConditions, golems?: readonly GolemInput[]): CombatResult | null {
  if (!weapon || weapon.f.kind !== "weapon" || weapon.r.raw == null || !weapon.r.speed || weapon.r.missingOres) return null;
  const runes = weapon.f.runes ? decodeRunes(weapon.f.runes, "weapon") : undefined;
  return combatDps({
    weapon: { ores: oreCounts(weapon.r), raw: weapon.r.raw, interval: weapon.r.speed, cls: weapon.f.class_name },
    level: runes ? weapon.f.enhance ?? 9 : 0, runes,
    armour: armour.map((a) => (a && a.f.kind === "armour" && !a.r.missingOres ? { ores: oreCounts(a.r) } : null)),
    raceId, conditions, golems,
  });
}
