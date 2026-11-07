/**
 * A Golemite from its ores: rarity from the primary ore (the same rule as weapons and armour, checked in game), mining
 * help and trait share from the rarity, and every ore trait (weapon and armour) at the strength the player gets it.
 * No combat damage of its own: how a Golemite fights isn't known.
 */
import { GOLEMITE, GOLEMITE_RARITY } from "@/data/golemites";
import { scaleTraitText, type Mix, type Rarity } from "./forge";
import { primaryOre, traitStrength } from "./index";

export function golemite(mix: Mix) {
  const used = mix.filter((m) => m.count > 0);
  const total = used.reduce((n, m) => n + m.count, 0);
  const primary = used.length ? primaryOre(used.map((m) => ({ ore: { slug: m.ore.id, multiplier: m.ore.multiplier, rarity: m.ore.rarity, ref: m.ore }, count: m.count })))?.ref ?? null : null;
  const rarity = primary && primary.rarity in GOLEMITE_RARITY ? (primary.rarity as Rarity) : null;
  const scale = rarity ? GOLEMITE_RARITY[rarity] : null;
  // All of each ore's traits, weapon and armour: the player gets them. Each one: the ore's numbers × its share strength
  // (10% to 30% rule) × the rarity's trait scaling.
  const traits = used
    .map((m) => {
      const share = total ? m.count / total : 0;
      const strength = traitStrength(share);
      const golem = strength * (scale?.traits ?? 0);
      const effects = m.ore.traits.map((t) => ({ text: scaleTraitText(t.text, golem), appliesTo: [...t.kinds].sort() as ("armour" | "weapon")[] }));
      return { ore: m.ore, share, strength, golem, effects, lines: effects.map((e) => e.text) };
    })
    .filter((t) => t.effects.length > 0)
    .sort((a, b) => b.share - a.share);
  return { mix: used, total, enough: total >= GOLEMITE.minOres, tooMany: total > GOLEMITE.maxOres, name: primary ? `${primary.name} Golemite` : "Golemite", primary, rarity, mining: scale?.mining ?? null, traitScale: scale?.traits ?? null, traits };
}

/** What a growth level means: size, whether it can fight, and snacks (days) still needed. */
export function golemGrowth(level: number) {
  const l = Math.min(GOLEMITE.maxLevel, Math.max(0, Math.floor(level) || 0));
  return { level: l, size: 1 + GOLEMITE.sizePerLevel * l, fights: l >= GOLEMITE.combatLevel, toCombat: Math.max(0, GOLEMITE.combatLevel - l), toMax: GOLEMITE.maxLevel - l };
}
