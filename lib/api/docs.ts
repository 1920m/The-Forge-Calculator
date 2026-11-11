/**
 * What the developer page shows: example requests run through the real engine (so the documented responses are what the
 * API returns), the warning codes, and the changelog.
 */
import type { Catalogue } from "@/lib/engine/forge";
import { buildCatalogue } from "./catalogue";
import { calculate } from "./calculate";
import { CalculateRequest } from "./schema";
import { API_VERSION, DATA_VERSION, MODEL_VERSION } from "./version";

const DKG_ORES = [{ id: "galaxite", count: 5 }, { id: "kyubite", count: 5 }, { id: "fierce-jade", count: 5 }, { id: "bismuth", count: 1 }];

export const EXAMPLES = {
  forge: { type: "forge", kind: "weapon", item: "dark-knights-gauntlets", ores: DKG_ORES },
  dps: {
    type: "dps", weapon: { item: "dark-knights-gauntlets", ores: DKG_ORES }, enhancement: 9,
    runes: [{ id: "blast-chip", level: 3, secondaries: ["crit_chance", "lethality", "atk_speed"] }],
  },
  loadout: {
    type: "loadout", weapon: { item: "dark-knights-gauntlets", ores: DKG_ORES },
    chestplate: { item: "dark-knight-chestplate", ores: [{ id: "vanegos", count: 10 }, { id: "galaxite", count: 10 }] },
    enhancement: 9, race: "kitsune",
  },
  golemite: { type: "golemite", ores: [{ id: "lucky-cat", count: 10 }] },
} as const;

export type ExampleType = keyof typeof EXAMPLES;

const revisionOf = (cat: Catalogue) => Number((cat as { revision?: number }).revision) || 0;

/** The full response the API gives for one of the examples (with a placeholder request ID). */
export function exampleResponse(cat: Catalogue, type: ExampleType) {
  const out = calculate(cat, CalculateRequest.parse(EXAMPLES[type]));
  return {
    success: true, apiVersion: API_VERSION, catalogueRevision: revisionOf(cat), dataVersion: DATA_VERSION, calculationModelVersion: MODEL_VERSION,
    requestId: "req_example", data: out.data, warnings: out.warnings,
  };
}

export function exampleCatalogue(cat: Catalogue) {
  return { success: true, apiVersion: API_VERSION, catalogueRevision: revisionOf(cat), dataVersion: DATA_VERSION, requestId: "req_example", data: buildCatalogue(cat, { type: "ores", ids: ["bismuth"] }) };
}

/** Cuts long lists down to their first items so a response fits on the page. */
export function shorten(v: unknown, keep = 3): unknown {
  if (Array.isArray(v)) return v.slice(0, keep).map((x) => shorten(x, keep));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shorten(x, keep)]));
  return v;
}

/** Every warning `calculate` can add (a test keeps this in step with lib/api/calculate.ts). */
export const WARNINGS: Record<string, string> = {
  ESTIMATED_DPS: "The response has a DPS figure. It comes from the community damage model (crits, procs and damage over time averaged), so it's an estimate, not a measurement from the game.",
  PROC_ENHANCEMENT_UNVERIFIED: "Enhancement above +0: burn, explosions and other procs are grown with it too, which isn't confirmed in game.",
  WORLD_FROM_ORES: "You didn't send `world` and the item can be forged in more than one; the only world where all your ores are found was used.",
  CLASS_NOT_AVAILABLE: "The item's class can't come out with this many ores, so its chance is 0%.",
  LOCK_NOT_AVAILABLE: "`lockClass` was sent but there aren't enough ores to lock the class yet, so the normal odds are used.",
  ODDS_CAPPED: "More than 55 ores: odds are only known up to 55, so the 55-ore odds are used.",
  SHOP_ITEMS_MISSING: "The class also has shop-blueprint weapons that aren't in the data, so chances inside it may be a little high.",
  MOLD_EFFECT_UNKNOWN: "Fewer molds than needed: how that changes the real chances isn't measured, so the chances shown are without them.",
  SITUATIONAL_BONUSES_OFF: "The race has situational bonuses (low HP, stacks...). Send `conditions` to see them separately in `scenarios`.",
  ABYSS_FORGE_ONLY: "The item is forged only at the Abyss Forge (Version 1.10), whose odds aren't published: its chance is 0% here, its stats are real.",
  DEFENCE_ONLY: "Every loadout: armour adds its defence at +0 and the damage traits counted in DPS; health, shields and other effects aren't added up.",
  GOLEMITE_TRAITS_UNVERIFIED: "Every Golemite result: the player gets all of its ore traits (weapon and armour, see `byType`); whether quality changes them isn't confirmed in game.",
};

export const CHANGELOG = [
  { version: "v1 beta", date: "2026-11-08", notes: ["Version 1.10 ores: Echotite, Frost Core, Tetrinite, Bizzarite, Frost Star and Royal Boneite, with their traits.", "New DPS effects: Reverberation, Frost Slash, Glacier Explosion, Starfall, Stellar Mark and Ancient Poison; Frost Core's armour Lethality and crit damage. Model version 2026-11-08.2."] },
  { version: "v1 beta", date: "2026-11-08", notes: ["Version 1.10 races: Imp and Fallen Angel, with their DPS effects; every race's text updated.", "Angelic Spear and Demonic Spear buffs; Jack's Crest, The Carver and Coffin's Lid fixed. Model version 2026-11-08."] },
  { version: "v1 beta", date: "2026-11-04", notes: ["First release: GET /catalogue and POST /calculate (forge, dps, loadout, golemite).", "Keys by invitation; the catalogue also needs a key during the beta."] },
];
