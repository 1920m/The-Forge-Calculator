/** Higher-level forge maths built on the pure functions in ./index. No framework or network imports. */
import { averageMultiplier, classOdds, primaryOre, rawStat, roundStat, enhancementTable, traitStrength, variantOdds, type CategoryRow, type Kind, type World } from "./index";

export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Relic" | "Exotic" | "Divine";
export type CatalogueOre = {
  id: string; name: string; rarity: string; multiplier: number; rule: "fixed" | "average";
  worlds: number[]; drop: number | null; source: string | null; verified: boolean;
  traits: { kinds: Kind[]; text: string }[];
};
export type CatalogueWeapon = { id: string; name: string; class: string; baseDamage: number; indexSpeed: number; trueSpeed: number; range: number; price: number; weight: number; worlds: number[]; verified: boolean };
export type CatalogueArmour = { id: string; name: string; weightClass: "Light" | "Medium" | "Heavy"; set: string; slot: "helmet" | "chestplate" | "leggings"; healthPct: number; price: number; weight: number; worlds: number[]; verified: boolean };
export type Catalogue = {
  ores: CatalogueOre[]; weapons: CatalogueWeapon[]; armour: CatalogueArmour[];
  weaponClasses: { early: string[]; late: string[] };
  armourClasses: [string, string][];
  odds: { weapon: Record<string, number[]>; armour: Record<string, number[]> };
  locks: { weapon: number[]; armour: number[] };
  qualityTiers: [string, number][];
};
export type Mix = { ore: CatalogueOre; count: number }[];

export const armourClassName = ([weight, slot]: [string, string]) => `${weight} ${slot[0].toUpperCase()}${slot.slice(1)}`;

export function classNames(cat: Catalogue, kind: Kind, world: World): string[] {
  return kind === "weapon" ? cat.weaponClasses[world < 3 ? "early" : "late"] : cat.armourClasses.map(armourClassName);
}

/** Category rows for the engine's classOdds, built from the catalogue's odds table. */
export function categoryRows(cat: Catalogue, kind: Kind): CategoryRow[] {
  return Object.entries(cat.odds[kind]).flatMap(([n, cells]) => cells.map((probability, i) => ({ kind, oreCount: Number(n), slot: i + 1, probability })));
}

export type Variant = { id: string; name: string; weight: number; chance: number; base: number; verified: boolean; speed?: number; range?: number };

/** Every variant of a class in a world, with its chance inside the class (normalised inverse weights). */
export function classVariants(cat: Catalogue, kind: Kind, world: World, className: string): Variant[] {
  const list = kind === "weapon"
    ? cat.weapons.filter((w) => w.class === className && w.worlds.includes(world)).map((w) => ({ id: w.id, name: w.name, weight: w.weight, base: w.baseDamage, verified: w.verified, speed: w.indexSpeed, range: w.range }))
    : cat.armour.filter((a) => armourClassName([a.weightClass, a.slot]) === className && a.worlds.includes(world)).map((a) => ({ id: a.id, name: a.name, weight: a.weight, base: a.healthPct, verified: a.verified }));
  const odds = variantOdds(list.map((v) => v.weight));
  return list.map((v, i) => ({ ...v, chance: odds[i] }));
}

export function qualityLabel(cat: Catalogue, qualityPct: number): string {
  let label = cat.qualityTiers[0][0];
  for (const [name, min] of cat.qualityTiers) if (qualityPct >= min) label = name;
  return label;
}

/** Scales the signed amounts in a trait line ("+15% Vitality", "-10% stamina", "+8 regen") by strength. Chances, durations and conditions are left as written. */
export function scaleTraitText(text: string, strength: number): string {
  return text.replace(/([+-])(\d+(?:\.\d+)?)(%?)/g, (_, sign: string, n: string, pct: string) => {
    const v = Number(n) * strength;
    return `${sign}${Number.isInteger(v) ? v : Number(v.toFixed(2))}${pct}`;
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
  const classes = names.map((name, i) => {
    const probability = odds.status === "available" ? odds.classes[i].probability : 0;
    const variants = classVariants(cat, kind, world, name).map((v) => {
      const raw = multiplier == null ? null : rawStat(v.base, multiplier, quality);
      return { ...v, overall: (probability * v.chance) / 100, raw, value: raw == null ? null : roundStat(raw, kind) };
    });
    return { name, probability, lockAt: locks[i], lockable: total >= locks[i], variants };
  });
  return { total, multiplier, primary, rarity: primary?.rarity ?? null, oddsStatus: odds.status, capped: odds.capped, classes, traits: transferredTraits(mix, kind) };
}

export { enhancementTable, roundStat, rawStat };
