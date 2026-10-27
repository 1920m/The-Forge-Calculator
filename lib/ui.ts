export const RARITY_COLOURS: Record<string, string> = {
  Common: "#8a8a8a", Uncommon: "#5a9a52", Rare: "#4a7fc0", Epic: "#8a5cc9", Legendary: "#d1a042",
  Mythic: "#c24a4a", Relic: "#c47a3a", Exotic: "#3fbfa8", Divine: "#e8d48a",
};
export const RARITY_ORDER = Object.keys(RARITY_COLOURS);
export const rarityColour = (r: string | null | undefined) => (r && RARITY_COLOURS[r]) || "#3a3834";
export const pct = (v: number, d = 1) => `${Number(v.toFixed(d))}%`;
export const fmt = (v: number | null | undefined, d = 2) => (v == null ? "–" : v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: d }));
/** An ore's multiplier as shown on tiles. Fichilliumorite and Bismuth take the other ores' average when forging. */
export const multLabel = (o: { multiplier: number; rule?: string }) => (o.rule === "average" ? "Avg" : `${o.multiplier}x`);
export const worldLabel = (worlds: number[]) => (worlds.length >= 4 ? "All" : worlds.join(" and "));

/**
 * Verification labels ("Confirmed in game", "Derived", "Unverified", "Wiki only") and the partner-badge slot.
 * Hidden until the site partners with the game's developers; set to true to bring them all back.
 */
export const SHOW_STATUS_LABELS = false;
