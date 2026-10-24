import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import type { Catalogue } from "../lib/engine/forge";
import { applyOreFilter, multiplierBounds, oreCategory } from "../lib/ore-filter";

const cat = data as unknown as Catalogue;
const w4 = cat.ores.filter((o) => o.worlds.includes(4));

describe("ore filter", () => {
  it("sorts by highest and lowest multiplier", () => {
    const high = applyOreFilter(w4, { sort: "high", range: null });
    const low = applyOreFilter(w4, { sort: "low", range: null });
    expect(high[0].multiplier).toBeGreaterThanOrEqual(high[high.length - 1].multiplier);
    expect(low[0].multiplier).toBeLessThanOrEqual(low[low.length - 1].multiplier);
    expect(high[0].name).toBe("Kitsunite");
  });
  it("best for armour keeps only armour-trait ores, highest first", () => {
    const list = applyOreFilter(w4, { sort: "armour", range: null });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((o) => oreCategory(o).armour)).toBe(true);
    expect(list.map((o) => o.name)).toContain("Lucky Cat");
    expect(list.map((o) => o.name)).not.toContain("Sun Stone");
  });
  it("best for weapons keeps only weapon-trait ores", () => {
    const list = applyOreFilter(w4, { sort: "weapon", range: null });
    expect(list.every((o) => oreCategory(o).weapon)).toBe(true);
    expect(list.map((o) => o.name)).toContain("Sun Stone");
  });
  it("puts every ore in weapon, armour or no-trait (ores with both count for both)", () => {
    for (const o of cat.ores) { const c = oreCategory(o); expect(c.weapon || c.armour || c.none).toBe(true); }
    expect(oreCategory(cat.ores.find((o) => o.name === "Sealed Curse")!)).toMatchObject({ weapon: true, armour: true });
    expect(oreCategory(cat.ores.find((o) => o.name === "Roosite")!).none).toBe(true);
  });
  it("keeps only ores inside the multiplier range, on the chosen world's ores", () => {
    const [min, max] = multiplierBounds(w4);
    expect(min).toBeLessThan(max);
    const list = applyOreFilter(w4, { sort: null, range: [10, 15] });
    expect(list.every((o) => o.multiplier >= 10 && o.multiplier <= 15)).toBe(true);
    expect(list.every((o) => o.worlds.includes(4))).toBe(true);
  });
});
