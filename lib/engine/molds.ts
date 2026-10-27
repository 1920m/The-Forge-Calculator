/**
 * Molds: a fifth forge slot, separate from the ores, that aims the forge at one item.
 *
 * Rules (from a player, 27 Oct 2026; not on the wiki):
 * - An item shown as 1/N needs N molds. With m molds it shows m/N.
 * - With m ≥ N molds AND its class locked, the item is guaranteed. The class has to be lockable first
 *   (enough ores), so molds alone never guarantee anything.
 * - The 1 in 1/N doesn't count: 0 molds is the normal chance, so a 1/1 item (Kunai) still needs 1 mold.
 * - Fewer than N molds can't guarantee it; more than N are wasted.
 * - Molds don't count as ores: they don't change the ore total, the multiplier, traits or stats.
 *
 * Our reading, not confirmed in game: with fewer than N molds (or the class not locked), the item's weight inside its
 * class becomes m/N instead of 1/N, so its share of the class grows. Other items keep their 1/N weight.
 * Pure functions, no framework imports.
 */

export const MAX_MOLDS = 1000;

export type MoldTarget = { cls: string; id: string };
export type MoldState =
  | { state: "off" }
  | { state: "guaranteed"; need: number; molds: number; wasted: number }
  | { state: "needs-lock"; need: number; molds: number; lockAt: number; lockable: boolean }
  | { state: "short"; need: number; molds: number };

type V = { id: string; weight: number; chance: number; overall: number };
type C<T extends V> = { name: string; probability: number; lockable: boolean; lockAt: number; variants: T[] };

/** The molds an item needs: its N in 1/N. */
export const moldsNeeded = (weight: number) => Math.max(1, Math.round(weight));

/**
 * Applies molds to the class odds (after any class lock). `locked` is the class the player locked, if it's lockable.
 * Chances still add up to 100% and none go below 0. With no molds or no target, the classes come back unchanged.
 */
export function applyMolds<T extends V, K extends C<T>>(classes: K[], target: MoldTarget | null, molds: number, locked: string | null): { classes: K[]; mold: MoldState } {
  const m = Math.max(0, Math.min(MAX_MOLDS, Math.floor(Number.isFinite(molds) ? molds : 0)));
  const cls = target ? classes.find((c) => c.name === target.cls) : undefined;
  const item = cls?.variants.find((v) => v.id === target?.id);
  if (!cls || !item || m === 0) return { classes, mold: { state: "off" } };

  const need = moldsNeeded(item.weight);
  const isLocked = locked === cls.name && cls.lockable;
  if (m >= need && isLocked) {
    const out = classes.map((c) => (c !== cls ? c : { ...c, variants: c.variants.map((v) => ({ ...v, chance: v === item ? 100 : 0, overall: v === item ? c.probability : 0 })) }));
    return { classes: out, mold: { state: "guaranteed", need, molds: m, wasted: m - need } };
  }

  // Not guaranteed: the item's weight becomes min(m, N)/N against the others' 1/N (our reading; see above).
  const weights = cls.variants.map((v) => (v === item ? Math.min(m, need) / need : 1 / Math.max(1, v.weight)));
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = classes.map((c) => (c !== cls ? c : {
    ...c, variants: c.variants.map((v, i) => { const chance = (weights[i] / sum) * 100; return { ...v, chance, overall: (c.probability * chance) / 100 }; }),
  }));
  const mold: MoldState = m < need ? { state: "short", need, molds: m } : { state: "needs-lock", need, molds: m, lockAt: cls.lockAt, lockable: cls.lockable };
  return { classes: out, mold };
}

/** Link format for the mold count and target: "6:dark-knight-gauntlet". Untrusted input. */
export function decodeMolds(raw: string | null | undefined): { molds: number; id: string | null } {
  if (!raw) return { molds: 0, id: null };
  const [n, id] = raw.slice(0, 80).split(":");
  const molds = Math.floor(Number(n));
  return { molds: Number.isFinite(molds) && molds > 0 ? Math.min(MAX_MOLDS, molds) : 0, id: id && /^[a-z0-9-]{1,60}$/.test(id) ? id : null };
}
export const encodeMolds = (molds: number, id: string | null) => `${molds}${id ? `:${id}` : ""}`;
