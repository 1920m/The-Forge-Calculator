/** Higher-level forge maths built on the pure functions in ./index. No framework or network imports. */
import { averageMultiplier, classOdds, primaryOre, rawStat, roundStat, enhancementTable, traitStrength, variantOdds, type CategoryRow, type Kind, type World } from "./index";
import { weaponDps } from "./dps";

export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Relic" | "Exotic" | "Divine";
export type CatalogueOre = {
  id: string; name: string; rarity: string; multiplier: number; rule: "fixed" | "average";
  worlds: number[]; drop: number | null; source: string | null; verified: boolean;
  traits: { kinds: Kind[]; text: string }[];
};
export type CatalogueWeapon = { id: string; name: string; class: string; baseDamage: number; indexSpeed: number; trueSpeed: number; range: number; price: number; weight: number; worlds: number[]; verified: boolean; tag?: "shop" | "halloween" | null };
export type CatalogueArmour = { id: string; name: string; weightClass: "Light" | "Medium" | "Heavy"; set: string; slot: "helmet" | "chestplate" | "leggings"; healthPct: number; price: number; weight: number; worlds: number[]; verified: boolean };
export type Catalogue = {
  ores: CatalogueOre[]; weapons: CatalogueWeapon[]; armour: CatalogueArmour[];
  /** Per world ("2" = Worlds 1–2, "3", "4"): the weapon classes in slot order and each class's variants. */
  weaponPools: Record<string, { classes: string[]; pools: Record<string, { shop: boolean; items: [string, number?][] }> }>;
  armourClasses: [string, string][];
  odds: { weapon: Record<string, number[]>; armour: Record<string, number[]> };
  locks: { weapon: number[]; armour: number[] };
  qualityTiers: [string, number][];
};
export type Mix = { ore: CatalogueOre; count: number }[];

export const armourClassName = ([weight, slot]: [string, string]) => `${weight} ${slot[0].toUpperCase()}${slot.slice(1)}`;

const poolKey = (world: World) => String(world <= 2 ? 2 : world);

export function classNames(cat: Catalogue, kind: Kind, world: World): string[] {
  return kind === "weapon" ? cat.weaponPools[poolKey(world)].classes : cat.armourClasses.map(armourClassName);
}

/** True when a weapon class in this world also has shop-blueprint weapons that are not in the data yet. */
export function poolIncomplete(cat: Catalogue, kind: Kind, world: World, className: string): boolean {
  return kind === "weapon" && !!cat.weaponPools[poolKey(world)].pools[className]?.shop;
}

/** Category rows for the engine's classOdds, built from the catalogue's odds table. */
export function categoryRows(cat: Catalogue, kind: Kind): CategoryRow[] {
  return Object.entries(cat.odds[kind]).flatMap(([n, cells]) => cells.map((probability, i) => ({ kind, oreCount: Number(n), slot: i + 1, probability })));
}

export type Variant = { id: string; name: string; weight: number; chance: number; base: number; verified: boolean; speed?: number; interval?: number; range?: number; tag?: "shop" | "halloween" | null };

/** Every variant of a class in a world, with its chance inside the class (normalised inverse weights). */
export function classVariants(cat: Catalogue, kind: Kind, world: World, className: string): Variant[] {
  const byId = new Map(cat.weapons.map((w) => [w.id, w]));
  const list = kind === "weapon"
    ? (cat.weaponPools[poolKey(world)].pools[className]?.items ?? []).flatMap(([id, weight]) => {
        const w = byId.get(id);
        return w ? [{ id: w.id, name: w.name, weight: weight ?? w.weight, base: w.baseDamage, verified: w.verified, speed: w.indexSpeed, interval: w.trueSpeed, range: w.range, tag: w.tag ?? null }] : [];
      })
    : cat.armour.filter((a) => armourClassName([a.weightClass, a.slot]) === className && a.worlds.includes(world)).map((a) => ({ id: a.id, name: a.name, weight: a.weight, base: a.healthPct, verified: a.verified }));
  const odds = variantOdds(list.map((v) => v.weight));
  return list.map((v, i) => ({ ...v, chance: odds[i] }));
}

export function qualityLabel(cat: Catalogue, qualityPct: number): string {
  let label = cat.qualityTiers[0][0];
  for (const [name, min] of cat.qualityTiers) if (qualityPct >= min) label = name;
  return label;
}

/**
 * Scales a trait line by strength, matching the game (Sun Stone at 20% share: "35% chance … 35%/s" became 19.3% and 19.3%/s).
 * Every percentage and signed amount scales: chances, damage, stat bonuses and penalties.
 * Left alone: HP thresholds ("below 35% HP"), durations and cooldowns in seconds. Shown to one decimal, like the game.
 */
export function scaleTraitText(text: string, strength: number): string {
  if (strength >= 1) return text;
  const round1 = (v: number) => Math.round(v * 10 + 1e-9) / 10;
  return text.replace(/(below |above )?([+-]?)(\d+(?:\.\d+)?)(%|(?=\s*(?:regen|health)\b))?(\s*(?:max )?HP\b)?/gi,
    (match, cond: string | undefined, sign: string, n: string, pct: string | undefined, hp: string | undefined) => {
      if (cond || (hp && !/max/i.test(hp) && !sign)) return match; // condition like "below 35% HP"
      if (!pct && !sign) return match; // plain numbers: durations ("5s"), counts
      return `${sign}${round1(Number(n) * strength)}${pct ?? ""}${hp ?? ""}`;
    });
}

export type TraitResult = { ore: CatalogueOre; share: number; strength: number; lines: string[]; fullLines: string[] };

export function transferredTraits(mix: Mix, kind: Kind): TraitResult[] {
  const total = mix.reduce((n, m) => n + m.count, 0);
  if (!total) return [];
  return mix
    .filter((m) => m.count > 0)
    .map((m) => {
      const share = m.count / total;
      const strength = traitStrength(share);
      const fullLines = m.ore.traits.filter((t) => t.kinds.includes(kind)).map((t) => t.text);
      return { ore: m.ore, share, strength, fullLines, lines: fullLines.map((l) => scaleTraitText(l, strength)) };
    })
    .filter((t) => t.fullLines.length > 0)
    .sort((a, b) => b.share - a.share);
}

const toEngineMix = (mix: Mix) => mix.filter((m) => m.count > 0).map((m) => ({ ore: { slug: m.ore.id, multiplier: m.ore.multiplier, rarity: m.ore.rarity, multiplierRule: m.ore.rule === "average" ? ("average-other-ores" as const) : undefined, ref: m.ore }, count: m.count }));

export function forge(cat: Catalogue, mix: Mix, kind: Kind, world: World, quality: number) {
  const engineMix = toEngineMix(mix);
  const total = engineMix.reduce((n, m) => n + m.count, 0);
  const multiplier = averageMultiplier(engineMix);
  const primary = primaryOre(engineMix)?.ref ?? null;
  const names = classNames(cat, kind, world);
  const odds = classOdds(kind, world, total, categoryRows(cat, kind));
  const locks = cat.locks[kind];
  const dpsOres = mix.filter((m) => m.count > 0).map((m) => ({ id: m.ore.id, count: m.count }));
  const classes = names.map((name, i) => {
    const probability = odds.status === "available" ? odds.classes[i].probability : 0;
    const variants = classVariants(cat, kind, world, name).map((v) => {
      const raw = multiplier == null ? null : rawStat(v.base, multiplier, quality);
      const dps = kind === "weapon" && raw != null && v.interval ? weaponDps({ ores: dpsOres, damage: raw, interval: v.interval }) : null;
      return { ...v, overall: (probability * v.chance) / 100, raw, value: raw == null ? null : roundStat(raw, kind), dps };
    });
    return { name, probability, lockAt: locks[i], lockable: total >= locks[i], incomplete: poolIncomplete(cat, kind, world, name), variants };
  });
  return { total, multiplier, primary, rarity: primary?.rarity ?? null, oddsStatus: odds.status, capped: odds.capped, classes, traits: transferredTraits(mix, kind) };
}

/**
 * The odds after the player locks a class in the forge (possible once the ore count reaches its lock number):
 * that class is guaranteed and the others can't come out. Items inside it keep their 1/N split.
 * Returns the classes unchanged if the class isn't there or can't be locked with this many ores.
 */
export function lockClass<C extends { name: string; probability: number; lockable: boolean; variants: V[] }, V extends { chance: number; overall: number }>(classes: C[], locked: string | null): C[] {
  const target = locked ? classes.find((c) => c.name === locked && c.lockable) : null;
  if (!target) return classes;
  return classes.map((c) => {
    const probability = c === target ? 100 : 0;
    return { ...c, probability, variants: c.variants.map((v) => ({ ...v, overall: (probability * v.chance) / 100 })) };
  });
}

export { enhancementTable, roundStat, rawStat };
