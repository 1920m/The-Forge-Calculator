import { forge, type Catalogue, type CatalogueOre } from "./engine/forge";
import type { SavedForge } from "./saved-forges";
import { decodeRunes, dpsAtLevel } from "./engine/runes";

export type Worked = ReturnType<typeof work>;

/** Stats for a save from today's game data. The item can vanish if the game data changes; cards say so. */
export function work(cat: Catalogue, oreById: Map<string, CatalogueOre>, f: SavedForge) {
  const mix = f.ores.flatMap((e) => { const ore = oreById.get(e.id); return ore ? [{ ore, count: e.count }] : []; });
  const r = forge(cat, mix, f.kind, f.world, f.quality / 100);
  const cls = r.classes.find((c) => c.name === f.class_name);
  const v = cls?.variants.find((x) => x.id === f.variant_id);
  // Saved weapon runes: DPS at the saved enhancement level with them (the cards show the level).
  const runed = f.kind === "weapon" && f.runes && v?.raw != null && v.interval
    ? dpsAtLevel({ ores: mix.map((m) => ({ id: m.ore.id, count: m.count })), raw: v.raw, interval: v.interval }, f.enhance ?? 9, decodeRunes(f.runes, "weapon")).total
    : null;
  return {
    mix, missingOres: mix.length < f.ores.length,
    /** DPS with the saved runes at `runeLevel`, when the save has weapon runes. */
    runeDps: runed, runeLevel: runed != null ? f.enhance ?? 9 : null, hasRunes: !!f.runes,
    rarity: r.rarity, multiplier: r.multiplier, traits: r.traits.filter((t) => t.strength > 0).map((t) => t.ore.name),
    variantName: v?.name ?? null, value: v?.value ?? null, dps: v?.dps?.total ?? null, speed: v?.interval ?? null, // real swing time, not the card's index value
    chance: cls ? (cls.lockable ? "Guaranteed" : `${cls.probability}% class`) : null,
  };
}
