import type { Kind, World } from "./engine";
import { MAX_TYPES, parseRecipe, type Entry } from "./forge-slots";
import { decodeRunes, encodeRunes, hasRunes } from "./engine/runes";

/** The star on the calculator: a forge's inputs. Stats are worked out again from the current game data. */
export type SavedForge = {
  id: string;
  name: string;
  kind: Kind;
  world: World;
  class_name: string;
  variant_id: string;
  quality: number;
  ores: Entry[];
  catalogue_revision: number | null;
  created_at: string;
  /** Runes saved with the forge (link format) and the enhancement level they were planned at; null when none. */
  enhance: number | null;
  runes: string | null;
};

export type NewForge = Omit<SavedForge, "id" | "created_at">;

export const MAX_SAVED = 200;
export const MAX_NAME = 40;
export const SAVED_COLUMNS = "id, name, kind, world, class_name, variant_id, quality, ores, catalogue_revision, created_at, enhance, runes";

/** The runes as stored: checked against the rune list for this item type, or null when there are none. */
export function cleanRunes(raw: unknown, kind: Kind): string | null {
  if (typeof raw !== "string") return null;
  const slots = decodeRunes(raw, kind);
  return hasRunes(slots) ? encodeRunes(slots) : null;
}

/** Forge names: 1 to 40 characters, no angle brackets or control characters (the database checks the same). */
export function cleanForgeName(raw: string): string | null {
  const name = raw.replace(/[<>\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME).trim();
  return name.length ? name : null;
}

const VARIANT_ID = /^[a-z0-9-]{1,60}$/;
const CLASS_NAME = /^[A-Za-z' -]{1,60}$/;

/** Reads a row from the database. Rows are treated as untrusted: anything malformed is dropped. */
export function readSavedForge(row: unknown): SavedForge | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const kind = r.kind === "weapon" || r.kind === "armour" ? r.kind : null;
  const world = Number(r.world);
  const quality = Number(r.quality);
  const name = typeof r.name === "string" ? cleanForgeName(r.name) : null;
  if (typeof r.id !== "string" || !kind || !name || ![1, 2, 3, 4].includes(world) || !(quality >= 1 && quality <= 100)) return null;
  if (typeof r.variant_id !== "string" || !VARIANT_ID.test(r.variant_id) || typeof r.class_name !== "string" || !CLASS_NAME.test(r.class_name)) return null;
  const list = Array.isArray(r.ores) ? r.ores.slice(0, MAX_TYPES) : [];
  const ores = parseRecipe(list.map((e) => `${(e as Entry)?.id}:${(e as Entry)?.count}`).join(","));
  if (!ores.length) return null;
  const rev = Number(r.catalogue_revision);
  const runes = cleanRunes(r.runes, kind);
  const enhance = Number(r.enhance);
  return {
    id: r.id, name, kind, world: world as World, class_name: r.class_name, variant_id: r.variant_id, quality: Math.round(quality), ores,
    catalogue_revision: Number.isFinite(rev) ? rev : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    runes, enhance: runes && Number.isInteger(enhance) && enhance >= 0 && enhance <= 10 ? enhance : null,
  };
}

/** Same forge = same item, quality and ores (in any order), and the same runes. The star is filled when this matches a save. */
export function forgeKey(f: Pick<SavedForge, "kind" | "variant_id" | "quality" | "ores"> & Partial<Pick<SavedForge, "enhance" | "runes">>): string {
  const ores = [...f.ores].sort((a, b) => a.id.localeCompare(b.id)).map((e) => `${e.id}:${e.count}`).join(",");
  const runes = f.runes ? `|+${f.enhance ?? 0}|${f.runes}` : "";
  return `${f.kind}|${f.variant_id}|${f.quality}|${ores}${runes}`;
}

/** Calculator link that opens this forge exactly: ores, kind, quality, world and the saved item. */
export function calculatorHref(f: Pick<SavedForge, "kind" | "world" | "class_name" | "variant_id" | "quality" | "ores"> & Partial<Pick<SavedForge, "enhance" | "runes">>): string {
  const p = new URLSearchParams({
    o: f.ores.map((e) => `${e.id}:${e.count}`).join(","),
    k: f.kind,
    q: String(f.quality),
    world: String(f.world),
    c: f.class_name,
    v: f.variant_id,
  });
  // Saved runes open at the bottom of the calculator.
  if (f.runes) { p.set("e", String(f.enhance ?? 9)); p.set(f.kind === "weapon" ? "rw" : "ra", f.runes); }
  return `/?${p.toString()}`;
}
