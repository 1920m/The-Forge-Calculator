"use client";

import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { enhancementTable, forge, qualityLabel, roundStat, type Catalogue, type CatalogueOre, type Mix } from "@/lib/engine/forge";
import type { Kind } from "@/lib/engine";
import type { DpsResult } from "@/lib/engine/dps";
import { imageUrl } from "@/lib/data/supabase";
import { SHOW_STATUS_LABELS, fmt, pct, rarityColour } from "@/lib/ui";
import { Reveal, useShell, worldName } from "./shell";
import { GameImage } from "./game-image";
import { Chevron, Lock } from "./icons";
import { EMPTY_FILTER, OreFilter, TraitMarks, applyOreFilter, oreCategory, type OreFilterState } from "./ore-filter";

import { MAX_ORES, MAX_TYPES, addOre, parseRecipe, type Entry } from "@/lib/forge-slots";
import type { NewForge } from "@/lib/saved-forges";
import { SaveStar } from "./save-star";
import { FeedbackLink } from "./feedback";
import Link from "next/link";
import { averageTries, triesFor } from "@/lib/engine/odds";
import { DpsTarget } from "./dps-target";
const QUALITY_PRESETS = [25, 50, 75, 90, 100];

/** `c` and `v` in the URL pre-select a class and variant (used by the Builds page). */
function readRecipe(): { kind?: Kind; quality?: number; entries?: Entry[]; pick?: { cls: string; id: string } } {
  try {
    const p = new URLSearchParams(window.location.search);
    const fromUrl = p.get("o");
    const raw = fromUrl ?? window.localStorage.getItem("forge.recipe");
    const kind = (p.get("k") ?? window.localStorage.getItem("forge.kind")) as Kind | null;
    const q = Number(p.get("q") ?? window.localStorage.getItem("forge.quality"));
    const entries = raw ? parseRecipe(raw) : undefined;
    // Pre-selection from the Builds page: short, plain values only.
    const cls = p.get("c")?.slice(0, 60) ?? null, id = p.get("v")?.slice(0, 60) ?? null;
    return { kind: kind === "weapon" || kind === "armour" ? kind : undefined, quality: q > 0 && q <= 100 ? q : undefined, entries, pick: cls && id ? { cls, id } : undefined };
  } catch { return {}; }
}

export function Calculator({ cat }: { cat: Catalogue }) {
  const { world } = useShell();
  const oreById = useMemo(() => new Map(cat.ores.map((o) => [o.id, o])), [cat]);
  const [kind, setKind] = useState<Kind>("armour");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [quality, setQuality] = useState(100);
  const [pick, setPick] = useState<{ cls: string; id: string } | null>(null);
  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allWorlds, setAllWorlds] = useState(false);
  const [oreFilter, setOreFilter] = useState<OreFilterState>(EMPTY_FILTER);
  const loaded = useRef(false);

  // Restore the recipe from the URL or the last visit, once.
  useEffect(() => {
    const r = readRecipe();
    const t = window.setTimeout(() => {
      if (r.kind) setKind(r.kind);
      if (r.quality) setQuality(r.quality);
      if (r.entries) setEntries(r.entries.filter((e) => oreById.has(e.id)));
      if (r.pick) setPick(r.pick);
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [oreById]);

  // Keep the URL shareable and remember the recipe.
  useEffect(() => {
    if (!loaded.current) return;
    const o = entries.map((e) => `${e.id}:${e.count}`).join(",");
    try {
      const url = new URL(window.location.href);
      if (o) url.searchParams.set("o", o); else url.searchParams.delete("o");
      url.searchParams.set("k", kind);
      url.searchParams.set("q", String(quality));
      url.searchParams.delete("c"); url.searchParams.delete("v"); // one-time pre-selection
      window.history.replaceState(null, "", url);
      window.localStorage.setItem("forge.recipe", o);
      window.localStorage.setItem("forge.kind", kind);
      window.localStorage.setItem("forge.quality", String(quality));
    } catch { /* storage unavailable */ }
  }, [entries, kind, quality]);

  const mix: Mix = useMemo(() => entries.flatMap((e) => { const ore = oreById.get(e.id); return ore ? [{ ore, count: e.count }] : []; }), [entries, oreById]);
  const result = useMemo(() => forge(cat, mix, kind, world, quality / 100), [cat, mix, kind, world, quality]);
  const total = result.total;

  // Selected result: the user's pick if still valid, else the most likely variant.
  const selected = useMemo(() => {
    const live = result.classes.filter((c) => c.probability > 0);
    if (pick) {
      const c = result.classes.find((x) => x.name === pick.cls);
      const v = c?.variants.find((x) => x.id === pick.id);
      if (c && v) return { cls: c, v };
    }
    let best: { cls: (typeof result.classes)[number]; v: (typeof result.classes)[number]["variants"][number] } | null = null;
    for (const c of live) for (const v of c.variants) if (!best || v.overall > best.v.overall) best = { cls: c, v };
    return best;
  }, [result, pick]);

  // Stable so the ore tiles (memoised) only re-render when their own count changes.
  // Recalculating re-renders most of the page, so clicks run it as a transition: the browser paints the press first.
  const add = useCallback((id: string, n = 1) => startTransition(() => setEntries((cur) => addOre(cur, id, n))), []);
  const setCount = (id: string, count: number) => setEntries((cur) => cur.flatMap((e) => (e.id !== id ? [e] : count > 0 ? [{ id, count: Math.min(MAX_ORES, count) }] : [])));

  const countOf = (id: string) => entries.find((e) => e.id === id)?.count ?? 0;
  const full = entries.length >= MAX_TYPES;
  const removeAll = useCallback((id: string) => startTransition(() => setEntries((cur) => cur.filter((e) => e.id !== id))), []);
  const statName = kind === "armour" ? "Defense" : "Damage";
  const unit = kind === "armour" ? "DEF" : "DMG";
  // The same item at 100% quality: raw = base × M × (1 + q), so scale by 2 / (1 + q).
  const fullValue = selected?.v.raw != null ? (selected.v.raw * 2) / (1 + quality / 100) : null;
  const enhance = selected?.v.raw != null ? enhancementTable(selected.v.raw, kind) : [];
  const maxEnh = enhance.length ? Math.max(...enhance.map((l) => l.stat)) || 1 : 1;
  // DPS is weapon damage times things that don't depend on damage (speed, crits, proc chances), so it rises by the
  // same 5% per level as damage.
  const baseDps = kind === "weapon" ? selected?.v.dps?.total ?? null : null;
  const scopeOres = cat.ores.filter((o) => allWorlds || o.worlds.includes(world));
  const toSave = useMemo<NewForge | null>(() => selected && total >= 3 ? {
    name: selected.v.name, kind, world, class_name: selected.cls.name, variant_id: selected.v.id, quality, ores: entries,
    catalogue_revision: Number((cat as { revision?: number }).revision) || null,
  } : null, [selected, total, kind, world, quality, entries, cat]);
  const visibleOres = applyOreFilter(scopeOres.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase())), oreFilter);

  return (
    <div className="page calc">
      <div className="row">
        {/* ---------- Forge Chances ---------- */}
        <Reveal col={1} className="calc-left">
          <section className="gp" aria-labelledby="chances-h">
            <div className="tb"><h2 id="chances-h">Forge Chances</h2><span className="small muted">{total} ores</span></div>
            <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {total < 3 && <p className="small muted" style={{ margin: 0 }}>Add at least 3 ores to see what you can forge.</p>}
              {result.capped && <p className="small muted" style={{ margin: 0 }}>Odds are only known up to 55 ores, so the 55-ore odds are shown.</p>}
              {result.classes.map((c) => {
                const off = c.probability === 0;
                return (
                  <div key={c.name} style={{ opacity: off ? 0.45 : 1, transition: "opacity .3s" }}>
                    <div className="class-head">
                      <span>{c.name} ({c.probability}%)</span>
                      <span className="lock" title={`Lockable at ${c.lockAt} ores`} style={{ color: c.lockable ? "var(--acc)" : "var(--muted)" }}><Lock /> <small>{c.lockAt}</small></span>
                    </div>
                    {!off && (
                      <div className="variant-tiles">
                        {c.variants.map((v) => (
                          <button key={v.id} className="tile" style={{ width: 60, height: 60, ["--rc" as string]: selected?.v.id === v.id ? "var(--acc)" : "#3a3834" }}
                            onClick={() => startTransition(() => setPick({ cls: c.name, id: v.id }))} aria-label={`${v.name}, 1 in ${v.weight}, ${pct(v.overall)} overall`} title={`${v.name}: ${pct(v.chance)} in class, ${pct(v.overall, 2)} overall`}>
                            <GameImage src={imageUrl(kind === "weapon" ? "weapons" : "armour", v.id)} alt="" size={20} />
                            <span className="t-br" style={{ left: 0, right: 0, textAlign: "center" }}>1/{v.weight}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!off && c.incomplete && <div className="note" style={{ textAlign: "center", marginTop: 4 }}>Plus shop-blueprint weapons not listed yet, so chances inside this class may be a little high.</div>}
                  </div>
                );
              })}
            </div>
          </section>
        </Reveal>

        {/* ---------- Forge + result ---------- */}
        <div className="calc-mid">
          <Reveal col={2}>
            <section className="gp forge-panel" style={{ padding: "20px 22px 22px", textAlign: "center" }} aria-label="Forge">
              <SaveStar forge={toSave} />
              <div className="slots">
                  {mix.map(({ ore, count }) => (
                    <div key={ore.id} className="slot">
                      <HoldToRemove label={ore.name} onRemove={() => removeAll(ore.id)} colour={rarityColour(ore.rarity)}>
                        <GameImage src={imageUrl("ores", ore.id)} alt="" />
                        <span className="t-top">{ore.name}</span>
                        <span className="t-br">x{count}</span>
                      </HoldToRemove>
                      <div className="slot-ctl">
                        <button className="btn sm" onClick={() => add(ore.id, -1)} aria-label={`Remove one ${ore.name}`}>−</button>
                        <input className="input count" type="number" min={0} max={MAX_ORES} value={count} aria-label={`${ore.name} count`} onChange={(e) => setCount(ore.id, Math.floor(Number(e.target.value)) || 0)} />
                        <button className="btn sm" onClick={() => add(ore.id, 1)} aria-label={`Add one ${ore.name}`}>+</button>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: MAX_TYPES - mix.length }, (_, i) => (
                    <div key={`empty-${i}`} className="slot">
                      <div className="tile slot-empty" style={{ width: 92, height: 92 }}><span className="small faint">Empty</span></div>
                    </div>
                  ))}
                </div>
              <p className="small muted" style={{ margin: "10px 0 0" }}>
                {mix.length === 0 ? <>Your forge is empty. Pick up to {MAX_TYPES} ore types from <b>Select Ores</b>.</> : full ? <>The forge is full: {MAX_TYPES} ore types. Press and hold an ore to remove it.</> : <>Up to {MAX_TYPES} ore types. Press and hold an ore to remove it.</>}
              </p>
              <div style={{ marginTop: 16, fontSize: 20, fontWeight: 700, color: "#fff" }}>Multiplier: {result.multiplier == null ? "–" : `${result.multiplier.toFixed(2)}x`}</div>
              <div className="muted" style={{ fontSize: 15 }}>
                {total} ore{total === 1 ? "" : "s"}{result.primary && <>. Primary ore: <span style={{ color: rarityColour(result.primary.rarity) }}>{result.primary.name}</span> (sets the look and rarity)</>}
              </div>
              {total > 0 && (
                <div style={{ margin: "14px auto 0", maxWidth: 460 }}>
                  <div className="share" role="img" aria-label={mix.map((m) => `${m.ore.name} ${pct((m.count / total) * 100, 0)}`).join(", ")}>
                    {mix.map((m) => <div key={m.ore.id} style={{ width: `${(m.count / total) * 100}%`, background: rarityColour(m.ore.rarity) }} />)}
                  </div>
                  <div className="share-legend">{mix.map((m) => <span key={m.ore.id}>{m.ore.name} {pct((m.count / total) * 100, 0)}</span>)}</div>
                </div>
              )}
              {mix.length > 0 && <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => startTransition(() => { setEntries([]); setPick(null); })}>Clear forge</button>}
            </section>
          </Reveal>

          <Reveal col={2}>
            <section className="gp result" aria-live="polite" aria-label="Result">
              {selected ? (
                <>
                  <h2 className="result-name">{selected.v.name}{SHOW_STATUS_LABELS && !selected.v.verified && <> <span className="badge unv">Unverified</span></>}</h2>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div className="tile" style={{ width: 110, height: 110, ["--rc" as string]: rarityColour(result.rarity) }}>
                      <GameImage src={imageUrl(kind === "weapon" ? "weapons" : "armour", selected.v.id)} alt={selected.v.name} size={40} />
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div className="kv"><span>Craft Quality:</span><span className="gold" style={{ fontWeight: 700 }}>{qualityLabel(cat, quality)} ({quality}%)</span></div>
                    <div className="kv"><span>Materials:</span><span className="small" style={{ color: "#cfc7b2" }}>{mix.map((m) => `${m.ore.name}(${pct((m.count / total) * 100, 0)})`).join(" + ")}</span></div>
                    <div className="kv"><span>Class:</span><span className="muted">{selected.cls.name}</span></div>
                    <div className="kv"><span>Rarity:</span><span style={{ fontWeight: 700, color: rarityColour(result.rarity) }}>{result.rarity}</span></div>
                    <div className="kv"><span>{statName}:</span><span className="strong" style={{ fontWeight: 700 }}>{fmt(selected.v.value)} {unit}</span></div>
                    <div className="kv"><span>At 100%:</span><span className="muted">{fullValue == null ? "–" : `${fmt(roundStat(fullValue, kind))} ${unit}`}</span></div>
                    {kind === "weapon" && <div className="kv"><span>ATK Speed:</span><span className="muted" title="The real time between swings. The game's item card shows a different 'index' number, which isn't the real speed.">{selected.v.interval}s per swing · range {selected.v.range}<span className="small faint" style={{ display: "block" }}>Card shows {selected.v.speed}s (the game&apos;s index value)</span></span></div>}
                    {kind === "weapon" && selected.v.dps && <DpsRow dps={selected.v.dps} />}
                    <div className="kv"><span>Chance:</span><span className="muted">{pct(selected.v.overall, 2)} overall ({pct(selected.v.chance)} of {selected.cls.name})</span></div>
                    <TriesRow chance={selected.v.overall / 100} ores={total} />
                    <div className="kv"><span>Lock:</span><span className="muted">{selected.cls.lockable ? "Lockable with this many ores" : `Lockable from ${selected.cls.lockAt} ores`}</span></div>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ textAlign: "center", margin: "18px 0" }}>Add 3 or more ores to see your result.</p>
              )}
              <div className="small muted" style={{ marginTop: 16, textAlign: "center" }}>Set quality</div>
              <div className="presets">
                {QUALITY_PRESETS.map((v) => <button key={v} className="btn" aria-pressed={quality === v} onClick={() => startTransition(() => setQuality(v))}>{v}%</button>)}
              </div>
              <label className="small muted" style={{ display: "block", marginTop: 10 }}>
                <span className="sr-only">Quality percent</span>
                <input type="range" min={1} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
              </label>
              {SHOW_STATUS_LABELS && <div className="note" style={{ textAlign: "center", marginTop: 4 }}>Quality label ranges are unverified.</div>}
              {selected && <p className="small faint" style={{ textAlign: "center", margin: "14px 0 0" }}>Game shows something different? <FeedbackLink kind="bug" className="inline-link">Tell us</FeedbackLink></p>}
            </section>
          </Reveal>
        </div>

        {/* ---------- Select ores ---------- */}
        <Reveal col={3} className="calc-right">
          <section className="gp" aria-labelledby="ores-h">
            <div className="tb"><h2 id="ores-h">Forge / Select Ores</h2></div>
            <div style={{ padding: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                <span className="small muted">Search ores</span>
                <input className="input" type="search" placeholder="Try Mythril or Kitsunite" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", position: "relative" }}>
                <button className="btn sm" aria-pressed={!allWorlds} onClick={() => setAllWorlds(false)}>World {worldName(world)} ores</button>
                <button className="btn sm" aria-pressed={allWorlds} onClick={() => setAllWorlds(true)}>All ores</button>
                <OreFilter ores={scopeOres} value={oreFilter} onChange={setOreFilter} />
              </div>
              <div className="ore-grid">
                {visibleOres.map((o) => { const c = countOf(o.id); return <OreButton key={o.id} ore={o} count={c} locked={full && c === 0} onAdd={add} />; })}
              </div>
              {visibleOres.length === 0 && <p className="muted" style={{ margin: "4px 0 0" }}>No ores match these filters. Try widening the multiplier range or press Reset.</p>}
              <p className="note">{visibleOres.length} ores. Click to add one; right-click to remove one. <span style={{ color: "#e8c27a" }}>Sword</span> = weapon trait, <span style={{ color: "#8fd0f2" }}>shield</span> = armour trait.</p>
              <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                <button className={`big-toggle ${kind === "armour" ? "gb" : "btn"}`} aria-pressed={kind === "armour"} onClick={() => startTransition(() => { setKind("armour"); setPick(null); })}>Armor</button>
                <button className={`big-toggle ${kind === "weapon" ? "gb" : "btn"}`} aria-pressed={kind === "weapon"} onClick={() => startTransition(() => { setKind("weapon"); setPick(null); })}>Weapon</button>
              </div>
            </div>
          </section>
        </Reveal>
      </div>

      {/* ---------- variants + traits (left) and enhancement (right) ---------- */}
      {selected && (
        <>
          <div className="row">
            <div className="lower-left">
              <Reveal col={4}>
                <section className="gp">
                  <div className="tb"><h2>{selected.cls.name} variants</h2></div>
                  <div className="pad scroll-x">
                    <table className="table" style={{ minWidth: 420 }}>
                      <thead><tr><th>Variant</th><th>In class</th><th>Overall</th><th style={{ textAlign: "right" }}>{statName} at {quality}%</th></tr></thead>
                      <tbody>
                        {selected.cls.variants.map((v) => (
                          <tr key={v.id} className={v.id === selected.v.id ? "sel" : ""} onClick={() => startTransition(() => setPick({ cls: selected.cls.name, id: v.id }))} style={{ cursor: "pointer" }}>
                            <td><button className="link-btn" onClick={() => setPick({ cls: selected.cls.name, id: v.id })}>{v.name}</button> {SHOW_STATUS_LABELS && !v.verified && <span className="badge unv">Unverified</span>}{v.tag === "shop" && <span className="badge shop" title="Funguy shop blueprint">Shop</span>}{v.tag === "halloween" && <span className="badge der" title="Halloween weapon, World 4 only">Halloween</span>}</td>
                            <td>{pct(v.chance)}</td><td>{pct(v.overall, 2)}</td><td className="num">{fmt(v.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </Reveal>
              <div className={`collapse ${enhanceOpen ? "open" : ""}`}><div><div style={{ paddingTop: 24 }}>
                <TraitsPanel traits={result.traits} kind={kind} dense />
              </div></div></div>
            </div>

            <Reveal col={4} className="lower-right">
              <section className="gp">
                <button className="enh-head" aria-expanded={enhanceOpen} aria-controls="enh-rest" onClick={() => setEnhanceOpen((o) => !o)}>
                  <Chevron open={enhanceOpen} /><span>Enhance Equipment</span><span className="small" style={{ marginLeft: "auto", color: "#cfc7e6" }}>{enhanceOpen ? "Show less" : "Show +1 to +10"}</span>
                </button>
                <div className="pad">
                  <div className="stat-head enh-cols"><span><span className="enh-long">Stat Improvement:</span><span className="enh-short">Level</span></span>{baseDps != null && <><span className="enh-v">{unit}</span><span className="enh-d">DPS</span></>}</div>
                  {enhance.slice(0, 1).map((l) => <EnhRow key={l.level} l={l} max={maxEnh} unit={unit} dps={baseDps} />)}
                  <div id="enh-rest" className={`collapse ${enhanceOpen ? "open" : ""}`}><div>
                    {enhance.slice(1).map((l, i) => <EnhRow key={l.level} l={l} max={maxEnh} unit={unit} dps={baseDps} delay={enhanceOpen ? i * 35 : 0} hidden={!enhanceOpen} />)}
                  </div></div>
                  <p className="note">Every stat rises 5% per level, from +0 to +10. Values use your quality setting.{baseDps != null && " DPS rises by the same 5% per level, because hits and trait procs all scale with weapon damage."}</p>
                </div>
              </section>
            </Reveal>
          </div>
          {kind === "weapon" && (
            <Reveal col={4}>
              <DpsTarget classes={result.classes} pickedDps={selected.v.dps?.total ?? null} pickedId={selected.v.id} ores={total} quality={quality}
                onPick={(cls, id) => { startTransition(() => setPick({ cls, id })); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            </Reveal>
          )}
          <div className={`collapse ${enhanceOpen ? "" : "open"}`}><div>
            <Reveal col={4}><TraitsPanel traits={result.traits} kind={kind} /></Reveal>
          </div></div>
        </>
      )}
    </div>
  );
}

const OreButton = memo(function OreButton({ ore, count, locked, onAdd }: { ore: CatalogueOre; count: number; locked: boolean; onAdd: (id: string, n?: number) => void }) {
  return (
    <button className={`tile${locked ? " locked" : ""}`} style={{ height: 88, ["--rc" as string]: rarityColour(ore.rarity) }} onClick={() => onAdd(ore.id)} aria-disabled={locked}
      onContextMenu={(e) => { e.preventDefault(); onAdd(ore.id, -1); }} aria-label={locked ? `${ore.name}: the forge already has ${MAX_TYPES} ore types` : `Add ${ore.name}, ${ore.rarity}, ${ore.multiplier}x`} title={`${ore.name} · ${ore.rarity} · ${ore.multiplier}x${oreCategory(ore).weapon ? " · weapon trait" : ""}${oreCategory(ore).armour ? " · armour trait" : ""}`}>
      <GameImage src={imageUrl("ores", ore.id)} alt="" size={24} />
      <span className="t-top" style={{ right: count ? 26 : 2 }}>{ore.name}</span>
      <span className="t-br">{ore.multiplier}x</span>
      <TraitMarks ore={ore} />
      {count > 0 && <span className="t-badge">{count}</span>}
    </button>
  );
});

/** Forge slot that removes the whole ore after a press-and-hold: a ring fills round a bin icon, red fading to grey. */
function HoldToRemove({ label, colour, onRemove, children }: { label: string; colour: string; onRemove: () => void; children: React.ReactNode }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const HOLD_MS = 700;
  const stop = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; setHolding(false); };
  const start = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setHolding(true);
    timer.current = window.setTimeout(() => { timer.current = null; setHolding(false); onRemove(); }, HOLD_MS);
  };
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return (
    <button className={`tile hold${holding ? " holding" : ""}`} style={{ width: 92, height: 92, ["--rc" as string]: colour, ["--hold" as string]: `${HOLD_MS}ms` }}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === "Delete" || e.key === "Backspace") onRemove(); }}
      aria-label={`${label}. Press and hold, or press Delete, to remove all ${label}`}>
      {children}
      <span className="hold-ring" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="62" height="62">
          <circle cx="24" cy="24" r="20" className="hold-track" />
          <circle cx="24" cy="24" r="20" className="hold-fill" pathLength={100} />
          <g className="hold-bin" transform="translate(14 13) scale(0.85)" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v8M14 10v8" />
          </g>
        </svg>
      </span>
    </button>
  );
}

function EnhRow({ l, max, unit, dps = null, delay = 0, hidden = false }: { l: { level: number; multiplier: number; stat: number }; max: number; unit: string; dps?: number | null; delay?: number; hidden?: boolean }) {
  return (
    <div className="enh-row" style={{ opacity: hidden ? 0 : 1, transform: hidden ? "translateY(-8px)" : "none", transition: `opacity .4s ease ${delay}ms, transform .4s ease ${delay}ms` }}>
      <span className="enh-l">+{l.level}</span>
      <span className="enh-m">1.00x → {l.multiplier.toFixed(2)}x</span>
      <span className="bar"><span style={{ width: `${Math.max(1, (l.stat / max) * 100)}%`, background: "#8fb86a" }} /></span>
      <span className="num enh-v" title={unit}>{fmt(l.stat)}</span>
      {dps != null && <span className="num enh-d" title="DPS at this level">{fmt(dps * l.multiplier)}</span>}
    </div>
  );
}

function TraitsPanel({ traits, kind, dense = false }: { traits: ReturnType<typeof forge>["traits"]; kind: Kind; dense?: boolean }) {
  return (
    <section className="gp">
      <div className="tb"><h2>Traits that transfer</h2>{SHOW_STATUS_LABELS && <span className="badge ok">Confirmed in game</span>}</div>
      <div className="pad">
        <p className="small muted" style={{ margin: "0 0 12px" }}>A trait needs a 10% share of the craft and reaches full strength at 30%. Chances, damage and stat amounts below are scaled to your share, as in game. Durations and cooldowns are shown as listed.</p>
        {traits.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No {kind} traits transfer from this mix.</p>
        ) : (
          <div className="trait-grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${dense ? 240 : 280}px, 1fr))` }}>
            {traits.map((t) => (
              <div key={t.ore.id} className="trait" style={{ opacity: t.strength === 0 ? 0.55 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontWeight: 700, color: "#fff", fontSize: 19 }}>{t.ore.name}</span>
                  <span className="small muted">{pct(t.share * 100)} share</span>
                </div>
                <div className="bar" style={{ height: 8, margin: "8px 0 4px" }}><span style={{ width: `${t.strength * 100}%`, background: "#8a5cc9" }} /></div>
                <div className="small muted" style={{ marginBottom: 6 }}>{t.strength === 0 ? "Inactive: needs at least a 10% share" : `Strength ${pct(t.strength * 100, 0)}`}</div>
                {t.lines.map((l, i) => <div key={i} style={{ fontSize: 16, color: "var(--strong)" }}>{l}</div>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** DPS with every trait the mix transfers: crits and lethality on each hit, plus procs and damage over time. */
function DpsRow({ dps }: { dps: DpsResult }) {
  const bits = [
    dps.critChance > 0 && `${pct(dps.critChance * 100)} crit chance, crits hit ${fmt(145 + dps.critDamage * 100, 1)}%`,
    dps.lethality > 0 && `+${pct(dps.lethality * 100)} lethality`,
    dps.atkSpeed > 0 && `+${pct(dps.atkSpeed * 100)} attack speed`,
    ...dps.parts.map((p) => `${p.label} ${fmt(p.dps)}`),
  ].filter(Boolean);
  return (
    <div className="kv">
      <span>DPS:</span>
      <span>
        <span className="strong" style={{ fontWeight: 700 }}>{fmt(dps.total)}</span>
        <span className="muted small"> · {fmt(dps.attacksPerSecond)} hits/s</span>
        {bits.length > 0 && <span className="small faint" style={{ display: "block" }}>{bits.join(" · ")}</span>}
        {dps.night != null && <span className="small faint" style={{ display: "block" }}>At night (Moon Stone): {fmt(dps.night)}</span>}
      </span>
    </div>
  );
}

/** "How many tries?" in plain words. The maths is on the How it works page. */
function TriesRow({ chance, ores }: { chance: number; ores: number }) {
  if (!(chance > 0)) return null;
  if (chance >= 1) return <div className="kv"><span>Tries:</span><span className="muted">Every forge with this mix gives it.</span></div>;
  const avg = averageTries(chance), half = triesFor(chance, 0.5), most = triesFor(chance, 0.9);
  const forges = (n: number) => `${fmt(n, 0)} forge${n === 1 ? "" : "s"}`;
  return (
    <div className="kv"><span>Tries:</span>
      <span className="muted">About {avg < 100 ? fmt(avg, 1) : fmt(avg, 0)} forges on average. Half of players get it within {forges(half)}, 9 in 10 within {forges(most)}.
        <span className="small faint" style={{ display: "block" }}>That&apos;s about {fmt(most * ores, 0)} ores for a 9 in 10 chance. <Link href="/how-it-works#tries" className="inline-link">How this is worked out</Link></span>
      </span>
    </div>
  );
}
