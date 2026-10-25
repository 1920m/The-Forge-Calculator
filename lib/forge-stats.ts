import { forge, type Catalogue, type CatalogueOre } from "./engine/forge";
import type { SavedForge } from "./saved-forges";

export type Worked = ReturnType<typeof work>;

/** Stats for a save from today's game data. The item can vanish if the game data changes; cards say so. */
export function work(cat: Catalogue, oreById: Map<string, CatalogueOre>, f: SavedForge) {
  const mix = f.ores.flatMap((e) => { const ore = oreById.get(e.id); return ore ? [{ ore, count: e.count }] : []; });
  const r = forge(cat, mix, f.kind, f.world, f.quality / 100);
  const cls = r.classes.find((c) => c.name === f.class_name);
  const v = cls?.variants.find((x) => x.id === f.variant_id);
  return {
    mix, missingOres: mix.length < f.ores.length,
    rarity: r.rarity, multiplier: r.multiplier, traits: r.traits.filter((t) => t.strength > 0).map((t) => t.ore.name),
    variantName: v?.name ?? null, value: v?.value ?? null, dps: v?.dps?.total ?? null, speed: v?.speed ?? null,
    chance: cls ? (cls.lockable ? "Guaranteed" : `${cls.probability}% class`) : null,
  };
}
