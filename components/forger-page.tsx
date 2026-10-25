"use client";

import { memo, startTransition, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { forge, qualityLabel, type Catalogue, type CatalogueOre } from "@/lib/engine/forge";
import { imageUrl } from "@/lib/data/supabase";
import { fmt, rarityColour } from "@/lib/ui";
import { MAX_NAME, MAX_SAVED, calculatorHref, type SavedForge } from "@/lib/saved-forges";
import { useAuth } from "./auth";
import { useSavedForges } from "./saved-forges";
import { Avatar } from "./account-menu";
import { Reveal, useShell, worldName } from "./shell";
import { GameImage } from "./game-image";

type KindFilter = "all" | "weapon" | "armour";
type Sort = "new" | "old" | "stat" | "name";

export function ForgerPage({ cat }: { cat: Catalogue }) {
  const { user, profile, loading: authLoading } = useAuth();
  const { forges, loading, error } = useSavedForges();
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<Sort>("new");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLowerCase());
  const oreById = useMemo(() => new Map(cat.ores.map((o) => [o.id, o])), [cat]);

  // Work each forge out once from the current game data.
  const cards = useMemo(() => forges.map((f) => ({ f, r: work(cat, oreById, f) })), [forges, cat, oreById]);
  const shown = useMemo(() => {
    const list = cards.filter(({ f, r }) => (kind === "all" || f.kind === kind)
      && (!query || f.name.toLowerCase().includes(query) || (r.variantName ?? "").toLowerCase().includes(query) || r.mix.some((m) => m.ore.name.toLowerCase().includes(query))));
    if (sort === "old") list.reverse();
    if (sort === "stat") list.sort((a, b) => (b.r.value ?? -1) - (a.r.value ?? -1));
    if (sort === "name") list.sort((a, b) => a.f.name.localeCompare(b.f.name));
    return list;
  }, [cards, kind, query, sort]);

  if (authLoading) return <div className="page"><p className="muted">Loading…</p></div>;

  if (!user) {
    return (
      <div className="page">
        <section className="gp login">
          <div className="tb"><h1 className="title">Forger page</h1></div>
          <div className="pad">
            <p className="login-lead">Your saved forges live here. Sign in, then press the ☆ on the calculator to save a forge.</p>
            <Link className="btn gb login-btn" href="/login?next=%2Fforger">Sign in</Link>
          </div>
        </section>
      </div>
    );
  }

  const name = profile?.display_name ?? "Forger";
  const counts = { all: forges.length, weapon: forges.filter((f) => f.kind === "weapon").length, armour: forges.filter((f) => f.kind === "armour").length };

  return (
    <div className="page">
      <Reveal col={1}>
        <section className="gp">
          <div className="tb forger-head">
            <span className="forger-who"><Avatar name={name} url={profile?.avatar_url ?? null} size={40} /><h1 className="title">{name}</h1></span>
            <span className="small muted">{loading ? "Loading…" : `${forges.length} of ${MAX_SAVED} forges saved`}</span>
          </div>
          <div className="pad forger-tools">
            <div className="forger-kinds" role="group" aria-label="Show">
              {(["all", "weapon", "armour"] as const).map((k) => (
                <button key={k} className="btn sm" aria-pressed={kind === k} onClick={() => startTransition(() => setKind(k))}>
                  {k === "all" ? "All" : k === "weapon" ? "Weapons" : "Armor"} <span className="muted">({counts[k]})</span>
                </button>
              ))}
            </div>
            <label className="forger-search">
              <span className="sr-only">Search saved forges</span>
              <input className="input" type="search" placeholder="Search names or ores" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <label className="forger-sort">
              <span className="small muted">Sort</span>
              <select className="input" value={sort} onChange={(e) => startTransition(() => setSort(e.target.value as Sort))}>
                <option value="new">Newest</option>
                <option value="old">Oldest</option>
                <option value="stat">Strongest</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
        </section>
      </Reveal>

      {error && <p className="login-error" role="alert">{error}</p>}

      {!loading && forges.length === 0 && !error && (
        <section className="gp"><div className="pad forger-empty">
          <p style={{ margin: 0 }}>No saved forges yet.</p>
          <p className="muted" style={{ margin: "6px 0 14px" }}>Make a forge in the calculator and press the ☆ in the forge&apos;s corner to keep it here.</p>
          <Link className="btn gb" href="/">Open the calculator</Link>
        </div></section>
      )}

      {forges.length > 0 && shown.length === 0 && <p className="muted">No saved forges match. Try another search or show All.</p>}

      {shown.length > 0 && (
        <div className="forge-grid">
          {shown.map(({ f, r }) => <ForgeCard key={f.id} f={f} r={r} cat={cat} />)}
        </div>
      )}
    </div>
  );
}

type Worked = ReturnType<typeof work>;

/** Stats for a save from today's game data. The item can vanish if the game data changes; the card says so. */
function work(cat: Catalogue, oreById: Map<string, CatalogueOre>, f: SavedForge) {
  const mix = f.ores.flatMap((e) => { const ore = oreById.get(e.id); return ore ? [{ ore, count: e.count }] : []; });
  const r = forge(cat, mix, f.kind, f.world, f.quality / 100);
  const cls = r.classes.find((c) => c.name === f.class_name);
  const v = cls?.variants.find((x) => x.id === f.variant_id);
  return {
    mix, missingOres: mix.length < f.ores.length,
    rarity: r.rarity, multiplier: r.multiplier, traits: r.traits.filter((t) => t.strength > 0).map((t) => t.ore.name),
    variantName: v?.name ?? null, value: v?.value ?? null, dps: v?.dps?.total ?? null, speed: v?.speed ?? null,
    chance: cls ? (cls.lockable ? "Guaranteed" : `${cls.probability}% class`) : null,
  };
}

const ForgeCard = memo(function ForgeCard({ f, r, cat }: { f: SavedForge; r: Worked; cat: Catalogue }) {
  const { setWorld } = useShell();
  const { rename, remove } = useSavedForges();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(f.name);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const unit = f.kind === "weapon" ? "DMG" : "DEF";
  const gone = !r.variantName || r.missingOres;

  useEffect(() => { if (editing) input.current?.select(); }, [editing]);
  useEffect(() => { if (!confirm) return; const t = window.setTimeout(() => setConfirm(false), 4000); return () => clearTimeout(t); }, [confirm]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim() === f.name) { setEditing(false); return; }
    setBusy(true);
    const res = await rename(f.id, draft);
    setBusy(false);
    if (res) setErr(res); else { setErr(null); setEditing(false); }
  };

  const del = async () => {
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    const res = await remove(f.id);
    if (res) { setErr(res); setBusy(false); setConfirm(false); }
  };

  return (
    <article className="forge-card" aria-labelledby={titleId}>
      <div className="forge-card-h">
        {editing ? (
          <form className="forge-rename" onSubmit={submit}>
            <label className="sr-only" htmlFor={`${titleId}-in`}>Name</label>
            <input id={`${titleId}-in`} ref={input} className="input" value={draft} maxLength={MAX_NAME} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setDraft(f.name); setEditing(false); } }} disabled={busy} />
            <button className="btn sm" type="submit" disabled={busy}>Save</button>
          </form>
        ) : (
          <h2 id={titleId} className="forge-card-name">{f.name}</h2>
        )}
        <span className="small muted forge-card-meta">{f.kind === "weapon" ? "Weapon" : "Armor"} · W{worldName(f.world)}</span>
      </div>

      <div className="forge-card-top">
        <div className="tile" style={{ width: 84, height: 84, ["--rc" as string]: rarityColour(r.rarity) }}>
          <GameImage src={imageUrl(f.kind === "weapon" ? "weapons" : "armour", f.variant_id)} alt={r.variantName ?? ""} size={32} />
        </div>
        <div className="forge-card-id">
          {r.variantName && r.variantName !== f.name && <div style={{ color: "#fff", fontWeight: 700 }}>{r.variantName}</div>}
          <div className="muted small">{f.class_name}</div>
          <div style={{ color: rarityColour(r.rarity), fontWeight: 700 }}>{r.rarity}</div>
        </div>
      </div>

      <div className="build-ores forge-card-ores">
        {r.mix.map(({ ore, count }) => (
          <span key={ore.id} className="build-ore" title={`${count} × ${ore.name}`}>
            <span className="tile" style={{ ["--rc" as string]: rarityColour(ore.rarity), width: 46, height: 46 }}>
              <GameImage src={imageUrl("ores", ore.id)} alt="" size={20} />
              <span className="t-br">{count}</span>
            </span>
            <span className="build-ore-name">{ore.name}</span>
          </span>
        ))}
      </div>

      <div className="build-stats">
        {gone ? (
          <p className="small muted forge-gone">This forge no longer matches the game data, so its stats can&apos;t be worked out. Open it in the calculator to rebuild it.</p>
        ) : (
          <>
            <div className="kv"><span>{unit}</span><span className="strong" style={{ fontWeight: 700 }}>{fmt(r.value ?? 0)}</span></div>
            {f.kind === "weapon" && r.dps != null && <div className="kv"><span>DPS</span><span className="strong">{fmt(r.dps)}</span></div>}
            {f.kind === "weapon" && r.speed != null && <div className="kv"><span>ATK Speed</span><span className="muted">{r.speed}s</span></div>}
            <div className="kv"><span>Quality</span><span className="gold">{qualityLabel(cat, f.quality)} ({f.quality}%)</span></div>
            <div className="kv"><span>Multiplier</span><span className="muted">{r.multiplier == null ? "–" : `${fmt(r.multiplier)}x`}</span></div>
            <div className="kv"><span>Class</span><span className="muted">{r.chance ?? "–"}</span></div>
            <div className="kv"><span>Traits</span><span className="muted">{r.traits.length ? r.traits.join(", ") : "None"}</span></div>
          </>
        )}
      </div>

      {err && <p className="login-error small" role="alert" style={{ margin: "0 12px 8px" }}>{err}</p>}

      <div className="forge-card-actions">
        <Link className="btn sm gb" href={calculatorHref(f)} onClick={() => setWorld(f.world)}>Open in calculator</Link>
        {!editing && <button className="btn sm" onClick={() => { setDraft(f.name); setEditing(true); }} disabled={busy}>Rename</button>}
        <button className={`btn sm danger-btn${confirm ? " confirm" : ""}`} onClick={del} disabled={busy} aria-label={confirm ? `Confirm delete ${f.name}` : `Delete ${f.name}`}>
          {confirm ? "Delete?" : "Delete"}
        </button>
      </div>
    </article>
  );
});
