/**
 * Runes on one weapon or armour piece: which slots are open, what the runes add up to, and a short text form for
 * the share link. Pure functions; the data is in data/runes.ts.
 */
import { RUNES, SECONDARIES, runeById, secondaryById, type RuneKind, type RuneLevel, type RuneProc, type SecondaryId } from "@/data/runes";

export const MAX_RUNE_SLOTS = 3;
/** A slot opens at +3, +6 and +9. */
export const slotsAt = (enhance: number) => Math.min(MAX_RUNE_SLOTS, Math.max(0, Math.floor(enhance / 3)));
export const slotOpensAt = (slot: number) => (slot + 1) * 3;

export type RuneSlot = { id: string; level: RuneLevel; secondaries: SecondaryId[] };

/** Totals of every rune in the open slots. Copies of the same rune add up. */
export type RuneTotals = {
  procs: (RuneProc & { label: string })[];
  stats: Partial<Record<SecondaryId, number>>;
  shields: { chance: number; cut: number }[];
  effects: string[];
};

export function runeTotals(slots: readonly (RuneSlot | null)[], open: number): RuneTotals {
  const out: RuneTotals = { procs: [], stats: {}, shields: [], effects: [] };
  slots.slice(0, open).forEach((s) => {
    if (!s) return;
    const rune = runeById.get(s.id);
    if (!rune) return;
    const tier = rune.levels[s.level - 1];
    if (tier.proc) out.procs.push({ ...tier.proc, label: `${rune.name} ${roman(s.level)}` });
    if (tier.shield) out.shields.push(tier.shield);
    if (!tier.proc && !tier.shield) out.effects.push(`${rune.name} ${roman(s.level)}: ${tier.text}`);
    for (const id of s.secondaries.slice(0, s.level)) {
      const sec = secondaryById.get(id);
      if (sec && sec.kind === rune.kind) out.stats[id] = (out.stats[id] ?? 0) + sec.best;
    }
  });
  return out;
}

export const roman = (l: number) => ["", "I", "II", "III"][l] ?? String(l);

/* ------------------------------------------------------------------ link format: id:level:sec.sec, slots split by "," ("-" = empty) */

const LEVELS = new Set([1, 2, 3]);

export function encodeRunes(slots: readonly (RuneSlot | null)[]): string {
  return slots.map((s) => (s ? `${s.id}:${s.level}${s.secondaries.length ? `:${s.secondaries.join(".")}` : ""}` : "-")).join(",");
}

/** Reads runes from a link. Untrusted: unknown runes, wrong-kind runes and extra side effects are dropped. */
export function decodeRunes(raw: string | null | undefined, kind: RuneKind): (RuneSlot | null)[] {
  const out: (RuneSlot | null)[] = [null, null, null];
  if (!raw) return out;
  raw.slice(0, 300).split(",").slice(0, MAX_RUNE_SLOTS).forEach((part, i) => {
    const [id, lv, secs] = part.split(":");
    const rune = runeById.get(id);
    const level = Number(lv);
    if (!rune || rune.kind !== kind || !LEVELS.has(level)) return;
    const secondaries = [...new Set((secs ?? "").split("."))]
      .filter((x): x is SecondaryId => secondaryById.get(x as SecondaryId)?.kind === kind)
      .slice(0, level);
    out[i] = { id, level: level as RuneLevel, secondaries };
  });
  return out;
}

export const runesFor = (kind: RuneKind) => RUNES.filter((r) => r.kind === kind);
export const secondariesFor = (kind: RuneKind) => SECONDARIES.filter((s) => s.kind === kind);
