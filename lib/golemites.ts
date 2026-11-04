import { GOLEMITE } from "@/data/golemites";
import { MAX_TYPES, parseRecipe, type Entry } from "./forge-slots";
import { cleanForgeName } from "./saved-forges";

/** A saved Golemite: its name, ores and growth level. Rarity and traits are worked out again from the game data. */
export type SavedGolemite = { id: string; name: string; ores: Entry[]; level: number; quality: number; catalogue_revision: number | null; created_at: string };
export type NewGolemite = Pick<SavedGolemite, "name" | "ores" | "level" | "quality" | "catalogue_revision">;

export const MAX_GOLEMITES = 50;
export const GOLEMITE_COLUMNS = "id, name, ores, level, quality, catalogue_revision, created_at";

export const oreTotal = (ores: readonly Entry[]) => ores.reduce((n, e) => n + e.count, 0);

/** Reads a row from the database (or a shared profile). Untrusted: anything malformed is dropped. */
export function readGolemite(row: unknown): SavedGolemite | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const name = typeof r.name === "string" ? cleanForgeName(r.name) : null;
  if (typeof r.id !== "string" || !/^[0-9a-f-]{36}$/i.test(r.id) || !name) return null;
  const list = Array.isArray(r.ores) ? r.ores.slice(0, MAX_TYPES) : [];
  const ores = parseRecipe(list.map((e) => `${(e as Entry)?.id}:${(e as Entry)?.count}`).join(","));
  if (oreTotal(ores) < GOLEMITE.minOres || oreTotal(ores) > GOLEMITE.maxOres) return null;
  const level = Number(r.level), rev = Number(r.catalogue_revision), quality = Number(r.quality);
  return {
    id: r.id, name, ores, level: Number.isInteger(level) && level >= 0 && level <= GOLEMITE.maxLevel ? level : 0,
    quality: quality >= 1 && quality <= 100 ? Math.round(quality) : 100,
    catalogue_revision: Number.isFinite(rev) ? rev : null, created_at: typeof r.created_at === "string" ? r.created_at : "",
  };
}

/** Same Golemite = same ores (in any order) and quality. The calculator's star is filled when this matches a save. */
export function golemiteKey(g: Pick<SavedGolemite, "ores" | "quality">): string {
  return `${g.quality}|${[...g.ores].sort((a, b) => a.id.localeCompare(b.id)).map((e) => `${e.id}:${e.count}`).join(",")}`;
}

/** Calculator link in Golemite mode with these ores and quality (in World 4, where Golemites can be crafted). */
export function golemiteHref(g: Pick<SavedGolemite, "ores" | "quality">): string {
  return `/?k=golemite&world=4&q=${g.quality}&o=${encodeURIComponent(g.ores.map((e) => `${e.id}:${e.count}`).join(","))}`;
}
