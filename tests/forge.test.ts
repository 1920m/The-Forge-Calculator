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
  // In game (Hell Slayer craft video, 27 Oct 2026): Bismuth, Fichilliumorite, Kitsunite and Galaxite, one each,
  // shows 26.25× and a Masterwork (100%) Hell Slayer with 584.06 DMG. Bismuth and Fichilliumorite both take the
  // average of the other ores, so the multiplier is the average of Kitsunite (27.5) and Galaxite (25).
  it("Hell Slayer: Bismuth takes the average like Fichilliumorite, 26.25x, 584.06 DMG", () => {
    const r = forge(cat, mix(["Bismuth", 1], ["Fichilliumorite", 1], ["Kitsunite", 1], ["Galaxite", 1]), "weapon", 4, 1);
    expect(r.multiplier!.toFixed(2)).toBe("26.25");
    expect(r.rarity).toBe("Divine");
    const hs = r.classes.find((c) => c.name === "Straight Sword")!.variants.find((v) => v.name === "Hell Slayer")!;
    expect(hs.value).toBe(584.06);
    // More Bismuth doesn't drag the multiplier down either.
    expect(forge(cat, mix(["Bismuth", 5], ["Kitsunite", 2], ["Galaxite", 2]), "weapon", 4, 1).multiplier).toBeCloseTo(26.25, 9);
  });
  it("uses each world's classes: 1–2 Gauntlets/Katana/Greatsword, 3 Mace/Axe/Spear, 4 Mace/Katana/Spear", () => {
    const names = (w: 1 | 2 | 3 | 4) => forge(cat, mix(["Iron", 10]), "weapon", w, 1).classes.slice(2, 5).map((c) => c.name);
    expect(names(2)).toEqual(["Gauntlets", "Katana", "Greatsword"]);
    expect(names(3)).toEqual(["Mace", "Axe", "Spear"]);
    expect(names(4)).toEqual(["Mace", "Katana", "Spear"]);
  });
  it("World 4 Katana includes the World 2 katanas, Juto, Kurokiba, Washi-maru and Halloween Straight Edge; Dragon Slayer is 1/1", () => {
    expect(classVariants(cat, "weapon", 4, "Katana").map((v) => v.name)).toEqual(["Uchigatana", "Tachi", "Juto Katana", "Kurokiba-gatana", "Washi-maru", "Straight Edge Katana"]);
    // Shop blueprints roll where Cris saw the Funguy shop; leftovers are World 4 Halloween weapons.
    expect(classVariants(cat, "weapon", 3, "Dagger").map((v) => v.name)).toEqual(expect.arrayContaining(["Dagger", "Hook", "Cultist Dagger"]));
    expect(classVariants(cat, "weapon", 2, "Dagger").map((v) => v.name)).not.toContain("Cultist Dagger");
    expect(classVariants(cat, "weapon", 4, "Spear").find((v) => v.name === "Demonic Spear")?.tag).toBe("halloween");
    expect(classVariants(cat, "weapon", 4, "Colossal Sword").find((v) => v.name === "Dragon Slayer")?.weight).toBe(1);
    expect(classVariants(cat, "weapon", 2, "Colossal Sword").find((v) => v.name === "Dragon Slayer")?.weight).toBe(16);
  });
  it("World 1 uses Gauntlets in slot 3 and hides World 4 variants", () => {
    const r = forge(cat, mix(["Iron", 7]), "weapon", 1, 1);
    expect(r.classes[2].name).toBe("Gauntlets");
    expect(r.classes[1].variants.some((v) => v.name === "Hachiwari")).toBe(false);
  });
  it("uses the in-game weights: Wolf 1/3, Raven 1/8", () => {
    const heavy = classVariants(cat, "armour", 3, "Heavy Chestplate");
    expect(heavy.find((v) => v.name === "Wolf Chestplate")?.weight).toBe(3);
    expect(heavy.find((v) => v.name === "Raven's Chestplate")?.weight).toBe(8);
  });
  it("can't forge Knight, Wolf or Raven's armour in World 4 (players' feedback)", () => {
    for (const slot of ["Heavy Helmet", "Heavy Chestplate", "Heavy Leggings", "Medium Helmet", "Medium Chestplate", "Medium Leggings"]) {
      const names = classVariants(cat, "armour", 4, slot).map((v) => v.name);
      expect(names.filter((n) => /^(Knight|Wolf|Raven's) /.test(n))).toEqual([]);
    }
    expect(classVariants(cat, "armour", 3, "Heavy Chestplate").map((v) => v.name)).toContain("Knight Chestplate");
  });
  it("lists Comically Large Spoon as a World 1 weapon, not a World 4 shop blueprint", () => {
    const spoon = cat.weapons.find((w) => w.id === "comically-large-spoon")!;
    expect(spoon.worlds).toEqual([1]);
    expect(spoon.tag).toBe("world1");
    expect(classVariants(cat, "weapon", 2, "Colossal Sword").map((v) => v.id)).toContain("comically-large-spoon");
    expect(classVariants(cat, "weapon", 4, "Colossal Sword").map((v) => v.id)).not.toContain("comically-large-spoon");
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

describe("locking a class", async () => {
  const { lockClass } = await import("../lib/engine/forge");
  const r = forge(cat, mix(["Bismuth", 1], ["Fichilliumorite", 1], ["Galaxite", 1], ["Kitsunite", 1], ["Iron", 6]), "weapon", 4, 1); // 10 ores
  const sum = (cs: typeof r.classes) => cs.reduce((a, c) => a + c.variants.reduce((b, v) => b + v.overall, 0), 0);

  it("changes nothing when no class is locked", () => {
    expect(lockClass(r.classes, null)).toBe(r.classes);
  });
  it("guarantees the locked class and keeps the 1 in N split inside it", () => {
    const ss = r.classes.find((c) => c.name === "Straight Sword")!;
    expect(ss.lockable).toBe(true); // 9 ores lock Straight Sword
    const locked = lockClass(r.classes, "Straight Sword");
    expect(locked.find((c) => c.name === "Straight Sword")!.probability).toBe(100);
    expect(locked.filter((c) => c.name !== "Straight Sword").every((c) => c.probability === 0 && c.variants.every((v) => v.overall === 0))).toBe(true);
    const hs = locked.find((c) => c.name === "Straight Sword")!.variants.find((v) => v.name === "Hell Slayer")!;
    expect(hs.overall).toBeCloseTo(hs.chance, 12);
    expect(sum(locked)).toBeCloseTo(100, 9);
    expect(sum(r.classes)).toBeCloseTo(100, 9);
  });
  it("can't lock a class the ores don't reach", () => {
    const colossal = r.classes.find((c) => c.name === "Colossal Sword")!;
    expect(colossal.lockable).toBe(false);
    expect(lockClass(r.classes, "Colossal Sword")).toBe(r.classes);
  });
});
