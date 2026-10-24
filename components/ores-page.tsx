"use client";

import { useMemo, useState } from "react";
import type { Catalogue } from "@/lib/engine/forge";
import { imageUrl } from "@/lib/data/supabase";
import { RARITY_ORDER, rarityColour, worldLabel } from "@/lib/ui";
import { Reveal, useShell, worldName } from "./shell";
import { GameImage } from "./game-image";
import { EMPTY_FILTER, OreFilter, TraitMarks, applyOreFilter, type OreFilterState } from "./ore-filter";

type Sort = "multiplier" | "rarity" | "name";

export function OresPage({ cat }: { cat: Catalogue }) {
  const { world } = useShell();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"world" | "all">("world");
  const [oreFilter, setOreFilter] = useState<OreFilterState>(EMPTY_FILTER);
  const [sort, setSort] = useState<Sort>("multiplier");
  const [selId, setSelId] = useState<string | null>(null);

  const scopeOres = useMemo(() => cat.ores.filter((o) => scope === "all" || o.worlds.includes(world)), [cat, scope, world]);
  const list = useMemo(() => {
    const searched = scopeOres.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
    const filtered = applyOreFilter(searched, oreFilter);
    if (oreFilter.sort) return filtered; // the filter's own order wins
    return filtered.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "rarity" ? RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || b.multiplier - a.multiplier : b.multiplier - a.multiplier);
  }, [scopeOres, q, sort, oreFilter]);
  const sel = cat.ores.find((o) => o.id === selId) ?? list[0] ?? null;

  return (
    <div className="page">
      <div className="row">
        <Reveal col={1} style={{ flex: "1 1 560px", minWidth: 0 }}>
          <section className="gp">
            <div className="tb"><h1 className="title">Ores</h1><span className="small muted">{list.length} shown of {cat.ores.length}</span></div>
            <div className="pad">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end", marginBottom: 14 }}>
                <label style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="small muted">Search ores</span>
                  <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try Mythril or Kitsunite" />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="small muted">Sort by</span>
                  <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: "auto" }}>
                    <option value="multiplier">Multiplier</option><option value="rarity">Rarity</option><option value="name">Name</option>
                  </select>
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, position: "relative" }}>
                <button className="btn sm" aria-pressed={scope === "world"} onClick={() => setScope("world")}>World {worldName(world)}</button>
                <button className="btn sm" aria-pressed={scope === "all"} onClick={() => setScope("all")}>All worlds</button>
                <OreFilter ores={scopeOres} value={oreFilter} onChange={setOreFilter} />
              </div>
              <div className="ore-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", maxHeight: "none" }}>
                {list.map((o) => (
                  <button key={o.id} className="tile" style={{ height: 104, ["--rc" as string]: rarityColour(o.rarity), outline: sel?.id === o.id ? "2px solid var(--acc)" : "none", outlineOffset: 2 }}
                    onClick={() => setSelId(o.id)} aria-pressed={sel?.id === o.id} aria-label={`${o.name}, ${o.multiplier}x`}>
                    <GameImage src={imageUrl("ores", o.id)} alt="" />
                    <span className="t-top">{o.name}</span>
                    <span className="t-br">{o.multiplier}x</span>
                    <TraitMarks ore={o} />
                  </button>
                ))}
              </div>
              {list.length === 0 && <p className="muted">No ores match.</p>}
            </div>
          </section>
        </Reveal>
        <Reveal col={2} style={{ flex: "0 1 420px", minWidth: 300 }}>
          {sel && (
            <section className="gp" aria-live="polite">
              <div className="tb"><h2>{sel.name}</h2>{!sel.verified && <span className="badge unv">Wiki only</span>}</div>
              <div className="pad">
                <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
                  <div className="tile" style={{ width: 96, height: 96, ["--rc" as string]: rarityColour(sel.rarity) }}><GameImage src={imageUrl("ores", sel.id)} alt={sel.name} size={36} /></div>
                  <div><div className="small muted">Multiplier</div><div style={{ fontSize: 30, fontWeight: 700 }} className="gold">{sel.multiplier}x</div></div>
                </div>
                <div className="kv"><span>Rarity:</span><span style={{ color: rarityColour(sel.rarity), fontWeight: 700 }}>{sel.rarity}</span></div>
                <div className="kv"><span>World:</span><span className="muted">{worldLabel(sel.worlds)}</span></div>
                <div className="kv"><span>Drop chance:</span><span className="muted">{sel.drop ? `1 in ${sel.drop.toLocaleString("en-GB")}` : sel.source ?? "Unknown"}</span></div>
                {sel.source && sel.drop != null && <div className="kv"><span>Found in:</span><span className="muted">{sel.source}</span></div>}
                <div className="stat-head" style={{ marginTop: 14 }}>Traits at full strength</div>
                {sel.traits.length === 0 ? <p className="muted" style={{ padding: "8px 14px", margin: 0 }}>No trait.</p> :
                  sel.traits.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, padding: "8px 14px", background: i % 2 ? "transparent" : "var(--row)" }}>
                      <span style={{ flex: "0 0 96px", fontWeight: 700, color: "#fff" }}>{t.kinds.length > 1 ? "Weapon and armour" : t.kinds[0] === "weapon" ? "Weapon" : "Armour"}</span>
                      <span style={{ color: "#cfc7b2" }}>{t.text}</span>
                    </div>
                  ))}
                <p className="note">A trait needs a 10% share of the craft and reaches full strength at a 30% share.</p>
              </div>
            </section>
          )}
        </Reveal>
      </div>
    </div>
  );
}
