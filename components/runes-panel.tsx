"use client";

import Link from "next/link";
import { startTransition, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RUNES_SOURCE, runeById, secondaryById, type Rune, type RuneKind, type RuneLevel, type SecondaryId } from "@/data/runes";
import { roman, runeTotals, runesFor, secondariesFor, slotOpensAt, slotsAt, MAX_RUNE_SLOTS, type RuneSlot, type RuneTotals } from "@/lib/engine/runes";
import { weaponDps, type DpsResult } from "@/lib/engine/dps";
import { enhanceFactor } from "@/lib/engine/dps-target";
import { roundStat } from "@/lib/engine";
import { fmt, pct } from "@/lib/ui";
import { Lock } from "./icons";

const LEVELS = Array.from({ length: 11 }, (_, i) => i);

export type RuneItem = {
  kind: RuneKind; name: string; raw: number | null;
  /** Weapons only: what the DPS maths needs. */
  ores?: { id: string; count: number }[]; interval?: number;
};

type Props = { item: RuneItem; enhance: number; onEnhance: (l: number) => void; slots: (RuneSlot | null)[]; onSlots: (s: (RuneSlot | null)[]) => void };

/** DPS for the item at this enhancement level with these runes in the open slots. */
function dpsWith(item: RuneItem, enhance: number, totals: RuneTotals | null): DpsResult | null {
  if (item.kind !== "weapon" || item.raw == null || !item.ores || !item.interval) return null;
  return weaponDps({ ores: item.ores, damage: item.raw * enhanceFactor(enhance), interval: item.interval, extra: totals ? { stats: totals.stats, procs: totals.procs } : undefined });
}

/** Effective health from a shield: 1 ÷ (1 − chance × cut). Each Ward Patch shields on its own. */
const shieldFactor = (shields: { chance: number; cut: number }[]) => shields.reduce((f, s) => f / (1 - s.chance * s.cut), 1);

export function RunesPanel({ item, enhance, onEnhance, slots, onSlots }: Props) {
  const open = slotsAt(enhance);
  const [picking, setPicking] = useState<number | null>(null);
  const totals = useMemo(() => runeTotals(slots, open), [slots, open]);
  const without = useMemo(() => dpsWith(item, enhance, null), [item, enhance]);
  const withRunes = useMemo(() => dpsWith(item, enhance, totals), [item, enhance, totals]);
  const unit = item.kind === "weapon" ? "DMG" : "DEF";
  const stat = item.raw == null ? null : roundStat(item.raw * enhanceFactor(enhance), item.kind);

  const setSlot = (i: number, s: RuneSlot | null) => startTransition(() => onSlots(slots.map((x, j) => (j === i ? s : x))));
  // What each rune adds on its own: DPS with all runes minus DPS without this one.
  const gainOf = (i: number) => {
    if (!withRunes) return null;
    const rest = runeTotals(slots.map((x, j) => (j === i ? null : x)), open);
    return withRunes.total - dpsWith(item, enhance, rest)!.total;
  };

  return (
    <section className="gp runes" aria-labelledby="runes-h">
      <div className="tb"><h2 id="runes-h">Runes</h2><span className="small muted">{item.name} · +{enhance}</span></div>
      <div className="pad">
        <div className="runes-top">
          <div>
            <div className="step-h"><span className="step-n">1</span>Enhancement level</div>
            <div className="level-row" role="group" aria-label="Enhancement level">
              {LEVELS.map((l) => <button key={l} className="btn sm" aria-pressed={enhance === l} onClick={() => startTransition(() => onEnhance(l))}>+{l}</button>)}
            </div>
            <p className="note" style={{ marginTop: 6 }}>A rune slot opens at +3, +6 and +9. {open ? `${open} of ${MAX_RUNE_SLOTS} open.` : "Enhance to +3 for the first slot."}</p>
          </div>
          <RuneSummary item={item} stat={stat} unit={unit} enhance={enhance} totals={totals} without={without} withRunes={withRunes} />
        </div>

        <div className="step-h" style={{ marginTop: 18 }}><span className="step-n">2</span>Add runes</div>
        <div className="rune-slots">
          {Array.from({ length: MAX_RUNE_SLOTS }, (_, i) => {
            const s = slots[i];
            if (i >= open) return <div key={i} className="rune-slot locked"><span className="rune-lock" aria-hidden="true"><Lock /></span><span className="muted">Opens at +{slotOpensAt(i)}</span></div>;
            if (!s) return <button key={i} className="rune-slot empty" onClick={() => setPicking(i)}><span className="rune-plus" aria-hidden="true">+</span>Add a rune</button>;
            return <RuneCard key={i} slot={s} gain={gainOf(i)} onChange={(n) => setSlot(i, n)} onSwap={() => setPicking(i)} onRemove={() => setSlot(i, null)} />;
          })}
        </div>
        <p className="note">Every value is the best roll of its range (a perfect rune). Side effects: a level I rune can have 1, II can have 2, III can have 3. The same rune can go in more than one slot, and each copy adds its effect again. Rune values from the <a className="inline-link" href={RUNES_SOURCE.url} target="_blank" rel="noopener noreferrer">Forge wiki</a>. <Link className="inline-link" href="/how-it-works#runes">How runes are counted</Link></p>
      </div>
      {picking != null && (
        <RunePicker item={item} enhance={enhance} slots={slots} index={picking} open={open}
          onClose={() => setPicking(null)}
          onPick={(r) => { setSlot(picking, { id: r.id, level: slots[picking]?.level ?? 3, secondaries: [] }); setPicking(null); }} />
      )}
    </section>
  );
}

/** "Blast Chip III ×2 1,277.12": copies of the same rune shown once with their total. */
function groupParts(parts: { label: string; dps: number }[]) {
  const by = new Map<string, { n: number; dps: number }>();
  for (const p of parts) { const g = by.get(p.label) ?? { n: 0, dps: 0 }; g.n++; g.dps += p.dps; by.set(p.label, g); }
  return [...by].map(([label, g]) => `${label}${g.n > 1 ? ` ×${g.n}` : ""} ${fmt(g.dps)}`).join(" · ");
}

/** The best roll this site calculates with, in short. */
function bestRoll(tier: Rune["levels"][number]): string | null {
  const p = tier.proc;
  if (p) {
    const base = `${pct(p.chance * 100)} chance, ${pct(p.dmg * 100)} weapon damage`;
    if (p.type === "explosion") return base;
    if (p.type === "lightning") return `${base}, ${p.cd}s cooldown`;
    return `${pct(p.chance * 100)} chance, ${pct(p.dmg * 100)} weapon damage per second for ${p.dur}s`;
  }
  if (tier.shield) return `${pct(tier.shield.chance * 100)} chance to cut damage by ${pct(tier.shield.cut * 100)}`;
  return null;
}

function RuneSummary({ item, stat, unit, enhance, totals, without, withRunes }: { item: RuneItem; stat: number | null; unit: string; enhance: number; totals: RuneTotals; without: DpsResult | null; withRunes: DpsResult | null }) {
  const stats = Object.entries(totals.stats) as [SecondaryId, number][];
  const shield = totals.shields.length ? shieldFactor(totals.shields) : null;
  return (
    <div className="spin-result rune-summary" aria-live="polite">
      {item.kind === "weapon" && withRunes && without ? (
        <>
          <div className="spin-big"><span className="spin-pct">{fmt(withRunes.total)}</span><span className="spin-says">DPS at +{enhance} with runes</span></div>
          <p className="muted" style={{ margin: "4px 0 0" }}>{fmt(without.total)} without runes · <b className="strong">{withRunes.total >= without.total ? "+" : ""}{fmt(withRunes.total - without.total)}</b> ({pct(((withRunes.total / without.total) - 1) * 100)}) · {stat != null ? `${fmt(stat)} ${unit}` : ""}</p>
        </>
      ) : (
        <>
          <div className="spin-big"><span className="spin-pct">{stat != null ? fmt(stat) : "–"}</span><span className="spin-says">{unit} at +{enhance}</span></div>
          {shield != null && <p style={{ margin: "4px 0 0" }}><b className="strong">+{pct((shield - 1) * 100)}</b> <span className="muted">effective health from shields</span></p>}
        </>
      )}
      <ul className="spin-facts" style={{ marginTop: 10 }}>
        {stats.length > 0 && <li><b>Side effects:</b> {stats.map(([id, v]) => `+${pct(v * 100)} ${secondaryById.get(id)!.name}`).join(" · ")}</li>}
        {withRunes && <li><b>Hits:</b> {pct(withRunes.critChance * 100)} crit chance, crits hit {fmt(145 + withRunes.critDamage * 100, 1)}% · +{pct(withRunes.lethality * 100)} lethality · +{pct(withRunes.atkSpeed * 100)} attack speed · {fmt(withRunes.attacksPerSecond)} hits/s</li>}
        {withRunes && totals.procs.length > 0 && <li><b>Rune damage:</b> {groupParts(withRunes.parts.filter((p) => totals.procs.some((r) => r.label === p.label))) || "none"}</li>}
        {totals.shields.length > 0 && <li><b>Shields:</b> {totals.shields.map((s) => `${pct(s.chance * 100)} chance to cut ${pct(s.cut * 100)}`).join(" · ")}</li>}
        {totals.effects.length > 0 && <li><b>Also:</b> {totals.effects.map((e) => e.replace(/\.$/, "")).join(" · ")}</li>}
        {!stats.length && !totals.procs.length && !totals.shields.length && !totals.effects.length && <li className="muted">No runes yet. Add one below.</li>}
      </ul>
    </div>
  );
}

function RuneCard({ slot, gain, onChange, onSwap, onRemove }: { slot: RuneSlot; gain: number | null; onChange: (s: RuneSlot) => void; onSwap: () => void; onRemove: () => void }) {
  const rune = runeById.get(slot.id)!;
  const tier = rune.levels[slot.level - 1];
  const options = secondariesFor(rune.kind);
  const setLevel = (level: RuneLevel) => onChange({ ...slot, level, secondaries: slot.secondaries.slice(0, level) });
  const setSec = (i: number, id: string) => {
    const next = [...slot.secondaries];
    if (id) next[i] = id as SecondaryId; else next.splice(i, 1);
    onChange({ ...slot, secondaries: next.filter(Boolean).slice(0, slot.level) });
  };
  return (
    <article className="rune-slot filled">
      <div className="rune-head">
        <button className="link-btn rune-name" onClick={onSwap} title="Change rune">{rune.name}</button>
        <span className="rune-kind small">{rune.effect}</span>
        <button className="lo-clear" onClick={onRemove} aria-label={`Remove ${rune.name}`} title="Remove">×</button>
      </div>
      <div className="rune-levels" role="group" aria-label={`${rune.name} level`}>
        {([1, 2, 3] as RuneLevel[]).map((l) => <button key={l} className="btn sm" aria-pressed={slot.level === l} onClick={() => setLevel(l)}>{roman(l)}</button>)}
      </div>
      <p className="rune-text">{tier.text}</p>
      {bestRoll(tier) && <p className="rune-best small">Counted as: {bestRoll(tier)}</p>}
      <div className="rune-secs">
        <span className="small muted">Side effects ({slot.secondaries.length}/{slot.level})</span>
        {Array.from({ length: slot.level }, (_, i) => {
          const value = slot.secondaries[i] ?? "";
          if (i > slot.secondaries.length) return null; // fill in order
          return (
            <select key={i} className="input rune-sec" value={value} aria-label={`Side effect ${i + 1}`} onChange={(e) => setSec(i, e.target.value)}>
              <option value="">{value ? "Remove" : "Add a side effect…"}</option>
              {options.filter((o) => o.id === value || !slot.secondaries.includes(o.id)).map((o) => <option key={o.id} value={o.id}>+{pct(o.best * 100)} {o.name}</option>)}
            </select>
          );
        })}
      </div>
      {gain != null && <div className="rune-gain small">{gain > 0.005 ? <><b>+{fmt(gain)}</b> DPS from this rune</> : <span className="muted">Adds no DPS (doesn&apos;t deal damage)</span>}</div>}
    </article>
  );
}

/** Pick a rune: one tab per kind, best first. Weapon runes are ranked by the DPS they'd add to this weapon. */
function RunePicker({ item, enhance, slots, index, open, onPick, onClose }: { item: RuneItem; enhance: number; slots: (RuneSlot | null)[]; index: number; open: number; onPick: (r: Rune) => void; onClose: () => void }) {
  const current = slots[index];
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<RuneKind>(item.kind);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>(".picker-item:not(:disabled)")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);

  const ranked = useMemo(() => {
    const list = runesFor(tab);
    if (tab === "weapon" && item.kind === "weapon") {
      // DPS this rune would add at level III (no side effects) next to the runes already chosen.
      const others = slots.map((x, j) => (j === index ? null : x));
      const base = dpsWith(item, enhance, runeTotals(others, open))?.total ?? 0;
      return list.map((r) => {
        const t = runeTotals(others.map((x, j) => (j === index ? { id: r.id, level: 3 as RuneLevel, secondaries: [] } : x)), open);
        return { r, score: (dpsWith(item, enhance, t)?.total ?? 0) - base, note: "" };
      }).sort((a, b) => b.score - a.score);
    }
    if (tab === "armour") {
      return list.map((r) => {
        const sh = r.levels[2].shield;
        return { r, score: sh ? shieldFactor([sh]) - 1 : -1, note: sh ? "" : "Not counted in health numbers" };
      }).sort((a, b) => b.score - a.score);
    }
    return list.map((r) => ({ r, score: 0, note: "" }));
  }, [tab, item, enhance, slots, index, open]);

  return createPortal(
    <div className="picker-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="picker gp" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box}>
        <div className="tb">
          <h2 id={titleId}>{current ? "Change rune" : "Add a rune"}</h2>
          <button className="lo-clear static" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="picker-worlds" role="group" aria-label="Rune type">
          {(["weapon", "armour"] as RuneKind[]).map((k) => (
            <button key={k} className="btn sm" aria-pressed={tab === k} onClick={() => setTab(k)}>Best for {k === "weapon" ? "weapons" : "armour"}</button>
          ))}
        </div>
        {tab !== item.kind && <p className="note" style={{ margin: "8px 14px 0" }}>{tab === "weapon" ? "Weapon runes go on weapons." : "Armour runes go on armour."} Switch the calculator to {tab === "weapon" ? "Weapon" : "Armor"} to use these.</p>}
        <div className="picker-list">
          {ranked.map(({ r, score, note }, i) => {
            const fits = r.kind === item.kind;
            return (
              <button key={r.id} className={`picker-item${current?.id === r.id ? " on" : ""}`} disabled={!fits} onClick={() => onPick(r)} aria-pressed={current?.id === r.id}>
                <span className="rune-rank" aria-hidden="true">{i + 1}</span>
                <span className="picker-text">
                  <b>{r.name}{r.aka ? <span className="muted small"> ({r.aka})</span> : null}</b>
                  <span className="small muted">{r.effect} · III: {r.levels[2].text}</span>
                  {tab === "weapon" && item.kind === "weapon" && <span className="small" style={{ color: score > 0.005 ? "var(--gold)" : "var(--faint)" }}>{score > 0.005 ? `+${fmt(score)} DPS on this weapon at III` : "No DPS (utility)"}</span>}
                  {tab === "armour" && <span className="small" style={{ color: score > 0 ? "var(--gold)" : "var(--faint)" }}>{score > 0 ? `+${pct(score * 100)} effective health at III` : note}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
