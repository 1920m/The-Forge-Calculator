/**
 * Recommended crafts by world and stage, from the community wiki's Guide page
 * (https://forgewiki.org/wiki/Guide, last edited 2 Aug 2026, CC BY-SA 4.0).
 * Ore names are matched to the catalogue; the calculator works out every number shown.
 */
export type Recipe = [ore: string, count: number][];
export type BuildRow = { stage: string; items: (Recipe | null)[] };
export type BuildTable = { kind: "weapon" | "armour"; columns: string[]; rows: BuildRow[] };
export type BuildArea = { id: string; name: string; world: 2 | 3 | 4; note?: string; weapons: BuildTable; armour: BuildTable };

const W = ["Straight Sword", "Gauntlets", "Colossal Sword"]; // the wiki's three weapon sizes
const A = ["Heavy Chestplate", "Heavy Helmet", "Heavy Leggings"];

export const BUILD_SOURCE = { title: "The Forge Official Roblox Wiki: Guide", url: "https://forgewiki.org/wiki/Guide", edited: "2 Aug 2026" };

export const BUILDS: BuildArea[] = [
  {
    id: "forgotten-kingdom", name: "Forgotten Kingdom", world: 2,
    weapons: { kind: "weapon", columns: W, rows: [
      { stage: "Early game", items: [[["Eye Ore", 2], ["Cuprite", 2], ["Emerald", 2]], [["Eye Ore", 3], ["Cuprite", 3], ["Emerald", 3]], [["Eye Ore", 15], ["Cuprite", 15], ["Emerald", 15]]] },
      { stage: "Mid game", items: [[["Eye Ore", 4], ["Rivalite", 2]], [["Eye Ore", 6], ["Rivalite", 3]], [["Eye Ore", 35], ["Rivalite", 15]]] },
      { stage: "End game", items: [[["Darkryte", 4], ["Magmaite", 2]], [["Darkryte", 6], ["Magmaite", 3]], [["Darkryte", 12], ["Magmaite", 10], ["Demonite", 8], ["Eye Ore", 10]]] },
    ] },
    armour: { kind: "armour", columns: A, rows: [
      { stage: "Early game", items: [[["Ruby", 16], ["Emerald", 12], ["Cuprite", 12]], [["Ruby", 9], ["Emerald", 9], ["Cuprite", 9]], [["Ruby", 12], ["Emerald", 10], ["Cuprite", 8]]] },
      { stage: "Mid game", items: [[["Lightite", 16], ["Mythril", 12], ["Eye Ore", 12]], [["Lightite", 9], ["Mythril", 8], ["Eye Ore", 9]], [["Lightite", 11], ["Mythril", 9], ["Eye Ore", 10]]] },
      { stage: "Late game", items: [[["Mythril", 18], ["Eye Ore", 11], ["Obsidian", 11]], [["Mythril", 9], ["Eye Ore", 9], ["Obsidian", 9]], [["Mythril", 12], ["Eye Ore", 10], ["Obsidian", 8]]] },
      { stage: "End game", items: [[["Darkryte", 16], ["Demonite", 12], ["Eye Ore", 12]], [["Darkryte", 9], ["Obsidian", 12], ["Eye Ore", 9]], [["Darkryte", 12], ["Obsidian", 9], ["Eye Ore", 9]]] },
    ] },
  },
  {
    id: "frostspire-expanse", name: "Frostspire Expanse", world: 3,
    weapons: { kind: "weapon", columns: W, rows: [
      { stage: "Early game", items: [[["Snowite", 4], ["Iceite", 2]], [["Snowite", 6], ["Iceite", 3]], [["Snowite", 30], ["Iceite", 15]]] },
      { stage: "Mid game", items: [[["Iceite", 2], ["Crimsonite", 2], ["Yeti Heart", 2]], [["Iceite", 3], ["Crimsonite", 3], ["Yeti Heart", 3]], [["Iceite", 15], ["Crimsonite", 15], ["Yeti Heart", 15]]] },
      { stage: "End game", items: [[["Gargantuan", 2], ["Golem Heart", 2], ["Voidstar", 2]], [["Gargantuan", 3], ["Golem Heart", 3], ["Voidstar", 3]], [["Gargantuan", 15], ["Golem Heart", 15], ["Voidstar", 15]]] },
    ] },
    armour: { kind: "armour", columns: A, rows: [
      { stage: "Early game", items: [[["Snowite", 16], ["Frost Fossil", 12], ["Velchire", 12]], [["Snowite", 10], ["Frost Fossil", 8], ["Velchire", 8]], [["Snowite", 12], ["Frost Fossil", 9], ["Velchire", 9]]] },
      { stage: "Mid game", items: [[["Etherealite", 12], ["Frost Fossil", 12], ["Velchire", 12], ["Suryafal", 4]], [["Etherealite", 8], ["Frost Fossil", 8], ["Velchire", 8], ["Suryafal", 2]], [["Etherealite", 9], ["Frost Fossil", 9], ["Velchire", 9], ["Suryafal", 3]]] },
      { stage: "Late game", items: [[["Duranite", 12], ["Frost Fossil", 12], ["Etherealite", 12], ["Gargantuan", 4]], [["Duranite", 8], ["Frost Fossil", 8], ["Etherealite", 8], ["Gargantuan", 2]], [["Duranite", 9], ["Frost Fossil", 9], ["Etherealite", 9], ["Gargantuan", 3]]] },
      { stage: "End game (glass cannon)", items: [[["Etherealite", 12], ["Frost Fossil", 12], ["Eye Ore", 12], ["Gargantuan", 4]], [["Duranite", 8], ["Frost Fossil", 8], ["Eye Ore", 8], ["Gargantuan", 2]], [["Etherealite", 9], ["Frost Fossil", 9], ["Eye Ore", 9], ["Gargantuan", 3]]] },
      { stage: "End game (tank)", items: [[["Gargantuan", 16], ["Etherealite", 12], ["Duranite", 12]], [["Gargantuan", 10], ["Etherealite", 8], ["Duranite", 8]], [["Gargantuan", 12], ["Etherealite", 9], ["Duranite", 9]]] },
    ] },
  },
  {
    id: "crimson-sakura", name: "Crimson Sakura Isles", world: 4,
    weapons: { kind: "weapon", columns: W, rows: [
      { stage: "Early game", items: [[["Voidstar", 2], ["Onyx", 2], ["Tiger's Eye", 2]], [["Voidstar", 3], ["Onyx", 3], ["Tiger's Eye", 3]], [["Voidstar", 15], ["Onyx", 15], ["Tiger's Eye", 15]]] },
      { stage: "Mid game", items: [[["Kyubite", 2], ["Onyx", 2], ["Wolfarite", 2]], [["Kyubite", 3], ["Onyx", 3], ["Wolfarite", 3]], [["Kyubite", 15], ["Wolfarite", 15], ["Yin-Yang", 15], ["Meteorite", 5]]] },
      { stage: "End game", items: [[["Galaxite", 1], ["Yin-Yang", 1], ["Wolfarite", 1], ["Kyubite", 1]], [["Galaxite", 3], ["Wolfarite", 3], ["Kyubite", 3]], [["Galaxite", 20], ["Wolfarite", 15], ["Kyubite", 15]]] },
    ] },
    armour: { kind: "armour", columns: A, rows: [
      { stage: "Late game", items: [[["Heavenly Orb", 15], ["Azuryxite", 13], ["Etherealite", 13]], [["Heavenly Orb", 10], ["Eye Ore", 8], ["Frost Fossil", 8]], [["Heavenly Orb", 12], ["Eye Ore", 9], ["Frost Fossil", 9]]] },
      { stage: "End game", items: [[["Heavenly Orb", 16], ["Kokorite", 12], ["Yin-Yang", 12]], [["Takenokoishi", 10], ["Kokorite", 8], ["Yin-Yang", 8]], [["Heavenly Orb", 12], ["Kokorite", 9], ["Yin-Yang", 9]]] },
    ] },
  },
  {
    id: "tower-of-hell", name: "Tower of Hell", world: 4, note: "World 4 endgame area",
    weapons: { kind: "weapon", columns: W, rows: [
      { stage: "Early game", items: [[["Galaxite", 1], ["Yin-Yang", 1], ["Wolfarite", 1], ["Kyubite", 1]], [["Galaxite", 3], ["Wolfarite", 3], ["Kyubite", 3]], [["Galaxite", 20], ["Wolfarite", 15], ["Kyubite", 15]]] },
      { stage: "Mid game", items: [[["Vanegos", 4], ["Galaxite", 4], ["Fichilliumorite", 4]], [["Vanegos", 5], ["Galaxite", 5], ["Fichilliumorite", 5]], [["Vanegos", 15], ["Galaxite", 20], ["Fichilliumorite", 15]]] },
      { stage: "End game", items: [[["Kitsunite", 4], ["Galaxite", 4], ["Fichilliumorite", 4]], [["Kitsunite", 5], ["Galaxite", 5], ["Fichilliumorite", 5]], [["Kitsunite", 20], ["Galaxite", 15], ["Fichilliumorite", 15]]] },
    ] },
    armour: { kind: "armour", columns: A, rows: [
      { stage: "Mid game", items: [[["Kokorite", 16], ["Yin-Yang", 16], ["Heavenly Orb", 16], ["Sentira", 4]], [["Takenokoishi", 11], ["Kokorite", 11], ["Heavenly Orb", 11], ["Sentira", 2]], [["Kokorite", 13], ["Yin-Yang", 13], ["Heavenly Orb", 14], ["Sentira", 2]]] },
      { stage: "Late game", items: [[["Fierce Jade", 16], ["Aether Lotus", 16], ["Vanegos", 16], ["Vooite", 4]], [["Takenokoishi", 11], ["Aether Lotus", 11], ["Fierce Jade", 11], ["Vooite", 2]], [["Ceyite", 13], ["Aether Lotus", 13], ["Fierce Jade", 14], ["Vooite", 2]]] },
      { stage: "End game", items: [[["Kitsunite", 20], ["Fierce Jade", 16], ["Vanegos", 16]], [["Takenokoishi", 11], ["Fierce Jade", 11], ["Kitsunite", 13]], [["Kitsunite", 16], ["Ceyite", 13], ["Aether Lotus", 13]]] },
    ] },
  },
];
