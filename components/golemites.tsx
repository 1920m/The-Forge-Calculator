"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Catalogue, CatalogueOre } from "@/lib/engine/forge";
import { golemGrowth, golemite } from "@/lib/engine/golemite";
import { GOLEMITE_COLUMNS, MAX_GOLEMITES, golemiteHref, readGolemite, type NewGolemite, type SavedGolemite } from "@/lib/golemites";
import { cleanForgeName } from "@/lib/saved-forges";
import { imageUrl } from "@/lib/data/supabase";
import { supabase } from "@/lib/supabase/browser";
import { fmt, pct, rarityColour } from "@/lib/ui";
import { GOLEMITE } from "@/data/golemites";
import { useAuth } from "./auth";
import { GameImage } from "./game-image";

export type GolemWorked = ReturnType<typeof golemite>;
export type GolemCard = { g: SavedGolemite; r: GolemWorked };

/** A Golemite's stats from today's game data. */
export function workGolemite(oreById: Map<string, CatalogueOre>, g: Pick<SavedGolemite, "ores">): GolemWorked {
  return golemite(g.ores.flatMap((e) => { const ore = oreById.get(e.id); return ore ? [{ ore, count: e.count }] : []; }));
}

export function useGolemCards(cat: Catalogue, list: SavedGolemite[]): GolemCard[] {
  const oreById = useMemo(() => new Map(cat.ores.map((o) => [o.id, o])), [cat]);
  return useMemo(() => list.map((g) => ({ g, r: workGolemite(oreById, g) })), [list, oreById]);
}

/** The signed-in player's saved Golemites: loaded once, changes saved straight away. */
export function useGolemites() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [list, setList] = useState<SavedGolemite[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || loadedFor === uid) return;
    let alive = true;
    void supabase().from("golemites").select(GOLEMITE_COLUMNS).order("created_at", { ascending: false }).then(({ data, error: err }) => {
      if (!alive) return;
      setList(err ? [] : (data ?? []).flatMap((row) => { const g = readGolemite(row); return g ? [g] : []; }));
      setError(err ? "Couldn't load your Golemites." : null);
      setLoadedFor(uid);
    });
    return () => { alive = false; };
  }, [uid, loadedFor]);

  const save = useCallback(async (g: NewGolemite): Promise<string | null> => {
    const name = cleanForgeName(g.name);
    if (!name) return "Give your Golemite a name.";
    const { data, error: err } = await supabase().from("golemites").insert({ ...g, name }).select(GOLEMITE_COLUMNS).single();
    if (err) return /50 Golemites/.test(err.message) ? `You can save up to ${MAX_GOLEMITES} Golemites. Delete some to save more.` : "Couldn't save your Golemite. Please try again.";
    const saved = readGolemite(data);
    if (saved) setList((cur) => [saved, ...cur]);
    return null;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Pick<SavedGolemite, "name" | "level">>): Promise<string | null> => {
    let before: SavedGolemite[] = [];
    setList((cur) => { before = cur; return cur.map((g) => (g.id === id ? { ...g, ...patch } : g)); });
    const { error: err } = await supabase().from("golemites").update(patch).eq("id", id);
    if (err) { setList(before); return "Couldn't save that change. Please try again."; }
    return null;
  }, []);

  const remove = useCallback(async (id: string): Promise<string | null> => {
    const { error: err } = await supabase().from("golemites").delete().eq("id", id);
    if (err) return "Couldn't delete it. Please try again.";
    setList((cur) => cur.filter((g) => g.id !== id));
    return null;
  }, []);

  return { list, loading: !!uid && loadedFor !== uid, error, save, update, remove };
}

/** Rarity, mining help, trait scaling and growth for a Golemite. */
export function GolemiteStats({ r, level }: { r: GolemWorked; level: number }) {
  const grow = golemGrowth(level);
  return (
    <>
      <div className="kv"><span>Rarity:</span><span style={{ fontWeight: 700, color: r.rarity ? rarityColour(r.rarity) : undefined }}>{r.rarity ?? "–"}</span></div>
      <div className="kv"><span>Mining help:</span><span className="strong">{r.mining != null ? `${pct(r.mining * 100, 0)} of your mining damage` : "–"}</span></div>
      <div className="kv"><span>Trait scaling:</span><span className="muted">{r.traitScale != null ? `${pct(r.traitScale * 100, 0)} of each ore trait` : "–"}</span></div>
      <div className="kv"><span>Growth:</span><span className="muted">Level {grow.level} of {GOLEMITE.maxLevel} · {fmt(grow.size * 100, 0)}% size
        <span className="small faint" style={{ display: "block" }}>{grow.fights ? "Can fight (from level 13)." : `Fights from level ${GOLEMITE.combatLevel}: ${grow.toCombat} more snack${grow.toCombat === 1 ? "" : "s"} (one a day).`}</span></span></div>
      <div className="kv"><span>Carries:</span><span className="muted">Up to {GOLEMITE.storage} ores</span></div>
    </>
  );
}

/** The ore traits a Golemite gets, at its rarity's scaling. */
export function GolemiteTraits({ r }: { r: GolemWorked }) {
  if (!r.traits.length) return <p className="muted small" style={{ margin: 0 }}>No weapon traits carry over. An ore needs at least 10% of the mix.</p>;
  return (
    <ul className="golem-traits">
      {r.traits.map((t) => (
        <li key={t.ore.id}>
          <b style={{ color: rarityColour(t.ore.rarity) }}>{t.ore.name}</b> <span className="small muted">{pct(t.share * 100, 0)} of the mix · {pct(t.strength * 100, 0)} strength × {pct((r.traitScale ?? 0) * 100, 0)} = {pct(t.golem * 100, 1)}</span>
          {t.lines.map((l, i) => <span key={i} className="small" style={{ display: "block" }}>{l}</span>)}
        </li>
      ))}
    </ul>
  );
}

/** A saved Golemite on the Forger page. */
export function GolemiteCard({ card, equipped, onEquip, onLevel, onDelete }: {
  card: GolemCard; equipped: string | null; onEquip: (c: GolemCard) => void; onLevel: (c: GolemCard, level: number) => void; onDelete: (c: GolemCard) => Promise<string | null>;
}) {
  const { g, r } = card;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!confirm) return; const t = window.setTimeout(() => setConfirm(false), 4000); return () => clearTimeout(t); }, [confirm]);
  const del = async () => {
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    const res = await onDelete(card);
    if (res) { setErr(res); setBusy(false); setConfirm(false); }
  };
  return (
    <article className="forge-card golem-card" aria-label={g.name}>
      <div className="forge-card-h">
        <h3 className="forge-card-name">{g.name}</h3>
        <span className="small muted forge-card-meta">Golemite{equipped ? ` · ${equipped}` : ""}</span>
      </div>
      <div className="build-ores forge-card-ores">
        {r.mix.map(({ ore, count }) => (
          <span key={ore.id} className="build-ore" title={`${count} × ${ore.name}`}>
            <span className="tile" style={{ ["--rc" as string]: rarityColour(ore.rarity), width: 46, height: 46 }}>
              <GameImage src={imageUrl("ores", ore.id)} alt="" size={20} /><span className="t-br">{count}</span>
            </span>
            <span className="build-ore-name">{ore.name}</span>
          </span>
        ))}
      </div>
      <div className="build-stats">
        <GolemiteStats r={r} level={g.level} />
        <div className="kv"><span>Level:</span><span className="golem-level">
          <button className="btn sm" onClick={() => onLevel(card, g.level - 1)} disabled={g.level <= 0} aria-label="One level down">−</button>
          <b>{g.level}</b>
          <button className="btn sm" onClick={() => onLevel(card, g.level + 1)} disabled={g.level >= GOLEMITE.maxLevel} aria-label="One level up">+</button>
        </span></div>
      </div>
      {err && <p className="login-error small" role="alert" style={{ margin: "0 12px 8px" }}>{err}</p>}
      <div className="forge-card-actions">
        <Link className="btn sm gb" href={golemiteHref(g)}>Open in Golemite forge</Link>
        <button className="btn sm" aria-pressed={!!equipped} onClick={() => onEquip(card)} disabled={busy}>{equipped ? "Equipped" : "Equip"}</button>
        <button className={`btn sm danger-btn${confirm ? " confirm" : ""}`} onClick={del} disabled={busy} aria-label={confirm ? `Confirm delete ${g.name}` : `Delete ${g.name}`}>{confirm ? "Delete?" : "Delete"}</button>
      </div>
    </article>
  );
}
