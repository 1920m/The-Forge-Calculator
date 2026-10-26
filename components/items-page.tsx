"use client";

import { startTransition, useEffect, useState } from "react";
import { classNames, classVariants, poolIncomplete, type Catalogue } from "@/lib/engine/forge";
import { stat, type Kind } from "@/lib/engine";
import { imageUrl } from "@/lib/data/supabase";
import { SHOW_STATUS_LABELS, fmt, pct } from "@/lib/ui";
import { Reveal, useShell, worldName } from "./shell";
import { GameImage } from "./game-image";

/** Which list to open: ?k= in the link first, then the type last used on the calculator. */
function readKind(): Kind | null {
  try {
    const k = new URLSearchParams(window.location.search).get("k") ?? window.localStorage.getItem("forge.kind");
    return k === "weapon" || k === "armour" ? k : null;
  } catch { return null; }
}

export function ItemsPage({ cat }: { cat: Catalogue }) {
  const { world } = useShell();
  const [kind, setKindState] = useState<Kind>("weapon");
  useEffect(() => {
    const k = readKind();
    const t = window.setTimeout(() => { if (k) setKindState(k); }, 0);
    return () => clearTimeout(t);
  }, []);
  const setKind = (k: Kind) => {
    startTransition(() => { setKindState(k); setCls(null); });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("k", k);
      window.history.replaceState(null, "", url);
    } catch { /* ignore */ }
  };
  const names = classNames(cat, kind, world);
  const locks = cat.locks[kind];
  const [clsPick, setCls] = useState<string | null>(null);
  const cls = clsPick && names.includes(clsPick) ? clsPick : names[names.length - 1];
  const [mult, setMult] = useState(10);
  const variants = classVariants(cat, kind, world, cls);
  const swaps = kind === "weapon" ? "Each world has its own classes: World 1–2 has Gauntlets, Katana and Greatsword; World 3 has Mace, Axe and Spear; World 4 has Mace, Katana and Spear." : "World 4 adds the Ninja's, Rootguard, Vanguard and Shogun sets.";
  const unit = kind === "weapon" ? "DMG" : "DEF";

  return (
    <div className="page">
      <Reveal col={1}>
        <div className="kind-switch" role="group" aria-label="Show weapons or armour">
          <button className={`big-toggle ${kind === "armour" ? "gb" : "btn"}`} aria-pressed={kind === "armour"} onClick={() => setKind("armour")}>Armour</button>
          <button className={`big-toggle ${kind === "weapon" ? "gb" : "btn"}`} aria-pressed={kind === "weapon"} onClick={() => setKind("weapon")}>Weapons</button>
        </div>
      </Reveal>
      <div className="row">
        <Reveal col={1} style={{ flex: "1 1 520px", minWidth: 0 }}>
          <section className="gp">
            <div className="tb"><h1 className="title">{kind === "weapon" ? "Weapon" : "Armour"} classes</h1><span className="small muted">World {worldName(world)}</span></div>
            <div className="pad scroll-x">
              <table className="table" style={{ minWidth: 420 }}>
                <thead><tr><th>Class</th><th>Unlocks at</th><th>Variants</th><th /></tr></thead>
                <tbody>
                  {names.map((n, i) => (
                    <tr key={n} className={n === cls ? "sel" : ""}>
                      <td><button className="link-btn" style={{ fontWeight: 700 }} onClick={() => setCls(n)}>{n}</button></td>
                      <td className="gold" style={{ fontWeight: 700 }}>{locks[i]} ores</td>
                      <td className="muted">{classVariants(cat, kind, world, n).length}{poolIncomplete(cat, kind, world, n) && <span title="Plus shop-blueprint weapons not listed yet"> + shop</span>}</td>
                      <td><button className="btn sm" aria-pressed={n === cls} onClick={() => setCls(n)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note">{swaps} The number is the ore count at which the game lets you lock the class; a class can already appear with fewer ores (see the odds on the calculator).</p>
              <Timeline items={names.map((n, i) => [n, locks[i]] as [string, number])} />
            </div>
          </section>
        </Reveal>
        <Reveal col={2} style={{ flex: "1 1 560px", minWidth: 0 }}>
          <section className="gp">
            <div className="tb">
              <h2>{cls}</h2>
              <label className="small muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>Multiplier
                <input className="input" type="number" min={0} step={0.01} value={mult} onChange={(e) => setMult(Math.max(0, Number(e.target.value) || 0))} style={{ width: 90 }} />
              </label>
            </div>
            <div className="pad scroll-x">
              <table className="table" style={{ minWidth: 580 }}>
                <thead><tr><th>Variant</th>{kind === "weapon" ? <><th>Base dmg</th><th title="Real time between swings">Swing</th><th title="The number the game's item card shows">Card speed</th><th>Range</th></> : <th>Health %</th>}<th>Weight</th><th>In class</th><th style={{ textAlign: "right" }}>{unit} at {mult}x</th></tr></thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id}>
                      <td><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <span className="tile" style={{ width: 34, height: 34, borderWidth: 1 }}><GameImage src={imageUrl(kind === "weapon" ? "weapons" : "armour", v.id)} alt="" size={16} /></span>
                        {v.name}</span> {SHOW_STATUS_LABELS && !v.verified && <span className="badge unv">Unverified</span>}{v.tag === "shop" && <span className="badge shop" title="Funguy shop blueprint">Shop</span>}{v.tag === "halloween" && <span className="badge der" title="Halloween weapon, World 4 only">Halloween</span>}</td>
                      {kind === "weapon" ? <><td>{v.base}</td><td>{v.interval}s</td><td className="muted">{v.speed}s</td><td>{v.range}</td></> : <td>{v.base}</td>}
                      <td className="muted">1/{v.weight}</td>
                      <td>{pct(v.chance)}</td>
                      <td className="num">{fmt(stat(v.base, mult, 1, kind))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note">{kind === "weapon" ? "Damage = base damage × multiplier × (1 + quality), shown here at 100% quality. Swing is the real time between attacks, used for DPS. Card speed is the game's index value, which the item card shows but which isn't the real speed." : "Defense = health % × multiplier × (1 + quality), rounded to a whole number, shown here at 100% quality."} Chance inside the class is 1/weight, normalised.{poolIncomplete(cat, kind, world, cls) && " This class also has shop-blueprint weapons that are not listed yet, so these chances may be a little high."}</p>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}

function Timeline({ items }: { items: [string, number][] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="small muted">Lock thresholds on the ore-count scale</div>
      <div className="timeline">
        <div className="tl-line" />
        {items.map(([n, at], i) => (
          <div key={n} className={`tl-mark ${i % 2 ? "down" : "up"}`} style={{ left: `${((at - 3) / 52) * 100}%` }}>
            <div className="tl-stem" /><div className="tl-label">{n}</div><div className="small muted">{at}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }} className="faint"><span>3 ores</span><span>55 ores</span></div>
    </div>
  );
}
