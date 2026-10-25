import { describe, expect, it } from "vitest";
import { armourScore } from "../lib/engine/armour";

const o = (id: string, multiplier: number) => ({ id, multiplier, rarity: "Epic" });

describe("armour score", () => {
  it("is just the multiplier with no armour traits", () => {
    expect(armourScore([{ ore: o("iron", 2), count: 10 }]).effectiveHealth).toBeCloseTo(2, 9);
  });

  it("adds Vitality, the best shield and the best dodge, scaled by share", () => {
    // 50% Aether Lotus (18x, +30% Vitality, 60% chance to cut 65%) and 50% Ceyite (16.5x, 40% dodge), both at full strength.
    const a = armourScore([{ ore: o("aether-lotus", 18), count: 10 }, { ore: o("ceyite", 16.5), count: 10 }]);
    expect(a.multiplier).toBeCloseTo(17.25, 9);
    expect(a.vitality).toBeCloseTo(0.3, 9);
    expect(a.effectiveHealth).toBeCloseTo((17.25 * 1.3) / (1 - 0.6 * 0.65) / (1 - 0.4), 9);
  });

  it("gives no trait under a 10% share", () => {
    expect(armourScore([{ ore: o("obsidian", 2.35), count: 1 }, { ore: o("iron", 2.35), count: 19 }]).vitality).toBe(0);
  });
});
