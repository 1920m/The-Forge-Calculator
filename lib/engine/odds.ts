/**
 * "How many tries?" maths for anything that is a fresh roll each time: forging the same mix again, or a race spin.
 * Each try succeeds with chance p, independent of the tries before it (no pity or guarantee).
 *
 * - Average tries:        1 ÷ p
 * - Chance within n tries: 1 − (1 − p)^n
 * - Tries for a chance c:  the smallest n with 1 − (1 − p)^n ≥ c, which is ln(1 − c) ÷ ln(1 − p) rounded up
 */

/** Average number of tries to get it once. */
export function averageTries(p: number): number {
  if (!(p > 0)) return Infinity;
  return 1 / Math.min(p, 1);
}

/** Chance of getting it at least once in n tries (0 to 1). */
export function chanceWithin(p: number, n: number): number {
  if (!(p > 0) || !(n > 0)) return 0;
  if (p >= 1) return 1;
  return 1 - Math.pow(1 - p, Math.floor(n));
}

/** Fewest tries that give at least chance c (0 < c < 1) of getting it. */
export function triesFor(p: number, c: number): number {
  if (!(p > 0)) return Infinity;
  if (p >= 1 || c <= 0) return 1;
  if (c >= 1) return Infinity;
  // log1p keeps tiny chances accurate. The small allowance stops answers that are exact whole numbers
  // (like 1 try at 50% for a 50% roll) being pushed up by floating-point noise.
  const n = Math.log1p(-c) / Math.log1p(-p);
  return Math.max(1, Math.ceil(n - 1e-9));
}
