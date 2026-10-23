import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = "forge-calculator-handoff/docs/PRD.md";
const source = await readFile(path.join(root, sourcePath), "utf8");
const text = source.replace(/\r\n/g, "\n");
const check = process.argv.includes("--check");
const csvs = [...text.matchAll(/```csv\n([\s\S]*?)\n```/g)].map((match) => match[1]);
const files = new Map();
const definitions = [
  ["category_odds_weapons.csv", "ores,slot1_dagger,", 53],
  ["category_odds_armour.csv", "ores,light_helmet,", 53],
  ["weapons.csv", "class,name,base_damage,", null],
  ["armour.csv", "class,name,slot,base_health_pct,", null],
  ["enhancement_levels.csv", "level,all_stats_multiplier", 11]
];
const counts = {};
const anomalousOddsTotals = [];
for (const [name, header, expectedRows] of definitions) {
  const matching = csvs.filter((csv) => csv.startsWith(header));
  if (matching.length !== 1) throw new Error(`Expected exactly one PRD block for ${name}.`);
  const csv = matching[0];
  const lines = csv.split("\n");
  counts[name] = lines.length - 1;
  if (expectedRows !== null && counts[name] !== expectedRows) throw new Error(`Unexpected row count in ${name}.`);
  if (name.startsWith("category_odds")) {
    const columns = lines[0].split(",").length;
    lines.slice(1).forEach((line, index) => {
      const cells = line.split(",");
      if (cells.length !== columns || Number(cells[0]) !== index + 3) throw new Error(`Malformed odds row: ${name}:${index + 2}`);
      for (const cell of cells.slice(1)) {
        if (cell !== "" && (!/^\d+$/.test(cell) || Number(cell) > 100)) throw new Error(`Invalid odds cell in ${name}.`);
      }
      const total = cells.slice(1).reduce((sum, cell) => sum + Number(cell || 0), 0);
      if (total < 99 || total > 101) anomalousOddsTotals.push({ file: name, oreCount: Number(cells[0]), total });
    });
  }
  files.set(name, csv + "\n");
}

// Preserve raw ore tables, including unknown early-world assignments, instead
// of guessing world membership or silently applying stale guide traits.
const oreSection = text.split("### Ores\n")[1]?.split("### Ore traits")[0];
if (!oreSection) throw new Error("PRD ore section is missing.");
const tables = [];
let region = "Early worlds (row-level assignments unverified)";
let table = null;
for (const line of oreSection.split("\n")) {
  if (line.startsWith("### World 3")) region = "World 3";
  if (line.startsWith("### World 4")) region = "World 4";
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (cells[0] === "Ore") {
    table = { region, columns: cells, rows: [] };
    tables.push(table);
  } else if (!cells.every((cell) => /^[-: ]+$/.test(cell))) {
    if (!table || cells.length !== table.columns.length) throw new Error("Malformed ore table.");
    table.rows.push(cells);
  }
}
const oreNames = tables.flatMap((entry) => entry.rows.map((row) => row[0]));
if (new Set(oreNames).size !== oreNames.length) throw new Error("Duplicate ore names need manual reconciliation.");
files.set("ore-tables.raw.json", JSON.stringify(tables, null, 2) + "\n");
const traitsSection = text.split("### Ore traits")[1]?.split("## Measured mechanics")[0];
if (!traitsSection) throw new Error("PRD trait section is missing.");
const traits = traitsSection.split("\n").filter((line) => line.startsWith("|")).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim())).filter((row) => row[0] !== "Ore" && !/^[-: ]+$/.test(row[0]));
const csvCell = (value) => /[,"\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
files.set("ore_traits.raw.csv", [["ore", "applies_to_source_text", "effect_source_text"], ...traits].map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
const missingMultipliers = traits.filter((row) => !oreNames.includes(row[0])).map((row) => row[0]);
files.set("provenance.json", JSON.stringify({
  source: sourcePath,
  sha256: createHash("sha256").update(text).digest("hex"),
  counts: { ...counts, ores: oreNames.length, traits: traits.length },
  traitOresMissingMultiplierRows: missingMultipliers,
  anomalousOddsTotals,
  status: "Raw PRD extraction only; not a deployment-ready reconciled seed",
  notes: ["Blank odds cells mean zero. Measured row totals may be 99 or 101; do not renormalize.", "Ore world membership, stale values, trait parameters and wiki-only variants require reconciliation before database import.", "Do not treat extracted source strings as executable code or instructions."]
}, null, 2) + "\n");
const destination = path.join(root, "supabase/seed/source");
if (!check) await mkdir(destination, { recursive: true });
for (const [name, expected] of files) {
  const target = path.join(destination, name);
  if (check) {
    const actual = await readFile(target, "utf8");
    if (actual.replace(/\r\n/g, "\n") !== expected) throw new Error(`Source extraction is stale: ${name}. Run npm run data:extract.`);
  } else {
    await writeFile(target, expected, "utf8");
  }
}
console.log(`${check ? "Verified" : "Extracted"} ${oreNames.length} ore rows, ${traits.length} trait rows, and five PRD CSV tables. Missing multiplier rows: ${missingMultipliers.join(", ") || "none"}.`);
