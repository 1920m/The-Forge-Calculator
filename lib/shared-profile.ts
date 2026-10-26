import { EMPTY_LOADOUT, FORGE_SLOTS, cleanLoadout, slotFor, type Loadout } from "./loadout";
import { pickaxeById } from "@/data/pickaxes";
import { readSavedForge, type SavedForge } from "./saved-forges";

/** Share link ids: 12 lowercase hex characters (the database makes them and checks the same). */
export const SHARE_ID = /^[a-f0-9]{12}$/;
export const shareUrl = (origin: string, id: string) => `${origin}/u/${id}`;

export type SharedProfile = { name: string; avatarUrl: string | null; loadout: Loadout; forges: SavedForge[] };

/** Reads what get_shared_profile returns. Untrusted: anything malformed is dropped, the same as your own rows. */
export function readSharedProfile(raw: unknown): SharedProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.replace(/[<>\u0000-\u001f\u007f]/g, "").trim().slice(0, 32) : "";
  if (!name) return null;
  const avatarUrl = typeof r.avatar_url === "string" && /^https:\/\//.test(r.avatar_url) && r.avatar_url.length <= 500 ? r.avatar_url : null;
  const slots = r.slots && typeof r.slots === "object" ? (r.slots as Record<string, unknown>) : {};
  const forges: SavedForge[] = [];
  const loadout: Loadout = { ...EMPTY_LOADOUT };
  for (const s of FORGE_SLOTS) {
    const f = readSavedForge(slots[s]);
    if (f && slotFor(f) === s) { forges.push(f); loadout[s] = f.id; }
  }
  loadout.pickaxe = typeof r.pickaxe === "string" && pickaxeById.has(r.pickaxe) ? r.pickaxe : null;
  return { name, avatarUrl, forges, loadout: cleanLoadout(loadout, new Map(forges.map((f) => [f.id, f]))) };
}
