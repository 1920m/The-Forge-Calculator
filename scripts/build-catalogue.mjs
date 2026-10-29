// Builds data/catalogue.json from docs/PRD.md (the source of truth) plus the
// short list of wiki-only ores below. Run: npm run data:build
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

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

// Wiki-only ores (forgewiki.org Module:Ore/Data, rechecked 25 Oct 2026): [name, rarity, multiplier, worlds, drop 1/N, source].
const W12 = [1, 2];
const wikiOnly = [
  ["Grass", "Common", 0.1, [3], 23, "Quest"], ["Boneite", "Rare", 1.2, W12, 222, "Skeleton drops"], ["Quartz", "Rare", 1.5, W12, 90, null],
  ["Volcanic Rock Ore", "Rare", 1.55, W12, 55, null], ["Amethyst", "Rare", 1.65, W12, 115, null], ["Topaz", "Rare", 1.75, W12, 143, null],
  ["Slimite", "Epic", 2.25, W12, 247, "Slime drops"], ["Sapphire", "Rare", 2.25, W12, 247, null], ["Dark Boneite", "Rare", 2.25, W12, 555, "Elite enemy drops"],
  ["Cuprite", "Epic", 2.43, W12, 303, null], ["Orange Crystal Ore", "Epic", 3, W12, 255, "Goblin Cave"], ["Magenta Crystal Ore", "Epic", 3.1, W12, 255, "Goblin Cave"],
  ["Green Crystal Ore", "Epic", 3.2, W12, 255, "Goblin Cave"], ["Crimson Crystal Ore", "Epic", 3.3, W12, 255, "Goblin Cave"], ["Blue Crystal Ore", "Epic", 3.4, W12, 255, "Goblin Cave"],
  ["Zephyte", "Legendary", 18.5, [4], 15, "Tower of Hell"],
];
for (const [name, rarity, multiplier, worlds, drop, source] of wikiOnly) if (!ores.has(name)) ores.set(name, { id: slug(name), name, rarity, multiplier, worlds, drop, source, traits: [], verified: false });
// Goblin Cave crystals: the drop rates were missing from the PRD table.
for (const [name, drop] of [["Rainbow Crystal", 5000], ["Arcane Crystal", 100000]]) { const o = ores.get(name); if (o && o.drop == null) { o.drop = drop; o.source = "Goblin Cave"; } }

// Traits: "Weapon: x. Armour: y. Both: z" segments, otherwise the whole text applies to the listed kinds.
for (const r of tablesIn(between("### Ore traits", "## Measured mechanics"))[0].rows) {
  const ore = ores.get(r["Ore"]); if (!ore) continue;
  const applies = r["Applies to"].toLowerCase();
  const text = r["Trait effect (as listed)"];
  const kinds = applies.includes("weapon") && applies.includes("armour") || applies === "both" ? ["weapon", "armour"] : applies.includes("weapon") ? ["weapon"] : ["armour"];
  const parts = [...text.matchAll(/\b(Weapon|Armour|Both):\s*([^]*?)(?=\b(?:Weapon|Armour|Both):|$)/gi)];
  // "Weapon / Both" style rows must say which part goes where, or every line would land on one kind.
  if (!parts.length && applies.includes("/")) throw new Error(`${r["Ore"]}: "${r["Applies to"]}" needs Weapon:/Armour:/Both: sections in the trait text`);
  if (parts.length) for (const [, k, t] of parts) ore.traits.push({ kinds: k.toLowerCase() === "both" ? ["weapon", "armour"] : [k.toLowerCase()], text: t.trim().replace(/\.$/, "") });
  else ore.traits.push({ kinds, text });
}
const fichi = ores.get("Fichilliumorite"); if (fichi) { fichi.rule = "average"; fichi.traits = [{ kinds: ["weapon", "armour"], text: "Takes the average multiplier of the other ores" }]; }
// Bismuth also takes the average when forging (its ore page says so, and an in-game craft confirms it: Bismuth,
// Fichilliumorite, Kitsunite and Galaxite, one each, shows 26.25×, the average of Kitsunite and Galaxite).
// Its listed 8× isn't used when forging. It keeps its own traits.
const bismuth = ores.get("Bismuth"); if (bismuth) bismuth.rule = "average";

// ---------- odds
const csv = (header) => { const m = [...prd.matchAll(/```csv\n([\s\S]*?)\n```/g)].map((x) => x[1]).find((c) => c.startsWith(header)); if (!m) throw new Error(header); return m.split("\n").map((l) => l.split(",")); };
const oddsTable = (header) => Object.fromEntries(csv(header).slice(1).map(([n, ...cells]) => [n, cells.map((c) => (c === "" ? 0 : Number(c)))]));

// ---------- weapons
// Stats from the PRD weapon table plus wiki rows the PRD lacked (forgewiki.org/wiki/Weapons, 24 Oct 2026).
const EXTRA_WEAPONS = [
  ["Greatsword", "The Carver", "13.8", "0.91", "1.26", "9", "485", "4"], // wiki spells it "The Craver"
  ["Greatsword", "Jack's Crest", "13.8", "0.91", "1.26", "9", "485", "6"],
  ["Axe", "Duskwing's Cleaver", "8.4", "0.48", "0.88", "8", "205", "8"],
  ["Spear", "Demonic Spear", "12.75", "0.56", "0.60", "11", "120", "4"],
  ["Great Axe", "Halberd", "16.8", "1", "0.91", "10", "850", "1"],
  ["Colossal Sword", "Coffin's Lid", "23", "1.12", "1.56", "10", "1355", "16"],
];
const allWeapons = [...csv("class,name,base_damage").slice(1), ...EXTRA_WEAPONS].map(([cls, name, dmg, idx, tru, range, price, chance]) => ({
  id: slug(name), name, class: cls, baseDamage: num(dmg), indexSpeed: num(idx), trueSpeed: num(tru), range: num(range), price: num(price), weight: num(chance), worlds: [], verified: true, tag: null,
}));
const byName = new Map(allWeapons.map((w) => [w.name, w]));

// Which classes and variants each world rolls, as listed by Cris from the game (24 Oct 2026).
const COLOSSAL_1_2 = [["Great Sword"], ["Hammer"], ["Skull Crusher"], ["Dragon Slayer"]];
// [name] uses the wiki weight; [name, weight] overrides it for that world. shop: the class also has
// shop-blueprint weapons Cris does not own yet, so the list (and the odds inside it) may be incomplete.
const W2 = {
  "Dagger": { items: [["Dagger"], ["Gladius Daggers"], ["Hook"]] },
  "Straight Sword": { items: [["Falchion Sword"], ["Cutlass"], ["Rapier"], ["Chaos"]] },
  "Gauntlets": { items: [["Ironhand"], ["Boxing Gloves"], ["Relevator"], ["Savage Claws"], ["Dark Knight's Gauntlets"]] },
  "Katana": { items: [["Uchigatana"], ["Tachi"]] },
  "Greatsword": { items: [["Crusader Sword"], ["Long Sword"], ["Dark Knight's Greatsword"], ["Anchored Greatsword"], ["Zweihander"], ["Jack's Crest"], ["The Carver"]] },
  "Great Axe": { items: [["Double Battle Axe"], ["Scythe"]] },
  // Comically Large Spoon only rolls in World 1 (players' feedback, 27 Oct 2026). It isn't a shop blueprint.
  "Colossal Sword": { items: [...COLOSSAL_1_2, ["Comically Large Spoon"]] },
};
const W3 = {
  "Dagger": { items: W2["Dagger"].items, shop: true },
  "Straight Sword": { items: [...W2["Straight Sword"].items, ["Hook Blade"]], shop: true },
  "Mace": { items: [["Mace"], ["Spiked Mace"], ["Winged Mace"], ["Hammerhead Mace"], ["Grave Maker"]] },
  "Axe": { items: [["Axe"], ["Battleaxe"], ["Curved Handle Axe"], ["Spade Armed Axe"]], shop: true },
  "Spear": { items: [["Spear"], ["Trident"], ["Angelic Spear"], ["Knight Spear"], ["Compass Spear"]] },
  "Great Axe": { items: [...W2["Great Axe"].items, ["Greater Battle Axe"], ["Wyvern Axe"]], shop: true },
  "Colossal Sword": { items: COLOSSAL_1_2 },
};
const W4 = {
  "Dagger": { items: [["Kunai"], ["Jitte"], ["Damascus Dagger"], ["Tanto"]], shop: true },
  "Straight Sword": { items: [["Chokuto"], ["Hachiwari"], ["Dragon Blade"], ["Hook Blade"]], shop: true },
  "Mace": { items: [["Mace"], ["Tetsubo"], ["Kanabo"]] },
  "Katana": { items: [...W2["Katana"].items, ["Juto Katana"], ["Kurokiba-gatana"], ["Washi-maru"]] },
  "Spear": { items: [["Spear"], ["Shakujo"], ["Sodegarami"], ["Bo Staff"], ["Naginata"]] },
  "Great Axe": W3["Great Axe"],
  // World 4 rolls Dragon Slayer at 1/1 (the game also lists a 1/16 copy, which Cris says to ignore).
  "Colossal Sword": { items: [["Dragon Slayer", 1], ["Kinmon Kamagatana"], ["Otsuchi"], ["Sharktooth Odachi"], ["Excalibur"]], shop: true },
};
const inWorld = (w, world) => { w.worlds = [...new Set([...w.worlds, ...(world === 2 ? [1, 2] : [world])])]; };
const pool = (world, classes, def) => ({
  classes,
  pools: Object.fromEntries(classes.map((c) => [c, {
    shop: !!def[c].shop,
    items: def[c].items.map(([name, weight]) => {
      const w = byName.get(name);
      if (!w) throw new Error(`Unknown weapon ${name}`);
      if (w.class !== c) throw new Error(`${name} is ${w.class}, not ${c}`);
      inWorld(w, world);
      return weight ? [w.id, weight] : [w.id];
    }),
  }])),
});
const weaponPools = {
  2: pool(2, ["Dagger", "Straight Sword", "Gauntlets", "Katana", "Greatsword", "Great Axe", "Colossal Sword"], W2),
  3: pool(3, ["Dagger", "Straight Sword", "Mace", "Axe", "Spear", "Great Axe", "Colossal Sword"], W3),
  4: pool(4, ["Dagger", "Straight Sword", "Mace", "Katana", "Spear", "Great Axe", "Colossal Sword"], W4),
};
// Cris: where a class says "funguy shop", every other variant of that class (the shop blueprints) also rolls there.
// Anything left after that is a Halloween weapon, which only rolls in World 4.
const listed = new Set(allWeapons.filter((w) => w.worlds.length).map((w) => w.id));
for (const w of allWeapons.filter((x) => !listed.has(x.id))) {
  for (const world of [2, 3, 4]) {
    const p = weaponPools[world].pools[w.class];
    if (p?.shop) { p.items.push([w.id]); inWorld(w, world); w.tag = "shop"; }
  }
  if (!w.worlds.length && weaponPools[4].pools[w.class]) { weaponPools[4].pools[w.class].items.push([w.id]); inWorld(w, 4); w.tag = "halloween"; }
  if (!w.worlds.length) w.verified = false; // class does not exist in any world we know
}
for (const world of [2, 3, 4]) for (const p of Object.values(weaponPools[world].pools)) p.shop = false;
// The site shows Worlds 1 and 2 together, so World 1-only weapons sit in that pool with a "World 1 only" tag.
const WORLD_1_ONLY = new Set(["Comically Large Spoon"]);
for (const w of allWeapons) if (WORLD_1_ONLY.has(w.name)) { w.worlds = [1]; w.tag = "world1"; }
const weapons = allWeapons.map((w) => ({ ...w, worlds: w.worlds.sort() }));

// ---------- armour
// Where each set can be forged, from the wiki's armour pages (rechecked 29 Oct 2026). Worlds: 1 Stonewake's Cross,
// 2 Forgotten Kingdom, 3 Frostspire Expanse, 4 Crimson Sakura. A list uses the set's normal 1/N everywhere;
// an object gives the 1/N in each world where it differs (e.g. Knight is 1/1 in Worlds 1–2 but 1/5 in World 3).
const ARMOUR_WORLDS = {
  "Basic": [1, 2, 3], // Light and Medium: not in Crimson Sakura
  "Ninja's": [4],
  "Samurai": { 2: 2, 3: 2, 4: 1 }, // not in Stonewake's Cross
  "Viking": [3],
  "Rootguard": [4],
  "Knight": { 1: 1, 2: 1, 3: 5 },
  "Dark Knight": { 2: 2, 3: 1, 4: 1 }, // not in Stonewake's Cross
  "Wolf": [3],
  "Goblin's": [3, 4],
  "Raven's": [3],
  "Vanguard": [4],
  "Shogun": [4],
};
const armour = csv("class,name,slot,base_health_pct").slice(1).map(([cls, name, slot, hp, price, chance]) => {
  const set = name.replace(/ (Helmet|Chestplate|Leggings|Armor|Crown)$/, "").replace(/^(Light|Medium)$/, "Basic");
  const where = ARMOUR_WORLDS[set];
  if (!where) throw new Error(`No worlds for armour set ${set}`);
  const weight = num(chance); // Wolf 1/3 and Raven 1/8 confirmed in game by Cris, 24 Oct 2026
  const worlds = Array.isArray(where) ? where : Object.keys(where).map(Number);
  const worldWeights = Array.isArray(where) ? null : Object.fromEntries(Object.entries(where).filter(([, w]) => w !== weight));
  return {
    id: slug(name), name, weightClass: cls, set, slot, healthPct: num(hp), price: num(price), weight, worlds,
    ...(worldWeights && Object.keys(worldWeights).length ? { worldWeights } : {}),
    verified: !(name === "Vanguard Helmet" || name === "Vanguard Leggings"),
  };
});

// ---------- molds
// How many Weapon or Armor Molds make the game's mold screen show 100% for an item. This is NOT the item's 1/N:
// Dark Knight's Gauntlets is 1/6 but needs 70. Every number below was checked in game by Cris on 28 Oct 2026
// (screenshots or written down from the game). "seen" is the worlds it was checked in (2 = Worlds 1–2); an
// item uses the same number in every world. "ores" is the minimum ores the mold screen showed, which is always
// the class's lock number. Not listed (blank, never 0): Funguy shop blueprints Cris doesn't own, Halloween
// weapons, Comically Large Spoon, Boxing Gloves, Crusader Sword, Dark Knight's Greatsword, Anchored Greatsword,
// The Carver, Greater Battle Axe, Kinmon Kamagatana, Otsuchi and Sharktooth Odachi.
// Name differences from the game's mold screen: "Wytherin Axe" is our Wyvern Axe, "Spiked Halberd" our Halberd,
// "Ninja's Headgear" our Ninja's Helmet, "Shogun's ..." our Shogun ....
// Statuses the site understands: verified (exact, can show 100%), reported (player reports: "guaranteed if the
// report is right"), unverified (an estimate: never a guarantee).
const MOLDS_CHECKED = "2026-10-28";
// [item id, molds, minimum ores on the mold screen, worlds seen]
const WEAPON_MOLDS = [
  ["dagger", 2, 3, [2, 3]], ["gladius-daggers", 3, 3, [2, 3]], ["hook", 5, 3, [2, 3]],
  ["falchion-sword", 2, 9, [2, 3]], ["cutlass", 12, 9, [2, 3]], ["rapier", 15, 9, [2, 3]], ["chaos", 25, 9, [2, 3]], ["hook-blade", 38, 9, [3, 4]],
  ["ironhand", 3, 14, [2]], ["relevator", 25, 14, [2]], ["savage-claws", 40, 14, [2]], ["dark-knights-gauntlets", 70, 14, [2]],
  ["uchigatana", 2, 18, [2, 4]], ["tachi", 25, 18, [2, 4]],
  ["long-sword", 5, 24, [2]], ["zweihander", 20, 24, [2]], ["jacks-crest", 25, 24, [2]],
  ["double-battle-axe", 2, 31, [2, 3, 4]], ["scythe", 10, 31, [2, 3, 4]], ["batwing-reaver", 20, 31, [2, 3, 4]], ["wyvern-axe", 20, 31, [3, 4]], ["halberd", 40, 31, [4]],
  ["great-sword", 15, 50, [2, 3]], ["hammer", 15, 50, [2, 3]], ["skull-crusher", 30, 50, [2, 3]], ["dragon-slayer", 40, 50, [2, 3, 4]], ["excalibur", 150, 50, [3, 4]],
  ["mace", 2, 14, [3, 4]], ["spiked-mace", 5, 14, [3]], ["winged-mace", 12, 14, [3]], ["hammerhead-mace", 12, 14, [3]], ["grave-maker", 18, 14, [3]],
  ["tetsubo", 10, 14, [4]], ["kanabo", 12, 14, [4]],
  ["axe", 2, 18, [3]], ["battleaxe", 5, 18, [3]], ["curved-handle-axe", 10, 18, [3]], ["spade-armed-axe", 20, 18, [3]], ["duskwings-cleaver", 20, 18, [3]],
  ["spear", 2, 24, [3, 4]], ["trident", 15, 24, [3]], ["angelic-spear", 40, 24, [3]], ["knight-spear", 55, 24, [3]], ["compass-spear", 30, 24, [3]],
  ["shakujo", 15, 24, [4]], ["sodegarami", 40, 24, [4]], ["bo-staff", 50, 24, [4]], ["naginata", 40, 24, [4]],
  ["kunai", 2, 3, [4]], ["jitte", 2, 3, [4]], ["damascus-dagger", 3, 3, [4]], ["tanto", 3, 3, [4]],
  ["chokuto", 10, 9, [4]], ["hachiwari", 15, 9, [4]], ["dragon-blade", 35, 9, [4]],
  ["juto-katana", 16, 18, [4]], ["kurokiba-gatana", 28, 18, [4]], ["washi-maru", 60, 18, [4]],
];
const ARMOUR_MOLDS = [
  ["light-helmet", 2, 3, [3]], ["light-leggings", 3, 11, [3]], ["light-chestplate", 3, 15, [3]],
  ["ninjas-helmet", 6, 3, [4]], ["ninjas-leggings", 8, 11, [4]], ["ninjas-armor", 8, 15, [4]],
  ["medium-helmet", 4, 20, [3]], ["medium-leggings", 5, 24, [3]], ["medium-chestplate", 6, 30, [3]],
  ["viking-helmet", 6, 20, [3]], ["viking-leggings", 8, 24, [3]], ["viking-chestplate", 12, 30, [3]],
  ["samurai-helmet", 5, 20, [4]], ["samurai-leggings", 6, 24, [4]], ["samurai-chestplate", 10, 30, [4]],
  ["rootguard-helmet", 12, 20, [4]], ["rootguard-leggings", 15, 24, [4]], ["rootguard-chestplate", 20, 30, [4]],
  ["knight-helmet", 10, 35, [2, 3]], ["knight-leggings", 11, 42, [2, 3]], ["knight-chestplate", 15, 52, [2, 3]],
  ["dark-knight-helmet", 15, 35, [2, 4]], ["dark-knight-leggings", 18, 42, [2, 4]], ["dark-knight-chestplate", 22, 52, [2, 4]],
  ["wolf-helmet", 24, 35, [3]], ["wolf-leggings", 28, 42, [3]], ["wolf-chestplate", 28, 52, [3]],
  ["ravens-helmet", 25, 35, [3]], ["ravens-leggings", 27, 42, [3]], ["ravens-chestplate", 30, 52, [3]],
  ["goblins-crown", 22, 35, [4]],
  ["vanguard-helmet", 30, 35, [4]], ["vanguard-leggings", 33, 42, [4]], ["vanguard-chestplate", 35, 52, [4]],
  ["shogun-helmet", 40, 35, [4]], ["shogun-leggings", 42, 42, [4]], ["shogun-chestplate", 45, 52, [4]],
];
const REDDIT = "https://www.reddit.com/r/TheForgeRoblox/comments/";
// Player reports that matched before the in-game check, kept as extra sources.
const EARLIER_REPORTS = {
  "dark-knights-gauntlets": [
    { url: `${REDDIT}1wb8otn/best_dps_in_the_game_vs_my_fav_weapon_i_made/`, date: "2026-09-09", note: "Player report: crafted with 14 Kitsunite and 70 Weapon Molds" },
    { url: `${REDDIT}1wbx2js/best_weapon_armor_recipes/`, date: null, note: "Player report: recommends 70 molds" },
    { url: `${REDDIT}1wd1jeu/do_i_change_anything_i_dont_have_any_more_vooite/`, date: null, note: "Player report: lists 70" },
  ],
  "excalibur": [{ url: `${REDDIT}1wd1jeu/do_i_change_anything_i_dont_have_any_more_vooite/`, date: null, note: "Player report: lists 150" }],
};
const moldRequirements = [...WEAPON_MOLDS.map((r) => ["weapon", ...r]), ...ARMOUR_MOLDS.map((r) => ["armour", ...r])].map(([kind, itemId, molds, minOres, seen]) => ({
  itemId, kind, worlds: seen, exact: molds, reported: molds, approximate: false, status: "verified", minOres, checked: MOLDS_CHECKED,
  reports: 1 + (EARLIER_REPORTS[itemId]?.length ?? 0),
  sources: [{ url: null, date: MOLDS_CHECKED, note: "Checked in game by Cris" }, ...(EARLIER_REPORTS[itemId] ?? [])],
}));
const poolHas = (world, id) => Object.values(weaponPools[world].pools).some((p) => p.items.some(([x]) => x === id));
const seenNotInPool = [];
for (const r of moldRequirements) {
  const item = r.kind === "weapon" ? weapons.find((w) => w.id === r.itemId) : armour.find((a) => a.id === r.itemId);
  if (!item) throw new Error(`Mold requirement for unknown ${r.kind} ${r.itemId}`);
  if (r.status === "verified" && !(r.exact > 0)) throw new Error(`${r.itemId}: verified needs an exact number`);
  if (r.status !== "verified" && r.exact != null) throw new Error(`${r.itemId}: only verified entries have an exact number`);
  if (new Set(moldRequirements.map((x) => x.itemId)).size !== moldRequirements.length) throw new Error("Duplicate mold requirement");
  for (const w of r.worlds) {
    const there = r.kind === "weapon" ? poolHas(w, r.itemId) : item.worlds.includes(w);
    if (!there) seenNotInPool.push(`${r.itemId} (World ${w === 2 ? "1-2" : w})`);
  }
}
// Items Cris saw on a world's mold screen that our world lists don't have there yet (waiting for confirmation).
if (seenNotInPool.length) console.log(`molds seen outside our world lists: ${seenNotInPool.join(", ")}`);

const catalogue = {
  generatedFrom: "docs/PRD.md",
  ores: [...ores.values()].map((o) => ({ ...o, rule: o.rule ?? "fixed" })),
  weapons,
  armour,
  weaponPools,
  // Kept so sites running the previous version keep working with this data until they update.
  weaponClasses: { early: weaponPools[2].classes, late: weaponPools[3].classes },
  armourClasses: [["Light", "helmet"], ["Light", "leggings"], ["Light", "chestplate"], ["Medium", "helmet"], ["Medium", "leggings"], ["Medium", "chestplate"], ["Heavy", "helmet"], ["Heavy", "leggings"], ["Heavy", "chestplate"]],
  odds: { weapon: oddsTable("ores,slot1_dagger,"), armour: oddsTable("ores,light_helmet,") },
  locks: { weapon: [3, 9, 14, 18, 24, 31, 50], armour: [3, 11, 15, 20, 24, 30, 35, 42, 52] },
  moldRequirements,
  qualityTiers: [["Broken", 0], ["Poor", 25], ["Rough", 40], ["Average", 50], ["Good", 65], ["Great", 75], ["Excellent", 85], ["Perfect", 90], ["Masterwork", 95]],
};
// Revision goes up by one whenever the data changes, so the site can tell which copy is newer:
// the bundled file or the latest Supabase release.
const out = new URL("../data/catalogue.json", import.meta.url);
const hash = createHash("sha256").update(JSON.stringify(catalogue)).digest("hex").slice(0, 16);
// Read the previous copy directly (no exists-check first, which CodeQL flags as a race); a missing file means a first build.
let prev = {};
try { prev = JSON.parse(readFileSync(out, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
const revision = prev.contentHash === hash ? prev.revision : (prev.revision ?? 6) + 1;
writeFileSync(out, JSON.stringify({ revision, contentHash: hash, ...catalogue }) + "\n");
console.log(`revision ${revision} (${hash})`);
console.log(`shop: ${weapons.filter((w) => w.tag === "shop").map((w) => w.name).join(", ")}`);
console.log(`halloween: ${weapons.filter((w) => w.tag === "halloween").map((w) => w.name).join(", ")}`);
console.log(`no world: ${weapons.filter((w) => !w.worlds.length).map((w) => w.name).join(", ")}`);
console.log(`ores ${catalogue.ores.length}, traits ${catalogue.ores.reduce((n, o) => n + o.traits.length, 0)}, weapons ${weapons.length}, armour ${armour.length}`);
