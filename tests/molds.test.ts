import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import { forge, lockClass, type Catalogue, type Mix } from "../lib/engine/forge";
import { MAX_MOLDS, applyMolds, decodeMolds, encodeMolds, moldNeed, needLabel, type MoldRequirement } from "../lib/engine/molds";

const cat = data as unknown as Catalogue;
const reqs = cat.moldRequirements;
const ore = (name: string) => { const o = cat.ores.find((x) => x.name === name); if (!o) throw new Error(name); return o; };
const mix = (...pairs: [string, number][]): Mix => pairs.map(([n, c]) => ({ ore: ore(n), count: c }));
type Classes = ReturnType<typeof forge>["classes"];
const flat = (cs: Classes) => cs.flatMap((c) => c.variants);
const sum = (cs: Classes) => flat(cs).reduce((a, v) => a + v.overall, 0);
const item = (cs: Classes, cls: string, id: string) => cs.find((c) => c.name === cls)!.variants.find((v) => v.id === id)!;

// World 1–2 Gauntlets with 15 ores (lockable from 14). Dark Knight's Gauntlets is 1/6; players report 70 molds.
const r = forge(cat, mix(["Iron", 15]), "weapon", 2, 1);
const locked = lockClass(r.classes, "Gauntlets");
const DK = { cls: "Gauntlets", id: "dark-knights-gauntlets" };
// A made-up verified entry, for tests only: no item is verified in the real data yet.
const verifiedDK: MoldRequirement[] = [{ itemId: DK.id, kind: "weapon", worlds: [1, 2], exact: 70, reported: 70, approximate: false, status: "verified", reports: 3, sources: [], checked: "2026-10-28" }];

describe("mold requirements data", () => {
  it("keeps the requirement separate from the 1/N rarity", () => {
    expect(item(r.classes, DK.cls, DK.id).weight).toBe(6);
    expect(moldNeed(reqs, DK.id)).toMatchObject({ kind: "reported", value: 70 });
  });
  it("labels each status", () => {
    expect(needLabel(moldNeed(reqs, DK.id))).toBe("70");
    expect(needLabel(moldNeed(reqs, "excalibur"))).toBe("150");
    expect(moldNeed(reqs, "shogun-helmet")).toMatchObject({ kind: "approximate", value: 40 });
    expect(needLabel(moldNeed(reqs, "shogun-chestplate"))).toBe("~52");
    expect(moldNeed(reqs, "kunai")).toMatchObject({ kind: "unknown", value: null });
    expect(needLabel(moldNeed(reqs, "kunai"))).toBe("?");
  });
  it("has nothing verified yet, and every entry has a source and a date it was checked", () => {
    expect(reqs!.some((x) => x.status === "verified")).toBe(false);
    for (const x of reqs!) { expect(x.sources.length).toBeGreaterThan(0); expect(x.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/); }
  });
});

describe("molds on the odds", () => {
  it("change nothing with no target", () => {
    const out = applyMolds(locked, null, 70, "Gauntlets", reqs);
    expect(out.classes).toBe(locked);
    expect(out.mold.state).toBe("off");
  });

  it("6 molds (the old 1/N guess) no longer guarantee Dark Knight's Gauntlets", () => {
    const out = applyMolds(locked, DK, 6, "Gauntlets", reqs);
    expect(out.mold.state).toBe("partial");
    expect(out.classes).toBe(locked); // chances unchanged…
    expect(out.mold.chancesKnown).toBe(false); // …and marked as not the real chances with molds
  });

  it("a reported 70 with the class locked is only 'guaranteed if the report is right': no 100% in the chances", () => {
    const out = applyMolds(locked, DK, 70, "Gauntlets", reqs);
    expect(out.mold.state).toBe("conditional");
    expect(out.classes).toBe(locked);
    expect(item(out.classes, DK.cls, DK.id).overall).toBeLessThan(100);
    expect(out.mold.chancesKnown).toBe(false);
  });

  it("needs the padlock on before any guarantee", () => {
    const out = applyMolds(r.classes, DK, 70, null, verifiedDK);
    expect(out.mold).toMatchObject({ state: "needs-lock", classLockable: true, classLocked: false });
    expect(out.classes).toBe(r.classes);
    const few = forge(cat, mix(["Iron", 10]), "weapon", 2, 1); // below 14: can't lock Gauntlets
    expect(applyMolds(few.classes, DK, 70, "Gauntlets", verifiedDK).mold).toMatchObject({ state: "needs-lock", classLockable: false, classLocked: false });
  });

  it("only a verified number guarantees the item", () => {
    const out = applyMolds(locked, DK, 70, "Gauntlets", verifiedDK);
    expect(out.mold).toMatchObject({ state: "guaranteed", surplus: 0, chancesKnown: true });
    expect(item(out.classes, DK.cls, DK.id).overall).toBe(100);
    expect(flat(out.classes).filter((v) => v.id !== DK.id).every((v) => v.overall === 0)).toBe(true);
    expect(sum(out.classes)).toBeCloseTo(100, 9);
  });

  it("warns about molds over an exact number", () => {
    expect(applyMolds(locked, DK, 90, "Gauntlets", reqs).mold).toMatchObject({ state: "conditional", surplus: 20 });
    expect(applyMolds(locked, DK, 90, "Gauntlets", verifiedDK).mold).toMatchObject({ state: "guaranteed", surplus: 20 });
  });

  it("never guarantees an approximate or unknown number, however many molds", () => {
    const armour = forge(cat, mix(["Iron", 52]), "armour", 4, 1); // 52 ores: every armour class lockable
    const helm = lockClass(armour.classes, "Heavy Helmet");
    for (const m of [40, 52, MAX_MOLDS]) {
      const out = applyMolds(helm, { cls: "Heavy Helmet", id: "shogun-helmet" }, m, "Heavy Helmet", reqs);
      expect(out.mold.state).toBe("approx-reached");
      expect(out.mold.surplus).toBe(0);
      expect(out.classes).toBe(helm);
    }
    const ironhand = applyMolds(locked, { cls: "Gauntlets", id: "ironhand" }, MAX_MOLDS, "Gauntlets", reqs);
    expect(ironhand.mold.state).toBe("partial");
    expect(ironhand.classes).toBe(locked);
  });

  it("can use a confirmed partial formula when one exists (none does yet), keeping 100% in total", () => {
    const half = applyMolds(locked, DK, 35, "Gauntlets", reqs, () => 50);
    expect(half.mold.chancesKnown).toBe(true);
    expect(item(half.classes, DK.cls, DK.id).chance).toBeCloseTo(50, 9);
    expect(sum(half.classes)).toBeCloseTo(100, 9);
    expect(flat(half.classes).every((v) => v.overall >= 0)).toBe(true);
  });

  it("keep chances adding to the same total and never negative", () => {
    for (const [m, l, rq] of [[6, "Gauntlets", reqs], [70, "Gauntlets", reqs], [70, null, reqs], [70, "Gauntlets", verifiedDK]] as const) {
      const base = l ? locked : r.classes;
      const out = applyMolds(base, DK, m, l, rq);
      expect(sum(out.classes)).toBeCloseTo(sum(base), 9);
      expect(flat(out.classes).every((v) => v.overall >= 0)).toBe(true);
    }
  });
});

describe("mold links", () => {
  it("still read old links, which now show 6 of 70", () => {
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
