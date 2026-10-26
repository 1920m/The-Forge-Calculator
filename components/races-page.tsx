"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { RACES, RACE_RARITIES, RACES_SOURCE, type Race, type RaceRarity } from "@/data/races";
import { averageTries, chanceWithin, triesFor } from "@/lib/engine/odds";
import { RARITY_COLOURS, fmt, pct } from "@/lib/ui";
import { Reveal } from "./shell";

const colour = (r: RaceRarity) => RARITY_COLOURS[r === "Mythical" ? "Mythic" : r];
const SPIN_PRESETS = [1, 10, 25, 50, 100];
const MAX_SPINS = 100000;
const QUICK: { label: string; from: RaceRarity }[] = [
  { label: "Legendary or better", from: "Legendary" },
  { label: "Mythical or better", from: "Mythical" },
  { label: "Any Relic", from: "Relic" },
];
const atLeast = (from: RaceRarity) => RACES.filter((r) => RACE_RARITIES.indexOf(r.rarity) >= RACE_RARITIES.indexOf(from)).map((r) => r.id);

/** Under 100 spins keeps 1 decimal (13.4 average); larger numbers are whole spins. Whole numbers show no decimals. */
const spinsText = (n: number) => (!Number.isFinite(n) ? "never" : `${n < 100 ? fmt(n, 1) : fmt(n, 0)} spin${n === 1 ? "" : "s"}`);
/** Chances under 0.1% keep enough decimals to not read as 0%. */
const chanceText = (c: number) => (c >= 0.9995 ? "100%" : pct(c * 100, c < 0.001 ? 3 : c < 0.1 ? 2 : 1));

function load(): { targets?: string[]; spins?: number } {
  try {
    const t = JSON.parse(window.localStorage.getItem("forge.raceTargets") ?? "null");
    const s = Number(window.localStorage.getItem("forge.raceSpins"));
    return {
      targets: Array.isArray(t) ? t.filter((id) => RACES.some((r) => r.id === id)) : undefined,
      spins: Number.isFinite(s) && s >= 1 ? Math.min(MAX_SPINS, Math.floor(s)) : undefined,
    };
  } catch { return {}; }
}

export function RacesPage() {
  const [targets, setTargets] = useState<string[]>(() => atLeast("Legendary"));
  const [spins, setSpins] = useState(10);
  const [ready, setReady] = useState(false);

  // Restore the last choice once, after the first paint (the server can't see this browser's storage).
  useEffect(() => {
    const saved = load();
    const t = window.setTimeout(() => {
      if (saved.targets) setTargets(saved.targets);
      if (saved.spins) setSpins(saved.spins);
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem("forge.raceTargets", JSON.stringify(targets));
      window.localStorage.setItem("forge.raceSpins", String(spins));
    } catch { /* storage unavailable */ }
  }, [targets, spins, ready]);

  const picked = useMemo(() => RACES.filter((r) => targets.includes(r.id)), [targets]);
  // One spin gives exactly one race, so the chance of "any of these" is their chances added up.
  const p = picked.reduce((a, r) => a + r.chance, 0) / 100;
  const toggle = (id: string) => startTransition(() => setTargets((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])));
  const setAll = (ids: string[]) => startTransition(() => setTargets(ids));
  const setSpinCount = (n: number) => setSpins(Math.min(MAX_SPINS, Math.max(1, Math.floor(n) || 1)));
  const quickOn = (from: RaceRarity) => { const ids = atLeast(from); return ids.length === targets.length && ids.every((id) => targets.includes(id)); };

  return (
    <div className="page races">
      <div className="row">
        {/* ---------- the calculator ---------- */}
        <Reveal col={1} style={{ flex: "1 1 560px", minWidth: 0 }}>
          <section className="gp" aria-labelledby="spin-h">
            <div className="tb"><h1 id="spin-h" className="title">Race spin calculator</h1><span className="small muted">{RACES.length} races</span></div>
            <div className="pad">
              <div className="step-h"><span className="step-n">1</span>Which race do you want?</div>
              <p className="small muted" style={{ margin: "0 0 10px" }}>Pick one, or several if any of them would do.</p>
              <div className="race-quick">
                {QUICK.map((q) => <button key={q.label} className="btn sm" aria-pressed={quickOn(q.from)} onClick={() => setAll(atLeast(q.from))}>{q.label}</button>)}
                <button className="btn sm ghost" onClick={() => setAll([])} disabled={!targets.length}>Clear</button>
              </div>
              <div className="race-groups">
                {RACE_RARITIES.map((rarity) => (
                  <div key={rarity} className="race-group">
                    <div className="race-rarity" style={{ color: colour(rarity) }}>{rarity}<span className="faint"> · {pct(RACES.find((r) => r.rarity === rarity)!.chance, 2)} each</span></div>
                    <div className="race-chips">
                      {RACES.filter((r) => r.rarity === rarity).map((r) => (
                        <button key={r.id} className="race-chip" style={{ ["--rc" as string]: colour(r.rarity) }} aria-pressed={targets.includes(r.id)} onClick={() => toggle(r.id)}>{r.name}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="step-h" style={{ marginTop: 22 }}><span className="step-n">2</span>How many spins do you have?</div>
              <div className="spin-row">
                <div className="spin-input">
                  <button className="btn sm" onClick={() => setSpinCount(spins - 1)} aria-label="One spin fewer" disabled={spins <= 1}>−</button>
                  <input className="input" type="number" min={1} max={MAX_SPINS} value={spins} aria-label="Spins you have" onChange={(e) => setSpinCount(Number(e.target.value))} />
                  <button className="btn sm" onClick={() => setSpinCount(spins + 1)} aria-label="One more spin">+</button>
                </div>
                <div className="race-quick" style={{ margin: 0 }}>
                  {SPIN_PRESETS.map((n) => <button key={n} className="btn sm" aria-pressed={spins === n} onClick={() => setSpinCount(n)}>{n}</button>)}
                </div>
              </div>

              <SpinResult picked={picked} p={p} spins={spins} />
            </div>
          </section>
        </Reveal>

        {/* ---------- what the picked races do ---------- */}
        <Reveal col={2} style={{ flex: "1 1 380px", minWidth: 0 }}>
          <section className="gp" aria-labelledby="traits-h">
            <div className="tb"><h2 id="traits-h">Race traits</h2><span className="small muted">{picked.length ? `${picked.length} picked` : "none picked"}</span></div>
            <div className="pad race-traits">
              {picked.length === 0 && <p className="muted" style={{ margin: 0 }}>Pick a race to see what it does.</p>}
              {picked.map((r) => <RaceCard key={r.id} race={r} />)}
            </div>
          </section>
        </Reveal>
      </div>

      {/* ---------- every race ---------- */}
      <Reveal col={3}>
        <section className="gp" aria-labelledby="all-h">
          <div className="tb"><h2 id="all-h">All races</h2><span className="small muted">Click a race to add it to the calculator</span></div>
          <div className="pad scroll-x">
            <table className="table race-table" style={{ minWidth: 720 }}>
              <thead><tr><th>Race</th><th>Rarity</th><th>Each spin</th><th title="Average spins to get it">Average</th><th title="Spins for a 9 in 10 chance">9 in 10 by</th><th style={{ textAlign: "right" }}>With {spins} spin{spins === 1 ? "" : "s"}</th></tr></thead>
              <tbody>
                {RACES.map((r) => {
                  const q = r.chance / 100;
                  return (
                    <tr key={r.id} className={targets.includes(r.id) ? "sel" : ""}>
                      <td><button className="link-btn" style={{ fontWeight: 700, color: colour(r.rarity) }} aria-pressed={targets.includes(r.id)} onClick={() => toggle(r.id)}>{r.name}</button></td>
                      <td className="muted">{r.rarity}</td>
                      <td>{pct(r.chance, 2)} <span className="faint">(1 in {fmt(100 / r.chance, 1)})</span></td>
                      <td>{spinsText(averageTries(q))}</td>
                      <td>{spinsText(triesFor(q, 0.9))}</td>
                      <td className="num">{chanceText(chanceWithin(q, spins))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="note">
              Chances are from the <a className="inline-link" href={RACES_SOURCE.url} target="_blank" rel="noopener noreferrer">Forge wiki&apos;s Races page</a> (last edited {RACES_SOURCE.edited}) and add up to 100%.
              The wiki says luck buffs (event, totem and potion luck) don&apos;t change race spins. It doesn&apos;t mention any pity or guarantee, so every spin is counted as a fresh roll. <Link href="/how-it-works#tries" className="inline-link">How the numbers are worked out</Link>
            </p>
          </div>
        </section>
      </Reveal>
    </div>
  );
}

function SpinResult({ picked, p, spins }: { picked: Race[]; p: number; spins: number }) {
  if (!picked.length || p <= 0) {
    return <div className="spin-result empty"><p className="muted" style={{ margin: 0 }}>Pick at least one race above to see your chances.</p></div>;
  }
  const got = chanceWithin(p, spins);
  const what = picked.length === 1 ? picked[0].name : picked.length <= 3 ? `${picked.slice(0, -1).map((r) => r.name).join(", ")} or ${picked[picked.length - 1].name}` : `any of these ${picked.length} races`;
  const marks = [0.5, 0.9, 0.99].map((c) => ({ c, n: triesFor(p, c) }));
  return (
    <div className="spin-result" aria-live="polite">
      <div className="spin-big">
        <span className="spin-pct">{chanceText(got)}</span>
        <span className="spin-says">chance to get {what} with {spins} spin{spins === 1 ? "" : "s"}</span>
      </div>
      <div className="meter" role="img" aria-label={`${chanceText(got)} chance`}><div style={{ width: `${Math.max(got * 100, got > 0 ? 0.6 : 0)}%` }} /></div>
      <ul className="spin-facts">
        <li><b>Each spin:</b> {chanceText(p)} (1 in {fmt(1 / p, 1)})</li>
        <li><b>On average:</b> {spinsText(averageTries(p))} to get it</li>
        <li><b>How lucky you need to be:</b> {marks.map((m, i) => <span key={m.c}>{i > 0 && " · "}{m.c === 0.5 ? "half of players" : m.c === 0.9 ? "9 in 10" : "99 in 100"} get it within {spinsText(m.n)}</span>)}</li>
      </ul>
      <Curve p={p} spins={spins} />
    </div>
  );
}

/** Chance of having it by each spin count, with a marker at the player's spins. */
function Curve({ p, spins }: { p: number; spins: number }) {
  const W = 520, H = 150, L = 40, B = 24, T = 8;
  const maxN = Math.max(spins, triesFor(p, 0.99));
  const x = (n: number) => L + (n / maxN) * (W - L - 8);
  const y = (c: number) => T + (1 - c) * (H - T - B);
  const pts = Array.from({ length: 81 }, (_, i) => { const n = (i / 80) * maxN; return `${x(n).toFixed(1)},${y(1 - Math.pow(1 - p, n)).toFixed(1)}`; }).join(" ");
  const got = chanceWithin(p, spins);
  return (
    <svg className="spin-curve" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Chance rises with more spins, reaching 99% at ${fmt(triesFor(p, 0.99), 0)} spins. You have ${spins}.`}>
      {[0, 0.5, 1].map((c) => <g key={c}><line x1={L} x2={W - 8} y1={y(c)} y2={y(c)} stroke="var(--bd)" /><text x={L - 6} y={y(c) + 4} textAnchor="end">{c * 100}%</text></g>)}
      <polyline points={pts} fill="none" stroke="var(--acc)" strokeWidth="2.5" />
      <line x1={x(spins)} x2={x(spins)} y1={T} y2={H - B} stroke="var(--gold)" strokeDasharray="4 4" />
      <circle cx={x(spins)} cy={y(got)} r="5" fill="var(--gold)" />
      <text x={L} y={H - 6}>0</text>
      <text x={W - 8} y={H - 6} textAnchor="end">{fmt(maxN, 0)} spins</text>
    </svg>
  );
}

function RaceCard({ race }: { race: Race }) {
  return (
    <article className="race-card" style={{ ["--rc" as string]: colour(race.rarity) }}>
      <div className="race-card-h"><b>{race.name}</b><span className="small" style={{ color: colour(race.rarity) }}>{race.rarity} · {pct(race.chance, 2)}</span></div>
      <ul>{race.traits.map((t) => <li key={t.name}><b>{t.name}:</b> {t.text}</li>)}</ul>
    </article>
  );
}
