/**
 * Molds: a fifth forge slot, separate from the ores, that aims the forge at one item.
 *
 * What's known (28 Oct 2026):
 * - Molds raise the chosen item's chance, and enough of them make it 100% (wiki: Armor Mold page).
 * - How many is enough is NOT the item's 1/N. Players report Dark Knight's Gauntlets (1/6) needs 70.
 *   Requirements come from the game data (catalogue.moldRequirements), each with a status:
 *     verified    an exact number confirmed in game: the only status that can show a 100% guarantee;
 *     reported    an exact number from player reports: "guaranteed if the report is right", chances unchanged;
 *     approximate an estimate ("about 40"): never a guarantee;
 *     unknown     not in the data: never a guarantee.
 * - How much fewer molds help is unknown, so the site never invents a chance for it. `partialChance` is a slot
 *   for a confirmed formula; nothing uses it yet.
 * - Whether the game needs the class padlock pressed first is unknown. For now the calculator needs it on.
 * - Molds don't count as ores: no change to the ore total, multiplier, traits or stats.
 * Pure functions, no framework imports.
 */

export const MAX_MOLDS = 9999;

export type MoldSource = { url: string; date: string | null; note: string };
export type MoldRequirement = {
  itemId: string; kind: "weapon" | "armour"; worlds: number[];
  /** Exact number confirmed in game (verified entries only). */
  exact: number | null;
  /** Number from player reports. */
  reported: number | null;
  /** True when the report is an estimate ("about 40"). */
  approximate: boolean;
  status: "verified" | "reported" | "unverified";
  /** How many separate player reports give the number. */
  reports: number;
  sources: MoldSource[];
  /** When the entry was last checked (YYYY-MM-DD). */
  checked: string;
};

export type NeedKind = "verified" | "reported" | "approximate" | "unknown";
export type Need = { kind: NeedKind; value: number | null; req: MoldRequirement | null };

/** What the data says an item needs. Anything that doesn't add up is treated as unknown. */
export function moldNeed(reqs: readonly MoldRequirement[] | undefined, itemId: string): Need {
  const req = reqs?.find((r) => r.itemId === itemId) ?? null;
  if (!req) return { kind: "unknown", value: null, req: null };
  if (req.status === "verified" && req.exact != null && req.exact > 0) return { kind: "verified", value: req.exact, req };
  if (req.reported != null && req.reported > 0) return { kind: req.approximate ? "approximate" : "reported", value: req.reported, req };
  return { kind: "unknown", value: null, req };
}

/** "70", "~40" or "?" for an item tile. */
export const needLabel = (need: Need) => (need.value == null ? "?" : need.kind === "approximate" ? `~${need.value}` : String(need.value));

export type MoldOutcome =
  | "off"            // no item targeted
  | "aimed"          // targeted, no molds yet
  | "partial"        // some molds, fewer than an exact number, or the number is unknown
  | "approx-reached" // at least an approximate number: still not a guarantee
  | "needs-lock"     // at least an exact number, but the class padlock isn't on
  | "conditional"    // a reported exact number with the class locked: guaranteed if the report is right
  | "guaranteed";    // a verified exact number with the class locked

export type MoldState = {
  state: MoldOutcome;
  targetId: string | null;
  targetClass: string | null;
  molds: number;
  need: Need;
  /** Enough ores to lock the target's class. */
  classLockable: boolean;
  /** The target's class padlock is on. */
  classLocked: boolean;
  /** Molds over an exact number (verified or reported). 0 for approximate or unknown numbers. */
  surplus: number;
  /** False when molds change the real chances in a way nobody has measured: the numbers shown are without molds. */
  chancesKnown: boolean;
};

export const NO_MOLDS: MoldState = {
  state: "off", targetId: null, targetClass: null, molds: 0, need: { kind: "unknown", value: null, req: null },
  classLockable: false, classLocked: false, surplus: 0, chancesKnown: true,
};

export type MoldTarget = { cls: string; id: string };
type V = { id: string; chance: number; overall: number };
type C<T extends V> = { name: string; probability: number; lockable: boolean; variants: T[] };

/**
 * A confirmed partial-mold formula would go here: the target's chance inside its class (0–100) for a number of
 * molds, given its chance without molds. Return null when unknown. Not used yet.
 */
export type PartialChance = (molds: number, need: Need, chanceWithout: number) => number | null;

const clampMolds = (n: number) => Math.max(0, Math.min(MAX_MOLDS, Math.floor(Number.isFinite(n) ? n : 0)));

/**
 * Molds on the class odds (after any class lock). `locked` is the class whose padlock is on.
 * Only a verified number with the class locked changes the chances (the item 100%, the rest 0%). Anything else
 * leaves them as they are and says so in `chancesKnown`.
 */
export function applyMolds<T extends V, K extends C<T>>(
  classes: K[], target: MoldTarget | null, moldCount: number, locked: string | null,
  reqs: readonly MoldRequirement[] | undefined, partialChance?: PartialChance,
): { classes: K[]; mold: MoldState } {
  const molds = clampMolds(moldCount);
  const cls = target ? classes.find((c) => c.name === target.cls) : undefined;
  const item = cls?.variants.find((v) => v.id === target?.id);
  if (!cls || !item) return { classes, mold: { ...NO_MOLDS, molds } };

  const need = moldNeed(reqs, item.id);
  const classLocked = locked === cls.name && cls.lockable;
  const exact = need.kind === "verified" || need.kind === "reported";
  const reached = need.value != null && molds >= need.value;
  const base = { targetId: item.id, targetClass: cls.name, molds, need, classLockable: cls.lockable, classLocked, surplus: exact && reached ? molds - need.value! : 0 };

  let state: MoldOutcome;
  if (molds === 0) state = "aimed";
  else if (need.kind === "unknown" || !reached) state = "partial";
  else if (need.kind === "approximate") state = "approx-reached";
  else if (!classLocked) state = "needs-lock";
  else state = need.kind === "verified" ? "guaranteed" : "conditional";

  if (state === "guaranteed") {
    const out = classes.map((c) => (c !== cls ? c : { ...c, variants: c.variants.map((v) => ({ ...v, chance: v === item ? 100 : 0, overall: v === item ? c.probability : 0 })) }));
    return { classes: out, mold: { ...base, state, chancesKnown: true } };
  }

  // A confirmed partial formula (none yet) would set the item's share of its class; the others share the rest.
  const within = state === "partial" && partialChance ? partialChance(molds, need, item.chance) : null;
  if (within != null && Number.isFinite(within)) {
    const t = Math.max(item.chance, Math.min(100, within));
    const rest = 100 - item.chance;
    const out = classes.map((c) => (c !== cls ? c : {
      ...c, variants: c.variants.map((v) => {
        const chance = v === item ? t : rest > 0 ? (v.chance * (100 - t)) / rest : 0;
        return { ...v, chance, overall: (c.probability * chance) / 100 };
      }),
    }));
    return { classes: out, mold: { ...base, state, chancesKnown: true } };
  }

  return { classes, mold: { ...base, state, chancesKnown: molds === 0 } };
}

/** Link format for the mold count and target: "6:dark-knights-gauntlets". Untrusted input. */
export function decodeMolds(raw: string | null | undefined): { molds: number; id: string | null } {
  if (!raw) return { molds: 0, id: null };
  const [n, id] = raw.slice(0, 80).split(":");
  const molds = Math.floor(Number(n));
  return { molds: Number.isFinite(molds) && molds > 0 ? Math.min(MAX_MOLDS, molds) : 0, id: id && /^[a-z0-9-]{1,60}$/.test(id) ? id : null };
}
export const encodeMolds = (molds: number, id: string | null) => `${molds}${id ? `:${id}` : ""}`;
