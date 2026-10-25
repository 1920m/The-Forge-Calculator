/** The game's forge has four slots: at most four different ore types per craft. */
export const MAX_TYPES = 4;
export const MAX_ORES = 99;
export type Entry = { id: string; count: number };

/** Adds (or with a negative n, removes) ores. A new ore type is refused once all four slots are used. */
export function addOre(cur: Entry[], id: string, n = 1): Entry[] {
  const i = cur.findIndex((e) => e.id === id);
  if (i < 0) return n > 0 && cur.length < MAX_TYPES ? [...cur, { id, count: Math.min(MAX_ORES, n) }] : cur;
  const next = [...cur];
  const count = Math.max(0, Math.min(MAX_ORES, cur[i].count + n));
  if (count === 0) next.splice(i, 1); else next[i] = { id, count };
  return next;
}

const ORE_ID = /^[a-z0-9-]{1,40}$/;
const MAX_RECIPE_CHARS = 2000;

/**
 * Reads a recipe from a share link or saved data ("kitsunite:20,galaxite:15"). Treats it as untrusted:
 * only well-formed ore ids, whole counts from 1 to 99, repeated ores merged (the engine rejects duplicates),
 * at most four ore types. Anything else is dropped.
 */
export function parseRecipe(raw: string | null | undefined, known?: (id: string) => boolean): Entry[] {
  if (!raw || raw.length > MAX_RECIPE_CHARS) return [];
  const out: Entry[] = [];
  for (const part of raw.split(",")) {
    const [id = "", c = ""] = part.split(":");
    const count = Math.floor(Number(c));
    if (!ORE_ID.test(id) || !Number.isFinite(count) || count < 1 || (known && !known(id))) continue;
    const seen = out.find((e) => e.id === id);
    if (seen) seen.count = Math.min(MAX_ORES, seen.count + count);
    else if (out.length < MAX_TYPES) out.push({ id, count: Math.min(MAX_ORES, count) });
  }
  return out;
}
