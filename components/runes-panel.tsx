"use client";

import Link from "next/link";
import { startTransition, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RUNES_SOURCE, runeById, runeImage, runeImageScale, secondaryById, type Rune, type RuneKind, type RuneLevel, type SecondaryId } from "@/data/runes";
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
    if (p.type === "explosion") return `${pct(p.chance * 100)} chance, ${pct(p.dmg * 100)} weapon damage`;
    if (p.type === "lightning") return `${pct(p.chance * 100)} chance, ${pct(p.dmg * 100)} weapon damage, ${p.cd}s cooldown`;
    return `${pct(p.chance * 100)} chance, ${pct(p.dmg * 100)} weapon damage per second for ${p.dur}s`;
  }
  if (tier.shield) return `${pct(tier.shield.chance * 100)} chance to cut damage by ${pct(tier.shield.cut * 100)}`;
  return null;
}

function RuneIcon({ id, size }: { id: string; size: number }) {
  const k = runeImageScale[id];
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="rune-img" src={runeImage(id)} alt="" width={size} height={size} draggable={false} style={k ? { transform: `scale(${k})` } : undefined} />;
}

/* ------------------------------------------------------------------ the section */

export function RunesPanel({ item, enhance, onEnhance, slots, onSlots }: Props) {
  const open = slotsAt(enhance);
  const [editing, setEditing] = useState<number | null>(null);
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
            if (i >= open) return <div key={i} className="rune-slot locked"><span className="rune-lock" aria-hidden="true"><Lock size={22} /></span><span className="muted">Opens at +{slotOpensAt(i)}</span></div>;
            if (!s) return <button key={i} className="rune-slot empty" onClick={() => setEditing(i)}><span className="rune-plus" aria-hidden="true">+</span>Add a rune</button>;
            return <RuneCard key={i} slot={s} gain={gainOf(i)} onEdit={() => setEditing(i)} onRemove={() => setSlot(i, null)} />;
          })}
        </div>
        <p className="note">Every value is the best roll of its range (a perfect rune). A level I rune can have 1 side effect, II can have 2, III can have 3. The same rune can go in more than one slot, and each copy adds its effect again. Rune values and pictures from the <a className="inline-link" href={RUNES_SOURCE.url} target="_blank" rel="noopener noreferrer">Forge wiki</a> (CC BY-SA). <Link className="inline-link" href="/how-it-works#runes">How runes are counted</Link></p>
      </div>
      {editing != null && (
        <RuneStash item={item} enhance={enhance} slots={slots} index={editing} open={open}
          onClose={() => setEditing(null)} onSave={(s) => { setSlot(editing, s); setEditing(null); }} />
      )}
    </section>
  );
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

/** A filled slot: the rune's picture, level, side effects and what it adds. Click to edit it in the stash. */
function RuneCard({ slot, gain, onEdit, onRemove }: { slot: RuneSlot; gain: number | null; onEdit: () => void; onRemove: () => void }) {
  const rune = runeById.get(slot.id)!;
  const tier = rune.levels[slot.level - 1];
  return (
    <article className="rune-slot filled">
      <button className="rune-card-main" onClick={onEdit} aria-label={`${rune.name} ${roman(slot.level)}. Edit`}>
        <span className="rune-card-top">
          <span className="rune-pic"><RuneIcon id={rune.id} size={64} /></span>
          <span className="rune-card-id">
            <span className="rune-name">{rune.name} <span className="rune-lv">{roman(slot.level)}</span></span>
            <span className="rune-kind small">{rune.effect}</span>
          </span>
        </span>
        <span className="rune-text">{bestRoll(tier) ?? tier.text}</span>
        <span className="rune-sec-list">
          {slot.secondaries.length ? slot.secondaries.map((id) => <span key={id} className="rune-chip">+{pct(secondaryById.get(id)!.best * 100)} {secondaryById.get(id)!.name}</span>)
            : <span className="small faint">No side effects yet ({slot.level} allowed)</span>}
        </span>
        {gain != null && <span className="rune-gain small">{gain > 0.005 ? <><b>+{fmt(gain)}</b> DPS from this rune</> : <span className="muted">Adds no DPS (doesn&apos;t deal damage)</span>}</span>}
        <span className="rune-edit small">Edit</span>
      </button>
      <button className="lo-clear" onClick={onRemove} aria-label={`Remove ${rune.name}`} title="Remove">×</button>
    </article>
  );
}

/* ------------------------------------------------------------------ the rune stash: pick a rune, then set it up on the right */

function RuneStash({ item, enhance, slots, index, open, onSave, onClose }: {
  item: RuneItem; enhance: number; slots: (RuneSlot | null)[]; index: number; open: number;
  onSave: (s: RuneSlot) => void; onClose: () => void;
}) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const current = slots[index];
  const [tab, setTab] = useState<RuneKind>(item.kind);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<RuneSlot | null>(current ?? null);
  const [selected, setSelected] = useState<string>(current?.id ?? runesFor(item.kind)[0].id);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>(".stash-tile[aria-pressed='true']")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("modal-open"); prev?.focus?.(); };
  }, [onClose]);

  // Best first: weapon runes by the DPS they'd add here at level III; armour runes by effective health.
  const others = useMemo(() => slots.map((x, j) => (j === index ? null : x)), [slots, index]);
  const ranked = useMemo(() => {
    const list = runesFor(tab);
    if (tab === "weapon" && item.kind === "weapon") {
      const base = dpsWith(item, enhance, runeTotals(others, open))?.total ?? 0;
      return list.map((r) => {
        const t = runeTotals(others.map((x, j) => (j === index ? { id: r.id, level: 3 as RuneLevel, secondaries: [] } : x)), open);
        return { r, score: (dpsWith(item, enhance, t)?.total ?? 0) - base };
      }).sort((a, b) => b.score - a.score);
    }
    if (tab === "armour") return list.map((r) => ({ r, score: r.levels[2].shield ? shieldFactor([r.levels[2].shield]) - 1 : -1 })).sort((a, b) => b.score - a.score);
    return list.map((r) => ({ r, score: 0 }));
  }, [tab, item, enhance, others, index, open]);
  const shown = ranked.filter(({ r }) => !query.trim() || `${r.name} ${r.effect} ${r.aka ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const rune = runeById.get(selected)!;
  const fits = rune.kind === item.kind;
  // The rune being set up: the slot's own settings if it's the same rune, otherwise level III with no side effects.
  const setup = useMemo<RuneSlot>(() => (draft && draft.id === selected ? draft : { id: selected, level: 3, secondaries: [] }), [draft, selected]);
  const setLevel = (level: RuneLevel) => setDraft({ ...setup, level, secondaries: setup.secondaries.slice(0, level) });
  const toggleSec = (id: SecondaryId) => {
    const has = setup.secondaries.includes(id);
    if (!has && setup.secondaries.length >= setup.level) return;
    setDraft({ ...setup, secondaries: has ? setup.secondaries.filter((x) => x !== id) : [...setup.secondaries, id] });
  };
  const preview = useMemo(() => {
    if (!fits || item.kind !== "weapon") return null;
    const base = dpsWith(item, enhance, runeTotals(others, open))?.total ?? 0;
    const t = runeTotals(others.map((x, j) => (j === index ? setup : x)), open);
    return (dpsWith(item, enhance, t)?.total ?? 0) - base;
  }, [fits, item, enhance, others, index, open, setup]);
  const tier = rune.levels[setup.level - 1];

  return createPortal(
    <div className="picker-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stash gp" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box}>
        <div className="stash-head">
          <h2 id={titleId}>Rune Stash</h2>
          <span className="small muted">Slot {index + 1} · {item.name}</span>
          <button className="stash-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="stash-tools">
          <label className="stash-search">
            <span className="sr-only">Search runes</span>
            <input className="input" type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="stash-tabs" role="group" aria-label="Rune type">
            {(["weapon", "armour"] as RuneKind[]).map((k) => (
              <button key={k} className="btn sm" aria-pressed={tab === k} onClick={() => setTab(k)}>Best for {k === "weapon" ? "weapons" : "armour"}</button>
            ))}
          </div>
        </div>
        <div className="stash-body">
          <div className="stash-grid" role="group" aria-label="Runes, best first">
            {shown.map(({ r, score }) => (
              <button key={r.id} aria-pressed={selected === r.id} className={`stash-tile${r.kind !== item.kind ? " other" : ""}`} onClick={() => setSelected(r.id)}>
                <span className="stash-name">{r.name}</span>
                <RuneIcon id={r.id} size={64} />
                <span className="stash-score">
                  {tab === "weapon" && item.kind === "weapon" ? (score > 0.005 ? `+${fmt(score, 0)} DPS` : "Utility")
                    : tab === "armour" ? (score > 0 ? `+${pct(score * 100)} EH` : r.effect) : r.effect}
                </span>
              </button>
            ))}
            {shown.length === 0 && <p className="muted" style={{ gridColumn: "1 / -1", margin: 8 }}>No runes match.</p>}
          </div>

          <aside className="stash-side" aria-live="polite">
            <div className="stash-side-head">
              <div className="stash-side-name">{rune.name}</div>
              <div className="stash-side-pic"><RuneIcon id={rune.id} size={112} /></div>
              <div className="small muted" style={{ textAlign: "center" }}>{rune.kind === "weapon" ? "Weapon" : "Armour"} rune · {rune.effect}{rune.aka ? ` · also called ${rune.aka}` : ""}</div>
            </div>
            {fits ? (
              <>
                <div className="stash-label">Level</div>
                <div className="rune-levels" role="group" aria-label="Rune level">
                  {([1, 2, 3] as RuneLevel[]).map((l) => <button key={l} className="btn sm" aria-pressed={setup.level === l} onClick={() => setLevel(l)}>{roman(l)}</button>)}
                </div>
                <div className="stash-label">Traits</div>
                <div className="stash-traits">
                  <div className="stash-main"><b>{rune.effect} {roman(setup.level)}</b><span>{tier.text}</span>{bestRoll(tier) && <span className="rune-best">Counted as: {bestRoll(tier)}</span>}</div>
                </div>
                <div className="stash-label">Side effects <span className="faint">({setup.secondaries.length}/{setup.level})</span></div>
                <div className="stash-secs" role="group" aria-label="Side effects">
                  {secondariesFor(rune.kind).map((s) => {
                    const on = setup.secondaries.includes(s.id);
                    const full = !on && setup.secondaries.length >= setup.level;
                    return (
                      <button key={s.id} className="stash-sec" aria-pressed={on} disabled={full} onClick={() => toggleSec(s.id)} title={`${s.range} ${s.text}`}>
                        <span>{s.name}</span><b>+{pct(s.best * 100)}</b>
                      </button>
                    );
                  })}
                </div>
                {preview != null && <p className="stash-preview">{preview > 0.005 ? <>Adds <b>+{fmt(preview)} DPS</b> at +{enhance}</> : "Adds no DPS"}</p>}
                <button className="btn gb stash-save" onClick={() => onSave(setup)}>{current ? "Save rune" : `Put in slot ${index + 1}`}</button>
              </>
            ) : (
              <p className="note" style={{ textAlign: "center" }}>{rune.kind === "weapon" ? "Weapon runes go on weapons." : "Armour runes go on armour."} Switch the calculator to {rune.kind === "weapon" ? "Weapon" : "Armor"} to use it.</p>
            )}
          </aside>
        </div>
      </div>
    </div>,
    // Inside the themed app, so it uses the current world's colours.
    document.querySelector(".app") ?? document.body,
  );
}
