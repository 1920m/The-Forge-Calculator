import { describe, expect, it } from "vitest";
import { rolledChance, statAtShare, weaponDps } from "../lib/engine/dps";
import { enhanceFactor } from "../lib/engine";

// Builds checked against the wiki's own calculator are in tests/wiki-dps.test.ts; these are the rules on their own.
describe("weapon DPS", () => {
  it("ignores traits under a 10% share and is plain damage ÷ swing time with none", () => {
    expect(weaponDps({ ores: [{ id: "rivalite", count: 1 }, { id: "iron", count: 20 }], damage: 100, interval: 0.5 }).total).toBeCloseTo(200, 6);
    expect(statAtShare({ base: 0.02, max: 0.2 }, 0.2)).toBeCloseTo(0.11, 6);
    expect(statAtShare({ base: 0.02, max: 0.2 }, 0.5)).toBeCloseTo(0.2, 6);
  });
});

describe("DPS and enhancement", () => {
  it("multiplies the hits by the enhancement and leaves every proc as it is (tested in game, 12 Nov 2026)", () => {
    // Kitsunite + Galaxite: crits, burn, smite, explosion, lightning and black holes all active.
    const ores = [{ id: "kitsunite", count: 5 }, { id: "galaxite", count: 5 }, { id: "fichilliumorite", count: 4 }];
    const base = weaponDps({ ores, damage: 504.46, interval: 0.51 });
    expect(base.parts.length).toBeGreaterThan(3);
    for (const level of [1, 5, 9]) {
      const up = weaponDps({ ores, damage: 504.46, enhance: enhanceFactor(level), interval: 0.51 });
      expect(up.hit).toBeCloseTo(base.hit * enhanceFactor(level), 6);
      expect(up.procs).toBeCloseTo(base.procs, 6);
    }
  });
});

describe("Version 1.10 ores", () => {
  const part = (r: ReturnType<typeof weaponDps>, label: string) => r.parts.find((p) => p.label === label)?.dps ?? 0;
  const one = (id: string, count: number, damage: number, interval: number, cls?: string) => weaponDps({ ores: [{ id, count }], damage, interval, cls });

  it("Echotite: Reverberation repeats 20% of dagger hits, 16% of straight sword, 12% of gauntlet, 8% of the rest (rolled)", () => {
    for (const [cls, chance] of [["Dagger", 0.2], ["Straight Sword", 0.16], ["Gauntlets", 0.12], ["Mace", 0.08], [undefined, 0.08]] as const) {
      const r = one("echotite", 3, 100, 0.5, cls);
      expect(part(r, "Reverberation")).toBeCloseTo(r.hit * rolledChance(chance), 9);
    }
    // Below a 10% share it does nothing.
    expect(part(weaponDps({ ores: [{ id: "echotite", count: 1 }, { id: "iron", count: 10 }], damage: 100, interval: 0.5, cls: "Dagger" }), "Reverberation")).toBe(0);
  });
  it("Tetrinite: Ancient Poison adds up to 50% to poison while its mark is up", () => {
    const r = one("tetrinite", 14, 100, 1);
    const markUp = 1 - Math.pow(1 - 51 / 101, r.attacksPerSecond * 5);
    expect(part(r, "Ancient Poison")).toBeCloseTo(part(r, "Poison") * 0.5 * markUp, 9);
  });
  it("Frost Star: Starfall is ×1.8 with any Galaxite in the weapon, and Glacier Explosion needs crits", () => {
    expect(part(one("frost-star", 19, 100, 1.4), "Glacier Explosion")).toBe(0); // no crit chance of its own
    const gal = weaponDps({ ores: [{ id: "frost-star", count: 10 }, { id: "galaxite", count: 9 }], damage: 100, interval: 1.4 });
    const noGal = weaponDps({ ores: [{ id: "frost-star", count: 10 }, { id: "iron", count: 9 }], damage: 100, interval: 1.4 });
    const perProc = (x: typeof gal) => part(x, "Starfall") * (10 + 1 / (rolledChance(0.2) * x.attacksPerSecond));
    expect(perProc(gal) / perProc(noGal)).toBeCloseTo(1.8, 9);
    expect(part(gal, "Glacier Explosion")).toBeGreaterThan(0);
  });
});
