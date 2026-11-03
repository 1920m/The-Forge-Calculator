import { pickaxeById } from "@/data/pickaxes";
import { raceById } from "@/data/races";
import type { SavedForge } from "./saved-forges";

/** Gear slots, in the order the game's LOADOUT screen shows them: armour on the left, weapon and pickaxe on the right. */
export const ARMOUR_SLOTS = ["helmet", "chestplate", "leggings"] as const;
export type ArmourSlot = (typeof ARMOUR_SLOTS)[number];
export type ForgeSlot = ArmourSlot | "weapon";
export const GOLEM_SLOTS = ["golem1", "golem2"] as const;
export type GolemSlot = (typeof GOLEM_SLOTS)[number];
export type Slot = ForgeSlot | "pickaxe" | "race" | GolemSlot;
export const FORGE_SLOTS: ForgeSlot[] = [...ARMOUR_SLOTS, "weapon"];

export const SLOT_LABEL: Record<Slot, string> = { helmet: "Helmet", chestplate: "Chestplate", leggings: "Leggings", weapon: "Weapon", pickaxe: "Pickaxe", race: "Race", golem1: "Golemite", golem2: "Golemite 2" };

/** `race` is the race the player plays, `golem1`/`golem2` their Golemites (null in loadouts saved before these existed). */
export type Loadout = Record<ForgeSlot | GolemSlot, string | null> & { pickaxe: string | null; race: string | null };
export const EMPTY_LOADOUT: Loadout = { helmet: null, chestplate: null, leggings: null, weapon: null, pickaxe: null, race: null, golem1: null, golem2: null };
export const LOADOUT_COLUMNS = "helmet, chestplate, leggings, weapon, pickaxe, race, golem1, golem2";

/** Which slot a saved forge goes in: any weapon in Weapon; armour by its class ("Heavy Helmet" → helmet). */
export function slotFor(f: Pick<SavedForge, "kind" | "class_name">): ForgeSlot | null {
  if (f.kind === "weapon") return "weapon";
  const last = f.class_name.trim().split(/\s+/).pop()?.toLowerCase();
  return (ARMOUR_SLOTS as readonly string[]).includes(last ?? "") ? (last as ArmourSlot) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the loadout row. Untrusted: slots must be ids, the pickaxe and race must be ones we know. */
export function readLoadout(row: unknown): Loadout {
  if (!row || typeof row !== "object") return { ...EMPTY_LOADOUT };
  const r = row as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
  return {
    helmet: id(r.helmet), chestplate: id(r.chestplate), leggings: id(r.leggings), weapon: id(r.weapon),
    pickaxe: typeof r.pickaxe === "string" && pickaxeById.has(r.pickaxe) ? r.pickaxe : null,
    race: typeof r.race === "string" && raceById.has(r.race) ? r.race : null,
    golem1: id(r.golem1), golem2: id(r.golem2),
  };
}

/**
 * Drops slots whose forge is gone or no longer fits (the database does the same when a forge is deleted).
 * With `golems` given, Golem slots whose Golemite is gone are emptied too, and slot 2 while it's locked.
 */
export function cleanLoadout(l: Loadout, forges: Map<string, SavedForge>, golems?: { ids: Set<string>; slot2: boolean }): Loadout {
  const out = { ...l };
  for (const s of FORGE_SLOTS) {
    const f = out[s] ? forges.get(out[s]!) : undefined;
    if (!f || slotFor(f) !== s) out[s] = null;
  }
  if (golems) {
    for (const s of GOLEM_SLOTS) if (out[s] && !golems.ids.has(out[s]!)) out[s] = null;
    if (!golems.slot2 || out.golem2 === out.golem1) out.golem2 = null;
  }
  return out;
}

/** The calculator's race choice (`r` in the link): a race id, or "me" for the race in your Profile. Anything else is none. */
export const PROFILE_RACE = "me";
export function readRaceChoice(v: unknown): string | null {
  return typeof v === "string" && (v === PROFILE_RACE || raceById.has(v)) ? v : null;
}
