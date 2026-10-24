"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { World } from "@/lib/engine";

type Theme = { name: string; bg: string; bd: string; bd2: string; br: string; bar: string; panel: string; acc: string; tex: string; glow: string; kind: "dust" | "ember" | "snow" | "petal"; n: number };

/** Display name: Worlds 1 and 2 are one combined choice. */
export const worldName = (w: World) => (w <= 2 ? "1–2" : String(w));

export const THEMES: Record<World, Theme> = {
  2: { name: "Stonewake's Cross and Forgotten Kingdom", bg: "#0c0809", bd: "#3a2a2b", bd2: "#5a4346", br: "#8f7a7a", bar: "#1f1718", panel: "#150f10", acc: "#d9908f",
    tex: "repeating-linear-gradient(115deg,rgba(201,90,90,.045) 0 1px,transparent 1px 52px),repeating-linear-gradient(35deg,rgba(255,255,255,.015) 0 1px,transparent 1px 90px)",
    glow: "inset 0 0 180px rgba(150,40,40,.16)", kind: "ember", n: 26 },
  get 1() { return this[2]; },
  3: { name: "Frostspire Expanse", bg: "#080b10", bd: "#2a3a4c", bd2: "#3f5873", br: "#8fb4d4", bar: "#131c28", panel: "#0e141c", acc: "#8fd0f2",
    tex: "repeating-linear-gradient(60deg,rgba(150,205,245,.05) 0 1px,transparent 1px 44px),repeating-linear-gradient(120deg,rgba(150,205,245,.05) 0 1px,transparent 1px 44px)",
    glow: "inset 0 0 190px rgba(110,180,235,.14)", kind: "snow", n: 34 },
  4: { name: "Crimson Sakura Island", bg: "#0f0a0c", bd: "#4a2c38", bd2: "#6a3f50", br: "#d9a0b6", bar: "#241520", panel: "#160e12", acc: "#f0a8c0",
    tex: "radial-gradient(circle at 50% 100%,transparent 0 38%,rgba(240,168,192,.09) 39% 41%,transparent 42% 52%,rgba(240,168,192,.07) 53% 55%,transparent 56%) 0 0/64px 32px",
    glow: "inset 0 0 190px rgba(232,140,175,.12)", kind: "petal", n: 22 },
};

function particles(world: World) {
  const t = THEMES[world];
  let s = world * 7919;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  return Array.from({ length: t.n }, (_, i) => {
    const x = rnd() * 100, y = rnd() * 100;
    const dur = t.kind === "dust" ? 34 + rnd() * 24 : t.kind === "snow" ? 16 + rnd() * 14 : t.kind === "ember" ? 14 + rnd() * 14 : 20 + rnd() * 16;
    const delay = -rnd() * dur, sd = 3 + rnd() * 4, size = t.kind === "petal" ? 9 + rnd() * 8 : t.kind === "dust" ? 1.5 + rnd() * 2 : 2 + rnd() * 3;
    const outer = { left: `${x}%`, top: `${y}%`, animation: `${t.kind === "ember" || t.kind === "dust" ? "lift" : "fall"} ${dur}s linear ${delay}s infinite` };
    const sway = `${t.kind === "petal" ? "sway" : "sway2"} ${sd}s ease-in-out ${delay}s infinite alternate`;
    const inner =
      t.kind === "petal" ? { width: size, height: size * 0.7, background: "#f0a8c0", borderRadius: "100% 0 100% 0", opacity: 0.7, animation: sway }
      : t.kind === "snow" ? { width: size, height: size, background: "#e4f2ff", borderRadius: "50%", opacity: 0.65, animation: sway }
      : t.kind === "ember" ? { width: size, height: size, background: "#d9605f", borderRadius: "50%", boxShadow: "0 0 7px #c24a4a", opacity: 0.75, animation: sway }
      : { width: size, height: size, background: "#bdb49a", borderRadius: "50%", opacity: 0.35, animation: sway };
    return { key: i, outer, inner };
  });
}

type ShellState = { world: World; setWorld: (w: World) => void; phase: number };
const ShellContext = createContext<ShellState>({ world: 4, setWorld: () => {}, phase: 4 });
export const useShell = () => useContext(ShellContext);

const subscribe = () => () => {};
/** True once the browser has hydrated; false during server rendering. */
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

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
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const saved = readWorld();
    const timers = [
      window.setTimeout(() => { if (saved) setWorldState(saved); setPhase(1); }, 450),
      window.setTimeout(() => setPhase(2), 800),
      window.setTimeout(() => setPhase(3), 1150),
      window.setTimeout(() => setPhase(4), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const setWorld = useCallback((picked: World) => {
    // Worlds 1 and 2 share the same pools and odds, so they are one choice ("1–2").
    const w = (picked === 1 ? 2 : picked) as World;
    setWorldState(w);
    try {
      window.localStorage.setItem("forge.world", String(w));
      const url = new URL(window.location.href);
      url.searchParams.set("world", String(w));
      window.history.replaceState(null, "", url);
    } catch { /* ignore */ }
  }, []);

  const t = THEMES[world];
  const dots = useMemo(() => particles(world), [world]);
  const style = { "--bg": t.bg, "--bd": t.bd, "--bd2": t.bd2, "--br": t.br, "--bar": t.bar, "--panel": t.panel, "--acc": t.acc, "--tex": t.tex, "--glow": t.glow } as React.CSSProperties;

  return (
    <ShellContext.Provider value={{ world, setWorld, phase }}>
      <div className="app" style={style} data-world={world}>
        <div className="particles" aria-hidden="true">
          {phase > 0 && dots.map((d) => <span key={d.key} style={d.outer}><span style={d.inner} /></span>)}
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
  const { world, setWorld } = useShell();
  return (
    <div className="worlds" role="group" aria-label="World">
      <span>World</span>
      {([2, 3, 4] as World[]).map((w) => (
        <button key={w} className="btn" style={{ minWidth: 40, minHeight: 36 }} aria-pressed={w === world} aria-label={`World ${worldName(w)}, ${THEMES[w].name}`} onClick={() => setWorld(w)}>{worldName(w)}</button>
      ))}
    </div>
  );
}

export function LoadBar() {
  const { phase } = useShell();
  return <div className="progress" style={{ opacity: phase >= 4 ? 0 : 1 }} aria-hidden="true"><div style={{ width: `${Math.max(8, phase * 25)}%` }} /></div>;
}
