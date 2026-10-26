import { describe, expect, it } from "vitest";
import { averageTries, chanceWithin, triesFor } from "../lib/engine/odds";
import { RACES, RACE_RARITIES } from "../data/races";

describe("how many tries", () => {
  it("averages 1 ÷ p", () => {
    expect(averageTries(0.02)).toBeCloseTo(50, 9);
    expect(averageTries(0.0025)).toBeCloseTo(400, 9);
    expect(averageTries(1)).toBe(1);
    expect(averageTries(0)).toBe(Infinity);
  });

  it("gives the chance of at least one hit in n tries", () => {
    expect(chanceWithin(0.5, 1)).toBeCloseTo(0.5, 12);
    expect(chanceWithin(0.5, 2)).toBeCloseTo(0.75, 12);
    expect(chanceWithin(0.02, 50)).toBeCloseTo(1 - 0.98 ** 50, 12); // ≈ 63.6%, not 100%
    expect(chanceWithin(0.02, 0)).toBe(0);
    expect(chanceWithin(1, 1)).toBe(1);
  });

  it("finds the fewest tries for a target chance", () => {
    // 2%: half of players by 35 forges, 9 in 10 by 114.
    expect(triesFor(0.02, 0.5)).toBe(35);
    expect(triesFor(0.02, 0.9)).toBe(114);
    // Exact whole-number answers are not pushed up by rounding noise.
    expect(triesFor(0.5, 0.5)).toBe(1);
    expect(triesFor(0.5, 0.75)).toBe(2);
    expect(triesFor(1, 0.99)).toBe(1);
    expect(triesFor(0, 0.5)).toBe(Infinity);
  });

  it("agrees with chanceWithin: n reaches the target and n − 1 does not", () => {
    for (const p of [0.001, 0.0025, 0.0125, 0.04, 0.075, 0.115, 0.3505, 0.8]) {
      for (const c of [0.5, 0.75, 0.9, 0.99]) {
        const n = triesFor(p, c);
        expect(chanceWithin(p, n)).toBeGreaterThanOrEqual(c - 1e-12);
        if (n > 1) expect(chanceWithin(p, n - 1)).toBeLessThan(c);
      }
    }
  });
});

describe("race data", () => {
  it("has every race once and the chances add up to 100%", () => {
    expect(new Set(RACES.map((r) => r.id)).size).toBe(RACES.length);
    expect(RACES.reduce((a, r) => a + r.chance, 0)).toBeCloseTo(100, 9);
    for (const r of RACES) expect(RACE_RARITIES).toContain(r.rarity);
  });
  it("gives the expected numbers for a Mythical race", () => {
    const demon = RACES.find((r) => r.id === "demon")!;
    const p = demon.chance / 100;
    expect(averageTries(p)).toBeCloseTo(400, 9);
    expect(triesFor(p, 0.9)).toBe(920); // ln(0.1) ÷ ln(0.9975) = 919.9
    expect(chanceWithin(p, 10)).toBeCloseTo(1 - 0.9975 ** 10, 12);
  });
});
