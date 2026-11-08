import { describe, expect, it } from "vitest";
import { statAtShare, weaponDps } from "../lib/engine/dps";
import { enhanceFactor } from "../lib/engine";

// Expected values come from running the wiki's own DPS calculator (MediaWiki:ForgeCalculator.js) on the same builds.
describe("weapon DPS", () => {
  it("matches the wiki calculator: Hachiwari with Sun Stone, Yeti Heart, Golem Heart, Meteorite", () => {
    const r = weaponDps({ ores: [{ id: "sun-stone", count: 2 }, { id: "yeti-heart", count: 2 }, { id: "golem-heart", count: 1 }, { id: "meteorite", count: 2 }], damage: 179.52, interval: 0.7 });
    expect(r.hit).toBeCloseTo(346.0079, 3);
    expect(r.total).toBeCloseTo(441.6339, 3);
  });

  it("matches the wiki calculator: Excalibur with Kitsunite, Galaxite, Fichilliumorite (every proc type)", () => {
    const r = weaponDps({ ores: [{ id: "kitsunite", count: 20 }, { id: "galaxite", count: 15 }, { id: "fichilliumorite", count: 15 }], damage: 1585.7142857142856, interval: 1.4 });
    const part = (l: string) => r.parts.find((p) => p.label === l)?.dps ?? 0;
    expect(r.hit).toBeCloseTo(1463.9541, 3);
    expect(part("Explosion")).toBeCloseTo(317.1429, 3);
    expect(part("Burn")).toBeCloseTo(634.2857, 3);
    expect(part("Smite")).toBeCloseTo(283.1633, 3);
    expect(part("Black hole")).toBeCloseTo(285.4286, 3);
    expect(part("Lightning")).toBeCloseTo(253.7143, 3);
    expect(r.total).toBeCloseTo(3237.6888, 3);
  });

  it("matches the wiki calculator: poison and attack speed builds", () => {
    expect(weaponDps({ ores: [{ id: "malachite", count: 5 }, { id: "fierce-jade", count: 4 }, { id: "yin-yang", count: 3 }], damage: 199.04166666666669, interval: 0.69 }).total).toBeCloseTo(632.95, 2);
    expect(weaponDps({ ores: [{ id: "galaxite", count: 3 }, { id: "wolfarite", count: 3 }, { id: "kyubite", count: 3 }], damage: 383.2, interval: 0.51 }).total).toBeCloseTo(1910.0874, 3);
  });

  it("ignores traits under a 10% share and is plain damage ÷ swing time with none", () => {
    expect(weaponDps({ ores: [{ id: "rivalite", count: 1 }, { id: "iron", count: 20 }], damage: 100, interval: 0.5 }).total).toBeCloseTo(200, 6);
    expect(statAtShare({ base: 0.02, max: 0.2 }, 0.2)).toBeCloseTo(0.11, 6);
    expect(statAtShare({ base: 0.02, max: 0.2 }, 0.5)).toBeCloseTo(0.2, 6);
  });
});

describe("DPS and enhancement", () => {
  it("rises by exactly the enhancement multiplier, procs included", () => {
    // Kitsunite + Galaxite: crits, burn, smite, explosion, lightning and black holes all active.
    const ores = [{ id: "kitsunite", count: 5 }, { id: "galaxite", count: 5 }, { id: "fichilliumorite", count: 4 }];
    const base = weaponDps({ ores, damage: 504.46, interval: 0.51 });
    expect(base.parts.length).toBeGreaterThan(3);
    for (const level of [1, 5, 9]) {
      const m = enhanceFactor(level);
      const up = weaponDps({ ores, damage: 504.46 * m, interval: 0.51 });
      expect(up.total).toBeCloseTo(base.total * m, 6);
    }
  });
});

/*
 * Version 1.10 ores against the wiki's calculator of 7 Nov 2026 (22:52), same builds at 100% quality, +0. Hits and
 * Stellar Mark match exactly. The chance-based effects use the plain chance where the wiki rolls it up
 * ((floor(chance × 100) + 1) ÷ 101: 20% → 20.8%, 8% → 8.9%), the same as every other proc on the site; the wiki's
 * numbers are in the comments.
 */
describe("Version 1.10 ores", () => {
  const part = (r: ReturnType<typeof weaponDps>, label: string) => r.parts.find((p) => p.label === label)?.dps ?? 0;
  const one = (id: string, count: number, damage: number, interval: number, cls?: string) => weaponDps({ ores: [{ id, count }], damage, interval, cls });

  it("Echotite: Reverberation repeats 20% of dagger hits, 16% of straight sword, 12% of gauntlet, 8% of the rest", () => {
    const dagger = one("echotite", 3, 4.3 * 22 * 2, 0.47, "Dagger"); // wiki: hits 402.5532, Reverberation 83.6992
    expect(dagger.hit).toBeCloseTo(402.5532, 3);
    for (const [cls, chance] of [["Dagger", 0.2], ["Straight Sword", 0.16], ["Gauntlets", 0.12], ["Mace", 0.08], [undefined, 0.08]] as const) {
      const r = one("echotite", 3, 100, 0.5, cls);
      expect(part(r, "Reverberation")).toBeCloseTo(r.hit * chance, 9);
    }
    // Below a 10% share it does nothing.
    expect(part(weaponDps({ ores: [{ id: "echotite", count: 1 }, { id: "iron", count: 10 }], damage: 100, interval: 0.5, cls: "Dagger" }), "Reverberation")).toBe(0);
  });
  it("Tetrinite: Ancient Poison adds up to 50% to poison while its mark is up", () => {
    const r = one("tetrinite", 14, 7 * 23.5 * 2, 1.17); // wiki: poison 131.6, Ancient Poison 62.5393
    expect(part(r, "Poison")).toBeCloseTo(131.6, 3);
    const markUp = 1 - Math.pow(0.5, r.attacksPerSecond * 5);
    expect(part(r, "Ancient Poison")).toBeCloseTo(131.6 * 0.5 * markUp, 6);
  });
  it("Frost Core: +15% Lethality and +10% crit damage", () => {
    expect(one("frost-core", 14, 10 * 22.75 * 2, 0.51).total).toBeCloseTo(1025.9804, 3);
  });
  it("Frost Star: Frost Slash, Glacier Explosion on crits, Starfall (×1.8 with Galaxite) and Stellar Mark", () => {
    const r = one("frost-star", 19, 20 * 27.75 * 2, 1.4); // wiki: 832.9955 + Frost Slash 62.359 + Starfall 83.7402 + Stellar Mark 243.8036
    expect(r.hit).toBeCloseTo(832.9955, 3);
    expect(part(r, "Stellar Mark")).toBeCloseTo(243.8036, 3);
    expect(part(r, "Frost Slash")).toBeCloseTo(1110 * 0.25 * 0.3 * r.attacksPerSecond, 6);
    expect(part(r, "Glacier Explosion")).toBe(0); // no crit chance, so no glacier explosions
    const rate = r.attacksPerSecond;
    expect(part(r, "Starfall")).toBeCloseTo(1110 * 1.25 / (10 + 1 / (0.2 * rate)), 6);
    const gal = weaponDps({ ores: [{ id: "frost-star", count: 10 }, { id: "galaxite", count: 9 }], damage: 20 * 26.3289 * 2, interval: 1.4 });
    expect(part(gal, "Stellar Mark")).toBeGreaterThan(0);
    expect(part(gal, "Glacier Explosion")).toBeCloseTo(gal.parts.length && 20 * 26.3289 * 2 * 0.65 * 0.5 * Math.min(gal.critChance, 1) * gal.attacksPerSecond, 6);
    const noGal = weaponDps({ ores: [{ id: "frost-star", count: 10 }, { id: "iron", count: 9 }], damage: 20 * 26.3289 * 2, interval: 1.4 });
    // Same Starfall share, ×1.8 with Galaxite (speed differs a little with Galaxite's stats, so compare per proc).
    const perProc = (x: typeof gal) => part(x, "Starfall") * (10 + 1 / (0.2 * x.attacksPerSecond));
    expect(perProc(gal) / perProc(noGal)).toBeCloseTo(1.8, 9);
  });
});
