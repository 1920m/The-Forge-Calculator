"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { World } from "@/lib/engine";
import type { ForgeSite } from "@/lib/engine/forge";

type Theme = { name: string; bg: string; bd: string; bd2: string; br: string; bar: string; panel: string; acc: string; tex: string; glow: string; kind: "dust" | "ember" | "snow" | "petal" | "void"; n: number };

/** Display name: Worlds 1 and 2 are one combined choice. */
export const worldName = (w: World) => (w <= 2 ? "1–2" : String(w));

export const THEMES: Record<World, Theme> = {
  2: { name: "Stonewake's Cross and Forgotten Kingdom", bg: "#0c0809", bd: "#3a2a2b", bd2: "#5a4346", br: "#8f7a7a", bar: "#1f1718", panel: "#150f10", acc: "#d9908f",
    tex: "repeating-linear-gradient(115deg,rgba(201,90,90,.045) 0 1px,transparent 1px 52px),repeating-linear-gradient(35deg,rgba(255,255,255,.015) 0 1px,transparent 1px 90px)",
    glow: "inset 0 0 180px rgba(150,40,40,.16)", kind: "ember", n: 36 },
  get 1() { return this[2]; },
  3: { name: "Frostspire Expanse", bg: "#080b10", bd: "#2a3a4c", bd2: "#3f5873", br: "#8fb4d4", bar: "#131c28", panel: "#0e141c", acc: "#8fd0f2",
    tex: "repeating-linear-gradient(60deg,rgba(150,205,245,.05) 0 1px,transparent 1px 44px),repeating-linear-gradient(120deg,rgba(150,205,245,.05) 0 1px,transparent 1px 44px)",
    glow: "inset 0 0 190px rgba(110,180,235,.14)", kind: "snow", n: 34 },
  4: { name: "Crimson Sakura Island", bg: "#0f0a0c", bd: "#4a2c38", bd2: "#6a3f50", br: "#d9a0b6", bar: "#241520", panel: "#160e12", acc: "#f0a8c0",
    tex: "radial-gradient(circle at 50% 100%,transparent 0 38%,rgba(240,168,192,.09) 39% 41%,transparent 42% 52%,rgba(240,168,192,.07) 53% 55%,transparent 56%) 0 0/64px 32px",
    glow: "inset 0 0 190px rgba(232,140,175,.12)", kind: "petal", n: 22 },
};

/** The Abyss Forge (next to World 4): near-black with deep purple, and motes of violet light rising out of the dark. */
export const ABYSS_THEME: Theme = { name: "The Abyss", bg: "#030205", bd: "#1a1324", bd2: "#261b36", br: "#7d6a9e", bar: "#09060e", panel: "#060409", acc: "#6e4fa3",
  tex: "radial-gradient(ellipse at 50% 120%,rgba(80,40,140,.09),transparent 60%),repeating-radial-gradient(circle at 50% 50%,rgba(110,80,170,.025) 0 1px,transparent 1px 46px)",
  glow: "inset 0 0 220px rgba(45,18,90,.24)", kind: "void", n: 26 };

const SNOWFLAKE = "M12 1v22M2.5 6.5l19 11M2.5 17.5l19-11M12 1l-2.5 2.5M12 1l2.5 2.5M12 23l-2.5-2.5M12 23l2.5-2.5M2.5 6.5l3.4.9M2.5 6.5l.9-3.4M21.5 17.5l-3.4-.9M21.5 17.5l-.9 3.4M2.5 17.5l.9 3.4M2.5 17.5l3.4-.9M21.5 6.5l-.9-3.4M21.5 6.5l-3.4.9";
// Particles now fall across the screen (not the whole page), so travel times are shorter.
const TRAVEL = 0.45;
const ASH = ["#9a938b", "#b3aca4", "#837c75", "#a8a097", "#c2bbb2"];

type Particle = { key: number; outer: React.CSSProperties; inner: React.CSSProperties; flake?: { size: number; spin: string } };

function particles(world: World, abyss = false): Particle[] {
  const t = abyss ? ABYSS_THEME : THEMES[world];
  let s = (abyss ? 5 : world) * 7919;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  return Array.from({ length: t.n }, (_, i) => {
    const x = rnd() * 100;
    rnd(); // keeps the per-world random sequence stable
    const sd = 3 + rnd() * 4;
    if (t.kind === "snow") {
      // Six-armed snowflakes that drift down, sway and slowly turn.
      const dur = 18 + rnd() * 16, delay = -rnd() * dur, size = 7 + rnd() * 9;
      return {
        key: i,
        outer: { left: `${x}%`, animation: `fall ${dur * TRAVEL}s linear ${delay * TRAVEL}s infinite` },
        inner: { opacity: 0.45 + rnd() * 0.45, animation: `sway2 ${sd}s ease-in-out ${delay}s infinite alternate`, filter: "drop-shadow(0 0 3px rgba(190,230,255,.6))" },
        flake: { size, spin: `spin ${10 + rnd() * 14}s linear ${delay}s infinite${rnd() > 0.5 ? " reverse" : ""}` },
      };
    }
    if (t.kind === "void") {
      // Faint violet motes drifting up out of the dark, a few brighter than the rest.
      const bright = rnd() < 0.25;
      const dur = 26 + rnd() * 22, delay = -rnd() * dur, size = bright ? 3 + rnd() * 2.5 : 1.5 + rnd() * 2;
      return {
        key: i,
        outer: { left: `${x}%`, animation: `lift ${dur * TRAVEL}s linear ${delay * TRAVEL}s infinite` },
        inner: { width: size, height: size, borderRadius: "50%", background: bright ? "#c9a8ff" : "#7d5bc4", opacity: bright ? 0.75 : 0.45,
          boxShadow: bright ? "0 0 8px 2px rgba(160,110,255,.65)" : "0 0 4px 1px rgba(120,80,210,.4)", animation: `sway2 ${sd}s ease-in-out ${delay}s infinite alternate` },
      };
    }
    if (t.kind === "ember") {
      // Mostly grey ash flakes tumbling down; a few still-glowing pieces drift up.
      const glowing = rnd() < 0.2;
      const dur = glowing ? 14 + rnd() * 12 : 22 + rnd() * 18, delay = -rnd() * dur, size = glowing ? 2.5 + rnd() * 2 : 5 + rnd() * 7;
      const p = () => `${Math.round(rnd() * 35)}% ${Math.round(rnd() * 35)}%`;
      const shape = `polygon(${p()}, ${65 + Math.round(rnd() * 35)}% ${Math.round(rnd() * 30)}%, ${70 + Math.round(rnd() * 30)}% ${60 + Math.round(rnd() * 40)}%, ${Math.round(rnd() * 40)}% ${70 + Math.round(rnd() * 30)}%)`;
      return {
        key: i,
        outer: { left: `${x}%`, animation: `${glowing ? "lift" : "fall"} ${dur * TRAVEL}s linear ${delay * TRAVEL}s infinite` },
        inner: glowing
          ? { width: size, height: size, background: "#e07a52", borderRadius: "50%", boxShadow: "0 0 6px 1px rgba(224,96,70,.8)", opacity: 0.8, animation: `sway2 ${sd}s ease-in-out ${delay}s infinite alternate` }
          : { width: size, height: size * (0.6 + rnd() * 0.5), background: ASH[Math.floor(rnd() * ASH.length)], clipPath: shape, opacity: 0.55 + rnd() * 0.35, animation: `tumble ${sd + 2}s ease-in-out ${delay}s infinite alternate` },
      };
    }
    const dur = t.kind === "dust" ? 34 + rnd() * 24 : 20 + rnd() * 16;
    const delay = -rnd() * dur, size = t.kind === "petal" ? 9 + rnd() * 8 : 1.5 + rnd() * 2;
    const outer = { left: `${x}%`, animation: `${t.kind === "dust" ? "lift" : "fall"} ${dur * TRAVEL}s linear ${delay * TRAVEL}s infinite` };
    const sway = `${t.kind === "petal" ? "sway" : "sway2"} ${sd}s ease-in-out ${delay}s infinite alternate`;
    const inner = t.kind === "petal"
      ? { width: size, height: size * 0.7, background: "#f0a8c0", borderRadius: "100% 0 100% 0", opacity: 0.7, animation: sway }
      : { width: size, height: size, background: "#bdb49a", borderRadius: "50%", opacity: 0.35, animation: sway };
    return { key: i, outer, inner };
  });
}

/**
 * `site` is which forge World 4 uses: Crimson Sakura's ("normal") or the Abyss Forge, which the top bar offers as its
 * own choice next to the worlds. Anywhere but World 4 it's always "normal".
 */
type ShellState = { world: World; setWorld: (w: World) => void; site: ForgeSite; setAbyss: () => void; phase: number };
const ShellContext = createContext<ShellState>({ world: 4, setWorld: () => {}, site: "normal", setAbyss: () => {}, phase: 4 });
export const useShell = () => useContext(ShellContext);

const subscribe = () => () => {};
/** True once the browser has hydrated; false during server rendering. */
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

function readAbyss(): boolean {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.has("world")) return p.get("f") === "abyss" && p.get("world") === "4";
    return window.localStorage.getItem("forge.site") === "abyss";
  } catch { return false; }
}

function readWorld(): World | null {
  try {
    const q = Number(new URLSearchParams(window.location.search).get("world"));
    if ([1, 2, 3, 4].includes(q)) return (q === 1 ? 2 : q) as World;
    const s = Number(window.localStorage.getItem("forge.world"));
    if ([1, 2, 3, 4].includes(s)) return (s === 1 ? 2 : s) as World;
  } catch { /* storage unavailable */ }
  return null;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [world, setWorldState] = useState<World>(4);
  const [abyssOn, setAbyssOn] = useState(false);
  const [phase, setPhase] = useState(0);
  const site: ForgeSite = world === 4 && abyssOn ? "abyss" : "normal";

  useEffect(() => {
    const saved = readWorld();
    const abyss = readAbyss();
    const timers = [
      window.setTimeout(() => { if (saved) setWorldState(saved); if (abyss && (saved ?? 4) === 4) setAbyssOn(true); setPhase(1); }, 450),
      window.setTimeout(() => setPhase(2), 800),
      window.setTimeout(() => setPhase(3), 1150),
      window.setTimeout(() => setPhase(4), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const choose = useCallback((picked: World, abyss: boolean) => {
    // Worlds 1 and 2 share the same pools and odds, so they are one choice ("1–2").
    const w = (picked === 1 ? 2 : picked) as World;
    startTransition(() => { setWorldState(w); setAbyssOn(abyss); }); // re-themes the whole site; let the click paint first
    try {
      window.localStorage.setItem("forge.world", String(w));
      window.localStorage.setItem("forge.site", abyss ? "abyss" : "normal");
      const url = new URL(window.location.href);
      url.searchParams.set("world", String(w));
      if (abyss) url.searchParams.set("f", "abyss"); else url.searchParams.delete("f");
      window.history.replaceState(null, "", url);
    } catch { /* ignore */ }
  }, []);
  /** A world's own forge (World 4: Crimson Sakura). */
  const setWorld = useCallback((picked: World) => choose(picked, false), [choose]);
  /** The Abyss Forge, next to World 4. */
  const setAbyss = useCallback(() => choose(4, true), [choose]);

  const t = site === "abyss" ? ABYSS_THEME : THEMES[world];
  const dots = useMemo(() => particles(world, site === "abyss"), [world, site]);
  const style = { "--bg": t.bg, "--bd": t.bd, "--bd2": t.bd2, "--br": t.br, "--bar": t.bar, "--panel": t.panel, "--acc": t.acc, "--tex": t.tex, "--glow": t.glow } as React.CSSProperties;

  return (
    <ShellContext.Provider value={{ world, setWorld, site, setAbyss, phase }}>
      <div className="app" style={style} data-world={world} data-site={site}>
        <div className="particles" aria-hidden="true">
          {phase > 0 && dots.map((d) => (
            <span key={d.key} style={d.outer}>
              <span style={d.inner}>
                {d.flake && (
                  <svg viewBox="0 0 24 24" width={d.flake.size} height={d.flake.size} style={{ display: "block", animation: d.flake.spin }} fill="none" stroke="#eaf6ff" strokeWidth="1.6" strokeLinecap="round"><path d={SNOWFLAKE} /></svg>
                )}
              </span>
            </span>
          ))}
        </div>
        {children}
      </div>
    </ShellContext.Provider>
  );
}

/** Wraps a panel: shows a left-to-right shimmering grey box until its column's turn in the load-in sequence. */
export function Reveal({ col = 1, children, className = "", style }: { col?: number; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { phase } = useShell();
  const loading = phase < col;
  return (
    <div className={`sk-wrap ${loading ? "loading" : "reveal"} ${className}`} style={{ ...style, ["--d" as string]: `${(col - 1) * 0.15}s` }} aria-busy={loading}>
      {children}
    </div>
  );
}

export function WorldSwitch() {
  const { world, setWorld, site, setAbyss } = useShell();
  return (
    <div className="worlds" role="group" aria-label="World">
      <span>World</span>
      {([2, 3, 4] as World[]).map((w) => (
        <button key={w} className="btn" style={{ minWidth: 40, minHeight: 36 }} aria-pressed={w === world && site === "normal"} aria-label={`World ${worldName(w)}, ${THEMES[w].name}`} onClick={() => setWorld(w)}>{worldName(w)}</button>
      ))}
      <button className="btn abyss-btn" style={{ minHeight: 36 }} aria-pressed={site === "abyss"} aria-label="The Abyss Forge, next to World 4: World 4's items plus the Abyss items"
        title="The Abyss Forge: everything World 4 forges, plus the Abyss weapons and armour" onClick={setAbyss}>Abyss</button>
    </div>
  );
}

export function LoadBar() {
  const { phase } = useShell();
  return <div className="progress" style={{ opacity: phase >= 4 ? 0 : 1 }} aria-hidden="true"><div style={{ width: `${Math.max(8, phase * 25)}%` }} /></div>;
}
