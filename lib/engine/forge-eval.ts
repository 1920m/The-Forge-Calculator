/**
 * One forge, start to finish: odds for the ores, the class lock, molds aimed at an item, and which item the result
 * card shows. Pure functions shared by the calculator page and the public API, so both give the same numbers.
 */
import { forge, lockClass, type Catalogue, type Mix } from "./forge";
import { NO_MOLDS, applyMolds } from "./molds";
import type { Kind, World } from "./index";

export type ForgeResult = ReturnType<typeof forge>;
export type ForgeClass = ForgeResult["classes"][number];
export type ForgeVariant = ForgeClass["variants"][number];

/** A locked class only counts while the ores still allow locking it. */
export function activeLockFor(classes: readonly ForgeClass[], locked: string | null): string | null {
  return locked && classes.some((c) => c.name === locked && c.lockable) ? locked : null;
}

/** The class an item is in, for aiming molds at it. */
export function moldTargetFor(classes: readonly ForgeClass[], itemId: string | null): { cls: string; id: string } | null {
  const c = itemId ? classes.find((x) => x.variants.some((v) => v.id === itemId)) : undefined;
  return c && itemId ? { cls: c.name, id: itemId } : null;
}

/** The odds after the class lock, then molds (when used). */
export function withLockAndMolds(cat: Catalogue, normal: ForgeResult, lock: string | null, molds: { on: boolean; count: number; target: { cls: string; id: string } | null }) {
  const locked = lockClass(normal.classes, lock);
  const m = molds.on ? applyMolds(locked, molds.target, molds.count, lock, cat.moldRequirements) : { classes: locked, mold: NO_MOLDS };
  return { result: { ...normal, classes: m.classes }, mold: m.mold };
}

/** The item to show: the one asked for if it's in the result, else the most likely one. */
export function pickItem(result: ForgeResult, pick: { cls?: string | null; id: string } | null): { cls: ForgeClass; v: ForgeVariant } | null {
  if (pick) {
    const c = result.classes.find((x) => (pick.cls ? x.name === pick.cls : x.variants.some((v) => v.id === pick.id)));
    const v = c?.variants.find((x) => x.id === pick.id);
    if (c && v) return { cls: c, v };
  }
  let best: { cls: ForgeClass; v: ForgeVariant } | null = null;
  for (const c of result.classes) if (c.probability > 0) for (const v of c.variants) if (!best || v.overall > best.v.overall) best = { cls: c, v };
  return best;
}

/** Everything at once, for callers that don't memoise each step (the API). */
export function evaluateForge(cat: Catalogue, input: { mix: Mix; kind: Kind; world: World; quality: number; lock?: string | null; molds?: { count: number; itemId: string | null } | null; pick?: { cls?: string | null; id: string } | null }) {
  const normal = forge(cat, input.mix, input.kind, input.world, input.quality);
  const lock = activeLockFor(normal.classes, input.lock ?? null);
  const target = input.molds ? moldTargetFor(normal.classes, input.molds.itemId) : null;
  const { result, mold } = withLockAndMolds(cat, normal, lock, { on: !!input.molds, count: input.molds?.count ?? 0, target });
  return { normal, lock, result, mold, selected: pickItem(result, input.pick ?? null) };
}
