"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { imageUrl } from "@/lib/data/supabase";
import { fmt, rarityColour } from "@/lib/ui";
import { supabase } from "@/lib/supabase/browser";
import { PICKAXES, pickaxeById, type Pickaxe } from "@/data/pickaxes";
import { ARMOUR_SLOTS, EMPTY_LOADOUT, LOADOUT_COLUMNS, SLOT_LABEL, cleanLoadout, readLoadout, slotFor, type ForgeSlot, type Loadout, type Slot } from "@/lib/loadout";
import type { SavedForge } from "@/lib/saved-forges";
import type { Worked } from "@/lib/forge-stats";
import { useAuth } from "./auth";
import { GameImage } from "./game-image";

export type Card = { f: SavedForge; r: Worked };

/* ------------------------------------------------------------------ data */

/** The player's loadout: loaded once, saved on every change (the screen updates first and undoes on failure). */
export function useLoadout(byId: Map<string, Card>, forgesLoaded: boolean) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [raw, setRaw] = useState<Loadout>(EMPTY_LOADOUT);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || loadedFor === uid) return;
    let alive = true;
    void supabase().from("loadouts").select(LOADOUT_COLUMNS).maybeSingle().then(({ data, error: err }) => {
      if (!alive) return;
      setRaw(readLoadout(err ? null : data));
      setError(err ? "Couldn't load your loadout." : null);
      setLoadedFor(uid);
    });
    return () => { alive = false; };
  }, [uid, loadedFor]);

  const forges = useMemo(() => new Map([...byId].map(([id, c]) => [id, c.f])), [byId]);
  // Until the saved forges arrive, keep slot ids as they are; afterwards hide any that no longer fit.
  const loadout = useMemo(() => (forgesLoaded ? cleanLoadout(raw, forges) : raw), [raw, forges, forgesLoaded]);

  const latest = useRef(loadout);
  useEffect(() => { latest.current = loadout; }, [loadout]);

  const set = useCallback(async (slot: Slot, value: string | null) => {
    const before = latest.current;
    const next = { ...before, [slot]: value };
    latest.current = next;
    setRaw(next);
    setError(null);
    const { error: err } = await supabase().from("loadouts").upsert(next, { onConflict: "user_id" });
    if (err) { latest.current = before; setRaw(before); setError("Couldn't save your loadout. Please try again."); }
  }, []);

  return { loadout, ready: !!uid && loadedFor === uid, error, set };
}

/* ------------------------------------------------------------------ drag and drop */

export type DragState = { card: Card; x: number; y: number; over: string | null } | null;

/**
 * Drag a saved forge's picture onto a loadout slot. Works with a mouse, a pen or a finger (pointer events);
 * the page scrolls when the pointer nears the top or bottom edge so the loadout can be reached from far down.
 */
export function useForgeDrag(onDrop: (card: Card, slot: ForgeSlot) => void) {
  const [drag, setDrag] = useState<DragState>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => { dropRef.current = onDrop; }, [onDrop]);

  const start = useCallback((card: Card, e: React.PointerEvent) => {
    if (e.button !== 0 || !slotFor(card.f)) return;
    const sx = e.clientX, sy = e.clientY;
    let active = false, x = sx, y = sy, raf = 0;
    const slotAt = (px: number, py: number) => (document.elementFromPoint(px, py)?.closest("[data-slot]") as HTMLElement | null)?.dataset.slot ?? null;
    const scroll = () => {
      const edge = 70, h = window.innerHeight;
      const dy = y < edge ? -Math.ceil((edge - y) / 5) : y > h - edge ? Math.ceil((y - (h - edge)) / 5) : 0;
      if (dy) { window.scrollBy(0, dy); setDrag((d) => (d ? { ...d, over: slotAt(x, y) } : d)); }
      raf = requestAnimationFrame(scroll);
    };
    const move = (ev: PointerEvent) => {
      x = ev.clientX; y = ev.clientY;
      if (!active) {
        if (Math.hypot(x - sx, y - sy) < 6) return;
        active = true;
        document.body.classList.add("dragging");
        raf = requestAnimationFrame(scroll);
      }
      ev.preventDefault();
      setDrag({ card, x, y, over: slotAt(x, y) });
    };
    const end = (drop: boolean) => (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      cancelAnimationFrame(raf);
      document.body.classList.remove("dragging");
      if (active && drop) {
        const s = slotAt(ev.clientX, ev.clientY);
        if (s && s === slotFor(card.f)) dropRef.current(card, s as ForgeSlot);
      }
      setDrag(null);
    };
    const up = end(true), cancel = end(false);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }, []);

  return { drag, start };
}

export function DragGhost({ drag }: { drag: DragState }) {
  if (!drag) return null;
  const { f, r } = drag.card;
  // Drawn on <body> so it floats above the falling petals and every panel.
  return createPortal(
    <div className="drag-ghost" style={{ transform: `translate(${drag.x - 34}px, ${drag.y - 34}px)` }} aria-hidden="true">
      <span className="tile" style={{ width: 68, height: 68, ["--rc" as string]: rarityColour(r.rarity) }}>
        <GameImage src={imageUrl(f.kind === "weapon" ? "weapons" : "armour", f.variant_id)} alt="" size={26} />
      </span>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ panel */

type PanelProps = {
  name: string;
  loadout: Loadout;
  byId: Map<string, Card>;
  drag: DragState;
  onOpen: (slot: Slot) => void;
  onClear: (slot: Slot) => void;
};

/** The LOADOUT panel: armour on the left, weapon and pickaxe on the right, totals in the middle. */
export function LoadoutPanel({ name, loadout, byId, drag, onOpen, onClear }: PanelProps) {
  const card = (s: ForgeSlot) => (loadout[s] ? byId.get(loadout[s]!) ?? null : null);
  const armour = ARMOUR_SLOTS.map(card).filter((c): c is Card => !!c);
  const weapon = card("weapon");
  const pick = loadout.pickaxe ? pickaxeById.get(loadout.pickaxe) ?? null : null;
  const known = armour.filter((c) => c.r.value != null);
  const defence = known.reduce((n, c) => n + c.r.value!, 0);
  const traits = [...new Set([...armour, ...(weapon ? [weapon] : [])].flatMap((c) => c.r.traits))];
  const target = drag ? slotFor(drag.card.f) : null;
  const slotProps = (s: Slot) => ({ slot: s, target, over: drag?.over ?? null, dragging: !!drag, onOpen, onClear });

  return (
    <section className="gp loadout" aria-labelledby="loadout-h">
      <div className="tb"><h2 id="loadout-h" className="loadout-title">Loadout</h2><span className="small muted">Drag a saved forge&apos;s picture onto a slot, or tap a slot</span></div>
      <div className="loadout-grid">
        <div className="loadout-col left">
          {ARMOUR_SLOTS.map((s) => <ForgeSlotBox key={s} {...slotProps(s)} card={card(s)} />)}
        </div>
        <div className="loadout-centre">
          <div className="loadout-name">{name}</div>
          <div className="loadout-stats">
            <Stat label="Armor defense" value={known.length ? fmt(defence) : "–"} note={`${armour.length} of 3 pieces`} />
            <Stat label="Weapon damage" value={weapon?.r.value != null ? fmt(weapon.r.value) : "–"} note={weapon?.f.class_name ?? "No weapon"} />
            <Stat label="Weapon DPS" value={weapon?.r.dps != null ? fmt(weapon.r.dps) : "–"} note={weapon?.r.speed != null ? `${weapon.r.speed}s per swing` : ""} />
            <Stat label="Pickaxe" value={pick ? pick.name.replace(/ Pickaxe$/, "") : "–"} note={pick ? pick.region : "None"} />
          </div>
          <div className="loadout-traits">
            <span className="small muted">Traits</span>
            <span>{traits.length ? traits.join(", ") : "None yet"}</span>
          </div>
        </div>
        <div className="loadout-col right">
          <ForgeSlotBox {...slotProps("weapon")} card={weapon} />
          <PickaxeSlotBox {...slotProps("pickaxe")} pick={pick} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="loadout-stat"><span className="small muted">{label}</span><b>{value}</b><span className="small faint">{note}</span></div>;
}

type SlotBoxProps = { slot: Slot; target: ForgeSlot | null; over: string | null; dragging: boolean; onOpen: (s: Slot) => void; onClear: (s: Slot) => void };

function slotClass({ slot, target, over, dragging }: SlotBoxProps, filled: boolean) {
  const valid = dragging && target === slot;
  return `lo-slot${filled ? " filled" : ""}${valid ? " valid" : ""}${valid && over === slot ? " over" : ""}${dragging && !valid ? " dim" : ""}`;
}

function ForgeSlotBox(p: SlotBoxProps & { card: Card | null }) {
  const { slot, card, onOpen, onClear } = p;
  const label = SLOT_LABEL[slot];
  const f = card?.f, r = card?.r;
  return (
    <div className={slotClass(p, !!card)} data-slot={slot}>
      <button className="lo-main" onClick={() => onOpen(slot)} aria-label={card ? `${label}: ${f!.name}. Change` : `${label}: empty. Choose a ${label.toLowerCase()}`}>
        <span className="tile lo-pic" style={{ ["--rc" as string]: card ? rarityColour(r!.rarity) : "#3a3834" }}>
          {card ? <GameImage src={imageUrl(f!.kind === "weapon" ? "weapons" : "armour", f!.variant_id)} alt="" size={22} /> : <SlotIcon slot={slot} />}
        </span>
        <span className="lo-text">
          <span className="lo-label">{label}</span>
          {card ? (
            <>
              <span className="lo-name">{f!.name}</span>
              <span className="lo-stat small">{r!.value != null ? `${fmt(r!.value)} ${f!.kind === "weapon" ? "DMG" : "DEF"}` : "Not in game data"} · <span style={{ color: rarityColour(r!.rarity) }}>{r!.rarity}</span></span>
            </>
          ) : <span className="lo-empty small">Empty</span>}
        </span>
      </button>
      {card && (
        <>
          <span className="lo-ores">
            {r!.mix.map(({ ore, count }) => (
              <span key={ore.id} className="tile lo-ore" title={`${count} × ${ore.name}`} style={{ ["--rc" as string]: rarityColour(ore.rarity) }}>
                <GameImage src={imageUrl("ores", ore.id)} alt="" size={12} />
                <span className="t-br">{count}</span>
              </span>
            ))}
          </span>
          <button className="lo-clear" onClick={() => onClear(slot)} aria-label={`Take off ${f!.name}`} title="Take off">×</button>
        </>
      )}
    </div>
  );
}

function PickaxeSlotBox(p: SlotBoxProps & { pick: Pickaxe | null }) {
  const { pick, onOpen, onClear } = p;
  return (
    <div className={slotClass(p, !!pick)} data-slot="pickaxe">
      <button className="lo-main" onClick={() => onOpen("pickaxe")} aria-label={pick ? `Pickaxe: ${pick.name}. Change` : "Pickaxe: empty. Choose a pickaxe"}>
        <span className="tile lo-pic" style={{ ["--rc" as string]: pick ? rarityColour(pick.rarity) : "#3a3834" }}>
          {pick ? <GameImage src={imageUrl("pickaxes", pick.id)} alt="" size={22} /> : <SlotIcon slot="pickaxe" />}
        </span>
        <span className="lo-text">
          <span className="lo-label">Pickaxe</span>
          {pick ? (
            <>
              <span className="lo-name">{pick.name}</span>
              <span className="lo-stat small">{pick.region} · <span style={{ color: rarityColour(pick.rarity) }}>{pick.rarity}</span></span>
            </>
          ) : <span className="lo-empty small">Empty</span>}
        </span>
      </button>
      {pick && <button className="lo-clear" onClick={() => onClear("pickaxe")} aria-label={`Take off ${pick.name}`} title="Take off">×</button>}
    </div>
  );
}

/** Outline icons for empty slots. */
function SlotIcon({ slot }: { slot: Slot }) {
  const d: Record<Slot, string> = {
    helmet: "M5 13a7 7 0 0 1 14 0v4h-4v-3h-6v3H5z",
    chestplate: "M7 4l5 2 5-2 3 4-3 2v10H7V10L4 8z",
    leggings: "M7 4h10l1 16h-4l-2-10-2 10H6z",
    weapon: "M18 3l3 3-11 11-3-3zM5 16l3 3-3 2-2-2z",
    pickaxe: "M4 7c4-4 12-4 16 0-4-1-6-1-8 1M12 8l-7 13",
  };
  return <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" className="lo-icon"><path d={d[slot]} /></svg>;
}

/* ------------------------------------------------------------------ picker */

/** Tap a slot: choose from the saved forges that fit it, or from every pickaxe. */
export function SlotPicker({ slot, cards, current, onPick, onClose }: { slot: Slot; cards: Card[]; current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<number | "all">("all");

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);

  const fits = slot === "pickaxe" ? [] : cards.filter((c) => slotFor(c.f) === slot);
  const picks = slot === "pickaxe" ? PICKAXES.filter((p) => world === "all" || p.world === world || (world === 0 && p.world === null)) : [];

  return createPortal(
    <div className="picker-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="picker gp" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box}>
        <div className="tb">
          <h2 id={titleId}>Choose {slot === "weapon" ? "a weapon" : `a ${SLOT_LABEL[slot].toLowerCase()}`}</h2>
          <button className="lo-clear static" onClick={onClose} aria-label="Close">×</button>
        </div>
        {slot === "pickaxe" && (
          <div className="picker-worlds" role="group" aria-label="World">
            {(["all", 1, 2, 3, 4, 0] as const).map((w) => (
              <button key={w} className="btn sm" aria-pressed={world === w} onClick={() => setWorld(w)}>{w === "all" ? "All" : w === 0 ? "Limited" : `World ${w}`}</button>
            ))}
          </div>
        )}
        <div className="picker-list">
          {current && <button className="picker-item none" onClick={() => onPick(null)}>Take off</button>}
          {slot !== "pickaxe" && fits.length === 0 && (
            <p className="muted" style={{ margin: 8 }}>No saved {slot === "weapon" ? "weapons" : `${SLOT_LABEL[slot].toLowerCase()}s`} yet. Make one in the calculator and press ☆ to save it.</p>
          )}
          {fits.map(({ f, r }) => (
            <button key={f.id} className={`picker-item${current === f.id ? " on" : ""}`} onClick={() => onPick(f.id)} aria-pressed={current === f.id}>
              <span className="tile" style={{ width: 48, height: 48, ["--rc" as string]: rarityColour(r.rarity) }}><GameImage src={imageUrl(f.kind === "weapon" ? "weapons" : "armour", f.variant_id)} alt="" size={18} /></span>
              <span className="picker-text"><b>{f.name}</b><span className="small muted">{f.class_name} · {r.value != null ? `${fmt(r.value)} ${f.kind === "weapon" ? "DMG" : "DEF"}` : "Not in game data"}</span><span className="small faint">{r.mix.map((m) => `${m.count} ${m.ore.name}`).join(", ")}</span></span>
            </button>
          ))}
          {picks.map((p) => (
            <button key={p.id} className={`picker-item${current === p.id ? " on" : ""}`} onClick={() => onPick(p.id)} aria-pressed={current === p.id}>
              <span className="tile" style={{ width: 48, height: 48, ["--rc" as string]: rarityColour(p.rarity) }}><GameImage src={imageUrl("pickaxes", p.id)} alt="" size={18} /></span>
              <span className="picker-text"><b>{p.name}</b><span className="small"><span style={{ color: rarityColour(p.rarity) }}>{p.rarity}</span> <span className="muted">· {p.region}</span></span></span>
            </button>
          ))}
        </div>
        {slot === "pickaxe" && <p className="note" style={{ margin: "0 14px 12px" }}>Pickaxe list and pictures from the community wiki (CC BY-SA 4.0).</p>}
      </div>
    </div>,
    document.body,
  );
}
