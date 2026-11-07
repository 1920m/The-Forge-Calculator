/**
 * Full-loadout DPS: a weapon with its runes, the three armour pieces and a race, plus optional conditions.
 * It doesn't do any damage maths itself. It turns armour, race and conditions into `weaponDps` inputs (one engine
 * for the Calculator, Forger cards, Loadout and shared profiles) and works out what each layer adds.
 *
 * Layers, each on top of the ones before: base weapon → its ore traits → enhancement → runes → armour → Golemites (their
 * weapon and armour traits) → race.
 * Bonuses add up before the caps and then multiply, so each layer's share is the difference it makes at that point.
 * Conditions (below 35% HP, Orc Lord stacks, Dryad grove, max health, Kitsune after a dodge) are never in the
 * normal DPS; they make a separate scenario.
 */
import { ARMOUR_DPS } from "@/data/armour-dps";
import { raceById } from "@/data/races";
import { enhanceFactor } from "./index";
import { DPS_STATS, statAtShare, weaponDps, type DpsExtra, type DpsResult, type DpsStat, type SpecialProc } from "./dps";
import { runeTotals, slotsAt, type RuneSlot } from "./runes";

type OreCount = { id: string; count: number };
type CoreStat = "lethality" | "crit_chance" | "crit_dmg" | "atk_speed";

export type CombatConditions = {
  /** Below 35% HP: armour Berserker and Minotaur's Bull's Fury (which starts below 50%). */
  lowHp?: boolean;
  /** Orc Lord's Warbringer: share of health missing, 0 to 1. */
  orcLordMissingHp?: number;
  /** Orc Lord's Lord of War kill stacks, 0 to 5. */
  orcLordKills?: number;
  /** Dryad: standing in your Healing Grove. */
  dryadGrove?: boolean;
  /** Your max health, for Vital Power (Dryad, Bismuth armour). */
  maxHp?: number;
  /** Kitsune: just dodged, so Kitsune's Trickery is doubled. */
  kitsuneDodge?: boolean;
};

export type CombatInput = {
  weapon: { ores: OreCount[]; raw: number; interval: number; cls: string };
  /** Enhancement level used for damage (and which rune slots are open). */
  level: number;
  runes?: readonly (RuneSlot | null)[];
  /** Ore mixes of the equipped helmet, chestplate and leggings (missing pieces as null). */
  armour?: readonly ({ ores: OreCount[] } | null)[];
  raceId?: string | null;
  /** Equipped Golemites: their ores and their rarity's trait scale (their ore traits work for the player). */
  golems?: readonly GolemInput[];
  conditions?: CombatConditions;
};

export type GolemInput = { ores: OreCount[]; traitScale: number } | null;

export type LayerKey = "base" | "ores" | "enhance" | "runes" | "armour" | "golems" | "race";
export const LAYER_LABEL: Record<LayerKey, string> = { base: "Base weapon", ores: "Weapon ore traits", enhance: "Enhancement", runes: "Runes", armour: "Armour traits", golems: "Golemite traits", race: "Race" };

export type CombatResult = {
  /** Normal DPS: everything always active. */
  total: number;
  result: DpsResult;
  /** What each layer adds, in order. They add up to `total`. */
  breakdown: { key: LayerKey; label: string; dps: number }[];
  /** DPS below 35% HP (Berserker, Bull's Fury), when the build has any. */
  lowHp: number | null;
  /** DPS with the chosen conditions on, when any are chosen. */
  conditional: number | null;
  /** Armour and race effects that were counted, for the page to list. */
  counted: string[];
  /** For each Golemite passed in: whether any of its traits changed the DPS. */
  golemsCounted: boolean[];
};

const push = (vals: Partial<Record<DpsStat, number[]>>, stat: DpsStat, v: number) => { if (v) (vals[stat] ??= []).push(v); };
const merge = (a: DpsExtra, b: DpsExtra): DpsExtra => {
  const vals: Partial<Record<DpsStat, number[]>> = { ...a.vals };
  for (const [k, v] of Object.entries(b.vals ?? {}) as [DpsStat, number[]][]) vals[k] = [...(vals[k] ?? []), ...v];
  const uncapped: Partial<Record<CoreStat, number>> = { ...a.uncapped };
  for (const [k, v] of Object.entries(b.uncapped ?? {}) as [CoreStat, number][]) uncapped[k] = (uncapped[k] ?? 0) + v;
  return { stats: a.stats ?? b.stats, procs: [...(a.procs ?? []), ...(b.procs ?? [])], vals, uncapped, specials: [...(a.specials ?? []), ...(b.specials ?? [])], dotMultiplier: (a.dotMultiplier ?? 1) * (b.dotMultiplier ?? 1) };
};

/** Armour traits that change weapon damage, each piece scaled by its own ore shares, then added together. */
export function armourExtra(pieces: readonly ({ ores: OreCount[] } | null)[]) {
  const vals: Partial<Record<DpsStat, number[]>> = {};
  let lowHp = 0;
  const vital: VitalPower[] = [];
  const counted = new Set<string>();
  for (const piece of pieces) {
    if (!piece) continue;
    const total = piece.ores.reduce((n, o) => n + o.count, 0);
    if (!total) continue;
    for (const o of piece.ores) {
      const a = ARMOUR_DPS[o.id];
      const share = o.count / total;
      if (!a || share < 0.1) continue;
      const at = (full: number) => statAtShare({ base: full / 10, max: full }, share);
      for (const [stat, full] of Object.entries(a.stats ?? {}) as [DpsStat, number][]) push(vals, stat, at(full));
      if (a.lowHp) lowHp += at(a.lowHp);
      if (a.vitalPower) vital.push({ share, ...a.vitalPower });
      counted.add(o.id);
    }
  }
  return { extra: { vals } as DpsExtra, lowHp, vital, counted: [...counted] };
}

type VitalPower = { share: number; perHp: number; step: number; max: number; /** a Golemite's rarity trait scale */ scale?: number };

// Durations and cooldowns keep the ore's own value; the Golemite's rarity scales the amounts (the same as its card).
const UNSCALED = new Set<DpsStat>(["fire_duration", "poison_duration", "lightning_cooldown", "berserk_duration"]);

/**
 * Equipped Golemites' ore traits, which the player gets: weapon and armour traits alike. Each ore counts at its share of
 * the Golemite (10% to 30% rule), times the Golemite's rarity trait scale. Weapon traits are treated like extra weapon
 * ores, armour traits like another armour piece (same sums, maxes and caps).
 */
export function golemExtra(golems: readonly GolemInput[]) {
  const vals: Partial<Record<DpsStat, number[]>> = {};
  let lowHp = 0;
  const vital: VitalPower[] = [];
  const used = golems.map((g) => {
    if (!g || !(g.traitScale > 0)) return false;
    const total = g.ores.reduce((n, o) => n + o.count, 0);
    if (!total) return false;
    let any = false;
    for (const o of g.ores) {
      const share = o.count / total;
      // Weapon traits
      const ranges = DPS_STATS[o.id];
      for (const [stat, r] of Object.entries(ranges ?? {}) as [DpsStat, NonNullable<NonNullable<typeof ranges>[DpsStat]>][]) {
        const v = statAtShare(r, share) * (UNSCALED.has(stat) ? 1 : g.traitScale);
        if (v) { push(vals, stat, v); if (!UNSCALED.has(stat)) any = true; }
      }
      // Armour traits. Many ores have one trait for weapons and armour alike, which both tables list; it's already
      // counted above, so only what the weapon table doesn't have is added (Bismuth's crits, Demonite's burn, armour-only
      // Berserker such as Vanegos's).
      const a = ARMOUR_DPS[o.id];
      if (!a || share < 0.1) continue;
      const at = (full: number) => statAtShare({ base: full / 10, max: full }, share);
      for (const [stat, full] of Object.entries(a.stats ?? {}) as [DpsStat, number][]) {
        if (ranges?.[stat]) continue;
        push(vals, stat, at(full) * (UNSCALED.has(stat) ? 1 : g.traitScale));
        if (!UNSCALED.has(stat)) any = true;
      }
      if (a.lowHp && !ranges?.phys_dmg) { lowHp += at(a.lowHp) * g.traitScale; any = true; }
      if (a.vitalPower) { vital.push({ share, scale: g.traitScale, ...a.vitalPower }); any = true; }
    }
    return any;
  });
  return { extra: { vals } as DpsExtra, lowHp, vital, used };
}

/** A race's always-on effects for a weapon class. Unknown or missing races add nothing. */
export function raceExtra(raceId: string | null | undefined, cls: string): { extra: DpsExtra; lowHp: number } {
  const c = raceId ? raceById.get(raceId)?.combat : undefined;
  if (!c) return { extra: {}, lowHp: 0 };
  const vals: Partial<Record<DpsStat, number[]>> = {};
  const uncapped: Partial<Record<CoreStat, number>> = {};
  const addStats = (s: { lethality?: number; atk_speed?: number } | undefined) => { push(vals, "lethality", s?.lethality ?? 0); push(vals, "atk_speed", s?.atk_speed ?? 0); };
  const addUncapped = (s: Partial<Record<CoreStat, number>> | undefined) => { for (const [k, v] of Object.entries(s ?? {}) as [CoreStat, number][]) uncapped[k] = (uncapped[k] ?? 0) + v; };
  addStats(c.stats);
  addUncapped(c.uncapped);
  for (const b of c.classes ?? []) if (b.classes.includes(cls)) { addStats(b.stats); addUncapped(b.uncapped); }
  if (c.burn) { push(vals, "fire_dmg", c.burn.dmg); push(vals, "fire_chance", c.burn.chance ?? 0); push(vals, "fire_duration", c.burn.dur); }
  if (c.smite) { push(vals, "smite_dmg", c.smite.dmg); push(vals, "smite_chance", c.smite.chance); }
  return { extra: { vals, uncapped, specials: (c.specials ?? []) as SpecialProc[] }, lowHp: c.lowHp ?? 0 };
}

/** Low-health and situational bonuses, as uncapped additions (applied on top of the normal build). */
function conditionExtra(cond: CombatConditions, raceId: string | null | undefined, armourLowHp: number, raceLowHp: number,
  vital: VitalPower[]): DpsExtra {
  const uncapped: Partial<Record<CoreStat, number>> = {};
  const add = (k: CoreStat, v: number) => { if (v) uncapped[k] = (uncapped[k] ?? 0) + v; };
  if (cond.lowHp) add("lethality", Math.min(armourLowHp, 2) + raceLowHp); // the wiki caps ore Berserker at 200%
  let dotMultiplier = 1;
  if (raceId === "orc-lord") {
    add("lethality", Math.floor(Math.min(1, Math.max(0, cond.orcLordMissingHp ?? 0)) * 10 + 1e-6) * 0.075);
    add("atk_speed", Math.min(5, Math.max(0, Math.floor(cond.orcLordKills ?? 0))) * 0.075);
  }
  if (raceId === "dryad" && cond.dryadGrove) { add("crit_chance", 0.15); add("crit_dmg", 0.15); }
  if (raceId === "kitsune" && cond.kitsuneDodge) { add("lethality", 0.2); add("atk_speed", 0.2); add("crit_dmg", 0.15); }
  const hp = Math.max(0, cond.maxHp ?? 0);
  if (hp > 0) {
    if (raceId === "dryad") dotMultiplier += Math.min(10, Math.floor(hp / 1000)) * 0.05;
    for (const v of vital) dotMultiplier += Math.min(v.max, Math.floor(hp / v.step) * v.perHp) * statAtShare({ base: 0.1, max: 1 }, v.share) * (v.scale ?? 1);
  }
  return { uncapped, dotMultiplier };
}

const anyCondition = (c: CombatConditions | undefined) =>
  !!c && (!!c.lowHp || !!c.dryadGrove || !!c.kitsuneDodge || (c.orcLordMissingHp ?? 0) > 0 || (c.orcLordKills ?? 0) > 0 || (c.maxHp ?? 0) > 0);

export function combatDps(input: CombatInput): CombatResult {
  const { weapon, level } = input;
  const damage = weapon.raw * enhanceFactor(level);
  const t = input.runes ? runeTotals(input.runes, slotsAt(level)) : null;
  const runeExtra: DpsExtra = t ? { stats: t.stats, procs: t.procs } : {};
  const armour = armourExtra(input.armour ?? []);
  const golems = golemExtra(input.golems ?? []);
  const race = raceExtra(input.raceId, weapon.cls);
  const worn = merge(merge(runeExtra, armour.extra), golems.extra);
  const full = merge(worn, race.extra);
  const run = (ores: OreCount[], dmg: number, extra?: DpsExtra) => weaponDps({ ores, damage: dmg, interval: weapon.interval, extra });

  const steps: [LayerKey, DpsResult][] = [
    ["base", run([], weapon.raw)],
    ["ores", run(weapon.ores, weapon.raw)],
    ["enhance", run(weapon.ores, damage)],
    ["runes", run(weapon.ores, damage, runeExtra)],
    ["armour", run(weapon.ores, damage, merge(runeExtra, armour.extra))],
    // Only when Golemites are equipped, so results without them (and the public API) keep the same layers.
    ...((input.golems ?? []).some(Boolean) ? [["golems", run(weapon.ores, damage, worn)] as [LayerKey, DpsResult]] : []),
    ["race", run(weapon.ores, damage, full)],
  ];
  const breakdown = steps.map(([key, r], i) => ({ key, label: LAYER_LABEL[key], dps: r.total - (i ? steps[i - 1][1].total : 0) }));
  const result = steps[steps.length - 1][1];

  const wornLowHp = armour.lowHp + golems.lowHp;
  const lowHpSources = wornLowHp + race.lowHp;
  const lowHp = lowHpSources > 0 ? run(weapon.ores, damage, merge(full, conditionExtra({ lowHp: true }, input.raceId, wornLowHp, race.lowHp, []))).total : null;
  const conditional = anyCondition(input.conditions)
    ? run(weapon.ores, damage, merge(full, conditionExtra(input.conditions!, input.raceId, wornLowHp, race.lowHp, [...armour.vital, ...golems.vital]))).total
    : null;

  const raceName = input.raceId ? raceById.get(input.raceId)?.name : undefined;
  return { total: result.total, result, breakdown, lowHp, conditional, golemsCounted: golems.used, counted: [...armour.counted, ...(raceName && input.raceId && raceById.get(input.raceId)?.combat ? [raceName] : [])] };
}
