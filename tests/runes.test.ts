import { describe, expect, it } from "vitest";
import { RUNES, SECONDARIES } from "../data/runes";
import { decodeRunes, encodeRunes, runeTotals, slotsAt, type RuneSlot } from "../lib/engine/runes";
import { weaponDps } from "../lib/engine/dps";

describe("rune slots", () => {
  it("opens a slot at +3, +6 and +9, three at most", () => {
    expect([0, 2, 3, 5, 6, 8, 9, 10].map(slotsAt)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe("rune data", () => {
  it("has every rune once with three levels, and best rolls inside the wiki ranges", () => {
    expect(new Set(RUNES.map((r) => r.id)).size).toBe(RUNES.length);
    for (const r of RUNES) expect(r.levels).toHaveLength(3);
    const blast = RUNES.find((r) => r.id === "blast-chip")!;
    expect(blast.levels.map((l) => l.proc)).toEqual([
      { type: "explosion", chance: 0.2, dmg: 0.4 }, { type: "explosion", chance: 0.35, dmg: 0.6 }, { type: "explosion", chance: 0.5, dmg: 0.8 },
    ]);
    expect(SECONDARIES.find((s) => s.id === "atk_speed")!.best).toBe(0.18);
  });
});

describe("rune totals", () => {
  const blast3: RuneSlot = { id: "blast-chip", level: 3, secondaries: ["atk_speed", "crit_chance", "lethality"] };
  it("adds copies of the same rune and only counts open slots", () => {
    const t = runeTotals([blast3, blast3, blast3], 2);
    expect(t.procs).toHaveLength(2);
    expect(t.stats.atk_speed).toBeCloseTo(0.36, 12);
    expect(t.stats.crit_chance).toBeCloseTo(0.3, 12);
  });
  it("allows as many side effects as the rune's level", () => {
    const t = runeTotals([{ id: "flame-spark", level: 1, secondaries: ["atk_speed", "crit_chance"] }], 1);
    expect(t.stats).toEqual({ atk_speed: 0.18 });
  });
  it("ignores side effects of the wrong kind", () => {
    const t = runeTotals([{ id: "blast-chip", level: 2, secondaries: ["vitality", "lethality"] }], 1);
    expect(t.stats).toEqual({ lethality: 0.15 });
  });
});

describe("runes in DPS", () => {
  const base = { ores: [{ id: "iron", count: 10 }], damage: 100, interval: 0.5 };
  it("explosion: damage × share × chance × hits per second", () => {
    const t = runeTotals([{ id: "blast-chip", level: 3, secondaries: [] }], 1);
    const r = weaponDps({ ...base, extra: { procs: t.procs } });
    expect(r.total).toBeCloseTo(200 + 100 * 0.8 * 0.5 * 2, 9); // 280
  });
  it("attack speed and crits from side effects", () => {
    const r = weaponDps({ ...base, extra: { stats: { atk_speed: 0.18, crit_chance: 0.15, crit_dmg: 0.15, lethality: 0.15 } } });
    // 100 × 1.15 lethality × (0.15 × 1.60 + 0.85) crit blend × 1.18 ÷ 0.5
    expect(r.total).toBeCloseTo(100 * 1.15 * (0.15 * 1.6 + 0.85) * 2.36, 9);
  });
  it("burn and poison are capped at always-on, lightning at its cooldown", () => {
    const t = runeTotals([{ id: "venom-crumb", level: 3, secondaries: [] }, { id: "thunder-shard", level: 3, secondaries: [] }], 2);
    const r = weaponDps({ ...base, extra: { procs: t.procs } });
    const part = (l: string) => r.parts.find((p) => p.label.startsWith(l))!.dps;
    expect(part("Venom Crumb")).toBeCloseTo(100 * 0.2, 9); // always up: 20% per second
    expect(part("Thunder Shard")).toBeCloseTo(100 * 1 * 0.6 * 0.5, 9); // at most once per 2s cooldown
  });
});

describe("rune link", () => {
  it("round-trips and drops anything unknown", () => {
    const slots: (RuneSlot | null)[] = [{ id: "blast-chip", level: 3, secondaries: ["atk_speed", "crit_dmg"] }, null, { id: "flame-spark", level: 1, secondaries: [] }];
    expect(decodeRunes(encodeRunes(slots), "weapon")).toEqual(slots);
    expect(decodeRunes("ward-patch:3,nope:2,blast-chip:9,blast-chip:1:atk_speed.lethality.crit_dmg", "weapon"))
      .toEqual([null, null, null]); // armour rune, unknown rune, bad level; 4th slot doesn't exist
    expect(decodeRunes("blast-chip:1:atk_speed.lethality", "weapon")[0]).toEqual({ id: "blast-chip", level: 1, secondaries: ["atk_speed"] });
  });
});

describe("DPS at an enhancement level with runes", () => {
  it("only counts the runes whose slots that level opens", async () => {
    const { dpsAtLevel } = await import("../lib/engine/runes");
    const w = { ores: [{ id: "iron", count: 10 }], raw: 100, interval: 0.5 };
    const blast: RuneSlot = { id: "blast-chip", level: 3, secondaries: [] };
    expect(dpsAtLevel(w, 2, [blast]).total).toBeCloseTo(110 * 2, 9); // no slot yet at +2
    expect(dpsAtLevel(w, 3, [blast]).total).toBeCloseTo(115 * 2 + 115 * 0.8 * 0.5 * 2, 9);
    expect(dpsAtLevel(w, 5, [blast, blast]).procs).toBeCloseTo(125 * 0.8 * 0.5 * 2, 9); // second slot opens at +6
  });
});
