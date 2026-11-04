/**
 * Request shapes for POST /api/v1/calculate, checked at runtime (zod) and published as JSON Schema in the docs, from
 * this one definition. Limits come from the game rules already in the code (4 ore types, 99 of each, quality 1–100,
 * enhancement 0–9, 3 rune slots, 10–50 ores for a Golemite).
 */
import * as z from "zod";
import { MAX_ORES, MAX_TYPES } from "@/lib/forge-slots";
import { MAX_ENHANCE } from "@/lib/engine";
import { MAX_RUNE_SLOTS } from "@/lib/engine/runes";
import { MAX_MOLDS } from "@/lib/engine/molds";
import { GOLEMITE } from "@/data/golemites";

const id = z.string().regex(/^[a-z0-9-]{1,60}$/, "Use a catalogue ID: lowercase letters, digits and dashes.");
const ore = z.strictObject({ id, count: z.int().min(1).max(MAX_ORES) });
const ores = z.array(ore).min(1).max(MAX_TYPES)
  .refine((list) => new Set(list.map((o) => o.id)).size === list.length, "Each ore can only appear once; add the counts together.");
const world = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const quality = z.int().min(1).max(100);
const enhancement = z.int().min(0).max(MAX_ENHANCE);
const rune = z.strictObject({
  id,
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  secondaries: z.array(z.string().regex(/^[a-z_]{1,30}$/)).max(3).default([]),
});
const runes = z.array(rune.nullable()).max(MAX_RUNE_SLOTS);
const conditions = z.strictObject({
  lowHp: z.boolean().optional(),
  orcLordMissingHp: z.number().min(0).max(1).optional(),
  orcLordKills: z.int().min(0).max(5).optional(),
  dryadGrove: z.boolean().optional(),
  maxHp: z.int().min(0).max(1_000_000).optional(),
  kitsuneDodge: z.boolean().optional(),
});
const piece = z.strictObject({ item: id, ores, quality: quality.default(100) });

export const ForgeRequest = z.strictObject({
  type: z.literal("forge"),
  kind: z.enum(["weapon", "armour"]),
  /** The item you're aiming for (its catalogue ID). Without it, the most likely item is shown. */
  item: id.optional(),
  /** 1–4. Optional when the item and ores settle it; 1 and 2 share one forge. */
  world: world.optional(),
  ores,
  quality: quality.default(100),
  /** Lock the item's class (only counts once there are enough ores to lock it). */
  lockClass: z.boolean().default(false),
  /** Molds aimed at `item`. */
  molds: z.int().min(0).max(MAX_MOLDS).optional(),
  enhancement: enhancement.default(0),
  /** Weapon runes, one per slot (+3, +6, +9 open them). */
  runes: runes.optional(),
  /** "full" adds every class and item with its chances. */
  detail: z.enum(["summary", "full"]).default("summary"),
});

export const DpsRequest = z.strictObject({
  type: z.literal("dps"),
  weapon: piece,
  enhancement: enhancement.default(0),
  runes: runes.optional(),
  race: id.optional(),
  /** Ore mixes of the armour you wear, only for their damage traits (send `loadout` for defence too). */
  armour: z.array(z.strictObject({ ores })).max(3).optional(),
  conditions: conditions.optional(),
});

export const LoadoutRequest = z.strictObject({
  type: z.literal("loadout"),
  weapon: piece.optional(),
  helmet: piece.optional(),
  chestplate: piece.optional(),
  leggings: piece.optional(),
  enhancement: enhancement.default(0),
  runes: runes.optional(),
  race: id.optional(),
  conditions: conditions.optional(),
});

export const GolemiteRequest = z.strictObject({
  type: z.literal("golemite"),
  ores: ores.refine((list) => {
    const n = list.reduce((t, o) => t + o.count, 0);
    return n >= GOLEMITE.minOres && n <= GOLEMITE.maxOres;
  }, `A Golemite takes ${GOLEMITE.minOres} to ${GOLEMITE.maxOres} ores in all.`),
  quality: quality.default(100),
  /** Growth level, 0 to 25 (one Golem Snack a day). */
  level: z.int().min(0).max(GOLEMITE.maxLevel).default(0),
});

export const CalculateRequest = z.discriminatedUnion("type", [ForgeRequest, DpsRequest, LoadoutRequest, GolemiteRequest]);
export type CalculateInput = z.infer<typeof CalculateRequest>;
export type ForgeInput = z.infer<typeof ForgeRequest>;
export type DpsInputBody = z.infer<typeof DpsRequest>;
export type LoadoutInput = z.infer<typeof LoadoutRequest>;
export type GolemiteInput = z.infer<typeof GolemiteRequest>;

/** Catalogue query string. */
export const CATALOGUE_TYPES = ["ores", "weapons", "armour", "classes", "races", "runes", "molds", "golemites", "pickaxes"] as const;
export const CatalogueQuery = z.strictObject({
  type: z.enum(CATALOGUE_TYPES).optional(),
  world: z.coerce.number().pipe(world).optional(),
  ids: z.string().max(2000).transform((s) => s.split(",").filter(Boolean)).pipe(z.array(id).max(100)).optional(),
  search: z.string().trim().min(1).max(60).optional(),
});

/** zod issues → small, safe list for the response. */
export function issues(e: z.ZodError) {
  return e.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message }));
}
