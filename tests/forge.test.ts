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
  it("World 1 uses Gauntlets in slot 3 and hides World 4 variants", () => {
    const r = forge(cat, mix(["Iron", 7]), "weapon", 1, 1);
    expect(r.classes[2].name).toBe("Gauntlets");
    expect(r.classes[1].variants.some((v) => v.name === "Hachiwari")).toBe(false);
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
  it("scales signed amounts and leaves chances alone", () => {
    expect(scaleTraitText("+15% Vitality, -10% stamina", 0.5)).toBe("+7.5% Vitality, -5% stamina");
    expect(scaleTraitText("35% chance to Burn 5s at 35% weapon damage/s", 0.5)).toBe("35% chance to Burn 5s at 35% weapon damage/s");
  });
  it("labels quality tiers", () => {
    expect(qualityLabel(cat, 100)).toBe("Masterwork");
    expect(qualityLabel(cat, 83.4)).toBe("Great");
    expect(qualityLabel(cat, 10)).toBe("Broken");
  });
});
