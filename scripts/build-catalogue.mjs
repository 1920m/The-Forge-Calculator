// Builds data/catalogue.json from docs/PRD.md (the source of truth) plus the
// short list of wiki-only ores below. Run: npm run data:build
import { readFileSync, writeFileSync } from "node:fs";

const prd = readFileSync(new URL("../docs/PRD.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const slug = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const num = (s) => { const n = Number(String(s).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const rarityAlias = (r) => (r === "Mythical" ? "Mythic" : r);

function tablesIn(section) {
  const out = []; let t = null;
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) { t = null; continue; }
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.every((c) => /^[-: ]+$/.test(c))) continue;
    if (!t) { t = { head: cells, rows: [] }; out.push(t); continue; }
    t.rows.push(Object.fromEntries(t.head.map((h, i) => [h, cells[i]])));
  }
  return out;
}
const between = (a, b) => { const s = prd.indexOf(a); const e = prd.indexOf(b, s + a.length); if (s < 0 || e < 0) throw new Error(`Missing PRD section ${a}`); return prd.slice(s, e); };

// ---------- ores
const ores = new Map();
function addOres(section, worlds) {
  for (const t of tablesIn(section)) for (const r of t.rows) {
    const name = r["Ore"]; if (!name) continue;
    ores.set(name, {
      id: slug(name), name, rarity: rarityAlias(r["Rarity"]), multiplier: num(r["Multiplier"]),
      worlds, drop: num(r["Drop 1/N"]), source: r["Source"] || null, traits: [], verified: true,
    });
  }
}
addOres(between("### Ores\n", "### World 3 ores"), [1, 2]);
addOres(between("### World 3 ores", "### World 4 ores"), [3]);
addOres(between("### World 4 ores", "### Ore traits"), [4]);

// Wiki-only ores (forgewiki.org All Ores, 23 Oct 2026). World not confirmed in game.
const wikiOnly = [
  ["Grass", "Common", 0.1], ["Boneite", "Rare", 1.2], ["Quartz", "Rare", 1.5], ["Volcanic Rock Ore", "Rare", 1.55],
  ["Amethyst", "Rare", 1.65], ["Topaz", "Rare", 1.75], ["Slimite", "Epic", 2.25], ["Sapphire", "Rare", 2.25],
  ["Dark Boneite", "Rare", 2.25], ["Cuprite", "Epic", 2.43], ["Orange Crystal Ore", "Epic", 3], ["Magenta Crystal Ore", "Epic", 3.1],
  ["Green Crystal Ore", "Epic", 3.2], ["Crimson Crystal Ore", "Epic", 3.3], ["Blue Crystal Ore", "Epic", 3.4], ["Zephyte", "Legendary", 18.5],
];
for (const [name, rarity, multiplier] of wikiOnly) if (!ores.has(name)) ores.set(name, { id: slug(name), name, rarity, multiplier, worlds: [1, 2], drop: null, source: null, traits: [], verified: false });

// Traits: "Weapon: x. Armour: y. Both: z" segments, otherwise the whole text applies to the listed kinds.
for (const r of tablesIn(between("### Ore traits", "## Measured mechanics"))[0].rows) {
  const ore = ores.get(r["Ore"]); if (!ore) continue;
  const applies = r["Applies to"].toLowerCase();
  const text = r["Trait effect (as listed)"];
  const kinds = applies.includes("weapon") && applies.includes("armour") || applies === "both" ? ["weapon", "armour"] : applies.includes("weapon") ? ["weapon"] : ["armour"];
  const parts = [...text.matchAll(/(Weapon|Armour|Both):\s*([^]*?)(?=(?:Weapon|Armour|Both):|$)/g)];
  if (parts.length) for (const [, k, t] of parts) ore.traits.push({ kinds: k === "Both" ? ["weapon", "armour"] : [k.toLowerCase()], text: t.trim().replace(/\.$/, "") });
  else ore.traits.push({ kinds, text });
}
const fichi = ores.get("Fichilliumorite"); if (fichi) { fichi.rule = "average"; fichi.traits = [{ kinds: ["weapon", "armour"], text: "Takes the average multiplier of the other ores" }]; }

// ---------- odds
const csv = (header) => { const m = [...prd.matchAll(/```csv\n([\s\S]*?)\n```/g)].map((x) => x[1]).find((c) => c.startsWith(header)); if (!m) throw new Error(header); return m.split("\n").map((l) => l.split(",")); };
const oddsTable = (header) => Object.fromEntries(csv(header).slice(1).map(([n, ...cells]) => [n, cells.map((c) => (c === "" ? 0 : Number(c)))]));

// ---------- weapons
const W4_WEAPONS = new Set(["Kunai", "Jitte", "Damascus Dagger", "Tanto", "Hachiwari", "Chokuto", "Dragon Blade", "Thornspire", "Tetsubo", "Kanabo", "Shakujo", "Sodegarami", "Bo Staff", "Naginata", "Sun Great Axe", "Kinmon Kamagatana", "Otsuchi", "Sharktooth Odachi"]);
const UNVERIFIED_WEAPONS = new Set(["Reaper Scythe", "Batwing Reaver", "Bo Staff"]);
const EARLY_ONLY = new Set(["Gauntlets", "Katana", "Greatsword"]);
const LATE_ONLY = new Set(["Mace", "Axe", "Spear"]);
const weapons = csv("class,name,base_damage").slice(1).map(([cls, name, dmg, idx, tru, range, price, chance]) => ({
  id: slug(name), name, class: cls, baseDamage: num(dmg), indexSpeed: num(idx), trueSpeed: num(tru), range: num(range), price: num(price), weight: num(chance),
  worlds: W4_WEAPONS.has(name) ? [4] : EARLY_ONLY.has(cls) ? [1, 2] : LATE_ONLY.has(cls) ? [3, 4] : [1, 2, 3, 4],
  verified: !UNVERIFIED_WEAPONS.has(name),
}));

// ---------- armour
const W4_SETS = new Set(["Ninja's", "Rootguard", "Vanguard", "Shogun"]);
const armour = csv("class,name,slot,base_health_pct").slice(1).map(([cls, name, slot, hp, price, chance]) => {
  const set = name.replace(/ (Helmet|Chestplate|Leggings|Armor|Crown)$/, "").replace(/^(Light|Medium)$/, "Basic");
  const s = W4_SETS.has(set) ? set : set;
  return {
    id: slug(name), name, weightClass: cls, set: s, slot, healthPct: num(hp), price: num(price),
    weight: num(chance), // Wolf 1/3 and Raven 1/8 confirmed in game by Cris, 24 Oct 2026
    worlds: W4_SETS.has(s) ? [4] : [1, 2, 3, 4],
    verified: !(name === "Vanguard Helmet" || name === "Vanguard Leggings"),
  };
});

const catalogue = {
  generatedFrom: "docs/PRD.md",
  ores: [...ores.values()].map((o) => ({ ...o, rule: o.rule ?? "fixed" })),
  weapons,
  armour,
  weaponClasses: {
    early: ["Dagger", "Straight Sword", "Gauntlets", "Katana", "Greatsword", "Great Axe", "Colossal Sword"],
    late: ["Dagger", "Straight Sword", "Mace", "Axe", "Spear", "Great Axe", "Colossal Sword"],
  },
  armourClasses: [["Light", "helmet"], ["Light", "leggings"], ["Light", "chestplate"], ["Medium", "helmet"], ["Medium", "leggings"], ["Medium", "chestplate"], ["Heavy", "helmet"], ["Heavy", "leggings"], ["Heavy", "chestplate"]],
  odds: { weapon: oddsTable("ores,slot1_dagger,"), armour: oddsTable("ores,light_helmet,") },
  locks: { weapon: [3, 9, 14, 18, 24, 31, 50], armour: [3, 11, 15, 20, 24, 30, 35, 42, 52] },
  qualityTiers: [["Broken", 0], ["Poor", 25], ["Rough", 40], ["Average", 50], ["Good", 65], ["Great", 75], ["Excellent", 85], ["Perfect", 90], ["Masterwork", 95]],
};
writeFileSync(new URL("../data/catalogue.json", import.meta.url), JSON.stringify(catalogue) + "\n");
console.log(`ores ${catalogue.ores.length}, traits ${catalogue.ores.reduce((n, o) => n + o.traits.length, 0)}, weapons ${weapons.length}, armour ${armour.length}`);
