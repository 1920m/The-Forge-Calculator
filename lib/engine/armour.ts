/**
 * Armour value of an ore mix, used to rank armour builds.
 *
 * effective health = multiplier × (1 + Vitality) ÷ (1 − shield chance × shield cut) ÷ (1 − dodge)
 *
 * - The multiplier sets the piece's defence (defence = 2 × health % × multiplier × quality).
 * - Vitality adds to health. Shields ("x% chance to cut damage by y%") and dodge reduce the damage taken.
 * - Every effect scales with the ore's share (none below 10%, full from 30%), like all traits.
 * - Vitality adds up. Shields and dodge do not stack here: only the best one counts. (The wiki's data notes say
 *   shield cuts add up, but that would block 70% of hits completely in end-game builds, which is not what players
 *   see, so the safer reading is used.)
 * Regeneration, thorns, movement and offensive traits are not counted.
 */
import { traitStrength } from "./index";

type Effect = { vitality?: number; shield?: [chance: number, cut: number]; dodge?: number };

/** Full-strength armour effects, from each ore's wiki page (25 Oct 2026). */
export const ARMOUR_EFFECTS: Record<string, Effect> = {
  obsidian: { vitality: 0.3 },
  mythril: { vitality: 0.15 },
  "eye-ore": { vitality: -0.1 },
  darkryte: { dodge: 0.15 },
  graphite: { vitality: 0.05, shield: [0.2, 0.12] },
  etherealite: { vitality: 0.25 },
  duranite: { vitality: 0.2, shield: [0.25, 0.25] },
  mosasaursit: { vitality: 0.35 },
  "heart-of-the-island": { vitality: 0.15 },
  earthite: { vitality: 0.1 },
  "cyanite-jade": { vitality: 0.2 },
  "sealed-curse": { vitality: -0.2 },
  azuryxite: { vitality: 0.15, shield: [0.4, 0.3] }, // the wiki says "+15 extra health" under Vitality; read as +15%
  yin: { vitality: 0.08 },
  "yin-yang": { vitality: 0.08 },
  takenokoishi: { vitality: 0.15, shield: [0.7, 0.25] },
  kokorite: { vitality: -0.05 },
  "heavenly-orb": { vitality: 0.05, shield: [0.45, 0.3] },
  sentira: { vitality: 0.05, shield: [0.5, 0.5] },
  ceyite: { dodge: 0.4 },
  galaxite: { vitality: 0.08, shield: [0.5, 0.5] },
  "aether-lotus": { vitality: 0.3, shield: [0.6, 0.65] },
  vanegos: { vitality: -0.2 },
  kitsunite: { vitality: 0.25 },
};

export type ArmourOre = { id: string; multiplier: number; rarity: string };
export type ArmourScore = { multiplier: number; vitality: number; shieldChance: number; shieldCut: number; dodge: number; effectiveHealth: number };

export function armourScore(mix: { ore: ArmourOre; count: number }[]): ArmourScore {
  const total = mix.reduce((n, m) => n + m.count, 0);
  const multiplier = total ? mix.reduce((n, m) => n + m.ore.multiplier * m.count, 0) / total : 0;
  let vitality = 0, shieldChance = 0, shieldCut = 0, dodge = 0;
  for (const { ore, count } of mix) {
    const e = ARMOUR_EFFECTS[ore.id];
    if (!e || !total) continue;
    const s = traitStrength(count / total);
    if (!s) continue;
    vitality += (e.vitality ?? 0) * s;
    if (e.shield && e.shield[0] * e.shield[1] * s * s > shieldChance * shieldCut) { shieldChance = e.shield[0] * s; shieldCut = e.shield[1] * s; }
    if (e.dodge) dodge = Math.max(dodge, e.dodge * s);
  }
  const effectiveHealth = (multiplier * (1 + vitality)) / (1 - shieldChance * shieldCut) / (1 - dodge);
  return { multiplier, vitality, shieldChance, shieldCut, dodge, effectiveHealth };
}
