import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import type { Catalogue } from "../lib/engine/forge";
import { forge } from "../lib/engine/forge";
import { averageMultiplier, enhanceFactor, rawStat } from "../lib/engine/index";
import { atEnhancement, weaponDps } from "../lib/engine/dps";
import { combatDps } from "../lib/engine/loadout-dps";
import { dpsAtLevel } from "../lib/engine/runes";
import { calculate } from "../lib/api/calculate";

/*
 * Every page and the API reach DPS through different functions: the forge result (calculator, builds page, DPS target),
 * dpsAtLevel (runes panel, saved forges), combatDps (Loadout, race comparison, API). They must give the same number for
 * the same weapon, including Prismatic Shift, the 10% gates and enhancement growing only hits.
 */
const cat = data as unknown as Catalogue;
const ore = (id: string) => cat.ores.find((o) => o.id === id)!;
const BUILDS: { name: string; weapon: string; ores: { id: string; count: number }[] }[] = [
  { name: "the in-game Excalibur", weapon: "excalibur", ores: [{ id: "kitsunite", count: 12 }, { id: "galaxite", count: 12 }, { id: "tetrinite", count: 12 }, { id: "bismuth", count: 4 }] },
  { name: "Vooite with 30% Bismuth", weapon: "excalibur", ores: [{ id: "vooite", count: 35 }, { id: "bismuth", count: 15 }] },
  { name: "a Galaxite dagger with 5% Bismuth", weapon: "dagger", ores: [{ id: "galaxite", count: 19 }, { id: "bismuth", count: 1 }] },
  { name: "Echotite gauntlets", weapon: "dark-knights-gauntlets", ores: [{ id: "echotite", count: 10 }, { id: "frost-star", count: 6 }] },
];

describe("every DPS path agrees", () => {
  for (const b of BUILDS) {
    it(b.name, () => {
      const w = cat.weapons.find((x) => x.id === b.weapon)!;
      const mix = b.ores.map((o) => ({ ore: { slug: o.id, multiplier: ore(o.id).multiplier, rarity: ore(o.id).rarity, multiplierRule: ore(o.id).rule === "average" ? ("average-other-ores" as const) : undefined }, count: o.count }));
      const raw = rawStat(w.baseDamage, averageMultiplier(mix)!, 1);
      const weapon = { ores: b.ores, raw, interval: w.trueSpeed, cls: w.class };
      for (const level of [0, 4, 9]) {
        const combat = combatDps({ weapon, level }).total;
        expect(dpsAtLevel(weapon, level).total, `dpsAtLevel +${level}`).toBeCloseTo(combat, 9);
        const plain = weaponDps({ ores: b.ores, damage: raw, interval: w.trueSpeed, cls: w.class });
        expect(atEnhancement(plain, enhanceFactor(level)), `+0 result scaled to +${level}`).toBeCloseTo(combat, 9);
        const api = calculate(cat, { type: "dps", weapon: { item: b.weapon, ores: b.ores, quality: 100 }, enhancement: level, quality: 100 } as never) as unknown as { data: { dps: { total: number } } };
        expect(api.data.dps.total, `API +${level}`).toBeCloseTo(combat, 1);
      }
      // The forge result the calculator, builds page and DPS target use.
      const fr = forge(cat, b.ores.map((o) => ({ ore: ore(o.id), count: o.count })) as never, "weapon", 4, 1);
      const v = fr.classes.flatMap((c) => c.variants).find((x) => x.id === b.weapon);
      if (v?.dps) expect(v.dps.total).toBeCloseTo(combatDps({ weapon, level: 0 }).total, 6);
    });
  }
});
