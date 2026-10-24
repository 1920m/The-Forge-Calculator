import { describe, expect, it } from "vitest";
import { averageMultiplier, primaryOre, traitStrength, scaledEffect, rawStat, stat, enhancementTable, variantOdds, classOdds, type Ingredient, type CategoryRow } from "../lib/engine";
import armourEvidence from "./fixtures/cris-dark-knight.json";
import weaponEvidence from "./fixtures/cris-hachiwari.json";

const ingredient = (slug: string, multiplier: number, count: number, rarity = "Legendary"): Ingredient => ({ ore: { slug, multiplier, rarity }, count });
const darkKnight = [ingredient("sun-stone", 13.39, 9), ingredient("lucky-cat", 11.1, 8), ingredient("sealed-curse", 12, 8), ingredient("roosite", 14, 5)];
const hachiwari = [ingredient("sun-stone", 13.39, 2), ingredient("yeti-heart", 6, 2, "Mythic"), ingredient("golem-heart", 8.5, 1, "Divine"), ingredient("meteorite", 14.44, 2, "Mythic")];

describe("golden in-game examples and exact arithmetic", () => {
  it("reproduces Hachiwari multiplier, damage, primary ore, and rarity", () => {
    const multiplier = averageMultiplier(hachiwari)!;
    expect(hachiwari.map(({ ore, count }) => ({ slug: ore.slug, count }))).toEqual(weaponEvidence.recipe);
    expect(multiplier).toBeCloseTo(10.88, 12);
    expect(multiplier.toFixed(2)).toBe(weaponEvidence.displayedMultiplier);
    expect(stat(8.25, multiplier, 1, "weapon")).toBe(weaponEvidence.displayedDamage);
    expect(primaryOre(hachiwari)).toMatchObject({ slug: "meteorite", rarity: weaponEvidence.rarity });
  });
  it("preserves Dark Knight precision, matching the displayed multiplier and whole-number card", () => {
    const multiplier = averageMultiplier(darkKnight)!;
    expect(multiplier).toBeCloseTo(375.31 / 30, 12);
    expect(darkKnight.map(({ ore, count }) => ({ slug: ore.slug, count }))).toEqual(armourEvidence.recipe);
    expect(multiplier.toFixed(2)).toBe(armourEvidence.displayedMultiplier);
    expect(stat(25, multiplier, 1, "armour")).toBe(armourEvidence.displayedDefence);
  });
  it("matches Shogun's displayed multiplier and implied quality without rounding the mix", () => {
    const mix = [ingredient("meteorite", 14.44, 4), ingredient("roosite", 14, 12), ingredient("heat-steel", 11.5, 12), ingredient("sakurite", 14.2, 13)];
    const multiplier = averageMultiplier(mix)!;
    expect(multiplier.toFixed(3)).toBe("13.375");
    const quality = 803 / (2 * 36 * multiplier);
    expect(quality * 100).toBeCloseTo(83.4, 1);
    expect(stat(36, multiplier, quality, "armour")).toBe(803);
  });
  it("shows whole-number armour enhancements under Cris's updated rounding rule", () => {
    const raw = rawStat(25, averageMultiplier(darkKnight)!, 1);
    const levels = enhancementTable(raw, "armour");
    expect(levels[0].stat).toBe(626);
    expect(levels[1].stat).toBe(657);
    expect(levels[10].stat).toBe(938);
  });
});

describe("traits and rounding boundaries", () => {
  it("activates exactly at 10% and caps at 30%", () => {
    expect(traitStrength(0.099999)).toBe(0);
    expect(traitStrength(0.1)).toBeCloseTo(0.1);
    expect(traitStrength(0.2)).toBeCloseTo(0.55);
    expect(traitStrength(0.3)).toBe(1);
    expect(traitStrength(1)).toBe(1);
  });
  it("scales negative effects with the same factor", () => {
    expect(scaledEffect(-10, 0.2)).toBeCloseTo(-5.5);
    expect(scaledEffect(15, 0.182)).toBeCloseTo(7.035);
  });
  it("rounds armour to integers and weapons to two decimals, without floating-point bumps", () => {
    expect(stat(25, 12.51, 1, "armour")).toBe(626);
    expect(stat(8.25, 10.88, 1, "weapon")).toBe(179.52);
    expect(stat(1, 1.000001, 1, "weapon")).toBe(2.01);
    expect(stat(25, 12.51, 0, "armour")).toBe(0);
    expect(stat(25, 12.51, 0.25, "armour")).toBe(156);
    expect(stat(25, 12.51, 0.25, "weapon")).toBe(156.38);
  });
  it("rounds armour below and above the half-point to the nearest integer", () => {
    expect(stat(1, 78.05, 1, "armour")).toBe(156);
    expect(stat(1, 78.3, 1, "armour")).toBe(157);
    expect(stat(1, 78.25, 1, "armour")).toBe(157);
    expect(stat(1, 78, 1, "armour")).toBe(156);
  });
  it("keeps weapon enhancement values at two decimals", () => {
    expect(enhancementTable(rawStat(8.25, 10.88, 1), "weapon")[10].stat).toBe(269.28);
  });
  it("has eleven enhancement levels and no success-chance fields", () => {
    const levels = enhancementTable(100, "armour");
    expect(levels).toHaveLength(11);
    expect(levels[0]).toEqual({ level: 0, multiplier: 1, stat: 100 });
    expect(levels[10]).toEqual({ level: 10, multiplier: 1.5, stat: 150 });
  });
});

describe("probabilities", () => {
  const weaponRows = (count: number, percentages: number[]): CategoryRow[] => percentages.map((probability, index) => ({ kind: "weapon", oreCount: count, slot: index + 1, probability }));
  it("normalises inverse denominators to the PRD dagger example", () => {
    expect(variantOdds([1, 2, 4, 16, 2, 6, 8]).map((x) => Number(x.toFixed(2)))).toEqual([38.4, 19.2, 9.6, 2.4, 19.2, 6.4, 4.8]);
    expect(variantOdds([])).toEqual([]);
  });
  it("maps slots by world, preserving measured rounded percentages", () => {
    const rows = weaponRows(7, [6, 74, 20, 0, 0, 0, 0]);
    expect(classOdds("weapon", 1, 7, rows).classes[2].name).toBe("Gauntlets");
    expect(classOdds("weapon", 2, 7, rows)).toEqual(classOdds("weapon", 1, 7, rows));
    expect(classOdds("weapon", 4, 7, rows).classes[2]).toEqual({ name: "Mace", probability: 20 });
    expect(classOdds("weapon", 3, 7, rows)).toEqual(classOdds("weapon", 4, 7, rows));
  });
  it("matches the visible 30-ore armour odds in Cris's forge screenshot", () => {
    const percentages = [0, 0, 0, 0, 1, 8, 28, 49, 13];
    const rows: CategoryRow[] = percentages.map((probability, index) => ({ kind: "armour", oreCount: 30, slot: index + 1, probability }));
    const visible = Object.fromEntries(classOdds("armour", 4, 30, rows).classes.filter((row) => row.probability > 0).map((row) => [row.name, row.probability]));
    expect(visible).toEqual(armourEvidence.visibleClassOdds);
  });
  it("uses the 55-ore row above the table limit, with an explicit capped flag", () => {
    const rows = weaponRows(55, [0, 0, 0, 0, 1, 26, 73]);
    expect(classOdds("weapon", 4, 55, rows).capped).toBe(false);
    expect(classOdds("weapon", 4, 56, rows)).toMatchObject({ status: "available", capped: true });
  });
  it("does not turn missing table data into zero odds", () => {
    expect(classOdds("weapon", 1, 2, []).status).toBe("too-few");
    expect(classOdds("weapon", 1, 3, []).status).toBe("unavailable");
    expect(classOdds("weapon", 1, 3, weaponRows(3, [99, 0, 0, 0, 0, 0, 0])).classes.reduce((sum, row) => sum + row.probability, 0)).toBe(99);
  });
});

describe("input validation", () => {
  it("handles empty, one-ore, and 55-ore mixes", () => {
    expect(averageMultiplier([])).toBeNull();
    expect(primaryOre([])).toBeNull();
    expect(averageMultiplier([ingredient("iron", 0.35, 0)])).toBeNull();
    expect(averageMultiplier([ingredient("iron", 0.35, 1)])).toBe(0.35);
    expect(averageMultiplier([ingredient("iron", 0.35, 55)])).toBeCloseTo(0.35);
  });
  it("does not mutate the mix or cap distinct ore types", () => {
    const mix = Object.freeze([1, 2, 3, 4, 5, 6].map((n) => Object.freeze(ingredient(`ore-${n}`, n, 1))));
    expect(averageMultiplier(mix)).toBe(3.5);
    expect(primaryOre(mix)?.slug).toBe("ore-6");
  });
  it("uses the documented Fichilliumorite filler rule and leaves an all-filler mix unknown", () => {
    const filler: Ingredient = { ore: { slug: "fichilliumorite", multiplier: 1, rarity: "Divine", multiplierRule: "average-other-ores" }, count: 10 };
    expect(averageMultiplier([ingredient("sun-stone", 13.39, 2), ingredient("roosite", 14, 3), filler])).toBeCloseTo((2 * 13.39 + 3 * 14) / 5);
    expect(averageMultiplier([filler])).toBeNull();
  });
  it.each([-1, NaN, Infinity])("rejects invalid numbers", (value) => {
    expect(() => stat(value, 1, 1, "weapon")).toThrow();
    expect(() => traitStrength(value)).toThrow();
    expect(() => averageMultiplier([ingredient("iron", 1, value)])).toThrow();
  });
  it("rejects fractional counts, duplicate entries and out-of-range quality/shares", () => {
    expect(() => averageMultiplier([ingredient("iron", 1, 0.5)])).toThrow();
    expect(() => averageMultiplier([ingredient("iron", 1, 1), ingredient("iron", 1, 1)])).toThrow();
    expect(() => stat(1, 1, 1.01, "weapon")).toThrow();
    expect(() => traitStrength(1.01)).toThrow();
    expect(() => variantOdds([0])).toThrow();
  });
});
