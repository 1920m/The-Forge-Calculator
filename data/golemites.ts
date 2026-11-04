/**
 * Golemites (called Golems in the game's data): companions crafted in the forge, from the Forge wiki
 * (https://forgewiki.org/wiki/Golemite, Golemite_Snack and Guide/Golemite, read 3 Nov 2026). Added in 1.09.1 (20 Oct 2026).
 * Checked in game (4 Nov 2026): crafted in Worlds 3 and 4 from 10 to 50 ores; the card shows "<main ore> Golemite",
 * class Golem, the main ore's rarity, and that rarity's mining help and ore-trait share (Lucky Cat: Epic, 23%, 15%).
 */
import type { Rarity } from "@/lib/engine/forge";

export const GOLEMITE = {
  /** Ores in a Golemite craft. */
  minOres: 10,
  maxOres: 50,
  /** Worlds whose forge can craft them. */
  worlds: [3, 4] as readonly number[],
  /** Ores a Golemite can carry for you. */
  storage: 50,
  /** Growth: one Golem Snack a day gives one level. */
  maxLevel: 25,
  /** Golemites can fight from this growth level. */
  combatLevel: 13,
  /** Size grows 1% a level. */
  sizePerLevel: 0.01,
  /** Players start with one slot; the second opens at this player level. */
  secondSlotLevel: 300,
} as const;

/**
 * Mining help and how strongly ore traits carry over, by rarity ("23% mining help", "15% ore traits" on an Epic card).
 * Rarity is the main ore's, like weapons and armour.
 */
export const GOLEMITE_RARITY: Record<Rarity, { mining: number; traits: number }> = {
  Common: { mining: 0.1, traits: 0.06 },
  Uncommon: { mining: 0.14, traits: 0.08 },
  Rare: { mining: 0.18, traits: 0.12 },
  Epic: { mining: 0.23, traits: 0.15 },
  Legendary: { mining: 0.29, traits: 0.18 },
  Mythic: { mining: 0.35, traits: 0.23 },
  Relic: { mining: 0.4, traits: 0.25 },
  Exotic: { mining: 0.45, traits: 0.28 },
  Divine: { mining: 0.5, traits: 0.3 },
};

export const GOLEMITE_SOURCE = { url: "https://forgewiki.org/wiki/Golemite", checked: "3 Nov 2026" };
