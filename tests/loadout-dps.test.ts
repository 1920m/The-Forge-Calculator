import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import { forge, type Catalogue, type Mix } from "../lib/engine/forge";
import { weaponDps } from "../lib/engine/dps";
import { enhanceFactor } from "../lib/engine/index";
import { dpsAtLevel, decodeRunes } from "../lib/engine/runes";
import { armourExtra, combatDps, golemExtra, raceExtra, type CombatInput } from "../lib/engine/loadout-dps";
import { golemite } from "../lib/engine/golemite";
import { golemInput } from "../lib/forge-stats";
import { RACES } from "../data/races";

const cat = data as unknown as Catalogue;
const ore = (name: string) => { const o = cat.ores.find((x) => x.name === name); if (!o) throw new Error(name); return o; };
const mix = (...pairs: [string, number][]): Mix => pairs.map(([n, c]) => ({ ore: ore(n), count: c }));
const weaponOf = (m: Mix, world: 2 | 3 | 4, cls: string, id: string) => {
  const v = forge(cat, m, "weapon", world, 1).classes.find((c) => c.name === cls)!.variants.find((x) => x.id === id)!;
  return { ores: m.map((x) => ({ id: x.ore.id, count: x.count })), raw: v.raw!, interval: v.interval!, cls };
};
// A plain weapon (Iron has no traits) and a trait-heavy one.
const plainMace = weaponOf(mix(["Iron", 14]), 4, "Mace", "mace");
const hellSlayer = weaponOf(mix(["Bismuth", 1], ["Fichilliumorite", 1], ["Galaxite", 1], ["Kitsunite", 1]), 4, "Straight Sword", "hell-slayer");
const gauntlets = weaponOf(mix(["Iron", 15]), 2, "Gauntlets", "dark-knights-gauntlets");
const spear = weaponOf(mix(["Iron", 24]), 4, "Spear", "spear");
const piece = (...pairs: [string, number][]) => ({ ores: pairs.map(([n, c]) => ({ id: ore(n).id, count: c })) });
const run = (p: Partial<CombatInput> & { weapon: CombatInput["weapon"] }) => combatDps({ level: 0, ...p });

describe("full-loadout DPS: nothing extra", () => {
  it("matches today's weapon DPS exactly with no armour or race", () => {
    const now = dpsAtLevel(hellSlayer, 0).total;
    expect(run({ weapon: hellSlayer }).total).toBeCloseTo(now, 9);
    const runes = decodeRunes("blast-chip:3:atk_speed.crit_chance.lethality,flame-spark:2:crit_dmg.lethality,-", "weapon");
    expect(run({ weapon: hellSlayer, level: 9, runes }).total).toBeCloseTo(dpsAtLevel(hellSlayer, 9, runes).total, 9);
  });
  it("treats empty slots and unknown races as nothing", () => {
    const base = run({ weapon: plainMace }).total;
    expect(run({ weapon: plainMace, armour: [null, null, null], raceId: null }).total).toBe(base);
    expect(run({ weapon: plainMace, raceId: "not-a-race" }).total).toBe(base);
    expect(run({ weapon: plainMace, armour: [piece(["Iron", 30])] }).total).toBe(base); // Iron has no damage trait
  });
  it("breaks the total into layers that add up to it", () => {
    const runes = decodeRunes("blast-chip:3:atk_speed,-,-", "weapon");
    const r = run({ weapon: hellSlayer, level: 9, runes, armour: [piece(["Vanegos", 10])], raceId: "demon" });
    expect(r.breakdown.map((b) => b.key)).toEqual(["base", "ores", "enhance", "runes", "armour", "race"]);
    expect(r.breakdown.reduce((a, b) => a + b.dps, 0)).toBeCloseTo(r.total, 9);
    expect(r.breakdown.every((b) => b.dps >= 0)).toBe(true);
  });
});

describe("armour traits", () => {
  it("adds Lethality from a Vanegos piece, scaled by its share", () => {
    expect(armourExtra([piece(["Vanegos", 3], ["Iron", 7])]).extra.vals?.lethality?.[0]).toBeCloseTo(0.4, 9); // 30%: full
    expect(armourExtra([piece(["Vanegos", 1], ["Iron", 9])]).extra.vals?.lethality?.[0]).toBeCloseTo(0.04, 9); // 10%: a tenth
    expect(armourExtra([piece(["Vanegos", 1], ["Iron", 19])]).extra.vals?.lethality).toBeUndefined(); // 5%: off
  });
  it("adds each piece's traits once, so three pieces add up (then the usual caps)", () => {
    const one = run({ weapon: plainMace, armour: [piece(["Vanegos", 10])] }).result.lethality;
    const three = run({ weapon: plainMace, armour: [piece(["Vanegos", 10]), piece(["Vanegos", 10]), piece(["Vanegos", 10])] }).result.lethality;
    expect(one).toBeCloseTo(0.4, 9);
    expect(three).toBeCloseTo(1.2, 9);
  });
  it("counts the confirmed crit traits (Yin-Yang, Fierce Jade, Bismuth) and caps crit chance at 100%", () => {
    const r = run({ weapon: plainMace, armour: [piece(["Yin-Yang", 10]), piece(["Fierce Jade", 10]), piece(["Bismuth", 3], ["Iron", 7])] }).result;
    expect(r.critChance).toBeCloseTo(0.95, 9); // 45% + 35% + 15%
    expect(r.critDamage).toBeCloseTo(0.55, 9); // 20% + 20% + 15%
    const capped = run({ weapon: plainMace, armour: [piece(["Yin-Yang", 10]), piece(["Yin-Yang", 10]), piece(["Yin-Yang", 10])] }).result;
    expect(capped.critChance).toBe(1);
  });
  it("adds Demonite's burn to a weapon that has none", () => {
    const r = run({ weapon: plainMace, armour: [piece(["Demonite", 10])] }).result;
    expect(r.parts.find((p) => p.label === "Burn")?.dps).toBeGreaterThan(0);
  });
  it("never adds Lethality to procs: an armour Lethality bonus leaves burn damage alone", () => {
    const a = run({ weapon: plainMace, armour: [piece(["Demonite", 10])] }).result;
    const b = run({ weapon: plainMace, armour: [piece(["Demonite", 10]), piece(["Vanegos", 10])] }).result;
    expect(b.parts.find((p) => p.label === "Burn")!.dps).toBeCloseTo(a.parts.find((p) => p.label === "Burn")!.dps, 9);
    expect(b.hit).toBeGreaterThan(a.hit);
  });
});

describe("races", () => {
  it("has combat data on the same 20 races, without a second race list", () => {
    expect(RACES).toHaveLength(20);
    expect(RACES.filter((r) => r.combat).map((r) => r.id).sort()).toEqual(["angel", "archangel", "demon", "dragonborn", "dryad", "fairy", "felynx", "goblin", "golem", "kitsune", "minotaur", "orc", "orc-lord", "shadow", "vampire"]);
  });
  it("adds Physical Damage as Lethality and attack speed (Orc, Shadow, Demon)", () => {
    const base = run({ weapon: plainMace }).result;
    expect(run({ weapon: plainMace, raceId: "orc" }).result.lethality - base.lethality).toBeCloseTo(0.1, 9);
    const demon = run({ weapon: plainMace, raceId: "demon" }).result;
    expect(demon.lethality - base.lethality).toBeCloseTo(0.2, 9);
    expect(demon.atkSpeed - base.atkSpeed).toBeCloseTo(0.2, 9);
  });
  it("applies weapon-class bonuses only to that class", () => {
    const felynx = run({ weapon: gauntlets, raceId: "felynx" }).result;
    const plain = run({ weapon: gauntlets }).result;
    expect(felynx.lethality - plain.lethality).toBeCloseTo(0.2, 9);
    expect(felynx.atkSpeed - plain.atkSpeed).toBeCloseTo(0.2, 9);
    expect(run({ weapon: plainMace, raceId: "felynx" }).total).toBe(run({ weapon: plainMace }).total);
    expect(raceExtra("golem", "Great Axe").extra.vals?.atk_speed).toEqual([0.15]);
    expect(raceExtra("golem", "Katana").extra.vals?.atk_speed).toBeUndefined();
  });
  it("adds Kitsune's and Fairy's bonuses after the caps", () => {
    const capped = weaponDps({ ores: [], damage: 100, interval: 1, extra: { vals: { lethality: [5], atk_speed: [5] }, uncapped: { lethality: 0.15, atk_speed: 0.2 } } });
    expect(capped.lethality).toBeCloseTo(3.15, 9);
    expect(capped.atkSpeed).toBeCloseTo(1.7, 9);
    const fairy = run({ weapon: spear, raceId: "fairy" }).result;
    expect(fairy.lethality).toBeCloseTo(run({ weapon: spear }).result.lethality + 0.15, 9);
  });
  it("adds race procs: Kitsune's claws and foxfire, Orc Lord's slam, Demon's aura", () => {
    const labels = (id: string) => run({ weapon: plainMace, raceId: id }).result.parts.map((p) => p.label);
    expect(labels("kitsune")).toEqual(expect.arrayContaining(["Fox Claws", "Foxfire"]));
    expect(labels("orc-lord")).toContain("Titanic Earthquake");
    const demon = run({ weapon: plainMace, raceId: "demon" }).result;
    expect(demon.parts.find((p) => p.label === "Cursed Aura")!.dps).toBeCloseTo(plainMace.raw * 0.1, 9);
  });
  it("merges Dragonborn's burn and Angel's smite into the weapon's own", () => {
    expect(run({ weapon: plainMace, raceId: "dragonborn" }).result.parts.map((p) => p.label)).toContain("Burn");
    expect(run({ weapon: plainMace, raceId: "angel" }).result.parts.map((p) => p.label)).toContain("Smite");
    // Demon's +20% fire damage alone can't start a burn: it needs a burn chance from somewhere.
    expect(run({ weapon: plainMace, raceId: "demon" }).result.parts.map((p) => p.label)).not.toContain("Burn");
  });
  it("adds race and runes together once each", () => {
    const runes = decodeRunes("blast-chip:3:atk_speed,-,-", "weapon");
    const r = run({ weapon: plainMace, level: 9, runes, raceId: "shadow" });
    const byKey = Object.fromEntries(r.breakdown.map((b) => [b.key, b.dps]));
    expect(byKey.runes).toBeGreaterThan(0);
    expect(byKey.race).toBeGreaterThan(0);
    expect(r.result.atkSpeed).toBeCloseTo(0.18 + 0.1, 9); // rune side effect 18% + Shadow 10%
  });
});

describe("conditions never touch the normal DPS", () => {
  const berserkBuild = { weapon: plainMace, armour: [piece(["Vanegos", 10])] };
  it("shows a separate below-35%-HP figure when armour or race has Berserker", () => {
    const r = run(berserkBuild);
    expect(r.lowHp).not.toBeNull();
    expect(r.lowHp!).toBeGreaterThan(r.total);
    expect(run({ weapon: plainMace }).lowHp).toBeNull();
    expect(run({ weapon: plainMace, raceId: "minotaur" }).lowHp).toBeGreaterThan(run({ weapon: plainMace, raceId: "minotaur" }).total);
  });
  it("keeps the normal DPS the same whatever conditions are chosen", () => {
    const normal = run(berserkBuild).total;
    const r = run({ ...berserkBuild, conditions: { lowHp: true } });
    expect(r.total).toBe(normal);
    expect(r.conditional).toBeCloseTo(r.lowHp!, 9);
  });
  it("handles Orc Lord, Dryad and Kitsune conditions, alone and together", () => {
    const orc = run({ weapon: plainMace, raceId: "orc-lord" });
    const hurt = run({ weapon: plainMace, raceId: "orc-lord", conditions: { orcLordMissingHp: 0.5, orcLordKills: 5 } });
    expect(hurt.conditional!).toBeGreaterThan(orc.total);
    expect(hurt.total).toBe(orc.total);
    const half = run({ weapon: plainMace, raceId: "orc-lord", conditions: { orcLordMissingHp: 0.5 } }).conditional!;
    expect(hurt.conditional!).toBeGreaterThan(half); // the kill stacks add on top
    expect(run({ weapon: plainMace, raceId: "dryad", conditions: { dryadGrove: true } }).conditional!).toBeGreaterThan(run({ weapon: plainMace, raceId: "dryad" }).total);
    expect(run({ weapon: plainMace, raceId: "kitsune", conditions: { kitsuneDodge: true } }).conditional!).toBeGreaterThan(run({ weapon: plainMace, raceId: "kitsune" }).total);
    // A condition for another race does nothing.
    expect(run({ weapon: plainMace, raceId: "orc", conditions: { dryadGrove: true } }).conditional).toBeCloseTo(run({ weapon: plainMace, raceId: "orc" }).total, 9);
  });
  it("uses max health only for fire, poison, black hole and lightning (Vital Power)", () => {
    const build = { weapon: plainMace, raceId: "dryad", armour: [piece(["Demonite", 10])] };
    const r = run({ ...build, conditions: { maxHp: 10000 } });
    const normal = run(build).result;
    const burn = normal.parts.find((p) => p.label === "Burn")!.dps;
    expect(r.conditional! - r.total).toBeCloseTo(burn * 0.5, 6); // +50% at 10,000 health, burn only
  });
});

describe("enhancement", () => {
  it("uses the game's table: +5% a level to +8, ×1.50 at +9 (the top)", () => {
    expect(enhanceFactor(8)).toBeCloseTo(1.4, 9);
    expect(enhanceFactor(9)).toBeCloseTo(1.5, 9);
    expect(enhanceFactor(10)).toBeCloseTo(1.5, 9);
    const r0 = run({ weapon: plainMace, level: 0 }).total, r9 = run({ weapon: plainMace, level: 9 }).total;
    expect(r9 / r0).toBeCloseTo(1.5, 9);
    expect(r9).toBeCloseTo(6.282, 3); // the wiki's calculator, Mace (14 Iron) at +9
  });
  it.todo("stop scaling procs with enhancement, if the game shows procs use the damage before enhancing (as the wiki's script does)");
});

/*
 * The wiki's DPS calculator (MediaWiki:ForgeCalculator.js), run in the browser on 3 Nov 2026 with the same builds.
 * Race and armour layers match it. The known differences (docs/wiki-dps-comparison.md) are left out here:
 * enhancement (×1.50 at +9), and the wiki's newer proc maths (rolled chances, saturating burn uptime).
 */
describe("matches the wiki's calculator for race and armour", () => {
  const kunai = weaponOf(mix(["Iron", 3]), 4, "Dagger", "kunai");
  const wiki: [string, CombatInput["weapon"], string | null, CombatInput["armour"], number][] = [
    ["Mace, no race", plainMace, null, [], 4.188],
    ["Kunai, Goblin", kunai, "goblin", [], 7.641],
    ["Dark Knight's Gauntlets, Felynx", gauntlets, "felynx", [], 19.765],
    ["Spear, Fairy", spear, "fairy", [], 9.511],
    ["Mace, Orc", plainMace, "orc", [], 4.607],
    ["Mace, Dragonborn", plainMace, "dragonborn", [], 5.697],
    ["Mace, ArchAngel", plainMace, "archangel", [], 6.598],
    ["Mace, Kitsune", plainMace, "kitsune", [], 8.358],
    ["Mace, Orc Lord", plainMace, "orc-lord", [], 6.197],
    ["Mace, Shadow, Vanegos and Yin-Yang armour", plainMace, "shadow", [piece(["Vanegos", 10]), piece(["Yin-Yang", 10]), null], 8.634],
  ];
  for (const [name, weapon, raceId, armour, expected] of wiki) {
    it(name, () => expect(run({ weapon, raceId, armour }).total).toBeCloseTo(expected, 2));
  }
  it("adds the same for Vampire on a Hell Slayer, and Minotaur below 35% HP", () => {
    const plain = run({ weapon: hellSlayer }).total;
    expect(run({ weapon: hellSlayer, raceId: "vampire" }).total - plain).toBeCloseTo(2380.632 - 2265.494, 2);
    const mino = run({ weapon: hellSlayer, raceId: "minotaur", armour: [piece(["Fierce Jade", 10]), null, null] });
    expect(mino.lowHp! - mino.total).toBeCloseTo(3862.427 - 2896.805, 1);
  });
});

describe("full-loadout DPS: Golemites", () => {
  const golem = (...pairs: [string, number][]) => golemInput(golemite(mix(...pairs)));

  it("adds a Golemite's weapon ore traits at its rarity's trait scale", () => {
    const g = golem(["Galaxite", 10]); // Divine: traits at 30%
    expect(g?.traitScale).toBe(0.3);
    const withGolem = run({ weapon: plainMace, golems: [g] });
    // Galaxite at full strength (100% of the Golemite): 45% crit chance, 20% crit damage, 60% black hole, × 0.3.
    const manual = weaponDps({ ores: plainMace.ores, damage: plainMace.raw, interval: plainMace.interval, extra: { vals: { crit_chance: [0.135], crit_dmg: [0.06], blackhole_dmg: [0.18] } } }).total;
    expect(withGolem.total).toBeCloseTo(manual, 9);
    expect(withGolem.total).toBeGreaterThan(run({ weapon: plainMace }).total);
    expect(withGolem.golemsCounted).toEqual([true]);
    const row = withGolem.breakdown.find((b) => b.key === "golems")!;
    expect(row.label).toBe("Golemite traits");
    expect(row.dps).toBeCloseTo(withGolem.total - run({ weapon: plainMace }).total, 9);
    expect(withGolem.breakdown.reduce((n, b) => n + b.dps, 0)).toBeCloseTo(withGolem.total, 9);
  });

  it("two Golemites both count; an empty slot or a Golemite with no damage traits adds nothing", () => {
    const one = run({ weapon: plainMace, golems: [golem(["Galaxite", 10])] }).total;
    const two = run({ weapon: plainMace, golems: [golem(["Galaxite", 10]), golem(["Kyubite", 10])] });
    expect(two.total).toBeGreaterThan(one);
    expect(two.golemsCounted).toEqual([true, true]);
    const none = run({ weapon: plainMace }).total;
    const lucky = run({ weapon: plainMace, golems: [golem(["Lucky Cat", 10]), null] });
    expect(lucky.total).toBeCloseTo(none, 9);
    expect(lucky.golemsCounted).toEqual([false, false]);
  });

  it("adds armour traits too, without counting a shared weapon-and-armour trait twice", () => {
    // Bismuth's armour trait (+15% crit chance, crit damage and Lethality) isn't in its weapon traits: added, × 0.3.
    const b = golemExtra([golem(["Bismuth", 10])]).extra.vals!;
    expect(b.crit_chance).toEqual([expect.closeTo(0.045, 9)]);
    expect(b.lethality).toEqual([expect.closeTo(0.045, 9)]);
    // Eye Ore's +15% Lethality is one trait for both: counted once.
    expect(golemExtra([golem(["Eye Ore", 10])]).extra.vals!.lethality).toHaveLength(1);
    // Vanegos: shared Lethality once, plus its armour-only Berserker (below 35% HP) as a condition, not in the normal DPS.
    const v = golemExtra([golem(["Vanegos", 10])]);
    expect(v.extra.vals!.lethality).toHaveLength(1);
    expect(v.lowHp).toBeGreaterThan(0);
    const r = run({ weapon: plainMace, golems: [golem(["Vanegos", 10])] });
    expect(r.lowHp).not.toBeNull();
    expect(r.lowHp!).toBeGreaterThan(r.total);
    // Demonite's burn is armour-only: added, with its duration unscaled.
    const d = golemExtra([golem(["Demonite", 10])]).extra.vals!;
    expect(d.fire_duration).toEqual([2]);
    expect(d.fire_chance).toHaveLength(1);
  });

  it("follows the 10% rule inside the Golemite, and keeps durations at the ore's own value", () => {
    // Galaxite is 1 of 11 ores (9%): below 10%, so none of its traits carry over.
    expect(golemExtra([golem(["Iron", 10], ["Galaxite", 1])]).used).toEqual([false]);
    const burn = golemExtra([golem(["Kyubite", 10])]).extra.vals!;
    expect(burn.fire_duration).toEqual([5]); // not scaled by the rarity
    expect(burn.fire_dmg![0]).toBeCloseTo(0.45 * golemInput(golemite(mix(["Kyubite", 10])))!.traitScale, 9);
  });
});
