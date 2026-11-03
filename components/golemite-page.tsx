"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Catalogue } from "@/lib/engine/forge";
import { golemite } from "@/lib/engine/golemite";
import { MAX_TYPES, addOre, parseRecipe, type Entry } from "@/lib/forge-slots";
import { imageUrl } from "@/lib/data/supabase";
import { pct, rarityColour } from "@/lib/ui";
import { GOLEMITE, GOLEMITE_SOURCE } from "@/data/golemites";
import { useAuth } from "./auth";
import { OreButton } from "./calculator";
import { GameImage } from "./game-image";
import { GolemiteStats, GolemiteTraits, useGolemites } from "./golemites";
import { Reveal } from "./shell";

type WorldFilter = "all" | 3 | 4;

/** Golemites are forged in Worlds 3 and 4. */
const GOLEM_WORLDS = [3, 4];

/** The Golemite forge: pick 10 or more ores and see the Golemite's rarity, mining help and traits, then save it. */
export function GolemitePage({ cat }: { cat: Catalogue }) {
  const { user } = useAuth();
  const { list, save } = useGolemites();
  const oreById = useMemo(() => new Map(cat.ores.map((o) => [o.id, o])), [cat]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [level, setLevel] = useState(0);
  const [world, setWorld] = useState<WorldFilter>("all");
  const [search, setSearch] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  // Restore from the link (o = ores, g = level), once.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      const o = parseRecipe(p.get("o"), (id) => oreById.has(id));
      if (o.length) setEntries(o);
      const g = Number(p.get("g"));
      if (Number.isInteger(g) && g >= 0 && g <= GOLEMITE.maxLevel) setLevel(g);
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [oreById]);

  // Keep the link shareable.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      const url = new URL(window.location.href);
      const o = entries.map((e) => `${e.id}:${e.count}`).join(",");
      if (o) url.searchParams.set("o", o); else url.searchParams.delete("o");
      if (level) url.searchParams.set("g", String(level)); else url.searchParams.delete("g");
      window.history.replaceState(null, "", url);
    } catch { /* not available */ }
  }, [entries, level]);

  const mix = useMemo(() => entries.flatMap((e) => { const ore = oreById.get(e.id); return ore ? [{ ore, count: e.count }] : []; }), [entries, oreById]);
  const r = useMemo(() => golemite(mix), [mix]);
  const ores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cat.ores.filter((o) => o.worlds.some((w) => (world === "all" ? GOLEM_WORLDS.includes(w) : w === world)) && (!q || o.name.toLowerCase().includes(q)));
  }, [cat, world, search]);
  const add = useCallback((id: string, n = 1) => startTransition(() => { setEntries((cur) => addOre(cur, id, n)); setStatus(null); }), []);
  const countOf = (id: string) => entries.find((e) => e.id === id)?.count ?? 0;
  const full = entries.length >= MAX_TYPES;
  const defaultName = r.rarity ? `${r.rarity} Golemite` : "Golemite";
  const already = list.some((g) => g.level === level && g.ores.length === entries.length && entries.every((e) => g.ores.some((x) => x.id === e.id && x.count === e.count)));

  const doSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setStatus(null);
    const err = await save({ name: (name ?? defaultName).trim(), ores: entries, level, catalogue_revision: Number((cat as { revision?: number }).revision) || null });
    setSaving(false);
    setStatus(err ? { ok: false, text: err } : { ok: true, text: "Saved. Equip it from your Forger page." });
  };

  return (
    <div className="page">
      <Reveal col={1}>
        <h1 className="title" style={{ fontSize: 28 }}>Golemite forge</h1>
        <p className="muted" style={{ marginTop: -6 }}>Golemites are Golem companions you forge from {GOLEMITE.minOres} or more ores. They help you mine, carry up to {GOLEMITE.storage} ores and can fight once grown. Pick the ores to see what you&apos;d get.</p>
      </Reveal>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <Reveal col={2} style={{ flex: "1 1 460px", minWidth: 0 }}>
          <section className="gp" aria-labelledby="golem-ores-h">
            <div className="tb"><h2 id="golem-ores-h">Select ores</h2><span className="small muted">{r.total} ore{r.total === 1 ? "" : "s"}</span></div>
            <div className="pad">
              {entries.length > 0 && (
                <div className="golem-mix" aria-label="Your mix">
                  {mix.map(({ ore, count }) => (
                    <div key={ore.id} className="golem-mix-item">
                      <span className="tile" style={{ width: 52, height: 52, ["--rc" as string]: rarityColour(ore.rarity) }}><GameImage src={imageUrl("ores", ore.id)} alt="" size={20} /></span>
                      <span className="golem-mix-text"><b>{ore.name}</b><span className="small muted">{pct((count / r.total) * 100, 0)} of the mix</span></span>
                      <span className="golem-level">
                        <button className="btn sm" onClick={() => add(ore.id, -1)} aria-label={`One less ${ore.name}`}>−</button>
                        <b>{count}</b>
                        <button className="btn sm" onClick={() => add(ore.id, 1)} aria-label={`One more ${ore.name}`}>+</button>
                      </span>
                    </div>
                  ))}
                  <button className="btn ghost sm" onClick={() => startTransition(() => { setEntries([]); setStatus(null); })}>Clear</button>
                </div>
              )}
              <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                <span className="small muted">Search ores</span>
                <input className="input" type="search" placeholder="Try Golem Heart or Vanegos" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }} role="group" aria-label="World">
                {(["all", 3, 4] as const).map((w) => <button key={w} className="btn sm" aria-pressed={world === w} onClick={() => setWorld(w)}>{w === "all" ? "Worlds 3 and 4" : `World ${w}`}</button>)}
              </div>
              <div className="ore-grid">
                {ores.map((o) => { const c = countOf(o.id); return <OreButton key={o.id} ore={o} count={c} locked={full && c === 0} onAdd={add} />; })}
              </div>
              <p className="note">Click to add one; right-click to remove one. Up to {MAX_TYPES} ore types, like the forge.</p>
            </div>
          </section>
        </Reveal>

        <Reveal col={3} style={{ flex: "1 1 380px", minWidth: 0 }}>
          <section className="gp result" aria-live="polite" aria-labelledby="golem-result-h">
            <div className="tb"><h2 id="golem-result-h">Your Golemite</h2></div>
            <div className="pad">
              {!r.enough ? (
                <p className="muted" style={{ margin: 0 }}>{r.total === 0 ? `Add ${GOLEMITE.minOres} or more ores.` : `Add ${GOLEMITE.minOres - r.total} more ore${GOLEMITE.minOres - r.total === 1 ? "" : "s"}: a Golemite needs at least ${GOLEMITE.minOres}.`}</p>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <div className="tile" style={{ width: 96, height: 96, ["--rc" as string]: r.rarity ? rarityColour(r.rarity) : "#3a3834" }}>
                      {r.primary && <GameImage src={imageUrl("ores", r.primary.id)} alt={r.primary.name} size={34} />}
                    </div>
                  </div>
                  <GolemiteStats r={r} level={level} />
                  <label className="golem-slider">
                    <span className="small muted">Growth level: <b className="strong">{level}</b></span>
                    <input type="range" min={0} max={GOLEMITE.maxLevel} value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Growth level" />
                  </label>
                  <h3 className="small muted" style={{ margin: "14px 0 6px", fontWeight: 400 }}>Traits it gets</h3>
                  <GolemiteTraits r={r} />
                  {user ? (
                    <form className="golem-save" onSubmit={doSave}>
                      <label className="sr-only" htmlFor="golem-name">Name</label>
                      <input id="golem-name" className="input" value={name ?? defaultName} maxLength={40} onChange={(e) => setName(e.target.value)} />
                      <button className="btn gb" type="submit" disabled={saving}>{saving ? "Saving…" : already ? "Save again" : "Save Golemite"}</button>
                    </form>
                  ) : (
                    <p className="small muted" style={{ marginTop: 14 }}><Link className="inline-link" href="/login?next=%2Fgolemite">Sign in</Link> to save Golemites and put them in your Loadout.</p>
                  )}
                  {status && <p className={status.ok ? "small gold" : "login-error small"} role={status.ok ? "status" : "alert"} style={{ marginTop: 8 }}>{status.text} {status.ok && <Link className="inline-link" href="/forger">Forger page</Link>}</p>}
                </>
              )}
              <p className="note" style={{ marginTop: 14 }}>Rarity comes from the ore you use most, the same as weapons and armour. Mining help, trait scaling, growth and storage are from the <a className="inline-link" href={GOLEMITE_SOURCE.url} target="_blank" rel="noopener noreferrer">Forge wiki</a> (checked {GOLEMITE_SOURCE.checked}); how a Golemite fights isn&apos;t known yet, so there&apos;s no damage figure. <Link className="inline-link" href="/how-it-works#golemites">How it works</Link></p>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
