/**
 * A Golemite from its ores: rarity from the primary ore (the same rule as weapons and armour, checked in game), mining
 * help and trait share from the rarity, and which ores' weapon traits carry over at what strength. No combat damage:
 * how a Golemite fights isn't known.
 */
import { GOLEMITE, GOLEMITE_RARITY } from "@/data/golemites";
import { scaleTraitText, transferredTraits, type Mix, type Rarity } from "./forge";
import { primaryOre } from "./index";

export function golemite(mix: Mix) {
  const used = mix.filter((m) => m.count > 0);
  const total = used.reduce((n, m) => n + m.count, 0);
  const primary = used.length ? primaryOre(used.map((m) => ({ ore: { slug: m.ore.id, multiplier: m.ore.multiplier, rarity: m.ore.rarity, ref: m.ore }, count: m.count })))?.ref ?? null : null;
  const rarity = primary && primary.rarity in GOLEMITE_RARITY ? (primary.rarity as Rarity) : null;
  const scale = rarity ? GOLEMITE_RARITY[rarity] : null;
  // The guide's examples list weapon traits (crits, smite, explosions), so those are the ones shown.
  // Each trait: the ore's numbers × its share strength (10% to 30% rule) × the rarity's trait scaling.
  const traits = transferredTraits(used, "weapon").map((t) => {
    const golem = t.strength * (scale?.traits ?? 0);
    return { ore: t.ore, share: t.share, strength: t.strength, golem, lines: t.fullLines.map((l) => scaleTraitText(l, golem)) };
  });
  return { mix: used, total, enough: total >= GOLEMITE.minOres, tooMany: total > GOLEMITE.maxOres, name: primary ? `${primary.name} Golemite` : "Golemite", primary, rarity, mining: scale?.mining ?? null, traitScale: scale?.traits ?? null, traits };
}

/** What a growth level means: size, whether it can fight, and snacks (days) still needed. */
export function golemGrowth(level: number) {
  const l = Math.min(GOLEMITE.maxLevel, Math.max(0, Math.floor(level) || 0));
  return { level: l, size: 1 + GOLEMITE.sizePerLevel * l, fights: l >= GOLEMITE.combatLevel, toCombat: Math.max(0, GOLEMITE.combatLevel - l), toMax: GOLEMITE.maxLevel - l };
}
