/**
 * Weapon DPS, including ore traits. A port of the community DPS calculator on the wiki
 * (MediaWiki:ForgeCalculator.js, with the stat ranges from Data:Ores.json), limited to what a forge
 * result decides: the ores, the weapon and its damage. Race, runes, achievements and armour are not included.
 *
 * - Hits:      damage × (1 + lethality) × crit blend × attacks per second
 * - Crit:      blend = chance × (1.45 + crit damage) + (1 − chance), chance capped at 100%
 * - Speed:     attacks per second = (1 + attack speed) ÷ swing time (the weapon's true swing time)
 * - Procs:     explosion, smite, black hole and lightning add a share of weapon damage per hit;
 *              burn and poison add damage per second while they are up.
 * - Moon Stone's night bonus is shown separately. Below-35%-HP bonuses (berserk) are not counted.
 */
import stats from "@/data/dps-stats.json";

export type DpsStat =
  | "lethality" | "crit_chance" | "crit_dmg" | "atk_speed" | "moon" | "phys_dmg" | "berserk_duration"
  | "fire_dmg" | "fire_chance" | "fire_duration" | "explosion_dmg" | "explosion_chance"
  | "poison_dmg" | "poison_chance" | "poison_duration" | "smite_dmg" | "smite_chance"
  | "lightning_dmg" | "lightning_chance" | "lightning_cooldown" | "blackhole_dmg";
type Range = { base: number; max: number; ungated?: boolean; ceiling?: number; floor?: number };
export type OreDpsStats = Partial<Record<DpsStat, Range>>;

export const DPS_STATS = (stats as { ores: Record<string, OreDpsStats> }).ores;

const GATE = 0.1, TOP = 0.3;
const BASE_CRIT_DMG = 1.45;
const CAPS = { lethality: 3, crit_chance: 1, crit_dmg: 1, atk_speed: 1.5 };
const EXPLOSION_CAP = 2.5, SMITE_CAP = 2.5, DOT_TIME_CAP = 5;
const BLACK_HOLE_CHANCE = 0.3;

/** One ore's value for a stat at a share of the craft (0 below 10%, full from 30%). */
export function statAtShare(r: Range, share: number): number {
  if (!r.ungated && share < GATE) return 0;
  let v = r.base + (r.max - r.base) * Math.min((share - GATE) / (TOP - GATE), 1);
  if (r.ceiling != null) v = Math.min(r.ceiling, v);
  if (r.floor != null) v = Math.max(r.floor, v);
  return v;
}

export type DpsInput = { ores: { id: string; count: number }[]; damage: number; interval: number };
export type DpsResult = {
  total: number; hit: number; procs: number;
  parts: { label: string; dps: number }[];
  attacksPerSecond: number; lethality: number; critChance: number; critDamage: number; atkSpeed: number;
  night: number | null;
};

export function weaponDps({ ores, damage, interval }: DpsInput): DpsResult {
  const total = ores.reduce((n, o) => n + o.count, 0);
  const vals = (stat: DpsStat) => ores.flatMap((o) => {
    const r = DPS_STATS[o.id]?.[stat];
    if (!r || !total) return [];
    const share = o.count / total;
    return !r.ungated && share < GATE ? [] : [statAtShare(r, share)];
  });
  const sum = (s: DpsStat, cap = Infinity) => vals(s).reduce((a, v) => a + Math.min(cap, v), 0);
  const max = (s: DpsStat) => Math.max(0, ...vals(s));
  const minPositive = (s: DpsStat) => { const v = vals(s); return v.length ? Math.min(...v) : 0; };

  const lethality = Math.min(sum("lethality"), CAPS.lethality);
  const critChance = Math.min(sum("crit_chance"), CAPS.crit_chance);
  const critDamage = Math.min(sum("crit_dmg"), CAPS.crit_dmg);
  const atkSpeed = Math.min(sum("atk_speed"), CAPS.atk_speed);
  const rate = interval > 0 ? (1 + atkSpeed) / interval : 0;
  const blend = critChance * (BASE_CRIT_DMG + critDamage) + (1 - critChance);

  // Damage over time: refreshed by hits, so it is up for a share of the time.
  const dot = (dmg: number, chance: number, dur: number) => (rate ? damage * dmg * Math.min(1, chance * rate * Math.min(dur, DOT_TIME_CAP)) : 0);
  const fireDur = Math.max(max("fire_duration") - 1, 0);
  const poisonDur = Math.max(max("poison_duration") - 2, 0);
  const lightningCd = minPositive("lightning_cooldown");
  const hasGalaxite = ores.some((o) => o.id === "galaxite" && total > 0 && o.count / total >= GATE);
  // With Bismuth in the craft, each black hole also sends a rainbow wave of 125% weapon damage.
  const blackHoleDmg = sum("blackhole_dmg") + (hasGalaxite && ores.some((o) => o.id === "bismuth") ? 1.25 : 0);

  const hit = damage * (1 + lethality) * blend * rate;
  const parts = [
    { label: "Explosion", dps: damage * sum("explosion_dmg", EXPLOSION_CAP) * max("explosion_chance") * rate },
    { label: "Burn", dps: dot(sum("fire_dmg"), max("fire_chance"), fireDur) },
    { label: "Poison", dps: dot(sum("poison_dmg"), max("poison_chance"), poisonDur) },
    { label: "Smite", dps: damage * rate * Math.min(SMITE_CAP, sum("smite_dmg")) * Math.min(max("smite_chance"), 1) },
    { label: "Black hole", dps: hasGalaxite ? damage * blackHoleDmg * BLACK_HOLE_CHANCE * Math.max(1, rate) : 0 },
    { label: "Lightning", dps: rate ? damage * sum("lightning_dmg") * max("lightning_chance") * (lightningCd > 0 ? Math.min(rate, 1 / lightningCd) : rate) : 0 },
  ].filter((p) => p.dps > 0);
  const procs = parts.reduce((a, p) => a + p.dps, 0);

  const moon = sum("moon");
  return {
    total: hit + procs, hit, procs, parts,
    attacksPerSecond: rate, lethality, critChance, critDamage, atkSpeed,
    night: moon > 0 ? hit * (1 + moon) + procs : null,
  };
}
