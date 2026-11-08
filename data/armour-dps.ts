/**
 * Armour traits that change weapon damage, from each ore's wiki page (trait lists headed "Weapons and Armor"/both
 * or armour only), checked for all 149 ores on 3 Nov 2026. Values are at full strength (a 30% share of the piece);
 * like every trait they scale down to 10% strength at a 10% share and are off below that.
 *
 * - Lethality is "Physical Damage" on the wiki ("Lethality: Increases Physical Damage by 15%"). It boosts direct hits
 *   only, never burns, smites or other procs.
 * - `lowHp` is the Berserker bonus ("below 35% HP, +X% Physical Damage"): conditional, never in the normal DPS.
 * - Left out on purpose: area poison clouds (Poopite, Vooite), thorns, Demonite's Backfire (burns when you're hit),
 *   Bismuth's Vital Power (needs your max health; offered as a condition instead), and Version 1.10's Frost Core
 *   blizzard (when you're hit), Bizzarite's Void Mark (on the attacker, when you're hit) and Heaven's Ascent (builds up
 *   over a fight), which the wiki's calculator leaves out too.
 */
import type { DpsStat } from "@/lib/engine/dps";

export type ArmourDps = { stats?: Partial<Record<DpsStat, number>>; lowHp?: number; vitalPower?: { perHp: number; step: number; max: number } };

export const ARMOUR_DPS: Record<string, ArmourDps> = {
  "eye-ore": { stats: { lethality: 0.15 } },
  "frost-fossil": { stats: { lethality: 0.175 } },
  "sealed-curse": { stats: { lethality: 0.3 }, lowHp: 0.2 },
  kokorite: { stats: { lethality: 0.3 }, lowHp: 0.25 },
  "fierce-jade": { stats: { lethality: 0.2, crit_chance: 0.35, crit_dmg: 0.2 }, lowHp: 0.35 },
  vanegos: { stats: { lethality: 0.4 }, lowHp: 0.35 },
  "yin-yang": { stats: { crit_chance: 0.45, crit_dmg: 0.2 }, lowHp: 0.25 },
  bismuth: { stats: { lethality: 0.15, crit_chance: 0.15, crit_dmg: 0.15 }, vitalPower: { perHp: 0.01, step: 500, max: 0.2 } },
  // "15% chance to apply Burn for 2 seconds, dealing 20% of Base Weapon Damage per second."
  demonite: { stats: { fire_dmg: 0.2, fire_chance: 0.15, fire_duration: 2 } },
  "heart-of-the-island": { lowHp: 0.25 },
  // Version 1.10: "Lethality: Increases Physical Damage by 15%. Critical Damage: Increases Critical Damage by 10%." (both)
  "frost-core": { stats: { lethality: 0.15, crit_dmg: 0.1 } },
  yin: { lowHp: 0.25 },
};

export const ARMOUR_DPS_SOURCE = { title: "The Forge Official Roblox Wiki: ore pages", url: "https://forgewiki.org", checked: "3 Nov 2026" };
