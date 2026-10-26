import { describe, expect, it } from "vitest";
import { readSharedProfile, shareUrl } from "../lib/shared-profile";

const ores = [{ id: "kitsunite", count: 3 }, { id: "galaxite", count: 3 }];
const weapon = { id: "aa0f8922-4254-4307-a940-3b3f2a40e95c", name: "DKG", kind: "weapon", world: 2, class_name: "Gauntlets", variant_id: "dark-knights-gauntlets", quality: 100, ores, catalogue_revision: null };
const helm = { id: "c80459c2-53ed-4748-884b-3159a052883a", name: "Helm", kind: "armour", world: 4, class_name: "Heavy Helmet", variant_id: "shogun-helmet", quality: 90, ores, catalogue_revision: null };

describe("shared profile", () => {
  it("reads what the database sends", () => {
    const p = readSharedProfile({ name: "Alice", avatar_url: "https://x/a.png", slots: { weapon, helmet: helm }, pickaxe: "yin-yang-pickaxe" })!;
    expect(p.name).toBe("Alice");
    expect(p.avatarUrl).toBe("https://x/a.png");
    expect(p.loadout).toEqual({ helmet: helm.id, chestplate: null, leggings: null, weapon: weapon.id, pickaxe: "yin-yang-pickaxe" });
    expect(p.forges.map((f) => f.name)).toEqual(["Helm", "DKG"]);
  });

  it("drops anything that doesn't fit or isn't safe", () => {
    const p = readSharedProfile({
      name: "<b>Eve</b>", avatar_url: "javascript:alert(1)",
      slots: { helmet: weapon, chestplate: { ...helm, variant_id: "<script>" }, weapon: helm }, pickaxe: "not-a-pickaxe",
    })!;
    expect(p.name).toBe("bEve/b");
    expect(p.avatarUrl).toBeNull();
    expect(p.forges).toEqual([]);
    expect(p.loadout).toEqual({ helmet: null, chestplate: null, leggings: null, weapon: null, pickaxe: null });
  });

  it("is missing when there's no profile", () => {
    expect(readSharedProfile(null)).toBeNull();
    expect(readSharedProfile({ name: "" })).toBeNull();
  });

  it("builds the link", () => {
    expect(shareUrl("https://the-forge-calculator.vercel.app", "ddd9e2f5dde4")).toBe("https://the-forge-calculator.vercel.app/u/ddd9e2f5dde4");
  });
});
