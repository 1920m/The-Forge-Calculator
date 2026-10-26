"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import { dpsTarget, enhanceFactor, type TargetClass } from "@/lib/engine/dps-target";
import { averageTries, triesFor } from "@/lib/engine/odds";
import { fmt, pct } from "@/lib/ui";

const LEVELS = Array.from({ length: 11 }, (_, i) => i);
const chanceText = (c: number) => (c >= 0.9995 ? "100%" : c > 0 && c < 0.001 ? "under 0.1%" : pct(c * 100, c < 0.1 ? 2 : 1));

/**
 * Weapons only. The player sets the DPS they want (and an enhancement level); the panel shows which weapons from this
 * mix reach it, the chance a forge gives one, and how many forges that takes.
 */
export function DpsTarget({ classes, pickedDps, pickedId, ores, quality, onPick }: {
  classes: TargetClass[]; pickedDps: number | null; pickedId: string | null; ores: number; quality: number;
  onPick: (cls: string, id: string) => void;
}) {
  const [typed, setTyped] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const k = enhanceFactor(level);
  const { best } = useMemo(() => dpsTarget(classes, 0, level), [classes, level]);
  // Until the player types a number, the target is the weapon picked above, at this level.
  const target = typed ?? Math.floor((pickedDps ?? 0) * k);
  const { rows, chance } = useMemo(() => dpsTarget(classes, target, level), [classes, target, level]);
  if (!best) return null;
  const top = Math.ceil(best.dps);
  const hitCount = rows.filter((r) => r.hits).length;
  const set = (n: number) => startTransition(() => setTyped(Math.max(0, Math.round(n) || 0)));

  return (
    <section className="gp" aria-labelledby="target-h">
      <div className="tb"><h2 id="target-h">Hit a DPS target</h2><span className="small muted">{ores} ores · {quality}% quality</span></div>
      <div className="pad">
        <div className="target-grid">
          <div>
            <div className="step-h"><span className="step-n">1</span>What DPS do you want?</div>
            <div className="target-input">
              <span className="muted">At least</span>
              <input className="input" type="number" min={0} max={999999} value={target} aria-label="DPS you want" onChange={(e) => set(Number(e.target.value))} />
              <span className="muted">DPS</span>
            </div>
            <label className="sr-only" htmlFor="target-range">DPS target slider</label>
            <input id="target-range" type="range" min={0} max={top} step={Math.max(1, Math.round(top / 200))} value={Math.min(target, top)} onChange={(e) => set(Number(e.target.value))} />
            <div className="race-quick" style={{ marginTop: 8 }}>
              {pickedDps != null && <button className="btn sm" onClick={() => setTyped(null)} aria-pressed={typed === null}>Weapon picked above</button>}
              <button className="btn sm" onClick={() => set(Math.floor(best.dps))} aria-pressed={typed === Math.floor(best.dps)}>Best possible</button>
            </div>

            <div className="step-h" style={{ marginTop: 18 }}><span className="step-n">2</span>Enhancement level</div>
            <div className="level-row" role="group" aria-label="Enhancement level">
              {LEVELS.map((l) => <button key={l} className="btn sm" aria-pressed={level === l} onClick={() => startTransition(() => setLevel(l))}>+{l}</button>)}
            </div>
            <p className="note" style={{ marginTop: 6 }}>Each level adds 5% DPS. At +{level}: ×{k.toFixed(2)}.</p>
          </div>

          <TargetResult chance={chance} target={target} level={level} hitCount={hitCount} best={best} ores={ores} />
        </div>

        <div className="scroll-x" style={{ marginTop: 18 }}>
          <table className="table target-table">
            <thead><tr><th aria-label="Reaches the target" /><th>Weapon</th><th className="cls">Class</th><th style={{ textAlign: "right" }}>DPS at +{level}</th><th style={{ textAlign: "right" }}>Chance</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`${r.hits ? "hit" : "miss"}${r.id === pickedId ? " sel" : ""}`} onClick={() => onPick(r.cls, r.id)} style={{ cursor: "pointer" }}>
                  <td className="mark" aria-label={r.hits ? "Reaches it" : "Falls short"}>{r.hits ? "✓" : "✗"}</td>
                  <td><button className="link-btn" onClick={(e) => { e.stopPropagation(); onPick(r.cls, r.id); }}>{r.name}</button></td>
                  <td className="muted cls">{r.cls}</td>
                  <td className="num">{fmt(r.dps)}</td>
                  <td style={{ textAlign: "right" }}>{pct(r.chance * 100, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Uses the DPS on the result card (ore traits included, race and runes not) at your quality setting. Click a weapon to see it above. <Link href="/how-it-works#dps-target" className="inline-link">How this is worked out</Link></p>
      </div>
    </section>
  );
}

function TargetResult({ chance, target, level, hitCount, best, ores }: { chance: number; target: number; level: number; hitCount: number; best: { name: string; dps: number }; ores: number }) {
  if (chance <= 0) {
    return (
      <div className="spin-result target-result" aria-live="polite">
        <div className="spin-big"><span className="spin-pct" style={{ color: "var(--muted)" }}>0%</span><span className="spin-says">of forges reach {fmt(target, 0)} DPS at +{level}</span></div>
        <p style={{ margin: "10px 0 0" }}>Nothing from this mix gets there. The best is <b className="strong">{best.name}</b> at {fmt(best.dps)} DPS. Try a higher enhancement level, better quality or stronger ores.</p>
      </div>
    );
  }
  const avg = averageTries(chance), half = triesFor(chance, 0.5), most = triesFor(chance, 0.9);
  const forges = (n: number) => `${n < 100 ? fmt(n, 1) : fmt(n, 0)} forge${n === 1 ? "" : "s"}`;
  return (
    <div className="spin-result target-result" aria-live="polite">
      <div className="spin-big"><span className="spin-pct">{chanceText(chance)}</span><span className="spin-says">of forges reach {fmt(target, 0)} DPS at +{level}</span></div>
      <div className="meter" role="img" aria-label={`${chanceText(chance)} of forges`}><div style={{ width: `${Math.max(chance * 100, 0.6)}%` }} /></div>
      {chance >= 1 ? (
        <p style={{ margin: 0 }}>Every weapon this mix can give reaches it, so any forge will do.</p>
      ) : (
        <ul className="spin-facts">
          <li><b>Weapons that reach it:</b> {hitCount}</li>
          <li><b>On average:</b> {forges(avg)} to get one</li>
          <li><b>How lucky you need to be:</b> half of players within {forges(half)} · 9 in 10 within {forges(most)}</li>
          <li><b>Ores:</b> about {fmt(most * ores, 0)} for a 9 in 10 chance</li>
        </ul>
      )}
    </div>
  );
}
