/**
 * Three separate version numbers:
 * - API_VERSION: the shape of requests and responses (/api/v1). Only changes with a new path.
 * - catalogueRevision: the game data release (Supabase catalogue_releases), per response.
 * - MODEL_VERSION: the date the maths last changed in a way that changes numbers (enhancement table, DPS model...).
 * - DATA_VERSION: a short hash of the data that ships with each deploy (races, runes, molds, Golemites, armour traits).
 */
import { createHash } from "node:crypto";
import { RACES } from "@/data/races";
import { RUNES, SECONDARIES } from "@/data/runes";
import { MOLDS } from "@/data/molds";
import { GOLEMITE, GOLEMITE_RARITY } from "@/data/golemites";
import { ARMOUR_DPS } from "@/data/armour-dps";
import { PICKAXES } from "@/data/pickaxes";
import dpsStats from "@/data/dps-stats.json";

export const API_VERSION = "v1";
export const MODEL_VERSION = "2026-11-04";
export const DATA_VERSION = createHash("sha256")
  .update(JSON.stringify([RACES, RUNES, SECONDARIES, MOLDS, GOLEMITE, GOLEMITE_RARITY, ARMOUR_DPS, PICKAXES, dpsStats]))
  .digest("hex").slice(0, 12);
