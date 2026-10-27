/**
 * Recommended crafts by world and stage.
 * - Weapons: the community wiki's Guide page (https://forgewiki.org/wiki/Guide, last edited 2 Aug 2026, CC BY-SA 4.0).
 * - Armour: computed by scripts/best-armour.ts (npm run builds:armour), which tries every mix of up to 4 ores for
 *   each world and stage and keeps the one with the most effective health. The wiki's armour tables had mistakes.
 * Ore names are matched to the catalogue; the calculator works out every number shown.
 * Gauntlets use enough ores to lock the class (14), so Dark Knight's Gauntlets can be aimed at with molds:
 * 5/5/5 for three-ore mixes and 9/5 for two-ore mixes (players' feedback, 27 Oct 2026; the wiki has 3/3/3 and 6/3).
 */
import armourBuilds from "./armour-builds.json";
export type Recipe = [ore: string, count: number][];
export type BuildRow = { stage: string; items: (Recipe | null)[] };
export type BuildTable = { kind: "weapon" | "armour"; columns: string[]; rows: BuildRow[] };
export type BuildArea = { id: string; name: string; world: 2 | 3 | 4; note?: string; weapons: BuildTable; armour: BuildTable };

const W = ["Straight Sword", "Gauntlets", "Colossal Sword"]; // the wiki's three weapon sizes
const A = ["Heavy Chestplate", "Heavy Helmet", "Heavy Leggings"];
const computed = (id: string): BuildTable => ({ kind: "armour", columns: A, rows: (armourBuilds.areas as unknown as Record<string, { stage: string; items: [string, number][][] }[]>)[id] ?? [] });

export const BUILD_SOURCE = { title: "The Forge Official Roblox Wiki: Guide", url: "https://forgewiki.org/wiki/Guide", edited: "2 Aug 2026" };

export const BUILDS: BuildArea[] = [
  {
    id: "forgotten-kingdom", name: "Forgotten Kingdom", world: 2,
    weapons: { kind: "weapon", columns: W, rows: [
      { stage: "Early game", items: [[["Eye Ore", 2], ["Cuprite", 2], ["Emerald", 2]], [["Eye Ore", 5], ["Cuprite", 5], ["Emerald", 5]], [["Eye Ore", 15], ["Cuprite", 15], ["Emerald", 15]]] },
      { stage: "Mid game", items: [[["Eye Ore", 4], ["Rivalite", 2]], [["Eye Ore", 9], ["Rivalite", 5]], [["Eye Ore", 35], ["Rivalite", 15]]] },
      { stage: "End game", items: [[["Darkryte", 4], ["Magmaite", 2]], [["Darkryte", 9], ["Magmaite", 5]], [["Darkryte", 12], ["Magmaite", 10], ["Demonite", 8], ["Eye Ore", 10]]] },
    ] },
    armour: computed("forgotten-kingdom"),
  },
  {
    id: "frostspire-expanse", name: "Frostspire Expanse", world: 3,
    weapons: { kind: "weapon", columns: W, rows: [
      { stage: "Early game", items: [[["Snowite", 4], ["Iceite", 2]], [["Snowite", 9], ["Iceite", 5]], [["Snowite", 30], ["Iceite", 15]]] },
      { stage: "Mid game", items: [[["Iceite", 2], ["Crimsonite", 2], ["Yeti Heart", 2]], [["Iceite", 5], ["Crimsonite", 5], ["Yeti Heart", 5]], [["Iceite", 15], ["Crimsonite", 15], ["Yeti Heart", 15]]] },
      { stage: "End game", items: [[["Gargantuan", 2], ["Golem Heart", 2], ["Voidstar", 2]], [["Gargantuan", 5], ["Golem Heart", 5], ["Voidstar", 5]], [["Gargantuan", 15], ["Golem Heart", 15], ["Voidstar", 15]]] },
    ] },
    armour: computed("frostspire-expanse"),
  },
  {
    id: "crimson-sakura", name: "Crimson Sakura Isles", world: 4,
    weapons: { kind: "weapon", columns: W, rows: [
      { stage: "Early game", items: [[["Voidstar", 2], ["Onyx", 2], ["Tiger's Eye", 2]], [["Voidstar", 5], ["Onyx", 5], ["Tiger's Eye", 5]], [["Voidstar", 15], ["Onyx", 15], ["Tiger's Eye", 15]]] },
      { stage: "Mid game", items: [[["Kyubite", 2], ["Onyx", 2], ["Wolfarite", 2]], [["Kyubite", 5], ["Onyx", 5], ["Wolfarite", 5]], [["Kyubite", 15], ["Wolfarite", 15], ["Yin-Yang", 15], ["Meteorite", 5]]] },
      { stage: "End game", items: [[["Galaxite", 1], ["Yin-Yang", 1], ["Wolfarite", 1], ["Kyubite", 1]], [["Galaxite", 5], ["Wolfarite", 5], ["Kyubite", 5]], [["Galaxite", 20], ["Wolfarite", 15], ["Kyubite", 15]]] },
    ] },
    armour: computed("crimson-sakura"),
  },
  {
    id: "tower-of-hell", name: "Tower of Hell", world: 4, note: "World 4 endgame area",
    weapons: { kind: "weapon", columns: W, rows: [
      { stage: "Early game", items: [[["Galaxite", 1], ["Yin-Yang", 1], ["Wolfarite", 1], ["Kyubite", 1]], [["Galaxite", 5], ["Wolfarite", 5], ["Kyubite", 5]], [["Galaxite", 20], ["Wolfarite", 15], ["Kyubite", 15]]] },
      { stage: "Mid game", items: [[["Vanegos", 4], ["Galaxite", 4], ["Fichilliumorite", 4]], [["Vanegos", 5], ["Galaxite", 5], ["Fichilliumorite", 5]], [["Vanegos", 15], ["Galaxite", 20], ["Fichilliumorite", 15]]] },
      { stage: "End game", items: [[["Kitsunite", 4], ["Galaxite", 4], ["Fichilliumorite", 4]], [["Kitsunite", 5], ["Galaxite", 5], ["Fichilliumorite", 5]], [["Kitsunite", 20], ["Galaxite", 15], ["Fichilliumorite", 15]]] },
    ] },
    armour: computed("tower-of-hell"),
  },
];
