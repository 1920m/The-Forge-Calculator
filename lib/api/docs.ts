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
  WORLD_FROM_ORES: "You didn't send `world` and the item can be forged in more than one; the only world where all your ores are found was used.",
  CLASS_NOT_AVAILABLE: "The item's class can't come out with this many ores, so its chance is 0%.",
  LOCK_NOT_AVAILABLE: "`lockClass` was sent but there aren't enough ores to lock the class yet, so the normal odds are used.",
  ODDS_CAPPED: "More than 55 ores: odds are only known up to 55, so the 55-ore odds are used.",
  SHOP_ITEMS_MISSING: "The class also has shop-blueprint weapons that aren't in the data, so chances inside it may be a little high.",
  MOLD_EFFECT_UNKNOWN: "Fewer molds than needed: how that changes the real chances isn't measured, so the chances shown are without them.",
  SITUATIONAL_BONUSES_OFF: "The race has situational bonuses (low HP, stacks...). Send `conditions` to see them separately in `scenarios`.",
  ABYSS_FORGE_ONLY: "The item is forged only at the Abyss Forge: its chance at the normal forge is 0%. Send `\"forge\": \"abyss\"` (World 4) for its Abyss Forge chance. Its stats are real.",
  ABYSS_FORGE_NOT_HERE: "`\"forge\": \"abyss\"` was sent for another world. The Abyss Forge is next to World 4, so the normal forge was used.",
  CLASS_ODDS_UNKNOWN: "The item's weapon type (Halberd or Sword & Shield) came after the forge odds were taken from the game, so its chance at each ore count isn't known: the overall chance is 0%, its chance inside the class and its stats are real.",
  DEFENCE_ONLY: "Every loadout: armour adds its defence at +0 and the damage traits counted in DPS; health, shields and other effects aren't added up.",
  GOLEMITE_TRAITS_UNVERIFIED: "Every Golemite result: the player gets all of its ore traits (weapon and armour, see `byType`); whether quality changes them isn't confirmed in game.",
};

export const CHANGELOG = [
  { version: "v1 beta", date: "2026-11-16", notes: ["New items (theforge.gg, game version 1.10): Devil's Deed, Moon Crescent Spear, Royal Guardian's Glaive, Spiked Halberd, Fangtian, Knight's Bulwark and Rosethorn, and the Gloomwarden's, Voidstrider's and Dreadhorn's armour sets.", "forge requests take `forge: \"abyss\"` for the Abyss Forge next to World 4: World 4's items plus the Abyss items at their own 1/N. New warnings ABYSS_FORGE_NOT_HERE and CLASS_ODDS_UNKNOWN; ABYSS_FORGE_ONLY now points to the option.", "Halberd and Sword & Shield are their own weapon classes. Their chance at each ore count isn't known yet, so their items have a 0% overall chance (`oddsKnown: false`, no lock)."] },
  { version: "v1 beta", date: "2026-11-12", notes: ["DPS now follows the wiki's calculator exactly, which matched an in-game test within 1%: enhancement grows only hits (procs stay at +0 damage), proc chances are rolled like the game (one of 101), and burn, poison, black hole and lightning use its formulas. The PROC_ENHANCEMENT_UNVERIFIED warning is gone.", "Checked in game: a hits-only Excalibur matches to 1% at +0 and +9, and Bismuth's Lethality, crit chance and crit damage only work on armour, so they no longer count on weapons. Bismuth's Prismatic Shift (a random attack rune effect on hit) is now counted, estimated from in-game tests; the wiki's data split it by 8.", "Every ore page on the wiki was compared with our data: Fireite and Gargantuan burn for 10% a second (was 20%), Voidstar has 33.3% crit chance, Kokorite's, Sealed Curse's and Yin's Berserker is armour-only, and trait texts for Azuryxite, Bismuth, Tetrinite and Vooite were corrected.", "Burn and poison uptime is now 1 − (1 − chance)^(hits in the duration), black holes need a 10%+ share of Galaxite and Bismuth's wave a 10%+ share of Bismuth, and a Golemite's black hole uses its own scaled chance. The Dark Knight's Gauntlets example is now 2451.43 (4949.9 at +9 with Blast Chip III).", "Weapon damage and swing times now have the game's precision (Data:Weapons.json), Bismuth's traits follow the wiki's 8 Nov data, and Golemites from level 13 add their own hits (golemite `combat.hitShare`). Model version 2026-11-12."] },
  { version: "v1 beta", date: "2026-11-08", notes: ["Version 1.10 ores: Echotite, Frost Core, Tetrinite, Bizzarite, Frost Star and Royal Boneite, with their traits.", "New DPS effects: Reverberation, Frost Slash, Glacier Explosion, Starfall, Stellar Mark and Ancient Poison; Frost Core's armour Lethality and crit damage. Model version 2026-11-08.2."] },
  { version: "v1 beta", date: "2026-11-08", notes: ["Version 1.10 races: Imp and Fallen Angel, with their DPS effects; every race's text updated.", "Angelic Spear and Demonic Spear buffs; Jack's Crest, The Carver and Coffin's Lid fixed. Model version 2026-11-08."] },
  { version: "v1 beta", date: "2026-11-04", notes: ["First release: GET /catalogue and POST /calculate (forge, dps, loadout, golemite).", "Keys by invitation; the catalogue also needs a key during the beta."] },
];
