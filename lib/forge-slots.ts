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
