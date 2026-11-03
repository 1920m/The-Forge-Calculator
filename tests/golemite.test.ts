import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import type { Catalogue, Mix } from "../lib/engine/forge";
import { golemGrowth, golemite } from "../lib/engine/golemite";
import { GOLEMITE_RARITY } from "../data/golemites";
import { golemiteHref, readGolemite } from "../lib/golemites";
import { EMPTY_LOADOUT, LOADOUT_COLUMNS, cleanLoadout, readLoadout } from "../lib/loadout";
import { readSharedProfile } from "../lib/shared-profile";

const cat = data as unknown as Catalogue;
const ore = (name: string) => { const o = cat.ores.find((x) => x.name === name); if (!o) throw new Error(name); return o; };
const mix = (...pairs: [string, number][]): Mix => pairs.map(([n, c]) => ({ ore: ore(n), count: c }));
const G1 = "aaaaaaaa-0000-4000-8000-000000000001", G2 = "aaaaaaaa-0000-4000-8000-000000000002";

describe("Golemite from its ores", () => {
  it("takes rarity from the main ore and the wiki's mining and trait numbers", () => {
    const r = golemite(mix(["Golem Heart", 4], ["Heavenite", 3], ["Gargantuan", 3]));
    expect(r.enough).toBe(true);
    expect(r.rarity).toBe("Divine");
    expect(r.mining).toBe(0.5);
    expect(r.traitScale).toBe(0.3);
    expect(r.traits.map((t) => t.ore.name)).toEqual(["Golem Heart", "Heavenite", "Gargantuan"]);
    for (const t of r.traits) expect(t.golem).toBeCloseTo(0.3, 9); // every ore at 30% or more: full strength × 30%
  });
  it("breaks a tie by the higher multiplier, and scales a 10% ore down", () => {
    const r = golemite(mix(["Vanegos", 3], ["Kitsunite", 3], ["Fierce Jade", 3], ["Bismuth", 1]));
    expect(r.primary?.name).toBe("Kitsunite");
    expect(r.rarity).toBe("Divine");
    expect(r.traits.find((t) => t.ore.name === "Bismuth")!.golem).toBeCloseTo(0.1 * 0.3, 9);
  });
  it("needs 10 ores", () => {
    expect(golemite(mix(["Vanegos", 9])).enough).toBe(false);
    expect(golemite(mix(["Vanegos", 10])).enough).toBe(true);
    expect(golemite([]).rarity).toBeNull();
  });
  it("has a mining and trait figure for every rarity, rising with rarity", () => {
    const rows = Object.values(GOLEMITE_RARITY);
    expect(rows).toHaveLength(9);
    for (let i = 1; i < rows.length; i++) { expect(rows[i].mining).toBeGreaterThan(rows[i - 1].mining); expect(rows[i].traits).toBeGreaterThan(rows[i - 1].traits); }
  });
  it("grows 1% a level to 25 and fights from 13", () => {
    expect(golemGrowth(12)).toMatchObject({ fights: false, toCombat: 1 });
    expect(golemGrowth(13)).toMatchObject({ fights: true, size: 1.13 });
    expect(golemGrowth(40).level).toBe(25);
    expect(golemGrowth(-3).level).toBe(0);
  });
});

describe("saved Golemites", () => {
  it("reads good rows and drops bad ones", () => {
    expect(readGolemite({ id: G1, name: " Rocky ", ores: [{ id: "vanegos", count: 10 }], level: 14 })).toMatchObject({ name: "Rocky", level: 14 });
    expect(readGolemite({ id: G1, name: "Rocky", ores: [{ id: "vanegos", count: 9 }] })).toBeNull();
    expect(readGolemite({ id: "1; drop", name: "Rocky", ores: [{ id: "vanegos", count: 10 }] })).toBeNull();
    expect(readGolemite({ id: G1, name: "<b>", ores: [{ id: "vanegos", count: 10 }] })!.name).toBe("b");
    expect(readGolemite({ id: G1, name: "Rocky", ores: [{ id: "vanegos", count: 10 }], level: 99 })!.level).toBe(0);
  });
  it("links to the Golemite forge with the same ores and level", () => {
    expect(golemiteHref({ ores: [{ id: "vanegos", count: 6 }, { id: "kitsunite", count: 4 }], level: 3 })).toBe("/golemite?o=vanegos%3A6%2Ckitsunite%3A4&g=3");
  });
});

describe("Golem slots in the loadout", () => {
  it("reads both slots, and old loadouts without them", () => {
    expect(readLoadout({ golem1: G1, golem2: "x" })).toEqual({ ...EMPTY_LOADOUT, golem1: G1 });
    expect(readLoadout({}).golem1).toBeNull();
    expect(LOADOUT_COLUMNS).toContain("golem2");
  });
  it("empties a deleted Golemite, a locked slot 2 and the same Golemite twice", () => {
    const l = { ...EMPTY_LOADOUT, golem1: G1, golem2: G2 };
    expect(cleanLoadout(l, new Map(), { ids: new Set([G1, G2]), slot2: true })).toMatchObject({ golem1: G1, golem2: G2 });
    expect(cleanLoadout(l, new Map(), { ids: new Set([G1, G2]), slot2: false })).toMatchObject({ golem1: G1, golem2: null });
    expect(cleanLoadout(l, new Map(), { ids: new Set([G2]), slot2: true })).toMatchObject({ golem1: null, golem2: G2 });
    expect(cleanLoadout({ ...l, golem2: G1 }, new Map(), { ids: new Set([G1]), slot2: true })).toMatchObject({ golem1: G1, golem2: null });
    expect(cleanLoadout(l, new Map())).toMatchObject({ golem1: G1, golem2: G2 }); // left alone until the Golemites load
  });
  it("shows a shared profile's equipped Golemites, slot 2 only while open", () => {
    const g = (id: string, name: string) => ({ id, name, ores: [{ id: "golem-heart", count: 10 }], level: 13 });
    const open = readSharedProfile({ name: "Bo", slots: {}, golems: { golem1: g(G1, "One"), golem2: g(G2, "Two") }, golem_slot2: true })!;
    expect(open.golems.map((x) => x.name)).toEqual(["One", "Two"]);
    expect(open.loadout).toMatchObject({ golem1: G1, golem2: G2 });
    const shut = readSharedProfile({ name: "Bo", slots: {}, golems: { golem1: g(G1, "One"), golem2: g(G2, "Two") }, golem_slot2: false })!;
    expect(shut.golems.map((x) => x.name)).toEqual(["One"]);
    expect(shut.loadout.golem2).toBeNull();
    const old = readSharedProfile({ name: "Bo", slots: {} })!;
    expect(old.golems).toEqual([]);
    expect(old.golemSlot2).toBe(false);
  });
});
