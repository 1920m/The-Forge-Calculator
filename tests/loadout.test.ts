import { describe, expect, it } from "vitest";
import { cleanLoadout, readLoadout, slotFor, EMPTY_LOADOUT } from "@/lib/loadout";
import { PICKAXES, pickaxeById } from "@/data/pickaxes";
import images from "@/data/images.json";
import type { SavedForge } from "@/lib/saved-forges";

const forge = (id: string, kind: "weapon" | "armour", class_name: string): SavedForge => ({
  id, name: id, kind, class_name, world: 4, variant_id: "x", quality: 100, ores: [{ id: "a", count: 1 }], catalogue_revision: 8, created_at: "",
});
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222", C = "33333333-3333-4333-8333-333333333333";

describe("slotFor", () => {
  it("puts weapons in Weapon and armour by its class", () => {
    expect(slotFor({ kind: "weapon", class_name: "Gauntlets" })).toBe("weapon");
    expect(slotFor({ kind: "armour", class_name: "Heavy Helmet" })).toBe("helmet");
    expect(slotFor({ kind: "armour", class_name: "Light Chestplate" })).toBe("chestplate");
    expect(slotFor({ kind: "armour", class_name: "Medium Leggings" })).toBe("leggings");
    expect(slotFor({ kind: "armour", class_name: "Shield" })).toBeNull();
  });
});

describe("readLoadout", () => {
  it("keeps ids and known pickaxes, drops the rest", () => {
    expect(readLoadout({ helmet: A, weapon: "1; drop", pickaxe: "oni-pickaxe" })).toEqual({ ...EMPTY_LOADOUT, helmet: A, pickaxe: "oni-pickaxe" });
    expect(readLoadout({ pickaxe: "<script>" }).pickaxe).toBeNull();
    expect(readLoadout(null)).toEqual(EMPTY_LOADOUT);
  });
});

describe("cleanLoadout", () => {
  it("empties slots whose forge is gone or in the wrong slot", () => {
    const forges = new Map([[A, forge(A, "armour", "Heavy Helmet")], [B, forge(B, "weapon", "Katana")]]);
    expect(cleanLoadout({ helmet: A, chestplate: B, leggings: C, weapon: B, pickaxe: null }, forges)).toEqual({ ...EMPTY_LOADOUT, helmet: A, weapon: B });
  });
});

describe("pickaxes", () => {
  it("has unique ids, a world for each region and a picture for each", () => {
    expect(pickaxeById.size).toBe(PICKAXES.length);
    for (const p of PICKAXES) expect((images as string[]).includes(`pickaxes/${p.id}.png`)).toBe(true);
    expect(PICKAXES.filter((p) => p.world === 4).map((p) => p.name)).toContain("Oni Pickaxe");
  });
});
