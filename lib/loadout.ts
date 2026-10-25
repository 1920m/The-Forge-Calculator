import { pickaxeById } from "@/data/pickaxes";
import type { SavedForge } from "./saved-forges";

/** Gear slots, in the order the game's LOADOUT screen shows them: armour on the left, weapon and pickaxe on the right. */
export const ARMOUR_SLOTS = ["helmet", "chestplate", "leggings"] as const;
export type ArmourSlot = (typeof ARMOUR_SLOTS)[number];
export type ForgeSlot = ArmourSlot | "weapon";
export type Slot = ForgeSlot | "pickaxe";
export const FORGE_SLOTS: ForgeSlot[] = [...ARMOUR_SLOTS, "weapon"];

export const SLOT_LABEL: Record<Slot, string> = { helmet: "Helmet", chestplate: "Chestplate", leggings: "Leggings", weapon: "Weapon", pickaxe: "Pickaxe" };

export type Loadout = Record<ForgeSlot, string | null> & { pickaxe: string | null };
export const EMPTY_LOADOUT: Loadout = { helmet: null, chestplate: null, leggings: null, weapon: null, pickaxe: null };
export const LOADOUT_COLUMNS = "helmet, chestplate, leggings, weapon, pickaxe";

/** Which slot a saved forge goes in: any weapon in Weapon; armour by its class ("Heavy Helmet" → helmet). */
export function slotFor(f: Pick<SavedForge, "kind" | "class_name">): ForgeSlot | null {
  if (f.kind === "weapon") return "weapon";
  const last = f.class_name.trim().split(/\s+/).pop()?.toLowerCase();
  return (ARMOUR_SLOTS as readonly string[]).includes(last ?? "") ? (last as ArmourSlot) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the loadout row. Untrusted: slots must be ids, the pickaxe must be one we know. */
export function readLoadout(row: unknown): Loadout {
  if (!row || typeof row !== "object") return { ...EMPTY_LOADOUT };
  const r = row as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
  return {
    helmet: id(r.helmet), chestplate: id(r.chestplate), leggings: id(r.leggings), weapon: id(r.weapon),
    pickaxe: typeof r.pickaxe === "string" && pickaxeById.has(r.pickaxe) ? r.pickaxe : null,
  };
}

/** Drops slots whose forge is gone or no longer fits (the database does the same when a forge is deleted). */
export function cleanLoadout(l: Loadout, forges: Map<string, SavedForge>): Loadout {
  const out = { ...l };
  for (const s of FORGE_SLOTS) {
    const f = out[s] ? forges.get(out[s]!) : undefined;
    if (!f || slotFor(f) !== s) out[s] = null;
  }
  return out;
}
