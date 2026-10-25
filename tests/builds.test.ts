import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import { BUILDS } from "../data/builds";
import { classNames, forge, type Catalogue } from "../lib/engine/forge";

const cat = data as unknown as Catalogue;
const byName = new Map(cat.ores.map((o) => [o.name.toLowerCase(), o]));
const recipes = BUILDS.flatMap((a) => [a.weapons, a.armour].flatMap((t) => t.rows.flatMap((r) => r.items.flatMap((it) => (it ? [{ area: a, kind: t.kind, recipe: it }] : [])))));

describe("recommended builds", () => {
  it("only uses ores that are in the catalogue and found in that world", () => {
    for (const { area, recipe } of recipes) for (const [name] of recipe) {
      const ore = byName.get(name.toLowerCase());
      expect(ore, name).toBeDefined();
      expect(ore!.worlds.some((w) => w <= area.world), `${name} in ${area.name}`).toBe(true);
    }
  });

  it("never uses more than 4 ore types, and at least 3 ores", () => {
    for (const { recipe } of recipes) {
      expect(new Set(recipe.map(([n]) => n)).size).toBeLessThanOrEqual(4);
      expect(recipe.reduce((n, [, c]) => n + c, 0)).toBeGreaterThanOrEqual(3);
    }
  });

  it("targets classes that exist in each world", () => {
    for (const a of BUILDS) {
      const armour = classNames(cat, "armour", a.world);
      for (const c of a.armour.columns) expect(armour).toContain(c);
      const weapons = classNames(cat, "weapon", a.world);
      expect(weapons).toContain("Straight Sword");
      expect(weapons).toContain("Colossal Sword");
    }
  });

  it("works out the Forgotten Kingdom endgame colossal sword", () => {
    const mix = [["Darkryte", 12], ["Magmaite", 10], ["Demonite", 8], ["Eye Ore", 10]].map(([n, c]) => ({ ore: byName.get(String(n).toLowerCase())!, count: Number(c) }));
    const r = forge(cat, mix, "weapon", 2, 1);
    expect(r.total).toBe(40);
    expect(r.multiplier).toBeCloseTo((12 * 6.3 + 10 * 5 + 8 * 5.5 + 10 * 4) / 40, 5);
  });
});

describe("computed armour builds", () => {
  it("use exactly the Heavy lock counts, so the class is guaranteed", () => {
    const lock = { "Heavy Chestplate": 52, "Heavy Helmet": 35, "Heavy Leggings": 42 } as Record<string, number>;
    for (const a of BUILDS) for (const row of a.armour.rows) row.items.forEach((it, i) => {
      expect(it!.reduce((n, [, c]) => n + c, 0), `${a.name} ${row.stage} ${a.armour.columns[i]}`).toBe(lock[a.armour.columns[i]]);
    });
  });

  it("are guaranteed in the calculator at that count", () => {
    for (const a of BUILDS) for (const row of a.armour.rows) row.items.forEach((it, i) => {
      const mix = it!.map(([n, count]) => ({ ore: byName.get(n.toLowerCase())!, count }));
      const c = forge(cat, mix, "armour", a.world, 1).classes.find((x) => x.name === a.armour.columns[i]);
      expect(c?.lockable, `${a.name} ${row.stage} ${a.armour.columns[i]}`).toBe(true);
    });
  });
});
