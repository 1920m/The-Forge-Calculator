import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import fixture from "./fixtures/wiki-dps-2026-11-12.json";
import type { Catalogue } from "../lib/engine/forge";
import { averageMultiplier, rawStat } from "../lib/engine/index";
import { rolledChance, weaponDps } from "../lib/engine/dps";
import { combatDps, golemiteHitShare } from "../lib/engine/loadout-dps";

/*
 * The wiki's DPS calculator matched an in-game test on 12 Nov 2026 (an Excalibur at +9 averaged 5,600 DPS with Human and
 * 7,400 with Kitsune; the wiki says 5,648 and 7,791), so the site follows it. These builds were run through the wiki's
 * calculator in the browser the same day (tests/fixtures/wiki-dps-2026-11-12.json); every DPS part must match.
 */
const cat = data as unknown as Catalogue;
const byName = new Map(cat.ores.map((o) => [o.name, o]));
const RACE: Record<string, string> = {
  Human: "human", Kitsune: "kitsune", Demon: "demon", Dragonborn: "dragonborn", Angel: "angel", Archangel: "archangel", "Orc Lord": "orc-lord",
  "Fallen Angel": "fallen-angel", Imp: "imp", Goblin: "goblin", Felynx: "felynx", Fairy: "fairy", Orc: "orc", Shadow: "shadow", Vampire: "vampire", Minotaur: "minotaur",
};
const PART: Record<string, string> = {
  Explosion: "explosion", Burn: "fire", Poison: "poison", Smite: "smite", "Black hole": "blackhole", Lightning: "lightning", Reverberation: "reverberation",
  "Frost Slash": "frost_slash", "Glacier Explosion": "glacier_explosion", Starfall: "starfall", "Stellar Mark": "stellar_mark", "Ancient Poison": "ancient_poison",
  "Fox Claws": "fox_claws", Foxfire: "foxfire", "Cursed Aura": "cursed_aura", "Black Halo": "dark_smite", "Trident Toss": "trident_toss",
  "Titanic Earthquake": "smash", "Archangel's Smite": "archangel_smite",
};
type Build = Omit<(typeof fixture.builds)[number], "armour"> & { armour?: [string, number][][]; expected: { total: number; hits: number; procs: Record<string, number>; lowHp?: number } };
const ores = (pairs: [string, number][]) => pairs.map(([n, count]) => ({ id: byName.get(n)!.id, count }));

function run(b: Build) {
  const w = cat.weapons.find((x) => x.id === b.ours)!;
  const mix = (b.ores as [string, number][]).map(([n, count]) => {
    const o = byName.get(n)!;
    return { ore: { slug: o.id, multiplier: o.multiplier, rarity: o.rarity, multiplierRule: o.rule === "average" ? ("average-other-ores" as const) : undefined }, count };
  });
  const raw = rawStat(w.baseDamage, averageMultiplier(mix)!, 1);
  return combatDps({
    level: b.lvl, raceId: b.race ? RACE[b.race] : null, armour: (b.armour ?? []).map((p) => ({ ores: ores(p) })),
    weapon: { ores: ores(b.ores as [string, number][]), raw, interval: w.trueSpeed, cls: b.cls },
  });
}

describe("DPS matches the wiki's calculator part by part", () => {
  for (const b of fixture.builds as unknown as Build[]) {
    it(`${b.id}: ${b.wiki.weapon} (${(b.ores as [string, number][]).map(([n, c]) => `${c} ${n}`).join(", ")})${b.race ? `, ${b.race}` : ""}, +${b.lvl}`, () => {
      const c = run(b);
      const names = (b.ores as [string, number][]).map(([n]) => n);
      // Where we knowingly differ from the wiki's calculator (docs/wiki-dps-comparison.md). Every other part must match.
      // - Burn and poison (and Ancient Poison, which builds on poison): we use the exact uptime for hits that land one
      //   swing at a time, 1 − (1 − chance)^(hits in the duration); the wiki uses load ÷ (1 + load ÷ 2).
      // - Bismuth: its crits are armour-only and Prismatic Shift is modelled from in-game tests (hits, explosion,
      //   lightning and foxfire change too), and its Resonance needs a 10%+ share, like Galaxite's black hole.
      const total = (b.ores as [string, number][]).reduce((n, [, c]) => n + c, 0);
      const pct = (n: string) => (b.ores as [string, number][]).filter(([x]) => x === n).reduce((a, [, c]) => a + c, 0) / total;
      const bismuth = names.includes("Bismuth");
      const differs = new Set<string>([
        "fire", "poison", "ancient_poison",
        ...(bismuth ? ["explosion", "lightning", "Prismatic Shift", "foxfire"] : []),
        ...((pct("Bismuth") > 0 && pct("Bismuth") < 0.1) || (pct("Galaxite") > 0 && pct("Galaxite") < 0.1) ? ["blackhole"] : []),
      ]);
      if (bismuth) expect(c.result.hit).toBeLessThan(b.expected.hits);
      else expect(c.result.hit).toBeCloseTo(b.expected.hits, 2);
      const ours: Record<string, number> = {};
      for (const p of c.result.parts) ours[PART[p.label] ?? p.label] = (ours[PART[p.label] ?? p.label] ?? 0) + p.dps;
      if (b.id === "imp") delete ours.fire; // Hellfire Prod's spear burn: ours only, the wiki leaves it out
      const keys = (o: Record<string, number>) => Object.keys(o).filter((k) => !differs.has(k)).sort();
      expect(keys(ours)).toEqual(keys(b.expected.procs));
      for (const k of keys(b.expected.procs)) expect(ours[k], k).toBeCloseTo(b.expected.procs[k], 2);
      if (b.expected.lowHp != null && !differs.size) expect(c.lowHp!).toBeCloseTo(b.expected.lowHp, 2);
    });
  }
});

/*
 * In-game tests on the test server, 12 Nov 2026: Human unless named, no armour, no runes, no Golemites, 100% quality,
 * average DPS on a dummy over a long run. Proc-heavy builds vary by several percent between runs.
 */
describe("what the in-game tests showed", () => {
  const ex = (fixture.builds as unknown as Build[]).find((b) => b.id === "exH0")!;
  const vooite = (count: number, bismuth = 0): Build => ({ ...ex, ores: [["Vooite", count], ...(bismuth ? [["Bismuth", bismuth]] : [])] } as unknown as Build);

  it("Excalibur of 50 Vooite (hits only): card 1,260 damage, 1,890 at +9; 898 DPS at +0 and 1,360 at +9", () => {
    const r0 = run(vooite(50)), r9 = run({ ...vooite(50), lvl: 9 });
    expect(r0.result.parts).toEqual([]);
    expect(r0.total).toBeCloseTo(898, -1);
    expect(Math.abs(r9.total / 1360 - 1)).toBeLessThan(0.02);
  });
  it("enhancement grows only the hits: procs are the same at +0 and +9", () => {
    const r0 = run(ex), r9 = run({ ...ex, lvl: 9 });
    expect(r9.result.hit / r0.result.hit).toBeCloseTo(1.5, 9);
    expect(r9.result.procs).toBeCloseTo(r0.result.procs, 9);
  });
  it("Excalibur (12 Kitsunite, 12 Galaxite, 12 Tetrinite, 4 Bismuth): close to the DPS measured at +0 and +9", () => {
    const measured: [string | null, number, number, number][] = [
      ["Human", 0, 4500, 0.12], ["Human", 9, 5600, 0.03], ["Kitsune", 0, 6686, 0.02], ["Kitsune", 9, 7400, 0.07],
    ];
    for (const [race, lvl, dps, tol] of measured) expect(Math.abs(run({ ...ex, race, lvl } as Build).total / dps - 1), `${race} +${lvl}`).toBeLessThan(tol);
    // If procs grew with enhancement as well, +9 would add about 2,400 DPS over +0; the game added about 1,100 (Human) and 700 (Kitsune).
    expect(run({ ...ex, lvl: 9 }).total - run(ex).total).toBeLessThan(1000);
  });
  it("its card's traits: +1.8% attack speed, +45% crit chance, +20% crit damage and no Lethality (Bismuth's are armour-only)", () => {
    const r = run(ex).result;
    expect(r.atkSpeed).toBeCloseTo(0.018, 9);
    expect(r.critChance).toBeCloseTo(0.45, 9);
    expect(r.critDamage).toBeCloseTo(0.2, 9);
    expect(r.lethality).toBe(0);
  });
  it("Bismuth's Prismatic Shift: Excaliburs of Vooite with 10% and 30% Bismuth did 1,328 and 1,585 DPS", () => {
    expect(Math.abs(run(vooite(45, 5)).total / 1328 - 1)).toBeLessThan(0.02);
    expect(Math.abs(run(vooite(35, 15)).total / 1585 - 1)).toBeLessThan(0.04);
    expect(run(vooite(45, 5)).result.parts.map((p) => p.label)).toEqual(["Prismatic Shift"]);
  });
  it("Bismuth below a 10% share has no traits: 4 Bismuth in 50 ores is the same as Vooite alone", () => {
    expect(run(vooite(46, 4)).total).toBeCloseTo(run(vooite(50)).total, 9);
    expect(run(vooite(45, 5)).result.atkSpeed).toBeCloseTo(0.018, 9);
  });
});

describe("game rules the wiki's calculator uses", () => {
  it("rolls proc chances on 101 sides: (⌊chance × 100⌋ + 1) ÷ 101", () => {
    expect(rolledChance(0.3)).toBeCloseTo(31 / 101, 12);
    expect(rolledChance(0.08)).toBeCloseTo(9 / 101, 12);
    expect(rolledChance(1)).toBe(1);
  });
  it("gives a black hole from 10% Galaxite, and Bismuth's wave with it from 10% Bismuth", () => {
    const bh = (galaxite: number, bismuth: number) =>
      weaponDps({ ores: [{ id: "galaxite", count: galaxite }, { id: "bismuth", count: bismuth }, { id: "iron", count: 20 - galaxite - bismuth }], damage: 100, interval: 1 }).parts.find((p) => p.label === "Black hole");
    expect(bh(1, 2)).toBeUndefined(); // 5% Galaxite: its trait is off, so no black hole and nothing for the wave
    const at = (dmg: number, r: number) => 100 * dmg / (1 + 1 / ((31 / 101) * r));
    const only = weaponDps({ ores: [{ id: "galaxite", count: 2 }, { id: "iron", count: 18 }], damage: 100, interval: 1 });
    expect(only.parts.find((p) => p.label === "Black hole")!.dps).toBeCloseTo(at(0.06, only.attacksPerSecond), 9); // 10%: 6%
    const small = weaponDps({ ores: [{ id: "galaxite", count: 2 }, { id: "bismuth", count: 1 }, { id: "iron", count: 17 }], damage: 100, interval: 1 });
    expect(small.parts.find((p) => p.label === "Black hole")!.dps).toBeCloseTo(at(0.06, small.attacksPerSecond), 9); // 5% Bismuth: no wave
    const wave = weaponDps({ ores: [{ id: "galaxite", count: 2 }, { id: "bismuth", count: 2 }, { id: "iron", count: 16 }], damage: 100, interval: 1 });
    expect(wave.parts.find((p) => p.label === "Black hole")!.dps).toBeCloseTo(at(0.06 + 1.25, wave.attacksPerSecond), 9);
  });
  it("keeps burn and poison up 1 − (1 − chance)^(hits in the duration) of the time, hits landing one swing at a time", () => {
    // 20 Fireite in 20: 20% (rolled 21/101) for 10% a second, 2 s; 1 hit a second, so 2 hits fall in any 2 s.
    const r = weaponDps({ ores: [{ id: "fireite", count: 20 }], damage: 100, interval: 1 });
    expect(r.parts.find((p) => p.label === "Burn")!.dps).toBeCloseTo(100 * 0.1 * (1 - Math.pow(1 - 21 / 101, 2)), 9);
    // 2.5 hits in the duration: half the time 2 hits, half the time 3.
    const h = weaponDps({ ores: [{ id: "fireite", count: 20 }], damage: 100, interval: 0.8 });
    expect(h.parts.find((p) => p.label === "Burn")!.dps).toBeCloseTo(100 * 0.1 * (1 - (0.5 * Math.pow(80 / 101, 2) + 0.5 * Math.pow(80 / 101, 3))), 9);
  });
  it("adds Golemite hits from level 13: 2% of weapon damage, 6% at 25, two hits every three seconds", () => {
    expect(golemiteHitShare(12)).toBe(0);
    expect(golemiteHitShare(13)).toBeCloseTo(0.02, 12);
    expect(golemiteHitShare(19)).toBeCloseTo(0.04, 12);
    expect(golemiteHitShare(25)).toBeCloseTo(0.06, 12);
    expect(golemiteHitShare(40)).toBeCloseTo(0.06, 12);
    const weapon = { ores: [{ id: "iron", count: 10 }], raw: 300, interval: 1, cls: "Mace" };
    const golem = (level: number) => ({ ores: [{ id: "iron", count: 10 }], traitScale: 0.06, level });
    const base = combatDps({ level: 9, weapon }).total;
    expect(combatDps({ level: 9, weapon, golems: [golem(25)] }).total - base).toBeCloseTo(300 * 0.06 * (2 / 3), 9); // before enhancement
    expect(combatDps({ level: 9, weapon, golems: [golem(10)] }).total).toBeCloseTo(base, 9);
  });
  it("merges runes into the ores' procs like the wiki's abilities", () => {
    const r = weaponDps({
      ores: [{ id: "galaxite", count: 5 }, { id: "kyubite", count: 5 }, { id: "fierce-jade", count: 5 }, { id: "bismuth", count: 1 }],
      damage: rawStat(10, (5 * 25 + 5 * 17 + 5 * 17) / 15, 1), enhance: 1.5, interval: 0.506, cls: "Gauntlets",
      extra: { procs: [
        { type: "explosion", chance: 0.5, dmg: 0.8, label: "Blast Chip" }, { type: "burn", chance: 0.75, dmg: 0.35, dur: 5, label: "Flame Spark" },
        { type: "poison", chance: 0.95, dmg: 0.2, dur: 14, label: "Venom Crumb" }, { type: "lightning", chance: 0.6, dmg: 1, cd: 2, label: "Thunder Shard" },
      ] },
    });
    // The wiki gives 4,464.075; ours differs in burn and poison uptime and in the black hole (1 Bismuth in 16 is under 10%).
    const labels = r.parts.map((p) => p.label);
    expect(labels).toEqual(expect.arrayContaining(["Explosion", "Burn", "Poison", "Black hole", "Lightning"]));
    const explosion = r.parts.find((p) => p.label === "Explosion")!.dps;
    const d = rawStat(10, (5 * 25 + 5 * 17 + 5 * 17) / 15, 1);
    expect(explosion).toBeCloseTo(d * 0.8 * (51 / 101) * r.attacksPerSecond, 9); // the rune's explosion, no ore explosions here
  });
});
