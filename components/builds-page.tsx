"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { classNames, forge, type Catalogue, type CatalogueOre } from "@/lib/engine/forge";
import type { Kind, World } from "@/lib/engine";
import { imageUrl } from "@/lib/data/supabase";
import { fmt, rarityColour } from "@/lib/ui";
import { BUILDS, BUILD_SOURCE, type BuildArea, type Recipe } from "@/data/builds";
import { Reveal, useShell, worldName } from "./shell";
import { GameImage } from "./game-image";

/** Where a recipe is forged: its own world, or World 1–2 for a class only found there (Gauntlets). */
function forgeWorld(cat: Catalogue, kind: Kind, world: World, cls: string): World {
  return classNames(cat, kind, world).includes(cls) ? world : 2;
}

export function BuildsPage({ cat }: { cat: Catalogue }) {
  const { world } = useShell();
  const [kind, setKind] = useState<Kind>("weapon");
  const areas = BUILDS.filter((a) => a.world === (world <= 2 ? 2 : world));
  const byName = useMemo(() => new Map(cat.ores.map((o) => [o.name.toLowerCase(), o])), [cat]);

  return (
    <div className="page">
      <Reveal col={1}>
        <section className="gp">
          <div className="tb">
            <h1 className="title">Recommended builds</h1>
            <span className="small muted">World {worldName(world)}</span>
          </div>
          <div className="pad">
            <p style={{ margin: "0 0 14px", color: "#cfc7b2" }}>
              Ore mixes the community recommends for each stage of the game. Pick a world at the top to see its areas. Every number here is worked out by the calculator from the ores, and you can open any mix in the calculator to change it.
            </p>
            <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
              <button className={`big-toggle ${kind === "weapon" ? "gb" : "btn"}`} aria-pressed={kind === "weapon"} onClick={() => startTransition(() => setKind("weapon"))}>Weapons</button>
              <button className={`big-toggle ${kind === "armour" ? "gb" : "btn"}`} aria-pressed={kind === "armour"} onClick={() => startTransition(() => setKind("armour"))}>Armor</button>
            </div>
          </div>
        </section>
      </Reveal>

      {areas.map((area, i) => (
        <Reveal key={area.id} col={Math.min(4, i + 2)}>
          <AreaSection area={area} kind={kind} world={world} cat={cat} byName={byName} />
        </Reveal>
      ))}

      <p className="note" style={{ margin: 0 }}>
        Recipes from <a href={BUILD_SOURCE.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{BUILD_SOURCE.title}</a> (edited {BUILD_SOURCE.edited}, CC BY-SA 4.0). They are community advice, not official, and newer ores may beat them. Stats and DPS are at 100% quality with no enhancement; DPS counts the traits the mix transfers (crits, lethality, attack speed, burns and other procs).
      </p>
    </div>
  );
}

function AreaSection({ area, kind, world, cat, byName }: { area: BuildArea; kind: Kind; world: World; cat: Catalogue; byName: Map<string, CatalogueOre> }) {
  const table = kind === "weapon" ? area.weapons : area.armour;
  const columns = table.columns;
  return (
    <section className="gp">
      <div className="tb">
        <h2>{area.name}</h2>
        {area.note && <span className="small muted">{area.note}</span>}
      </div>
      <div className="pad builds">
        {table.rows.map((row) => (
          <div key={row.stage} className="build-stage">
            <h3 className="build-stage-h">{row.stage}</h3>
            <div className="build-grid">
              {row.items.map((recipe, j) => recipe && (
                <RecipeCard key={columns[j]} recipe={recipe} cls={columns[j]} kind={kind} world={world} cat={cat} byName={byName} />
              ))}
            </div>
          </div>
        ))}
        {kind === "weapon" && world > 2 && <p className="note">Gauntlets can only be forged in World 1–2, so their numbers are worked out there, and Open in calculator takes you to World 1–2.</p>}
      </div>
    </section>
  );
}

function RecipeCard({ recipe, cls, kind, world, cat, byName }: { recipe: Recipe; cls: string; kind: Kind; world: World; cat: Catalogue; byName: Map<string, CatalogueOre> }) {
  const { setWorld } = useShell();
  const mix = recipe.flatMap(([name, count]) => { const ore = byName.get(name.toLowerCase()); return ore ? [{ ore, count }] : []; });
  const at = forgeWorld(cat, kind, world, cls);
  const r = forge(cat, mix, kind, at, 1);
  const c = r.classes.find((x) => x.name === cls);
  const values = (c?.variants ?? []).map((v) => v.value).filter((v): v is number => v != null);
  const dps = (c?.variants ?? []).flatMap((v) => (v.dps ? [v.dps.total] : []));
  const unit = kind === "weapon" ? "DMG" : "DEF";
  const href = `/?o=${mix.map((m) => `${m.ore.id}:${m.count}`).join(",")}&k=${kind}&world=${at}`;
  return (
    <article className="build-card">
      <div className="build-card-h">
        <span style={{ fontWeight: 700, color: "#fff" }}>{cls}{at !== world && <span className="badge der" style={{ marginLeft: 8 }} title="Only forged in World 1–2">World 1–2</span>}</span>
        <span className="small muted">{r.total} ores</span>
      </div>
      <div className="build-ores">
        {mix.map(({ ore, count }) => (
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
        <div className="kv"><span>Multiplier</span><span className="gold" style={{ fontWeight: 700 }}>{r.multiplier == null ? "–" : `${fmt(r.multiplier)}x`}</span></div>
        <div className="kv"><span>Class chance</span><span className="strong" style={{ fontWeight: 700 }}>{c ? `${c.probability}%` : "–"}</span></div>
        <div className="kv"><span>{unit}</span><span className="strong">{range(values)}</span></div>
        {kind === "weapon" && <div className="kv"><span>DPS</span><span className="strong">{range(dps)}</span></div>}
        <div className="kv"><span>Traits</span><span className="muted">{r.traits.length ? r.traits.map((t) => t.ore.name).join(", ") : "None"}</span></div>
      </div>
      <Link className="btn sm build-open" href={href} onClick={() => { if (at !== world) setWorld(at); }}>Open in calculator</Link>
    </article>
  );
}

const range = (v: number[]) => {
  if (!v.length) return "–";
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
};
