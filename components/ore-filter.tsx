"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import type { CatalogueOre } from "@/lib/engine/forge";

export { EMPTY_FILTER, applyOreFilter, multiplierBounds, oreCategory, type OreFilterState, type OreSort } from "@/lib/ore-filter";
import { EMPTY_FILTER, multiplierBounds, oreCategory, type OreFilterState, type OreSort } from "@/lib/ore-filter";

const SORTS: [Exclude<OreSort, null>, string][] = [
  ["high", "Highest multiplier"],
  ["low", "Lowest multiplier"],
  ["armour", "Best for armour"],
  ["weapon", "Best for weapons"],
];

export function OreFilter({ ores, value, onChange }: { ores: CatalogueOre[]; value: OreFilterState; onChange: (v: OreFilterState) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [min, max] = multiplierBounds(ores);
  // Keep the chosen range inside the current world's bounds.
  const lo = Math.max(min, Math.min(value.range?.[0] ?? min, max));
  const hi = Math.min(max, Math.max(value.range?.[1] ?? max, lo));
  const active = (value.sort ? 1 : 0) + (value.range && (lo > min || hi < max) ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const setRange = (a: number, b: number) => onChange({ ...value, range: a <= min && b >= max ? null : [a, b] });
  const pctOf = (v: number) => (max === min ? 0 : ((v - min) / (max - min)) * 100);
  const step = 0.05;

  return (
    <div className="ofilter" ref={wrap}>
      <button className="btn sm ofilter-btn" aria-expanded={open} aria-controls={panelId} aria-pressed={active > 0} onClick={() => setOpen((o) => !o)}>
        <FunnelIcon /> Filter{active > 0 && <span className="ofilter-count">{active}</span>}
        <motion.span aria-hidden="true" animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} style={{ display: "inline-flex" }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </motion.span>
      </button>
      {/* Always mounted; opening only flips a class, so the click stays cheap. Height animates with CSS grid rows. */}
      <div className={`ofilter-drop${open ? " open" : ""}`}>
        <div className="ofilter-clip" inert={!open}>
          <div id={panelId} className="ofilter-panel gp" role="dialog" aria-label="Filter ores" aria-hidden={!open}>
            <div className="ofilter-head">
              <span>Sort and filter</span>
              <button className="link-btn small" onClick={() => onChange(EMPTY_FILTER)} disabled={active === 0} style={{ opacity: active ? 1 : 0.4 }}>Reset</button>
            </div>
            <div className="ofilter-sorts">
              {SORTS.map(([key, label]) => (
                <motion.button key={key} className="btn sm" aria-pressed={value.sort === key}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onChange({ ...value, sort: value.sort === key ? null : key })}>
                  {label}
                </motion.button>
              ))}
            </div>
            <div className="ofilter-range">
              <div className="ofilter-range-head"><span className="small muted">Multiplier</span><span className="gold small" style={{ fontWeight: 700 }}>{hi.toFixed(2)}x – {lo.toFixed(2)}x</span></div>
              {/* Highest on the left, lowest on the right: the inputs run right-to-left. */}
              <div className="dual" dir="rtl">
                <div className="dual-track" />
                <div className="dual-fill" style={{ left: `${100 - pctOf(hi)}%`, right: `${pctOf(lo)}%` }} />
                <input type="range" aria-label="Lowest multiplier" min={min} max={max} step={step} value={lo}
                  onChange={(e) => setRange(Math.min(Number(e.target.value), hi), hi)} style={{ zIndex: lo > max - (max - min) * 0.1 ? 4 : 3 }} />
                <input type="range" aria-label="Highest multiplier" min={min} max={max} step={step} value={hi}
                  onChange={(e) => setRange(lo, Math.max(Number(e.target.value), lo))} style={{ zIndex: 3 }} />
              </div>
              <div className="ofilter-range-head faint small"><span>{max.toFixed(1)}x</span><span>{min.toFixed(1)}x</span></div>
            </div>
            <p className="note" style={{ margin: "8px 0 0" }}>Applies to the ores shown above ({ores.length}). &ldquo;Best for&rdquo; keeps ores whose trait helps that item, highest multiplier first.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

/** Small marks on an ore tile: sword = weapon trait, shield = armour trait. */
export function TraitMarks({ ore }: { ore: CatalogueOre }) {
  const c = oreCategory(ore);
  if (c.none) return null;
  return (
    <span className="t-bl trait-marks" aria-hidden="true">
      {c.weapon && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#e8c27a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" /></svg>}
      {c.armour && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#8fd0f2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
    </span>
  );
}
