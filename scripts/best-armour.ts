/**
 * Finds the best Heavy armour mix for each world and stage by trying every combination of up to 4 ores,
 * scored with lib/engine/armour.ts (effective health). Run: npm run builds:armour
 * Writes data/armour-builds.json, which the Builds page reads.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { armourScore, ARMOUR_EFFECTS, type ArmourOre } from "../lib/engine/armour";

type Ore = ArmourOre & { name: string; worlds: number[]; drop: number | null; source: string | null };
const cat = JSON.parse(readFileSync(new URL("../data/catalogue.json", import.meta.url), "utf8")) as { ores: Ore[] };

/** Ore counts that lock each Heavy piece (so the class is guaranteed). */
const PIECES: [string, number][] = [["Heavy Chestplate", 52], ["Heavy Helmet", 35], ["Heavy Leggings", 42]];
const STAGES = ["Early game", "Mid game", "Late game", "End game"] as const;
type Stage = (typeof STAGES)[number];

// Never recommended: event-only ores, and Fichilliumorite (copies the average, adds nothing).
const EXCLUDE = new Set(["fichilliumorite", "candy-ore", "pumpkinite", "star-dust", "grass", "coinite"]);
// Ores that drop 1/1 from a special rock or boss, so their drop rate says nothing about how easy they are to get.
const TIER_OVERRIDE: Record<string, number> = { mosasaursit: 2, bismuth: 3, kyubite: 2, onite: 2, yin: 2, yang: 2, "oni-mask": 2 };
// Gargantuan and Heavenite can also be crafted, so their tiny drop rates don't rule them out.
const CRAFTABLE = new Set(["gargantuan", "heavenite"]);
/** Rarer than this per ore is not practical when a piece needs dozens of them. */
const MAX_DROP = 20000;

/** 0 = early … 3 = end. Mined ores by drop rate; crafted ores by rarity. */
function tier(o: Ore): number {
  if (o.id in TIER_OVERRIDE) return TIER_OVERRIDE[o.id];
  if (o.source === "Tower of Hell") return 3;
  if (o.drop != null && o.drop > MAX_DROP && !CRAFTABLE.has(o.id)) return 99;
  if (CRAFTABLE.has(o.id)) return 3;
  if (o.drop == null) return ["Common", "Uncommon", "Rare", "Epic"].includes(o.rarity) ? 1 : o.rarity === "Legendary" ? 2 : 3;
  return o.drop <= 400 ? 0 : o.drop <= 1500 ? 1 : o.drop <= 6000 ? 2 : 3;
}

type Area = { id: string; world: number; stages: Stage[]; allow: (o: Ore, stage: number) => boolean };
const home = (w: number, o: Ore) => o.worlds.includes(w);
const earlier = (w: number, o: Ore) => !home(w, o) && o.worlds.some((x) => x < w) && tier(o) <= 2;
const AREAS: Area[] = [
  { id: "forgotten-kingdom", world: 2, stages: [...STAGES], allow: (o, s) => home(2, o) && tier(o) <= s },
  { id: "frostspire-expanse", world: 3, stages: [...STAGES], allow: (o, s) => (home(3, o) && tier(o) <= s) || earlier(3, o) },
  { id: "crimson-sakura", world: 4, stages: [...STAGES], allow: (o, s) => o.source !== "Tower of Hell" && ((home(4, o) && tier(o) <= s) || earlier(4, o)) },
  { id: "tower-of-hell", world: 4, stages: ["End game"], allow: (o) => home(4, o) || earlier(4, o) },
];

const UNITS = 20; // share grid: 5% steps, refined to exact counts afterwards
function* compositions(n: number, k: number): Generator<number[]> {
  if (k === 1) { yield [n]; return; }
  for (let i = 1; i <= n - k + 1; i++) for (const rest of compositions(n - i, k - 1)) yield [i, ...rest];
}
function* combos<T>(xs: T[], k: number, start = 0): Generator<T[]> {
  if (k === 0) { yield []; return; }
  for (let i = start; i <= xs.length - k; i++) for (const rest of combos(xs, k - 1, i + 1)) yield [xs[i], ...rest];
}
const score = (ores: Ore[], counts: number[]) => armourScore(ores.map((ore, i) => ({ ore, count: counts[i] }))).effectiveHealth;

function best(pool: Ore[], total: number) {
  // Candidates: the 10 highest multipliers plus every ore with an armour effect.
  const top = [...pool].sort((a, b) => b.multiplier - a.multiplier);
  const cands = [...new Set([...top.slice(0, 10), ...top.filter((o) => o.id in ARMOUR_EFFECTS)])];
  let win = { ores: [] as Ore[], counts: [] as number[], s: -1 };
  for (let k = 1; k <= 4; k++) for (const set of combos(cands, k)) for (const units of compositions(UNITS, k)) {
    const counts = units.map((u) => Math.max(1, Math.round((u / UNITS) * total)));
    const s = score(set, counts);
    if (s > win.s) win = { ores: set, counts, s };
  }
  // Exact counts that add up to the lock total, then move one ore at a time while it helps.
  const c = win.counts.slice();
  let diff = total - c.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0; i = (i + 1) % c.length) { if (diff > 0) { c[i]++; diff--; } else if (c[i] > 1) { c[i]--; diff++; } }
  for (let improved = true; improved;) {
    improved = false;
    for (let a = 0; a < c.length; a++) for (let b = 0; b < c.length; b++) {
      if (a === b || c[a] <= 1) continue;
      const t = c.slice(); t[a]--; t[b]++;
      if (score(win.ores, t) > score(win.ores, c) + 1e-9) { c.splice(0, c.length, ...t); improved = true; }
    }
  }
  // Drop leftover 1–2 ore fillers from rounding when they change the score by less than 0.5%.
  let ores = win.ores.slice();
  for (let i = ores.length - 1; i >= 0 && ores.length > 1; i--) {
    if (c[i] > 2) continue;
    const keep = ores.map((_, j) => j).filter((j) => j !== i);
    const big = keep.reduce((a, b) => (c[b] > c[a] ? b : a));
    const t = c.slice(); t[big] += t[i];
    const without = keep.map((j) => t[j]);
    if (score(keep.map((j) => ores[j]), without) >= score(ores, c) * 0.995) { ores = keep.map((j) => ores[j]); c.splice(0, c.length, ...without); }
  }
  win = { ...win, ores };
  const order = c.map((n, i) => i).sort((x, y) => c[y] - c[x]);
  return { recipe: order.map((i) => [win.ores[i].name, c[i]] as [string, number]), detail: armourScore(order.map((i) => ({ ore: win.ores[i], count: c[i] }))) };
}

type Row = { stage: string; items: [string, number][][] };
const out: Record<string, Row[]> = {};
for (const area of AREAS) {
  out[area.id] = [];
  for (const stage of area.stages) {
    const s = STAGES.indexOf(stage);
    const pool = cat.ores.filter((o) => !EXCLUDE.has(o.id) && area.allow(o, s));
    const items = PIECES.map(([piece, total]) => {
      const r = best(pool, total);
      const d = r.detail;
      console.error(`${area.id} | ${stage} | ${piece} | ${r.recipe.map(([n, c]) => `${c} ${n}`).join(", ")} | M ${d.multiplier.toFixed(2)} vit ${(d.vitality * 100).toFixed(1)}% shield ${(d.shieldChance * 100).toFixed(0)}%×${(d.shieldCut * 100).toFixed(0)}% dodge ${(d.dodge * 100).toFixed(0)}% → EH ${d.effectiveHealth.toFixed(2)}`);
      return r.recipe;
    });
    // Same result as the stage before (nothing better unlocks): merge the labels, e.g. "Late and end game".
    const prev = out[area.id].at(-1);
    if (prev && JSON.stringify(prev.items) === JSON.stringify(items)) prev.stage = `${prev.stage.replace(/ game$/, "")} and ${stage.toLowerCase()}`;
    else out[area.id].push({ stage, items });
  }
}
writeFileSync(new URL("../data/armour-builds.json", import.meta.url), JSON.stringify({ generatedBy: "scripts/best-armour.ts", lockCounts: Object.fromEntries(PIECES), areas: out }, null, 1) + "\n");
