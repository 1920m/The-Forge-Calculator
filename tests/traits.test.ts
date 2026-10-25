import { describe, expect, it } from "vitest";
import data from "../data/catalogue.json";
import { forge, type Catalogue } from "../lib/engine/forge";
import { DPS_STATS } from "../lib/engine/dps";

const cat = data as unknown as Catalogue;
const ore = (id: string) => cat.ores.find((o) => o.id === id)!;

describe("ore traits", () => {
  it("every ore with weapon combat stats lists a weapon trait", () => {
    // Below-35%-HP berserk alone (Yin) is an armour trait, so it is not counted here.
    const combat = Object.entries(DPS_STATS).filter(([, s]) => Object.keys(s).some((k) => k !== "phys_dmg" && k !== "berserk_duration"));
    for (const [id] of combat) expect(ore(id).traits.some((t) => t.kinds.includes("weapon")), id).toBe(true);
  });

  it("shows all three traits for Kyubite, Onyx and Wolfarite", () => {
    const mix = [["kyubite", 3], ["onyx", 3], ["wolfarite", 3]].map(([id, count]) => ({ ore: ore(String(id)), count: Number(count) }));
    const names = forge(cat, mix, "weapon", 4, 1).traits.map((t) => t.ore.name).sort();
    expect(names).toEqual(["Kyubite", "Onyx", "Wolfarite"]);
  });

  it("splits Weapon / Both rows so armour gets the shared lines", () => {
    expect(ore("vanegos").traits.find((t) => t.text.includes("Lethality"))?.kinds).toEqual(["weapon", "armour"]);
    expect(ore("fierce-jade").traits.find((t) => t.text.includes("crit chance"))?.kinds).toEqual(["weapon", "armour"]);
    expect(ore("fierce-jade").traits.find((t) => t.text.includes("attack speed"))?.kinds).toEqual(["weapon"]);
  });
});
