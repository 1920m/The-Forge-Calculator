import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import { classVariants, forge, siteFor, type Catalogue, type Mix } from "../lib/engine/forge";
import { calculate } from "../lib/api/calculate";
import { CalculateRequest } from "../lib/api/schema";

const cat = data as unknown as Catalogue;
const share = (world: 2 | 3 | 4, kind: "weapon" | "armour", cls: string, id: string, site: "normal" | "abyss" = "normal") =>
  classVariants(cat, kind, world, cls, site).find((v) => v.id === id)?.chance;
const iron = (count: number): Mix => [{ ore: cat.ores.find((o) => o.id === "iron")!, count }];

describe("items added after Version 1.10 (theforge.gg, 16 Nov 2026)", () => {
  it("has the new weapons with their stats", () => {
    const w = (id: string) => cat.weapons.find((x) => x.id === id)!;
    expect(w("devils-deed")).toMatchObject({ class: "Colossal Sword", baseDamage: 30.8, trueSpeed: 1.4033, range: 15, weight: 64, tag: "abyss", worlds: [4] });
    expect(w("moon-crescent-spear")).toMatchObject({ class: "Spear", baseDamage: 14.7, trueSpeed: 0.725, weight: 32, tag: "abyss" });
    expect(w("royal-guardians-glaive")).toMatchObject({ class: "Halberd", baseDamage: 21.4, trueSpeed: 1.0667, weight: 16, tag: "abyss" });
    expect(w("rosethorn")).toMatchObject({ class: "Sword & Shield", baseDamage: 11.1, trueSpeed: 0.7, weight: 32, tag: "abyss" });
    expect(w("fangtian")).toMatchObject({ class: "Halberd", baseDamage: 18, weight: 8, tag: null });
    expect(w("spiked-halberd")).toMatchObject({ class: "Halberd", baseDamage: 17.04, weight: 1, tag: null });
    expect(w("knights-bulwark")).toMatchObject({ class: "Sword & Shield", baseDamage: 9.1, trueSpeed: 0.7, worlds: [1, 2, 3, 4] });
    expect(w("halberd")).toMatchObject({ class: "Halberd", tag: "guild", worlds: [4] });
  });

  it("has the new armour with its health and sets", () => {
    const a = (id: string) => cat.armour.find((x) => x.id === id)!;
    expect(a("dreadhorns-chestplate")).toMatchObject({ weightClass: "Heavy", healthPct: 55, weight: 8, tag: "abyss", worlds: [4] });
    expect(a("voidstriders-helmet")).toMatchObject({ weightClass: "Light", healthPct: 16, weight: 8, tag: "abyss" });
    expect(a("gloomwardens-chestplate")).toMatchObject({ weightClass: "Medium", healthPct: 33, weight: 8, worlds: [4] });
    expect(a("gloomwardens-chestplate").tag ?? null).toBeNull();
  });
});

describe("the Abyss Forge", () => {
  it("only exists next to World 4", () => {
    expect(siteFor(4, "abyss")).toBe("abyss");
    expect(siteFor(3, "abyss")).toBe("normal");
    expect(siteFor(4, null)).toBe("normal");
  });

  it("gives Abyss items no chance at the normal forge", () => {
    expect(share(4, "weapon", "Colossal Sword", "devils-deed")).toBe(0);
    expect(share(4, "armour", "Heavy Chestplate", "dreadhorns-chestplate")).toBe(0);
    expect(share(4, "armour", "Medium Chestplate", "gloomwardens-chestplate")).toBeCloseTo(100 / 8 / (1 + 1 / 2 + 1 / 8), 9);
  });

  it("matches every published Abyss share: World 4's pools plus the Abyss items", () => {
    // theforge.gg: Devil's Deed 0.7% of Colossal Swords, Moon Crescent Spear 1.6% of Spears, Royal Guardian's Glaive 5.3%
    // of Halberds, Rosethorn 3% of Sword & Shield, Dreadhorn's Chestplate 7.7%, Helmet 7.5%, Voidstrider's 11.1%.
    expect(share(4, "weapon", "Colossal Sword", "devils-deed", "abyss")).toBeCloseTo(0.7, 1);
    // Spears: 1.6% without the Halloween Demonic Spear (1/4), which our World 4 list still rolls; 1.4% with it.
    const withoutDemonic = { ...cat, weapons: cat.weapons.filter((w) => w.id !== "demonic-spear") } as Catalogue;
    expect(classVariants(withoutDemonic, "weapon", 4, "Spear", "abyss").find((v) => v.id === "moon-crescent-spear")!.chance).toBeCloseTo(1.6, 1);
    expect(share(4, "weapon", "Spear", "moon-crescent-spear", "abyss")).toBeCloseTo(1.41, 2);
    expect(share(4, "weapon", "Halberd", "royal-guardians-glaive", "abyss")).toBeCloseTo(5.3, 1);
    expect(share(4, "weapon", "Sword & Shield", "rosethorn", "abyss")).toBeCloseTo(3, 0);
    expect(share(4, "armour", "Heavy Chestplate", "dreadhorns-chestplate", "abyss")).toBeCloseTo(7.7, 1);
    expect(share(4, "armour", "Heavy Helmet", "dreadhorns-helmet", "abyss")).toBeCloseTo(7.5, 1);
    expect(share(4, "armour", "Light Chestplate", "voidstriders-chestplate", "abyss")).toBeCloseTo(11.1, 1);
    expect(share(4, "weapon", "Halberd", "halberd", "abyss")).toBe(0); // Guild Island's, not the Abyss Forge's
  });

  it("keeps chances inside each class adding up to 100%", () => {
    for (const site of ["normal", "abyss"] as const) {
      const r = forge(cat, iron(40), "armour", 4, 1, site);
      for (const c of r.classes) expect(c.variants.reduce((n, v) => n + v.chance, 0)).toBeCloseTo(100, 9);
      expect(r.site).toBe(site);
    }
  });
});

describe("classes whose odds aren't known yet", () => {
  it("lists Halberd and Sword & Shield with their weapons but no chance and no lock", () => {
    const r = forge(cat, iron(40), "weapon", 4, 1, "abyss");
    for (const name of ["Halberd", "Sword & Shield"]) {
      const c = r.classes.find((x) => x.name === name)!;
      expect(c).toMatchObject({ oddsKnown: false, probability: 0, lockAt: null, lockable: false });
      expect(c.variants.length).toBeGreaterThan(0);
      expect(c.variants.every((v) => v.overall === 0)).toBe(true);
    }
    const known = r.classes.filter((c) => c.oddsKnown);
    expect(known).toHaveLength(7);
    expect(known.reduce((n, c) => n + c.probability, 0)).toBeCloseTo(100, 6);
  });
});

describe("the API's forge option", () => {
  const ask = (body: Record<string, unknown>) =>
    calculate(cat, CalculateRequest.parse({ type: "forge", kind: "weapon", ores: [{ id: "iron", count: 50 }], item: "devils-deed", ...body })) as unknown as
      { data: { forge: string; item: { chance: { overall: number; inClass: number } }; links: { calculator: string } }; warnings: { code: string }[] };
  it("gives Devil's Deed its Abyss Forge chance with forge: abyss, and 0% with a warning at the normal forge", () => {
    const abyss = ask({ world: 4, forge: "abyss" });
    expect(abyss.data.forge).toBe("abyss");
    expect(abyss.data.item.chance.inClass).toBeGreaterThan(0.6);
    expect(abyss.data.item.chance.overall).toBeGreaterThan(0);
    expect(abyss.warnings.map((w) => w.code)).not.toContain("ABYSS_FORGE_ONLY");
    expect(abyss.data.links.calculator).toContain("f=abyss");
    const normal = ask({ world: 4 });
    expect(normal.data.item.chance.overall).toBe(0);
    expect(normal.warnings.map((w) => w.code)).toContain("ABYSS_FORGE_ONLY");
  });
});

describe("images for the new items", () => {
  it("are listed as WebP uploads and served from the bucket", async () => {
    const { imageUrl } = await import("../lib/data/supabase");
    expect(imageUrl("weapons", "devils-deed")).toMatch(/\/forge-images\/weapons\/devils-deed\.webp$/);
    expect(imageUrl("armour", "dreadhorns-chestplate")).toMatch(/\/forge-images\/armour\/dreadhorns-chestplate\.webp$/);
    expect(imageUrl("weapons", "excalibur")).toMatch(/\/weapons\/excalibur\.png$/);
    expect(imageUrl("weapons", "no-such-weapon")).toBeNull();
  });
});

describe("what each forge lists", () => {
  it("lists the Abyss items only at the Abyss Forge, and Guild Island's Halberd only at the normal forge", async () => {
    const { shownAt } = await import("../lib/engine/forge");
    const ids = (site: "normal" | "abyss", cls: string, kind: "weapon" | "armour" = "weapon") =>
      classVariants(cat, kind, 4, cls, site).filter((v) => shownAt(v, site)).map((v) => v.id);
    expect(ids("normal", "Colossal Sword")).not.toContain("devils-deed");
    expect(ids("abyss", "Colossal Sword")).toContain("devils-deed");
    expect(ids("normal", "Halberd")).toEqual(["halberd", "spiked-halberd", "fangtian"]);
    expect(ids("abyss", "Halberd")).toEqual(["spiked-halberd", "fangtian", "royal-guardians-glaive"]);
    expect(ids("normal", "Heavy Chestplate", "armour")).not.toContain("dreadhorns-chestplate");
    expect(ids("abyss", "Heavy Chestplate", "armour")).toEqual(expect.arrayContaining(["dreadhorns-chestplate", "juggernauts-chestplate", "shogun-chestplate"]));
    // Everything Crimson Sakura makes, the Abyss Forge makes too (Guild Island's Halberd aside).
    for (const kind of ["weapon", "armour"] as const) for (const c of forge(cat, iron(40), kind, 4, 1).classes) {
      const sakura = ids("normal", c.name, kind).filter((id) => id !== "halberd");
      expect(ids("abyss", c.name, kind)).toEqual(expect.arrayContaining(sakura));
    }
  });
});
