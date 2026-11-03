import { describe, expect, it } from "vitest";
import { readSharedProfile, shareUrl } from "../lib/shared-profile";
import data from "../data/catalogue.json";
import type { Catalogue } from "../lib/engine/forge";
import { forgeCombat, work } from "../lib/forge-stats";
import type { SavedForge } from "../lib/saved-forges";

const ores = [{ id: "kitsunite", count: 3 }, { id: "galaxite", count: 3 }];
const weapon = { id: "aa0f8922-4254-4307-a940-3b3f2a40e95c", name: "DKG", kind: "weapon", world: 2, class_name: "Gauntlets", variant_id: "dark-knights-gauntlets", quality: 100, ores, catalogue_revision: null };
const helm = { id: "c80459c2-53ed-4748-884b-3159a052883a", name: "Helm", kind: "armour", world: 4, class_name: "Heavy Helmet", variant_id: "shogun-helmet", quality: 90, ores, catalogue_revision: null };

describe("shared profile", () => {
  it("reads what the database sends", () => {
    const p = readSharedProfile({ name: "Alice", avatar_url: "https://x/a.png", slots: { weapon, helmet: helm }, pickaxe: "yin-yang-pickaxe" })!;
    expect(p.name).toBe("Alice");
    expect(p.avatarUrl).toBe("https://x/a.png");
    expect(p.loadout).toEqual({ helmet: helm.id, chestplate: null, leggings: null, weapon: weapon.id, pickaxe: "yin-yang-pickaxe", race: null });
    expect(p.forges.map((f) => f.name)).toEqual(["Helm", "DKG"]);
  });

  it("drops anything that doesn't fit or isn't safe", () => {
    const p = readSharedProfile({
      name: "<b>Eve</b>", avatar_url: "javascript:alert(1)",
      slots: { helmet: weapon, chestplate: { ...helm, variant_id: "<script>" }, weapon: helm }, pickaxe: "not-a-pickaxe", race: "<script>",
    })!;
    expect(p.name).toBe("bEve/b");
    expect(p.avatarUrl).toBeNull();
    expect(p.forges).toEqual([]);
    expect(p.loadout).toEqual({ helmet: null, chestplate: null, leggings: null, weapon: null, pickaxe: null, race: null });
  });

  it("reads the race, and old profiles without one", () => {
    expect(readSharedProfile({ name: "Bo", slots: {}, race: "orc-lord" })!.loadout.race).toBe("orc-lord");
    expect(readSharedProfile({ name: "Bo", slots: {} })!.loadout.race).toBeNull();
    expect(readSharedProfile({ name: "Bo", slots: {}, race: "not-a-race" })!.loadout.race).toBeNull();
  });

  it("works out the same loadout DPS as the owner sees", () => {
    const cat = data as unknown as Catalogue;
    const oreById = new Map(cat.ores.map((o) => [o.id, o]));
    const iron = [{ id: cat.ores.find((o) => o.name === "Iron")!.id, count: 15 }];
    const vanegos = cat.ores.find((o) => o.name === "Vanegos");
    const armourOres = vanegos ? [...iron, { id: vanegos.id, count: 5 }] : iron;
    const own = { ...weapon, ores: iron, created_at: "", enhance: 6, runes: null };
    const chest = { ...helm, id: "d80459c2-53ed-4748-884b-3159a052883a", class_name: "Heavy Chestplate", variant_id: "knight-chestplate", world: 2, ores: armourOres, created_at: "", enhance: null, runes: null };
    const p = readSharedProfile({ name: "Bo", slots: { weapon: own, chestplate: chest }, race: "orc" })!;
    const card = (f: SavedForge) => ({ f, r: work(cat, oreById, f) });
    const shared = forgeCombat(card(p.forges.find((f) => f.kind === "weapon")!), [null, card(p.forges.find((f) => f.kind === "armour")!), null], p.loadout.race);
    const mine = forgeCombat(card(own as SavedForge), [null, card(chest as SavedForge), null], "orc");
    expect(shared).not.toBeNull();
    expect(shared!.total).toBeCloseTo(mine!.total, 9);
    expect(shared!.breakdown.find((b) => b.key === "race")!.dps).toBeGreaterThan(0);
  });

  it("is missing when there's no profile", () => {
    expect(readSharedProfile(null)).toBeNull();
    expect(readSharedProfile({ name: "" })).toBeNull();
  });

  it("builds the link", () => {
    expect(shareUrl("https://the-forge-calculator.vercel.app", "ddd9e2f5dde4")).toBe("https://the-forge-calculator.vercel.app/u/ddd9e2f5dde4");
  });
});
