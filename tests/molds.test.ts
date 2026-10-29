import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import { armourClassName, classNames, forge, lockClass, type Catalogue, type Mix } from "../lib/engine/forge";
import { MAX_MOLDS, applyMolds, decodeMolds, encodeMolds, moldNeed, moldScreenChance, needLabel, type MoldRequirement } from "../lib/engine/molds";
import type { World } from "../lib/engine";

const cat = data as unknown as Catalogue;
const reqs = cat.moldRequirements!;
const byId = new Map(reqs.map((r) => [r.itemId, r]));
const ore = (name: string) => { const o = cat.ores.find((x) => x.name === name); if (!o) throw new Error(name); return o; };
const mix = (...pairs: [string, number][]): Mix => pairs.map(([n, c]) => ({ ore: ore(n), count: c }));
type Classes = ReturnType<typeof forge>["classes"];
const flat = (cs: Classes) => cs.flatMap((c) => c.variants);
const sum = (cs: Classes) => flat(cs).reduce((a, v) => a + v.overall, 0);
const item = (cs: Classes, cls: string, id: string) => cs.find((c) => c.name === cls)!.variants.find((v) => v.id === id)!;

// World 1–2 Gauntlets with 15 ores (lockable from 14). Dark Knight's Gauntlets is 1/6 but needs 70 molds.
const r = forge(cat, mix(["Iron", 15]), "weapon", 2, 1);
const locked = lockClass(r.classes, "Gauntlets");
const DK = { cls: "Gauntlets", id: "dark-knights-gauntlets" };

describe("mold requirements checked in game (28 Oct 2026)", () => {
  it("has a number for 58 weapons and every one of the 37 armour pieces", () => {
    expect(reqs.filter((x) => x.kind === "weapon")).toHaveLength(58);
    expect(reqs.filter((x) => x.kind === "armour")).toHaveLength(37);
    expect(cat.armour.every((a) => byId.has(a.id))).toBe(true);
    expect(new Set(reqs.map((x) => x.itemId)).size).toBe(reqs.length);
  });

  it("are all verified exact numbers, dated, with the in-game check as a source", () => {
    for (const x of reqs) {
      expect(x.status).toBe("verified");
      expect(x.exact).toBeGreaterThan(0);
      expect(x.checked).toBe("2026-10-28");
      expect(x.sources[0]).toMatchObject({ url: null, note: "Checked in game by Cris" });
    }
  });

  it("keep the number separate from the 1/N rarity", () => {
    expect(item(r.classes, DK.cls, DK.id).weight).toBe(6);
    expect(moldNeed(reqs, DK.id)).toMatchObject({ kind: "verified", value: 70 });
    expect(byId.get(DK.id)!.sources.length).toBe(4); // in game + 3 earlier player reports that agree
  });

  it.each([
    ["dagger", 2], ["hook-blade", 38], ["savage-claws", 40], ["dragon-slayer", 40], ["excalibur", 150], ["knight-spear", 55],
    ["washi-maru", 60], ["wyvern-axe", 20], ["halberd", 40], ["duskwings-cleaver", 20], ["gladius-daggers", 3], ["falchion-sword", 2],
    ["ninjas-helmet", 6], ["light-helmet", 2], ["knight-chestplate", 15], ["dark-knight-chestplate", 22], ["wolf-leggings", 28],
    ["goblins-crown", 22], ["shogun-helmet", 40], ["shogun-leggings", 42], ["shogun-chestplate", 45], ["vanguard-chestplate", 35],
  ])("%s needs %i", (id, n) => {
    expect(moldNeed(reqs, id)).toMatchObject({ kind: "verified", value: n });
  });

  it("leave unchecked items blank (?) rather than 0", () => {
    for (const id of ["crusader-sword", "the-carver", "greater-battle-axe", "kinmon-kamagatana", "otsuchi", "sharktooth-odachi", "boxing-gloves",
      "dark-knights-greatsword", "anchored-greatsword", "comically-large-spoon", "hell-slayer", "straight-edge-katana"]) {
      expect(byId.has(id)).toBe(false);
      expect(moldNeed(reqs, id)).toMatchObject({ kind: "unknown", value: null });
      expect(needLabel(moldNeed(reqs, id))).toBe("?");
    }
  });

  it("show the class's lock number as the mold screen's minimum ores, in every world it was seen", () => {
    for (const x of reqs) {
      if (x.kind === "armour") {
        const a = cat.armour.find((y) => y.id === x.itemId)!;
        const i = cat.armourClasses.findIndex((c) => armourClassName(c) === armourClassName([a.weightClass, a.slot]));
        expect([x.itemId, x.minOres]).toEqual([x.itemId, cat.locks.armour[i]]);
      } else {
        const w = cat.weapons.find((y) => y.id === x.itemId)!;
        for (const world of x.worlds) {
          const i = classNames(cat, "weapon", world as World).indexOf(w.class);
          if (i >= 0) expect([x.itemId, world, x.minOres]).toEqual([x.itemId, world, cat.locks.weapon[i]]);
        }
      }
    }
  });

  it("only list items in worlds our lists have them, apart from two sightings waiting for confirmation", () => {
    const poolHas = (w: number, id: string) => Object.values(cat.weaponPools[String(w)].pools).some((p) => p.items.some(([x]) => x === id));
    const outside: string[] = [];
    for (const x of reqs) for (const w of x.worlds) {
      const there = x.kind === "weapon" ? poolHas(w, x.itemId) : cat.armour.find((a) => a.id === x.itemId)!.worlds.includes(w);
      if (!there) outside.push(`${x.itemId}@${w}`);
    }
    // Seen on the game's mold screen there, but not in our world lists yet: Batwing Reaver in World 1–2, Excalibur in World 3.
    expect(outside.sort()).toEqual(["batwing-reaver@2", "excalibur@3"]);
    // Adding mold numbers doesn't put any item into a new world.
    expect(classNames(cat, "weapon", 3)).not.toContain("Excalibur");
    expect(forge(cat, mix(["Iron", 50]), "weapon", 3, 1).classes.flatMap((c) => c.variants.map((v) => v.id))).not.toContain("excalibur");
  });
});

describe("the game's mold screen with fewer molds: (molds ÷ needed)²", () => {
  it.each([
    ["savage-claws", 35, 77], ["dark-knights-gauntlets", 35, 25], ["dragon-slayer", 35, 77], ["hook-blade", 35, 85], ["angelic-spear", 35, 77],
  ])("%s with %i molds shows %i%%, as in Cris's screenshot", (id, m, shown) => {
    expect(Math.round(moldScreenChance(m, moldNeed(reqs, id))! * 100)).toBe(shown);
  });
  it("caps at 100% and has no value for unknown numbers", () => {
    expect(moldScreenChance(90, moldNeed(reqs, DK.id))).toBe(1);
    expect(moldScreenChance(10, moldNeed(reqs, "otsuchi"))).toBeNull();
  });
});

describe("molds on the odds", () => {
  it("change nothing with no target", () => {
    const out = applyMolds(locked, null, 70, "Gauntlets", reqs);
    expect(out.classes).toBe(locked);
    expect(out.mold.state).toBe("off");
  });

  it("fewer molds than needed leave every chance unchanged, marked as without molds", () => {
    const out = applyMolds(locked, DK, 35, "Gauntlets", reqs);
    expect(out.mold).toMatchObject({ state: "partial", chancesKnown: false });
    expect(out.classes).toBe(locked);
  });

  it("need the padlock on before the guarantee", () => {
    expect(applyMolds(r.classes, DK, 70, null, reqs).mold).toMatchObject({ state: "needs-lock", classLockable: true, classLocked: false });
    const few = forge(cat, mix(["Iron", 10]), "weapon", 2, 1); // below 14: Gauntlets can't be locked
    expect(applyMolds(few.classes, DK, 70, "Gauntlets", reqs).mold).toMatchObject({ state: "needs-lock", classLockable: false });
  });

  it("guarantee the item with the number needed and its class locked", () => {
    const out = applyMolds(locked, DK, 70, "Gauntlets", reqs);
    expect(out.mold).toMatchObject({ state: "guaranteed", surplus: 0, chancesKnown: true });
    expect(item(out.classes, DK.cls, DK.id).overall).toBe(100);
    expect(flat(out.classes).filter((v) => v.id !== DK.id).every((v) => v.overall === 0)).toBe(true);
    expect(sum(out.classes)).toBeCloseTo(100, 9);
  });

  it("guarantee armour the same way: Shogun Chestplate with 45 molds and Heavy Chestplate locked", () => {
    const armour = forge(cat, mix(["Iron", 52]), "armour", 4, 1);
    const out = applyMolds(lockClass(armour.classes, "Heavy Chestplate"), { cls: "Heavy Chestplate", id: "shogun-chestplate" }, 45, "Heavy Chestplate", reqs);
    expect(out.mold.state).toBe("guaranteed");
    expect(applyMolds(armour.classes, { cls: "Heavy Chestplate", id: "shogun-chestplate" }, 44, "Heavy Chestplate", reqs).mold.state).toBe("partial");
  });

  it("warn about molds over the number needed", () => {
    expect(applyMolds(locked, DK, 90, "Gauntlets", reqs).mold).toMatchObject({ state: "guaranteed", surplus: 20 });
  });

  it("never guarantee an unknown number, however many molds", () => {
    const out = applyMolds(locked, { cls: "Gauntlets", id: "boxing-gloves" }, MAX_MOLDS, "Gauntlets", reqs);
    expect(out.mold.state).toBe("partial");
    expect(out.classes).toBe(locked);
  });

  it("still handle player reports and estimates safely (none in the data now)", () => {
    const report = (approximate: boolean): MoldRequirement[] => [{ itemId: DK.id, kind: "weapon", worlds: [2], exact: null, reported: 70, approximate,
      status: approximate ? "unverified" : "reported", reports: 1, sources: [], checked: "2026-10-28" }];
    const reported = applyMolds(locked, DK, 70, "Gauntlets", report(false));
    expect(reported.mold.state).toBe("conditional");
    expect(reported.classes).toBe(locked);
    const estimate = applyMolds(locked, DK, MAX_MOLDS, "Gauntlets", report(true));
    expect(estimate.mold.state).toBe("approx-reached");
    expect(estimate.classes).toBe(locked);
  });

  it("can use a confirmed partial rule when one exists (none does yet), keeping 100% in total", () => {
    const half = applyMolds(locked, DK, 35, "Gauntlets", reqs, () => 50);
    expect(half.mold.chancesKnown).toBe(true);
    expect(item(half.classes, DK.cls, DK.id).chance).toBeCloseTo(50, 9);
    expect(sum(half.classes)).toBeCloseTo(100, 9);
    expect(flat(half.classes).every((v) => v.overall >= 0)).toBe(true);
  });

  it("keep chances adding to the same total and never negative", () => {
    for (const [m, l] of [[6, "Gauntlets"], [70, "Gauntlets"], [70, null], [90, "Gauntlets"]] as const) {
      const base = l ? locked : r.classes;
      const out = applyMolds(base, DK, m, l, reqs);
      expect(sum(out.classes)).toBeCloseTo(sum(base), 9);
      expect(flat(out.classes).every((v) => v.overall >= 0)).toBe(true);
    }
  });
});

describe("mold links", () => {
  it("still read old links", () => {
    const { molds, id } = decodeMolds("6:dark-knights-gauntlets");
    expect({ molds, id }).toEqual({ molds: 6, id: DK.id });
    expect(applyMolds(locked, DK, molds, "Gauntlets", reqs).mold).toMatchObject({ state: "partial", molds: 6, need: { value: 70 } });
  });
  it("round-trip and reject junk", () => {
    expect(decodeMolds(encodeMolds(70, DK.id))).toEqual({ molds: 70, id: DK.id });
    expect(decodeMolds("abc:<script>")).toEqual({ molds: 0, id: null });
    expect(decodeMolds("99999:kunai").molds).toBe(MAX_MOLDS);
    expect(decodeMolds(null)).toEqual({ molds: 0, id: null });
  });
});
