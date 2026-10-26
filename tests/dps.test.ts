import { describe, expect, it } from "vitest";
import { statAtShare, weaponDps } from "../lib/engine/dps";

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
    for (const level of [1, 5, 10]) {
      const m = 1 + 0.05 * level;
      const up = weaponDps({ ores, damage: 504.46 * m, interval: 0.51 });
      expect(up.total).toBeCloseTo(base.total * m, 6);
    }
  });
});
