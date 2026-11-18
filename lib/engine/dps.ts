/**
 * Weapon DPS, including ore traits. Trait values come from the wiki's data (ore pages and Data:Ores.json); the rules
 * are worked out from the trait texts and checked against in-game tests. The wiki's calculator (MediaWiki:ForgeCalculator.js)
 * was the starting point, but in-game tests found it off in several places, so it is only a reference
 * (docs/dps-rules.md lists every rule and where it comes from). Covers what a forge result decides: the ores, the
 * weapon and its damage, plus runes when the player adds them (see `extra`).
 * Armour, race and conditions come in through `extra` (see lib/engine/loadout-dps.ts); achievements are not included.
 * Tested in game on 12 Nov 2026 (docs/wiki-dps-comparison.md): a hits-only Excalibur matches to 1% at +0 and +9, and
 * proc-heavy builds come within a few percent (an Excalibur at +9 averaged 5,600 DPS with Human; this gives 5,712).
 *
 * - Hits:      damage × enhancement × (1 + lethality) × crit blend × attacks per second
 * - Crit:      blend = chance × (1.45 + crit damage) + (1 − chance), chance capped at 100%
 * - Speed:     attacks per second = (1 + attack speed) ÷ swing time (the weapon's true swing time)
 * - Procs:     everything else (explosion, burn, poison, smite, black hole, lightning, the Version 1.10 ore effects,
 *              rune and race procs) is a share of the weapon's damage before enhancement: enhancement only grows hits.
 * - Chances:   proc chances are rolled the way the game does, on a 101-sided roll: (⌊chance × 100⌋ + 1) ÷ 101.
 * - Burn and poison: up 1 − (1 − chance)^(hits in the duration) of the time (hits land one swing at a time).
 * - Black hole and lightning: a chance on hit with a cooldown (1 s for black holes; lightning uses its ore's).
 *   Black holes need Galaxite's trait (a 10%+ share); Bismuth's 125% wave needs 10%+ Bismuth.
 * - Moon Stone's night bonus is shown separately. Below-35%-HP bonuses (berserk) are not counted.
 * - Bismuth's Prismatic Shift (on hit, a random attack rune effect for 10 s): see `PRISMATIC` below. The wiki's
 *   calculator splits each rune stat by 8 instead (and so gets a 0.375 s lightning cooldown); in game a 10% Bismuth
 *   Excalibur did 1,328 DPS where that gives 914 for its hits plus a few points.
 */
import stats from "@/data/dps-stats.json";

export type DpsStat =
  | "lethality" | "crit_chance" | "crit_dmg" | "atk_speed" | "moon" | "phys_dmg" | "berserk_duration"
  | "fire_dmg" | "fire_chance" | "fire_duration" | "explosion_dmg" | "explosion_chance"
  | "poison_dmg" | "poison_chance" | "poison_duration" | "smite_dmg" | "smite_chance"
  | "lightning_dmg" | "lightning_chance" | "lightning_cooldown" | "blackhole_dmg" | "blackhole_chance" | "resonance_dmg"
  | "frost_slash_dmg" | "frost_slash_chance" | "glacier_dmg" | "glacier_chance"
  | "starfall_dmg" | "starfall_chance" | "starfall_cooldown" | "stellar_mark_dmg"
  | "ancient_poison_dmg" | "ancient_poison_chance" | "ancient_poison_duration";
type Range = { base: number; max: number; ungated?: boolean; ceiling?: number; floor?: number };
export type OreDpsStats = Partial<Record<DpsStat, Range>>;

export const DPS_STATS = (stats as { ores: Record<string, OreDpsStats> }).ores;

const GATE = 0.1, TOP = 0.3;
const BASE_CRIT_DMG = 1.45;
const CAPS = { lethality: 3, crit_chance: 1, crit_dmg: 1, atk_speed: 1.5 };
const EXPLOSION_CAP = 2.5, SMITE_CAP = 2.5, MOON_CAP = 1.5;
const FIRE_TIME = [1, 5] as const, POISON_TIME = [1, 15] as const;
const BLACK_HOLE_CHANCE = 0.3, BLACK_HOLE_COOLDOWN = 1;
const BISMUTH_WAVE = 1.25; // Bismuth's Resonance: a rainbow wave of 125% weapon damage with each Galaxite black hole
const DEFAULT_LIGHTNING_COOLDOWN = 10;
const ROLL_SIDES = 101;
/** Echotite: share of hits that hit twice, by weapon class (8% for the rest). */
const REVERBERATION: Record<string, number> = { Dagger: 0.2, "Straight Sword": 0.16, Gauntlets: 0.12 };
const REVERBERATION_DEFAULT = 0.08;
const STARFALL_GALAXITE = 225 / 125; // "With Galaxite in the same weapon, this damage increases to 225%"
const STELLAR_MARK_HITS = 5;
/**
 * Bismuth's Prismatic Shift, on a weapon with a 10%+ share of Bismuth: "On hit, provides a random Attack Rune Effect for
 * 10 seconds". There are 7 weapon runes; 4 deal damage, rolled here at the middle of their tier III ranges (Runes page).
 * How often a hit gives one isn't published. Estimated from in-game tests on 12 Nov 2026 (Excaliburs of Vooite with 10%
 * and 30% Bismuth did 1,328 and 1,585 DPS; this gives 1,315 and 1,542): half of all hits give a random rune, and
 * different runes' effects can be up at once, so each rune is up 1 − (1 − 0.5 ÷ 7)^(hits in 10 s) of the time.
 */
const PRISMATIC = { trigger: 0.5, seconds: 10, runes: 7 } as const;
const PRISMATIC_RUNES: NonNullable<DpsExtra["procs"]> = [
  { label: "Prismatic Shift", type: "explosion", chance: 0.425, dmg: 0.7 }, // Explosion III: 35–50%, 60–80%
  { label: "Prismatic Shift", type: "burn", chance: 0.6, dmg: 0.265, dur: 4 }, // Burn III: 45–75%, 18–35%/s, 3–5 s
  { label: "Prismatic Shift", type: "poison", chance: 0.775, dmg: 0.165, dur: 12 }, // Poison III: 60–95%, 13–20%/s, 10–14 s
  { label: "Prismatic Shift", type: "lightning", chance: 0.475, dmg: 0.8, cd: 3 }, // Lightning III: 35–60%, 60–100%, 2–4 s
];

/** One ore's value for a stat at a share of the craft (0 below 10%, full from 30%). */
export { BLACK_HOLE_CHANCE, BISMUTH_WAVE, GATE as TRAIT_GATE };

export function statAtShare(r: Range, share: number): number {
  if (!r.ungated && share < GATE) return 0;
  let v = r.base + (r.max - r.base) * Math.min((share - GATE) / (TOP - GATE), 1);
  if (r.ceiling != null) v = Math.min(r.ceiling, v);
  if (r.floor != null) v = Math.max(r.floor, v);
  return v;
}

type CoreStat = "lethality" | "crit_chance" | "crit_dmg" | "atk_speed";

/** A race ability that deals damage of its own. Shares are of weapon damage; seconds for cooldowns and durations. */
export type SpecialProc = { label: string } & (
  | { type: "cooldown"; dmg: number; chance: number; cd: number } // chance on hit, then a cooldown (Orc Lord's slam, Archangel's beams)
  | { type: "spirits"; dmg: number; chance: number; max: number } // summons on hit, at most `max` a second (Kitsune's fox claws)
  | { type: "foxfire"; dmg: number; chance: number; dur: number } // damage over time that Lethality boosts (Kitsune's foxfire)
  | { type: "onhit"; dmg: number; chance: number } // a chance on every hit, no cooldown (Fallen Angel's Black Halo)
  | { type: "limited"; dmg: number; cd: number } // fires on a hit, at most once every `cd` seconds (Imp's Trident Toss)
  | { type: "golemite"; dmg: number; rate: number } // a fighting Golemite: a share of weapon damage per hit, `rate` hits a second
  | { type: "aura"; dmg: number }); // constant damage per second while fighting (Demon's cursed aura)

/** What's added to the weapon's own ore traits. Everything is optional; without it the result is the weapon alone. */
export type DpsExtra = {
  /** Rune secondary traits (best rolls), added to the ores' before the caps. */
  stats?: Partial<Record<CoreStat, number>>;
  /** Rune on-hit procs. Each rune is its own source. */
  procs?: ({ label: string; chance: number; dmg: number } & (
    | { type: "poison" | "burn"; dur: number } | { type: "explosion" } | { type: "lightning"; cd: number }))[];
  /** Stat values from armour and race, already scaled by share, treated exactly like extra weapon ores (same sums, maxes and caps). */
  vals?: Partial<Record<DpsStat, number[]>>;
  /** Added after the caps: race exceptions (Kitsune, Fairy) and conditional effects. */
  uncapped?: Partial<Record<CoreStat, number>>;
  /** Multiplies fire, poison, black hole and lightning damage (Vital Power). Default 1. */
  dotMultiplier?: number;
  /** Race abilities with damage of their own. */
  specials?: SpecialProc[];
};
/**
 * `damage`: the weapon's damage before enhancement. `enhance`: the enhancement multiplier (1 at +0), which only grows
 * hits. `cls`: the weapon's class, for effects that depend on it (Echotite's Reverberation); without it the default is used.
 */
export type DpsInput = { ores: { id: string; count: number }[]; damage: number; enhance?: number; interval: number; cls?: string; extra?: DpsExtra };

/** A proc chance as the game rolls it: one of 101 outcomes, so 30% is 31 in 101. */
export function rolledChance(chance: number): number {
  if (!(chance > 0)) return 1 / ROLL_SIDES;
  return Math.min(1, (Math.floor(Math.round(chance * 100 * 100) / 100) + 1) / ROLL_SIDES);
}
export type DpsResult = {
  total: number; hit: number; procs: number;
  /** The part that grows with enhancement: hits and Echotite's repeated hits. The rest (procs) uses +0 damage. */
  scaling: number;
  parts: { label: string; dps: number }[];
  attacksPerSecond: number; lethality: number; critChance: number; critDamage: number; atkSpeed: number;
  night: number | null;
};

/** DPS at an enhancement multiplier, from a result worked out at +0 (enhance 1): only hits and their repeats grow. */
export const atEnhancement = (r: Pick<DpsResult, "total" | "scaling">, k: number) => r.scaling * k + (r.total - r.scaling);

/** Weapon DPS. With 10%+ Bismuth, Prismatic Shift's average is added as its own part. */
export function weaponDps(input: DpsInput): DpsResult {
  const plain = traitDps(input);
  const total = input.ores.reduce((n, o) => n + o.count, 0);
  const bismuth = input.ores.filter((o) => o.id === "bismuth").reduce((n, o) => n + o.count, 0);
  if (!total || bismuth / total < GATE || !(plain.attacksPerSecond > 0)) return plain;
  const up = 1 - Math.pow(1 - PRISMATIC.trigger / PRISMATIC.runes, plain.attacksPerSecond * PRISMATIC.seconds);
  // Every mix of the damage runes being up or not, weighted by how likely it is.
  let expected = 0;
  for (let mask = 0; mask < 1 << PRISMATIC_RUNES.length; mask++) {
    const on = PRISMATIC_RUNES.filter((_, i) => mask & (1 << i));
    const weight = PRISMATIC_RUNES.reduce((w, _, i) => w * (mask & (1 << i) ? up : 1 - up), 1);
    expected += weight * (on.length ? traitDps({ ...input, extra: { ...input.extra, procs: [...(input.extra?.procs ?? []), ...on] } }).total : plain.total);
  }
  const shift = expected - plain.total;
  if (!(shift > 0)) return plain;
  return { ...plain, total: plain.total + shift, procs: plain.procs + shift, parts: [...plain.parts, { label: "Prismatic Shift", dps: shift }], night: plain.night != null ? plain.night + shift : null };
}

function traitDps({ ores, damage, enhance = 1, interval, cls, extra }: DpsInput): DpsResult {
  const total = ores.reduce((n, o) => n + o.count, 0);
  const share = (id: string) => (total ? ores.filter((o) => o.id === id).reduce((n, o) => n + o.count, 0) / total : 0);
  const has = (id: string) => ores.some((o) => o.id === id && o.count > 0);
  // Rune procs join the ores' pools, the same as the wiki's "abilities": damage adds up, the best chance is used.
  const runeVals: Partial<Record<DpsStat, number[]>> = {};
  const addRune = (stat: DpsStat, v: number) => { (runeVals[stat] ??= []).push(v); };
  for (const r of extra?.procs ?? []) {
    if (r.type === "explosion") { addRune("explosion_dmg", r.dmg); addRune("explosion_chance", r.chance); }
    else if (r.type === "lightning") { addRune("lightning_dmg", r.dmg); addRune("lightning_chance", r.chance); addRune("lightning_cooldown", r.cd); }
    else { const k = r.type === "burn" ? "fire" : "poison"; addRune(`${k}_dmg`, r.dmg); addRune(`${k}_chance`, r.chance); addRune(`${k}_duration`, r.dur); }
  }
  const vals = (stat: DpsStat) => [...ores.flatMap((o) => {
    const r = DPS_STATS[o.id]?.[stat];
    if (!r || !total) return [];
    const sh = o.count / total;
    return !r.ungated && sh < GATE ? [] : [statAtShare(r, sh)];
  }), ...(extra?.vals?.[stat] ?? []).filter((v) => v !== 0), ...(runeVals[stat] ?? [])];
  const sum = (s: DpsStat) => vals(s).reduce((a, v) => a + v, 0);
  const max = (s: DpsStat) => Math.max(0, ...vals(s));
  const minPositive = (s: DpsStat) => { const v = vals(s).filter((x) => x > 0); return v.length ? Math.min(...v) : 0; };

  // Rune secondary traits add to the ores' before the caps; race exceptions and conditions come after them.
  const add = extra?.stats ?? {};
  const over = extra?.uncapped ?? {};
  const lethality = Math.min(sum("lethality") + (add.lethality ?? 0), CAPS.lethality) + (over.lethality ?? 0);
  const critChance = Math.min(sum("crit_chance") + (add.crit_chance ?? 0), CAPS.crit_chance) + (over.crit_chance ?? 0);
  const critDamage = Math.min(sum("crit_dmg") + (add.crit_dmg ?? 0), CAPS.crit_dmg) + (over.crit_dmg ?? 0);
  const atkSpeed = Math.min(sum("atk_speed") + (add.atk_speed ?? 0), CAPS.atk_speed) + (over.atk_speed ?? 0);
  const rate = interval > 0 ? (1 + atkSpeed) / interval : 0;
  const hitCrit = Math.min(critChance, 1); // a hit can't crit more than every time
  const blend = hitCrit * (BASE_CRIT_DMG + critDamage) + (1 - hitCrit);
  const dotK = extra?.dotMultiplier ?? 1;
  const roll = (s: DpsStat) => rolledChance(max(s));

  // A chance on hit followed by a cooldown: the average time between procs is the cooldown plus the wait for the next one.
  // (Timing it to whole swings, so the wait is the first hit after the cooldown, fit the in-game tests worse.)
  const cooldownRate = (chance: number, cd: number) => (chance > 0 && rate > 0 ? 1 / (cd + 1 / (chance * rate)) : 0);
  // Burn and poison: up when any hit in the last `dur` seconds applied it. Hits land one swing at a time, so that's
  // floor(n) or floor(n) + 1 hits (n = hits per second × duration), each applying it with its chance. (The wiki's
  // calculator uses load ÷ (1 + load ÷ 2) instead, a smooth stand-in for the same thing.)
  const uptime = (chance: number, dur: number) => {
    const n = rate * dur, k = Math.floor(n), f = n - k, miss = 1 - chance;
    return 1 - ((1 - f) * Math.pow(miss, k) + f * Math.pow(miss, k + 1));
  };
  const duration = (s: DpsStat, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, max(s)));
  const dot = (dmgStat: DpsStat, chanceStat: DpsStat, durStat: DpsStat, range: readonly [number, number]) => {
    const dmg = sum(dmgStat);
    return rate && dmg > 0 ? dotK * damage * dmg * uptime(roll(chanceStat), duration(durStat, range)) : 0;
  };

  const hit = damage * enhance * (1 + lethality) * blend * rate;
  const poison = dot("poison_dmg", "poison_chance", "poison_duration", POISON_TIME);
  // Black hole: Galaxite's trait (a 10%+ share, like every trait) gives a 30% chance; a Golemite's black hole brings its
  // own, scaled chance. Bismuth's Resonance (also from a 10%+ share: an in-game card with 8% Bismuth lists no Bismuth
  // traits) adds a 125% wave to a Galaxite black hole.
  const oreBlackHole = ores.some((o) => o.id === "galaxite" && total > 0 && o.count / total >= GATE);
  const blackHoleChance = oreBlackHole ? BLACK_HOLE_CHANCE : max("blackhole_chance");
  const blackHoleDmg = sum("blackhole_dmg") + (oreBlackHole && share("bismuth") >= GATE ? BISMUTH_WAVE : 0) + sum("resonance_dmg");
  const lightningDmg = sum("lightning_dmg");
  // Echotite at a 10%+ share: some hits land twice (damage only, so the repeat is a share of the hits' DPS).
  const echo = share("echotite") >= GATE ? rolledChance(cls != null ? REVERBERATION[cls] ?? REVERBERATION_DEFAULT : REVERBERATION_DEFAULT) : 0;
  const starfallDmg = sum("starfall_dmg"), starfallCd = minPositive("starfall_cooldown");
  // Ancient Poison: while the mark is up, poison deals more. The mark lasts `duration` and is put back on hit by chance.
  const ancient = sum("ancient_poison_dmg");
  const markUp = rate && ancient > 0 ? 1 - Math.pow(1 - roll("ancient_poison_chance"), rate * max("ancient_poison_duration")) : 0;
  const explosionDmg = Math.min(EXPLOSION_CAP, sum("explosion_dmg"));
  const smiteDmg = Math.min(SMITE_CAP, sum("smite_dmg"));
  const frostSlash = sum("frost_slash_dmg"), glacier = sum("glacier_dmg");
  const parts = [
    { label: "Explosion", dps: explosionDmg > 0 ? damage * explosionDmg * roll("explosion_chance") * rate : 0 },
    { label: "Burn", dps: dot("fire_dmg", "fire_chance", "fire_duration", FIRE_TIME) },
    { label: "Poison", dps: poison },
    { label: "Smite", dps: smiteDmg > 0 ? damage * rate * smiteDmg * roll("smite_chance") : 0 },
    { label: "Black hole", dps: blackHoleChance > 0 && blackHoleDmg > 0 ? dotK * damage * blackHoleDmg * cooldownRate(rolledChance(blackHoleChance), BLACK_HOLE_COOLDOWN) : 0 },
    { label: "Lightning", dps: lightningDmg > 0 ? dotK * damage * lightningDmg * cooldownRate(roll("lightning_chance"), minPositive("lightning_cooldown") || DEFAULT_LIGHTNING_COOLDOWN) : 0 },
    { label: "Reverberation", dps: hit * echo },
    { label: "Frost Slash", dps: frostSlash > 0 ? damage * frostSlash * roll("frost_slash_chance") * rate : 0 },
    { label: "Glacier Explosion", dps: glacier > 0 ? damage * glacier * roll("glacier_chance") * hitCrit * rate : 0 },
    { label: "Starfall", dps: starfallDmg > 0 && starfallCd > 0 ? damage * starfallDmg * (has("galaxite") ? STARFALL_GALAXITE : 1) * cooldownRate(roll("starfall_chance"), starfallCd) : 0 },
    { label: "Stellar Mark", dps: damage * sum("stellar_mark_dmg") * rate / STELLAR_MARK_HITS },
    { label: "Ancient Poison", dps: poison * ancient * markUp },
    // Race abilities and fighting Golemites. Lethality only boosts foxfire ("of your Total Damage"); the others are
    // shares of weapon damage.
    ...(extra?.specials ?? []).map((s) => ({
      label: s.label,
      dps: s.type === "cooldown" ? damage * s.dmg * cooldownRate(Math.min(s.chance, 1), s.cd)
        : s.type === "spirits" ? damage * s.dmg * Math.min(Math.min(s.chance, 1) * rate, s.max)
        : s.type === "foxfire" ? damage * (1 + lethality) * s.dmg * (1 - Math.exp(-Math.min(s.chance, 1) * rate * s.dur))
        : s.type === "onhit" ? damage * s.dmg * rolledChance(s.chance) * rate
        : s.type === "limited" ? damage * s.dmg * Math.min(rate, 1 / s.cd)
        : s.type === "golemite" ? damage * s.dmg * s.rate
        : damage * s.dmg,
    })),
  ].filter((p) => p.dps > 0);
  const procs = parts.reduce((a, p) => a + p.dps, 0);
  const scaling = hit + hit * echo;

  const moon = Math.min(MOON_CAP, sum("moon"));
  return {
    total: hit + procs, hit, procs, scaling, parts,
    attacksPerSecond: rate, lethality, critChance, critDamage, atkSpeed,
    night: moon > 0 ? hit * (1 + moon) + procs : null,
  };
}
