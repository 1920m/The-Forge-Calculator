/**
 * Weapon DPS, including ore traits. A port of the community DPS calculator on the wiki
 * (MediaWiki:ForgeCalculator.js, with the stat ranges from Data:Ores.json), limited to what a forge
 * result decides: the ores, the weapon and its damage, plus runes when the player adds them (see `extra`).
 * Armour, race and conditions come in through `extra` (see lib/engine/loadout-dps.ts); achievements are not included.
 *
 * - Hits:      damage × (1 + lethality) × crit blend × attacks per second
 * - Crit:      blend = chance × (1.45 + crit damage) + (1 − chance), chance capped at 100%
 * - Speed:     attacks per second = (1 + attack speed) ÷ swing time (the weapon's true swing time)
 * - Procs:     explosion, smite, black hole and lightning add a share of weapon damage per hit;
 *              burn and poison add damage per second while they are up.
 * - Version 1.10 ore effects (7 Nov 2026), as the wiki models them: Echotite's Reverberation repeats a share of hits
 *   (by weapon class), Frost Star's Frost Slash, Glacier Explosion (on crits), Starfall (×1.8 with Galaxite) and
 *   Stellar Mark (every 5 hits), and Tetrinite's Ancient Poison (more poison damage while the mark is up).
 * - Moon Stone's night bonus is shown separately. Below-35%-HP bonuses (berserk) are not counted.
 */
import stats from "@/data/dps-stats.json";

export type DpsStat =
  | "lethality" | "crit_chance" | "crit_dmg" | "atk_speed" | "moon" | "phys_dmg" | "berserk_duration"
  | "fire_dmg" | "fire_chance" | "fire_duration" | "explosion_dmg" | "explosion_chance"
  | "poison_dmg" | "poison_chance" | "poison_duration" | "smite_dmg" | "smite_chance"
  | "lightning_dmg" | "lightning_chance" | "lightning_cooldown" | "blackhole_dmg"
  | "frost_slash_dmg" | "frost_slash_chance" | "glacier_dmg" | "glacier_chance"
  | "starfall_dmg" | "starfall_chance" | "starfall_cooldown" | "stellar_mark_dmg"
  | "ancient_poison_dmg" | "ancient_poison_chance" | "ancient_poison_duration";
type Range = { base: number; max: number; ungated?: boolean; ceiling?: number; floor?: number };
export type OreDpsStats = Partial<Record<DpsStat, Range>>;

export const DPS_STATS = (stats as { ores: Record<string, OreDpsStats> }).ores;

const GATE = 0.1, TOP = 0.3;
const BASE_CRIT_DMG = 1.45;
const CAPS = { lethality: 3, crit_chance: 1, crit_dmg: 1, atk_speed: 1.5 };
const EXPLOSION_CAP = 2.5, SMITE_CAP = 2.5, DOT_TIME_CAP = 5;
const BLACK_HOLE_CHANCE = 0.3;
/** Echotite: share of hits that hit twice, by weapon class (8% for the rest). */
const REVERBERATION: Record<string, number> = { Dagger: 0.2, "Straight Sword": 0.16, Gauntlets: 0.12 };
const REVERBERATION_DEFAULT = 0.08;
const STARFALL_GALAXITE = 225 / 125; // "With Galaxite in the same weapon, this damage increases to 225%"
const STELLAR_MARK_HITS = 5;

/** One ore's value for a stat at a share of the craft (0 below 10%, full from 30%). */
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
/** `cls`: the weapon's class, for effects that depend on it (Echotite's Reverberation); without it the default is used. */
export type DpsInput = { ores: { id: string; count: number }[]; damage: number; interval: number; cls?: string; extra?: DpsExtra };
export type DpsResult = {
  total: number; hit: number; procs: number;
  parts: { label: string; dps: number }[];
  attacksPerSecond: number; lethality: number; critChance: number; critDamage: number; atkSpeed: number;
  night: number | null;
};

export function weaponDps({ ores, damage, interval, cls, extra }: DpsInput): DpsResult {
  const total = ores.reduce((n, o) => n + o.count, 0);
  const vals = (stat: DpsStat) => [...ores.flatMap((o) => {
    const r = DPS_STATS[o.id]?.[stat];
    if (!r || !total) return [];
    const share = o.count / total;
    return !r.ungated && share < GATE ? [] : [statAtShare(r, share)];
  }), ...(extra?.vals?.[stat] ?? []).filter((v) => v !== 0)];
  const sum = (s: DpsStat, cap = Infinity) => vals(s).reduce((a, v) => a + Math.min(cap, v), 0);
  const max = (s: DpsStat) => Math.max(0, ...vals(s));
  const minPositive = (s: DpsStat) => { const v = vals(s); return v.length ? Math.min(...v) : 0; };

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

  // Damage over time: refreshed by hits, so it is up for a share of the time.
  const dot = (dmg: number, chance: number, dur: number) => (rate ? damage * dmg * Math.min(1, chance * rate * Math.min(dur, DOT_TIME_CAP)) : 0);
  const fireDur = Math.max(max("fire_duration") - 1, 0);
  const poisonDur = Math.max(max("poison_duration") - 2, 0);
  const lightningCd = minPositive("lightning_cooldown");
  const hasGalaxite = ores.some((o) => o.id === "galaxite" && total > 0 && o.count / total >= GATE);
  // With Bismuth in the craft, each black hole also sends a rainbow wave of 125% weapon damage.
  const blackHoleDmg = sum("blackhole_dmg") + (hasGalaxite && ores.some((o) => o.id === "bismuth") ? 1.25 : 0);

  const hit = damage * (1 + lethality) * blend * rate;
  // A chance on hit followed by a cooldown: the average time between procs is the cooldown plus the wait for the next one.
  const cooldownRate = (chance: number, cd: number) => (chance > 0 && rate > 0 ? 1 / (cd + 1 / (Math.min(chance, 1) * rate)) : 0);
  const poison = dotK * dot(sum("poison_dmg"), max("poison_chance"), poisonDur);
  // Echotite at a 10%+ share: some hits land twice (damage only, so the repeat is a share of the hits' DPS).
  const echo = ores.some((o) => o.id === "echotite" && total > 0 && o.count / total >= GATE) ? (cls != null ? REVERBERATION[cls] ?? REVERBERATION_DEFAULT : REVERBERATION_DEFAULT) : 0;
  const starfallCd = minPositive("starfall_cooldown");
  // Ancient Poison: while the mark is up, poison deals more. The mark lasts `duration` and is put back on hit by chance.
  const markUp = rate ? 1 - Math.pow(1 - Math.min(max("ancient_poison_chance"), 1), rate * max("ancient_poison_duration")) : 0;
  const parts = [
    { label: "Explosion", dps: damage * sum("explosion_dmg", EXPLOSION_CAP) * max("explosion_chance") * rate },
    { label: "Burn", dps: dotK * dot(sum("fire_dmg"), max("fire_chance"), fireDur) },
    { label: "Poison", dps: poison },
    { label: "Smite", dps: damage * rate * Math.min(SMITE_CAP, sum("smite_dmg")) * Math.min(max("smite_chance"), 1) },
    { label: "Black hole", dps: hasGalaxite ? dotK * damage * blackHoleDmg * BLACK_HOLE_CHANCE * Math.max(1, rate) : 0 },
    { label: "Lightning", dps: rate ? dotK * damage * sum("lightning_dmg") * max("lightning_chance") * (lightningCd > 0 ? Math.min(rate, 1 / lightningCd) : rate) : 0 },
    { label: "Reverberation", dps: hit * echo },
    { label: "Frost Slash", dps: damage * sum("frost_slash_dmg") * Math.min(max("frost_slash_chance"), 1) * rate },
    { label: "Glacier Explosion", dps: damage * sum("glacier_dmg") * Math.min(max("glacier_chance"), 1) * hitCrit * rate },
    { label: "Starfall", dps: starfallCd > 0 ? damage * sum("starfall_dmg") * (ores.some((o) => o.id === "galaxite" && o.count > 0) ? STARFALL_GALAXITE : 1) * cooldownRate(max("starfall_chance"), starfallCd) : 0 },
    { label: "Stellar Mark", dps: damage * sum("stellar_mark_dmg") * rate / STELLAR_MARK_HITS },
    { label: "Ancient Poison", dps: poison * sum("ancient_poison_dmg") * markUp },
    // Rune procs: each rune is its own source (copies of a rune add up), worked out like the ore procs above.
    ...(extra?.procs ?? []).map((r) => ({
      label: r.label,
      dps: r.type === "explosion" ? damage * r.dmg * Math.min(r.chance, 1) * rate
        : r.type === "lightning" ? (rate ? dotK * damage * r.dmg * Math.min(r.chance, 1) * Math.min(rate, 1 / r.cd) : 0)
        : dotK * dot(r.dmg, r.chance, r.dur),
    })),
    // Race abilities. Lethality only boosts foxfire ("of your Total Damage"); the others are shares of weapon damage.
    ...(extra?.specials ?? []).map((s) => ({
      label: s.label,
      dps: s.type === "cooldown" ? damage * s.dmg * cooldownRate(s.chance, s.cd)
        : s.type === "spirits" ? damage * s.dmg * Math.min(Math.min(s.chance, 1) * rate, s.max)
        : s.type === "foxfire" ? damage * (1 + lethality) * s.dmg * (1 - Math.exp(-Math.min(s.chance, 1) * rate * s.dur))
        : s.type === "onhit" ? damage * s.dmg * Math.min(s.chance, 1) * rate
        : s.type === "limited" ? damage * s.dmg * Math.min(rate, 1 / s.cd)
        : damage * s.dmg,
    })),
  ].filter((p) => p.dps > 0);
  const procs = parts.reduce((a, p) => a + p.dps, 0);

  const moon = sum("moon");
  return {
    total: hit + procs, hit, procs, parts,
    attacksPerSecond: rate, lethality, critChance, critDamage, atkSpeed,
    night: moon > 0 ? hit * (1 + moon) + procs : null,
  };
}
