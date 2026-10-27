import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import { forge, lockClass, type Catalogue, type Mix } from "../lib/engine/forge";
import { applyMolds, decodeMolds, encodeMolds, moldsNeeded } from "../lib/engine/molds";

const cat = data as unknown as Catalogue;
const ore = (name: string) => { const o = cat.ores.find((x) => x.name === name); if (!o) throw new Error(name); return o; };
const mix = (...pairs: [string, number][]): Mix => pairs.map(([n, c]) => ({ ore: ore(n), count: c }));
type Classes = ReturnType<typeof forge>["classes"];
const sum = (cs: Classes) => cs.reduce((a, c) => a + c.variants.reduce((b, v) => b + v.overall, 0), 0);
const item = (cs: Classes, cls: string, id: string) => cs.find((c) => c.name === cls)!.variants.find((v) => v.id === id)!;

// The player's example: World 1–2 Gauntlets, Dark Knight Gauntlets is 1/6, so it needs 6 molds.
const r = forge(cat, mix(["Iron", 15]), "weapon", 2, 1);
const DK = { cls: "Gauntlets", id: "dark-knights-gauntlets" };

describe("molds", () => {
  it("need the item's N in 1/N", () => {
    expect(item(r.classes, DK.cls, DK.id).weight).toBe(6);
    expect(moldsNeeded(6)).toBe(6);
    expect(moldsNeeded(1)).toBe(1); // Kunai (1/1) still needs 1 mold: the 1 in 1/1 doesn't count
  });

  it("change nothing with no molds or no target", () => {
    expect(applyMolds(r.classes, DK, 0, null).classes).toBe(r.classes);
    expect(applyMolds(r.classes, null, 6, null).classes).toBe(r.classes);
    expect(applyMolds(r.classes, { cls: "Gauntlets", id: "nope" }, 6, null).mold.state).toBe("off");
  });

  it("guarantee the item with N molds and its class locked", () => {
    const locked = lockClass(r.classes, "Gauntlets");
    const out = applyMolds(locked, DK, 6, "Gauntlets");
    expect(out.mold).toEqual({ state: "guaranteed", need: 6, molds: 6, wasted: 0 });
    expect(item(out.classes, DK.cls, DK.id).overall).toBe(100);
    expect(out.classes.flatMap((c) => c.variants).filter((v) => v.id !== DK.id).every((v) => v.overall === 0)).toBe(true);
    expect(sum(out.classes)).toBeCloseTo(100, 9);
  });

  it("call extra molds wasted", () => {
    const out = applyMolds(lockClass(r.classes, "Gauntlets"), DK, 9, "Gauntlets");
    expect(out.mold).toEqual({ state: "guaranteed", need: 6, molds: 9, wasted: 3 });
  });

  it("don't guarantee anything without the class lock", () => {
    const out = applyMolds(r.classes, DK, 6, null);
    expect(out.mold.state).toBe("needs-lock");
    expect(item(out.classes, DK.cls, DK.id).overall).toBeLessThan(100);
    expect(sum(out.classes)).toBeCloseTo(sum(r.classes), 9); // the game's 15-ore odds table adds to 99%
  });

  it("can't guarantee with too few molds, but raise the item's share (m/N weight, our reading)", () => {
    const locked = lockClass(r.classes, "Gauntlets");
    const before = item(locked, DK.cls, DK.id).overall;
    const out = applyMolds(locked, DK, 3, "Gauntlets");
    expect(out.mold).toEqual({ state: "short", need: 6, molds: 3 });
    const after = item(out.classes, DK.cls, DK.id);
    expect(after.overall).toBeGreaterThan(before);
    expect(after.overall).toBeLessThan(100);
    // Weights: Dark Knight 3/6 against Ironhand 1/1 and three 1/4 items.
    expect(after.chance).toBeCloseTo((0.5 / (0.5 + 1 + 0.75)) * 100, 9);
    expect(sum(out.classes)).toBeCloseTo(100, 9);
    expect(out.classes.flatMap((c) => c.variants).every((v) => v.overall >= 0)).toBe(true);
  });

  it("read and write the link format", () => {
    expect(decodeMolds(encodeMolds(6, DK.id))).toEqual({ molds: 6, id: DK.id });
    expect(decodeMolds("abc:<script>")).toEqual({ molds: 0, id: null });
    expect(decodeMolds("99999:kunai").molds).toBe(1000);
    expect(decodeMolds(null)).toEqual({ molds: 0, id: null });
  });
});
