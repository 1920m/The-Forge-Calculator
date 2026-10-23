import { readFile, writeFile } from "node:fs/promises";

// PRD tables use different column orders. Resolve fields by their headers.
const directory = new URL("../supabase/seed/", import.meta.url);
const tables = JSON.parse(await readFile(new URL("source/ore-tables.raw.json", directory), "utf8"));
const prd = tables.flatMap(table => table.rows.map(row => Object.fromEntries(table.columns.map((column, index) => [column, row[index]]))));
const wiki = (await readFile(new URL("wiki-ores-2026-10-23.csv", directory), "utf8")).trim().split(/\r?\n/).slice(1).map(line => {
  const [name, multiplier, rarity] = line.split(",");
  return { name, multiplier: Number(multiplier), rarity };
});
const key = name => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const rarityKey = name => name.toLowerCase().replace("mythical", "mythic");
const prdMap = new Map(prd.map(row => [key(row.Ore), row]));
const wikiMap = new Map(wiki.map(row => [key(row.name), row]));
if (wiki.length !== 150 || wikiMap.size !== 150) throw new Error("Invalid wiki snapshot row count or duplicate ore names.");
const report = {
  source: "https://forgewiki.org/wiki/Ores",
  observed: "2026-10-23",
  pageLastEdited: "2026-10-20 16:44",
  attribution: "The Forge Official Roblox Wiki contributors; CC BY-SA 4.0. Adapted statistical snapshot from the displayed All Ores table.",
  license: "https://creativecommons.org/licenses/by-sa/4.0/",
  counts: { prd: prd.length, wiki: wiki.length },
  missingFromPrd: wiki.filter(row => !prdMap.has(key(row.name))),
  missingFromWiki: prd.filter(row => !wikiMap.has(key(row.Ore))).map(row => row.Ore),
  multiplierConflicts: wiki.flatMap(row => {
    const original = prdMap.get(key(row.name));
    const raw = original?.Multiplier;
    return original && Number(raw) !== row.multiplier ? [{ name: row.name, prd: raw, wiki: row.multiplier }] : [];
  }),
  rarityConflicts: wiki.flatMap(row => {
    const original = prdMap.get(key(row.name));
    return original && rarityKey(original.Rarity) !== rarityKey(row.rarity) ? [{ name: row.name, prd: original.Rarity, wiki: row.rarity }] : [];
  }),
  notes: [
    "Unverified secondary-source evidence. PRD and Cris's in-game evidence retain precedence; this report changes no production values.",
    "Mythical and Mythic are treated as naming aliases for comparison only.",
    "Fichilliumorite is listed as 1x on the wiki, while the PRD specifies a special average-of-other-ores rule; a scalar comparison cannot resolve that mechanic.",
    "Used For describes trait applicability, not proof that an ore cannot be forged into the other equipment kind. None does not mean unusable.",
    "The All Ores table provides mining sources but no full numerical trait effects. Individual ore pages and in-game evidence remain necessary for traits and exact world assignments."
  ]
};
const result = JSON.stringify(report, null, 2) + "\n";
const target = new URL("wiki-ore-audit.json", directory);
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")).replace(/\r\n/g, "\n") !== result) throw new Error("Ore audit is stale. Run node scripts/audit-wiki-ores.mjs.");
} else {
  await writeFile(target, result);
}
console.log(JSON.stringify(report, null, 2));
