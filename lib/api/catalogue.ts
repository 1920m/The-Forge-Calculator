/**
 * The public catalogue: the same game data the website uses, in a stable shape keyed by ID. Pure: give it the
 * catalogue (from getCatalogue) and a filter.
 */
import { armourClassName, type Catalogue, type CatalogueOre } from "@/lib/engine/forge";
import { imageUrl } from "@/lib/data/supabase";
import { RACES, type Race } from "@/data/races";
import { RUNES, SECONDARIES, runeImage } from "@/data/runes";
import { MOLDS } from "@/data/molds";
import { GOLEMITE, GOLEMITE_RARITY, GOLEMITE_SOURCE } from "@/data/golemites";
import { PICKAXES } from "@/data/pickaxes";
import { SITE_URL } from "@/lib/site";
import type { CATALOGUE_TYPES } from "./schema";

export type CatalogueType = (typeof CATALOGUE_TYPES)[number];
export type CatalogueFilter = { type?: CatalogueType; world?: number; ids?: string[]; search?: string };

/** The game's forges: Worlds 1 and 2 share one. */
export const FORGE_WORLDS = [2, 3, 4] as const;
export const forgeWorld = (w: number) => (w <= 2 ? 2 : w);

const TRAIT_RULE = { minShare: 0.1, fullShare: 0.3, strengthAtMin: 0.1, note: "A trait starts at 10% of the mix (at 10% strength) and reaches full strength at 30%." };

/** Worlds (2 = Worlds 1–2, 3, 4) whose forge can give this weapon, with its 1/N weight there. */
export function weaponWorlds(cat: Catalogue, id: string): { world: number; weight: number; cls: string }[] {
  const w = cat.weapons.find((x) => x.id === id);
  if (!w) return [];
  return FORGE_WORLDS.flatMap((world) => {
    const pools = cat.weaponPools[String(world)]?.pools ?? {};
    for (const [cls, pool] of Object.entries(pools)) {
      const hit = pool.items.find(([itemId]) => itemId === id);
      if (hit) return [{ world, weight: hit[1] ?? w.weight, cls }];
    }
    return [];
  });
}

/** Worlds (2 = Worlds 1–2, 3, 4) whose forge can give this armour piece, with its 1/N weight there. */
export function armourWorlds(cat: Catalogue, id: string): { world: number; weight: number }[] {
  const a = cat.armour.find((x) => x.id === id);
  if (!a) return [];
  return FORGE_WORLDS.filter((world) => a.worlds.includes(world) || (world === 2 && a.worlds.includes(1)))
    .map((world) => ({ world, weight: a.worldWeights?.[String(world)] ?? a.weight }));
}

export const oreWorlds = (o: CatalogueOre) => [...new Set(o.worlds.map(forgeWorld))];

function ore(o: CatalogueOre) {
  const traits = o.traits.map((t) => ({ text: t.text, appliesTo: [...t.kinds].sort() as ("armour" | "weapon")[] }));
  return {
    id: o.id, name: o.name, rarity: o.rarity, image: imageUrl("ores", o.id),
    // Average ores (Fichilliumorite) take the other ores' weighted average, so they have no number of their own.
    multiplier: o.rule === "average" ? null : o.multiplier, multiplierRule: o.rule,
    worlds: o.worlds,
    dropChance: o.drop != null ? { oneIn: o.drop } : null,
    foundIn: o.source,
    traits,
    hasTraits: { weapon: traits.some((t) => t.appliesTo.includes("weapon")), armour: traits.some((t) => t.appliesTo.includes("armour")) },
    traitRule: TRAIT_RULE,
    verified: o.verified,
  };
}

function weapon(cat: Catalogue, w: Catalogue["weapons"][number]) {
  const worlds = weaponWorlds(cat, w.id);
  return {
    id: w.id, name: w.name, class: w.class, image: imageUrl("weapons", w.id),
    baseDamage: w.baseDamage, attackInterval: w.trueSpeed, cardSpeed: w.indexSpeed, range: w.range, price: w.price,
    forgeWorlds: worlds.map((x) => ({ world: x.world, weight: x.weight })),
    tag: w.tag ?? null, verified: w.verified,
  };
}

function armour(cat: Catalogue, a: Catalogue["armour"][number]) {
  return {
    id: a.id, name: a.name, class: armourClassName([a.weightClass, a.slot]), weightClass: a.weightClass, slot: a.slot, set: a.set,
    image: imageUrl("armour", a.id), healthPct: a.healthPct, price: a.price,
    forgeWorlds: armourWorlds(cat, a.id), verified: a.verified,
  };
}

function classes(cat: Catalogue, worlds: number[]) {
  return worlds.map((world) => {
    const pool = cat.weaponPools[String(world)];
    return {
      world,
      weapon: pool.classes.map((name, i) => ({ name, slot: i + 1, lockAt: cat.locks.weapon[i], items: (pool.pools[name]?.items ?? []).map(([id]) => id), shopItemsMissing: !!pool.pools[name]?.shop })),
      armour: cat.armourClasses.map((pair, i) => {
        const name = armourClassName(pair);
        return { name, slot: i + 1, lockAt: cat.locks.armour[i], items: cat.armour.filter((a) => armourClassName([a.weightClass, a.slot]) === name && armourWorlds(cat, a.id).some((x) => x.world === world)).map((a) => a.id) };
      }),
    };
  });
}

const race = (r: Race) => ({
  id: r.id, name: r.name, rarity: r.rarity, spinChancePct: r.chance, traits: r.traits,
  affectsDps: !!r.combat, situational: r.combat?.conditions ?? [],
});

export function buildCatalogue(cat: Catalogue, f: CatalogueFilter) {
  const want = (t: CatalogueType) => !f.type || f.type === t;
  const ids = f.ids ? new Set(f.ids) : null;
  const q = f.search?.toLowerCase() ?? null;
  const keep = (x: { id: string; name: string }) => (!ids || ids.has(x.id)) && (!q || x.name.toLowerCase().includes(q) || x.id.includes(q));
  const world = f.world ?? null;
  const data: Record<string, unknown> = {};

  if (want("ores")) data.ores = cat.ores.filter((o) => keep(o) && (world == null || o.worlds.includes(world) || (world === 2 && o.worlds.includes(1)))).map(ore);
  if (want("weapons")) data.weapons = cat.weapons.map((w) => weapon(cat, w)).filter((w) => keep(w) && w.forgeWorlds.length > 0 && (world == null || w.forgeWorlds.some((x) => x.world === forgeWorld(world))));
  if (want("armour")) data.armour = cat.armour.map((a) => armour(cat, a)).filter((a) => keep(a) && (world == null || a.forgeWorlds.some((x) => x.world === forgeWorld(world))));
  if (want("classes")) data.classes = { worlds: classes(cat, world == null ? [...FORGE_WORLDS] : [forgeWorld(world)]), odds: cat.odds, oddsNote: "odds[kind][oreCount] = chance (%) of each class slot, 3 to 55 ores; above 55 the 55 row is used." };
  if (want("races")) data.races = RACES.filter(keep).map(race);
  if (want("runes")) {
    data.runes = RUNES.filter(keep).map((r) => ({ id: r.id, name: r.name, kind: r.kind, effect: r.effect, image: `${SITE_URL}${runeImage(r.id)}`, levels: r.levels.map((l, i) => ({ level: i + 1, text: l.text })), from: r.from }));
    data.runeSideEffects = SECONDARIES.map((s) => ({ id: s.id, name: s.name, kind: s.kind, best: s.best, range: s.range }));
    data.runeSlots = { opensAt: [3, 6, 9], note: "One slot at +3, two at +6, three at +9. A level I, II or III rune has up to 1, 2 or 3 side effects (best rolls)." };
  }
  if (want("molds")) {
    data.molds = {
      items: Object.values(MOLDS).map((m) => ({ kind: m.kind, name: m.name, image: `${SITE_URL}${m.image}`, from: m.from })),
      requirements: (cat.moldRequirements ?? []).filter((r) => (!ids || ids.has(r.itemId)) && (world == null || r.worlds.includes(forgeWorld(world)) || r.worlds.includes(world)))
        .map((r) => ({ itemId: r.itemId, kind: r.kind, worlds: r.worlds, molds: r.exact ?? r.reported ?? null, status: r.status, approximate: r.approximate, minOres: r.minOres })),
      note: "With the item's class locked and at least `molds` molds (status verified), the item is guaranteed. With fewer, the game's mold screen shows (molds ÷ needed)², observed in screenshots; how it combines with the normal chance isn't known.",
    };
  }
  if (want("golemites")) {
    data.golemites = {
      minOres: GOLEMITE.minOres, maxOres: GOLEMITE.maxOres, worlds: GOLEMITE.worlds, storage: GOLEMITE.storage, maxLevel: GOLEMITE.maxLevel,
      combatLevel: GOLEMITE.combatLevel, sizePerLevel: GOLEMITE.sizePerLevel, secondSlotPlayerLevel: GOLEMITE.secondSlotLevel,
      rarities: Object.entries(GOLEMITE_RARITY).map(([rarity, v]) => ({ rarity, miningHelp: v.mining, oreTraitShare: v.traits })),
      rarityRule: "The rarity of the ore used most (ties: higher multiplier), like weapons and armour.",
      source: GOLEMITE_SOURCE.url,
    };
  }
  if (want("pickaxes")) data.pickaxes = PICKAXES.filter(keep).map((p) => ({ ...p, image: imageUrl("pickaxes", p.id) }));
  return data;
}
