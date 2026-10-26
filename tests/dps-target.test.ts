import { describe, expect, it } from "vitest";
import { dpsTarget, enhanceFactor } from "../lib/engine/dps-target";

const classes = [
  { name: "Dagger", probability: 60, variants: [
    { id: "d1", name: "Dagger A", overall: 40, dps: { total: 1000 } },
    { id: "d2", name: "Dagger B", overall: 20, dps: { total: 1500 } },
  ] },
  { name: "Mace", probability: 40, variants: [
    { id: "m1", name: "Mace A", overall: 30, dps: { total: 2000 } },
    { id: "m2", name: "Mace B", overall: 10, dps: { total: 3000 } },
  ] },
  { name: "Katana", probability: 0, variants: [{ id: "k1", name: "Katana", overall: 0, dps: { total: 9000 } }] },
];

describe("DPS target", () => {
  it("adds up the chances of every weapon that reaches the target", () => {
    const r = dpsTarget(classes, 1500);
    expect(r.chance).toBeCloseTo(0.6, 12); // Dagger B 20% + Mace A 30% + Mace B 10%
    expect(r.rows.map((x) => x.id)).toEqual(["m2", "m1", "d2", "d1"]); // best DPS first
    expect(r.rows.find((x) => x.id === "d1")!.hits).toBe(false);
  });

  it("leaves out classes and weapons this mix can't forge", () => {
    const r = dpsTarget(classes, 0);
    expect(r.rows.some((x) => x.id === "k1")).toBe(false);
    expect(r.chance).toBeCloseTo(1, 12);
    expect(r.best?.id).toBe("m2");
  });

  it("scales DPS by 5% per enhancement level", () => {
    expect(enhanceFactor(0)).toBe(1);
    expect(enhanceFactor(10)).toBeCloseTo(1.5, 12);
    expect(enhanceFactor(14)).toBeCloseTo(1.5, 12); // capped at +10
    // Dagger A (1,000) reaches 1,400 only at +8 (1,400) or above.
    expect(dpsTarget(classes, 1400, 7).rows.find((x) => x.id === "d1")!.hits).toBe(false);
    expect(dpsTarget(classes, 1400, 8).rows.find((x) => x.id === "d1")!.hits).toBe(true);
    expect(dpsTarget(classes, 1400, 8).chance).toBeCloseTo(1, 12);
  });

  it("is 0% when nothing reaches the target", () => {
    const r = dpsTarget(classes, 5000);
    expect(r.chance).toBe(0);
    expect(r.rows.every((x) => !x.hits)).toBe(true);
  });
});
