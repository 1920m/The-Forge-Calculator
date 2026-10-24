import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import { forge, scaleTraitText, qualityLabel, classVariants, type Catalogue, type Mix } from "../lib/engine/forge";

const cat = data as unknown as Catalogue;
const ore = (name: string) => { const o = cat.ores.find((x) => x.name === name); if (!o) throw new Error(name); return o; };
const mix = (...pairs: [string, number][]): Mix => pairs.map(([n, c]) => ({ ore: ore(n), count: c }));

describe("catalogue forge results match Cris's in-game crafts", () => {
  it("Dark Knight Chestplate: 12.51x, Legendary, 626 DEF, 30-ore armour odds", () => {
    const r = forge(cat, mix(["Sun Stone", 9], ["Lucky Cat", 8], ["Sealed Curse", 8], ["Roosite", 5]), "armour", 4, 1);
    expect(r.multiplier!.toFixed(2)).toBe("12.51");
    expect(r.rarity).toBe("Legendary");
    const odds = Object.fromEntries(r.classes.filter((c) => c.probability > 0).map((c) => [c.name, c.probability]));
    expect(odds).toEqual({ "Medium Leggings": 1, "Medium Chestplate": 8, "Heavy Helmet": 28, "Heavy Leggings": 49, "Heavy Chestplate": 13 });
    const dk = r.classes.find((c) => c.name === "Heavy Chestplate")!.variants.find((v) => v.name === "Dark Knight Chestplate")!;
    expect(dk.value).toBe(626);
  });
  it("Hachiwari: 10.88x, Mythic primary Meteorite, 179.52 DMG, 74/20/6 odds with Mace", () => {
    const r = forge(cat, mix(["Sun Stone", 2], ["Yeti Heart", 2], ["Golem Heart", 1], ["Meteorite", 2]), "weapon", 4, 1);
    expect(r.multiplier!.toFixed(2)).toBe("10.88");
    expect(r.primary?.name).toBe("Meteorite");
    expect(r.rarity).toBe("Mythic");
    expect(r.classes.slice(0, 3).map((c) => [c.name, c.probability])).toEqual([["Dagger", 6], ["Straight Sword", 74], ["Mace", 20]]);
    const h = r.classes[1].variants.find((v) => v.name === "Hachiwari")!;
    expect(h.value).toBe(179.52);
  });
  it("uses each world's classes: 1–2 Gauntlets/Katana/Greatsword, 3 Mace/Axe/Spear, 4 Mace/Katana/Spear", () => {
    const names = (w: 1 | 2 | 3 | 4) => forge(cat, mix(["Iron", 10]), "weapon", w, 1).classes.slice(2, 5).map((c) => c.name);
    expect(names(2)).toEqual(["Gauntlets", "Katana", "Greatsword"]);
    expect(names(3)).toEqual(["Mace", "Axe", "Spear"]);
    expect(names(4)).toEqual(["Mace", "Katana", "Spear"]);
  });
  it("World 4 Katana includes the World 2 katanas plus Juto, Kurokiba and Washi-maru; Dragon Slayer is 1/1", () => {
    expect(classVariants(cat, "weapon", 4, "Katana").map((v) => v.name)).toEqual(["Uchigatana", "Tachi", "Juto Katana", "Kurokiba-gatana", "Washi-maru"]);
    expect(classVariants(cat, "weapon", 4, "Colossal Sword").find((v) => v.name === "Dragon Slayer")?.weight).toBe(1);
    expect(classVariants(cat, "weapon", 2, "Colossal Sword").find((v) => v.name === "Dragon Slayer")?.weight).toBe(16);
  });
  it("World 1 uses Gauntlets in slot 3 and hides World 4 variants", () => {
    const r = forge(cat, mix(["Iron", 7]), "weapon", 1, 1);
    expect(r.classes[2].name).toBe("Gauntlets");
    expect(r.classes[1].variants.some((v) => v.name === "Hachiwari")).toBe(false);
  });
  it("uses the in-game weights: Wolf 1/3, Raven 1/8", () => {
    const heavy = classVariants(cat, "armour", 4, "Heavy Chestplate");
    expect(heavy.find((v) => v.name === "Wolf Chestplate")?.weight).toBe(3);
    expect(heavy.find((v) => v.name === "Raven's Chestplate")?.weight).toBe(8);
  });
  it("variant chances inside a class sum to 100", () => {
    const sum = classVariants(cat, "armour", 4, "Heavy Chestplate").reduce((s, v) => s + v.chance, 0);
    expect(sum).toBeCloseTo(100, 9);
  });
});

describe("traits", () => {
  it("transfers only traits for the item kind, scaled by share", () => {
    const r = forge(cat, mix(["Sun Stone", 9], ["Lucky Cat", 8], ["Sealed Curse", 8], ["Roosite", 5]), "armour", 4, 1);
    const names = r.traits.map((t) => t.ore.name);
    expect(names).toEqual(["Lucky Cat", "Sealed Curse"]);
    const lucky = r.traits[0];
    expect(lucky.strength).toBeCloseTo(0.1 + 4.5 * (8 / 30 - 0.1));
  });
  it("matches Cris's Sun Stone test crafts: chance and damage scale, duration does not", () => {
    // 2 Sun Stone + 8 Roosite (20% share): the game shows Burn 19.3%/s, 19.3%.
    const a = forge(cat, mix(["Sun Stone", 2], ["Roosite", 8]), "weapon", 4, 1).traits[0];
    expect(a.lines[0]).toBe("19.3% chance to Burn 5s at 19.3% weapon damage/s");
    // 3 Sun Stone + 7 Roosite (30% share): full strength, Burn 35%/s, 35%.
    const b = forge(cat, mix(["Sun Stone", 3], ["Roosite", 7]), "weapon", 4, 1).traits[0];
    expect(b.lines[0]).toBe("35% chance to Burn 5s at 35% weapon damage/s");
  });
  it("matches the damage on Cris's Tachi (247.72) and Uchigatana (234.89)", () => {
    const tachi = forge(cat, mix(["Sun Stone", 2], ["Roosite", 8]), "weapon", 2, 1);
    expect(tachi.classes.flatMap((c) => c.variants).find((v) => v.name === "Tachi")?.value).toBe(247.72);
    const uchi = forge(cat, mix(["Sun Stone", 3], ["Roosite", 7]), "weapon", 2, 1);
    expect(uchi.classes.flatMap((c) => c.variants).find((v) => v.name === "Uchigatana")?.value).toBe(234.89);
  });
  it("scales stat lines and leaves HP thresholds and durations alone", () => {
    expect(scaleTraitText("+15% Vitality, -10% stamina", 0.5)).toBe("+7.5% Vitality, -5% stamina");
    expect(scaleTraitText("Below 35% HP: +20% damage and speed for 6s", 0.5)).toBe("Below 35% HP: +10% damage and speed for 6s");
  });
  it("labels quality tiers", () => {
    expect(qualityLabel(cat, 100)).toBe("Masterwork");
    expect(qualityLabel(cat, 83.4)).toBe("Great");
    expect(qualityLabel(cat, 10)).toBe("Broken");
  });
});
