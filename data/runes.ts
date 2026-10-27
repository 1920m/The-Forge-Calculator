/**
 * Weapon and armour runes, from the Forge wiki's Runes page (https://forgewiki.org/wiki/Runes, last edited 6 September 2026).
 * Each level's text is the wiki's range; the numbers we calculate with are the best roll of each range
 * ("perfect" runes): highest chance, damage and duration, lowest cooldown.
 *
 * Rules the site uses (from the player, 27 Oct 2026, not on the wiki): an item gets a rune slot at +3, +6 and +9
 * (3 at most); a level I, II or III rune can carry 1, 2 or 3 secondary traits; the same rune can fill several
 * slots and each copy adds its effect again.
 */

export type RuneKind = "weapon" | "armour";
export type RuneLevel = 1 | 2 | 3;

/** Damage a rune adds on hit, at the best roll. Shares are of weapon damage; seconds for durations and cooldowns. */
export type RuneProc =
  | { type: "poison" | "burn"; chance: number; dmg: number; dur: number }
  | { type: "explosion"; chance: number; dmg: number }
  | { type: "lightning"; chance: number; dmg: number; cd: number; targets: number };

export type RuneTier = { text: string; proc?: RuneProc; shield?: { chance: number; cut: number } };
export type Rune = { id: string; name: string; kind: RuneKind; effect: string; levels: [RuneTier, RuneTier, RuneTier]; from: string; aka?: string };

export const RUNES: Rune[] = [
  { id: "blast-chip", name: "Blast Chip", kind: "weapon", effect: "Explosion", from: "Bomber", levels: [
    { text: "8–20% chance on hit to trigger an explosion dealing 20–40% weapon damage as AoE.", proc: { type: "explosion", chance: 0.2, dmg: 0.4 } },
    { text: "20–35% chance on hit to trigger an explosion dealing 40–60% weapon damage as AoE.", proc: { type: "explosion", chance: 0.35, dmg: 0.6 } },
    { text: "35–50% chance on hit to trigger an explosion dealing 60–80% weapon damage as AoE.", proc: { type: "explosion", chance: 0.5, dmg: 0.8 } },
  ] },
  { id: "flame-spark", name: "Flame Spark", kind: "weapon", effect: "Burn", from: "Deathaxe Skeleton, Elite Deathaxe Skeleton, Blazing Slime, Reaper, Hellflame Oni", levels: [
    { text: "15–25% chance on hit to deal 5–10% weapon damage as fire per second for 1–2s.", proc: { type: "burn", chance: 0.25, dmg: 0.1, dur: 2 } },
    { text: "20–50% chance on hit to deal 10–22% weapon damage as fire per second for 2–3s.", proc: { type: "burn", chance: 0.5, dmg: 0.22, dur: 3 } },
    { text: "45–75% chance on hit to deal 18–35% weapon damage as fire per second for 3–5s.", proc: { type: "burn", chance: 0.75, dmg: 0.35, dur: 5 } },
  ] },
  { id: "venom-crumb", name: "Venom Crumb", kind: "weapon", effect: "Poison", from: "Blight Pyromancer", levels: [
    { text: "25–35% chance on hit to deal 4–7% weapon damage as poison per second for 3–6s.", proc: { type: "poison", chance: 0.35, dmg: 0.07, dur: 6 } },
    { text: "35–65% chance on hit to deal 7–13% weapon damage as poison per second for 6–10s.", proc: { type: "poison", chance: 0.65, dmg: 0.13, dur: 10 } },
    { text: "60–95% chance on hit to deal 13–20% weapon damage as poison per second for 10–14s.", proc: { type: "poison", chance: 0.95, dmg: 0.2, dur: 14 } },
  ] },
  { id: "thunder-shard", name: "Thunder Shard", aka: "Lightning Arc", kind: "weapon", effect: "Lightning", from: "Unknown", levels: [
    { text: "12–20% chance on hit to chain to up to 1–2 enemies within 12–15 studs for 25–40% damage (8–12s cooldown).", proc: { type: "lightning", chance: 0.2, dmg: 0.4, cd: 8, targets: 2 } },
    { text: "20–40% chance on hit to chain to up to 2–3 enemies within 15–20 studs for 40–65% damage (4–8s cooldown).", proc: { type: "lightning", chance: 0.4, dmg: 0.65, cd: 4, targets: 3 } },
    { text: "35–60% chance on hit to chain to up to 3–5 enemies within 18–25 studs for 60–100% damage (2–4s cooldown).", proc: { type: "lightning", chance: 0.6, dmg: 1, cd: 2, targets: 5 } },
  ] },
  { id: "drain-edge", name: "Drain Edge", kind: "weapon", effect: "Heal", from: "Reaper", levels: [
    { text: "Restores health equal to 4–11% of damage dealt per hit. Healing capped at 8% of max health." },
    { text: "Restores health equal to 11–19% of damage dealt per hit. Healing capped at 8% of max health." },
    { text: "Restores health equal to 19–28% of damage dealt per hit. Healing capped at 8% of max health." },
  ] },
  { id: "frost-speck", name: "Frost Speck", kind: "weapon", effect: "Freeze", from: "Crystal Spider, Diamond Spider, Prismarine Spider, Golem, Frostburn Oni", levels: [
    { text: "10–20% chance to freeze enemies for 1–2 seconds on hit (15–20s cooldown)." },
    { text: "15–40% chance to freeze enemies for 2–3 seconds on hit (12–17s cooldown)." },
    { text: "35–60% chance to freeze enemies for 3–5 seconds on hit (8–13s cooldown)." },
  ] },
  { id: "chill-dust", name: "Chill Dust", kind: "weapon", effect: "Slow", from: "Golem", levels: [
    { text: "20–30% chance on hit to slow enemy attack and movement speed by 5–15% for 2–3s." },
    { text: "25–60% chance on hit to slow enemy attack and movement speed by 12–32% for 3–7s." },
    { text: "50–95% chance on hit to slow enemy attack and movement speed by 28–45% for 7–10s." },
  ] },
  { id: "ward-patch", name: "Ward Patch", kind: "armour", effect: "Shield", from: "Monk Panda", levels: [
    { text: "5–15% chance on hit to reduce incoming damage by 6–14%.", shield: { chance: 0.15, cut: 0.14 } },
    { text: "10–24% chance on hit to reduce incoming damage by 11–22%.", shield: { chance: 0.24, cut: 0.22 } },
    { text: "20–33% chance on hit to reduce incoming damage by 18–28%.", shield: { chance: 0.33, cut: 0.28 } },
  ] },
  { id: "rage-mark", name: "Rage Mark", kind: "armour", effect: "Berserker", from: "Elite Skeleton Rogue, Common Orc, Elite Orc, Brute Oni, Savage Ape, Asura's Incarnate, Warlord Oni", levels: [
    { text: "Below 35% HP, grants 12–26% physical damage and movement speed for 4–7s (50–60s cooldown)." },
    { text: "Below 35% HP, grants 25–40% physical damage and movement speed for 6–11s (30–50s cooldown)." },
    { text: "Below 35% HP, grants 35–60% physical damage and movement speed for 10–18s (18–30s cooldown)." },
  ] },
  { id: "briar-notch", name: "Briar Notch", kind: "armour", effect: "Thorns", from: "Deathaxe Skeleton, Elite Deathaxe Skeleton, Samurai Ape", levels: [
    { text: "Reflects 2–10% of physical damage taken (capped at 5% max HP, 0.05s cooldown)." },
    { text: "Reflects 10–25% of physical damage taken (capped at 5% max HP, 0.05s cooldown)." },
    { text: "Reflects 20–35% of physical damage taken (capped at 5% max HP, 0.05s cooldown)." },
  ] },
  { id: "toxic-veins", name: "Toxic Veins", kind: "armour", effect: "Toxic aura", from: "Unknown", levels: [
    { text: "Below 35% HP, deals 5–15% poison damage around you for 4–8s (35–50s cooldown)." },
    { text: "Below 35% HP, deals 10–25% poison damage around you for 8–14s (25–40s cooldown)." },
    { text: "Below 35% HP, deals 20–40% poison damage around you for 10–20s (20–30s cooldown)." },
  ] },
];

/** Secondary traits ("side effects"), at the best roll. The wiki gives one range for every rune level. */
export type SecondaryId =
  | "atk_speed" | "lethality" | "crit_chance" | "crit_dmg" | "fracture"
  | "endurance" | "surge" | "vitality" | "swiftness" | "phase" | "stride";
export type Secondary = { id: SecondaryId; name: string; kind: RuneKind; best: number; range: string; text: string };

export const SECONDARIES: Secondary[] = [
  { id: "atk_speed", name: "Attack Speed", kind: "weapon", best: 0.18, range: "5–18%", text: "attack speed" },
  { id: "lethality", name: "Lethality", kind: "weapon", best: 0.15, range: "5–15%", text: "lethality" },
  { id: "crit_chance", name: "Critical Chance", kind: "weapon", best: 0.15, range: "6–15%", text: "crit chance" },
  { id: "crit_dmg", name: "Critical Damage", kind: "weapon", best: 0.15, range: "5–15%", text: "crit damage" },
  { id: "fracture", name: "Fracture", kind: "weapon", best: 0.2, range: "5–20%", text: "shield and stun damage" },
  { id: "endurance", name: "Endurance", kind: "armour", best: 0.1, range: "4–10%", text: "stamina" },
  { id: "surge", name: "Surge", kind: "armour", best: 0.11, range: "3–11%", text: "shorter dash cooldown" },
  { id: "vitality", name: "Vitality", kind: "armour", best: 0.1, range: "4–10%", text: "max health" },
  { id: "swiftness", name: "Swiftness", kind: "armour", best: 0.1, range: "4–10%", text: "movement speed" },
  { id: "phase", name: "Phase", kind: "armour", best: 0.11, range: "4–11%", text: "longer dash invincibility" },
  { id: "stride", name: "Stride", kind: "armour", best: 0.15, range: "4–15%", text: "dash distance" },
];

export const RUNES_SOURCE = { url: "https://forgewiki.org/wiki/Runes", edited: "6 September 2026" };
export const runeById = new Map(RUNES.map((r) => [r.id, r]));
/** Rune pictures from the wiki (CC BY-SA 4.0), resized to 112px and served with the site. */
export const runeImage = (id: string) => `/runes/${id}.webp`;
/** The wiki's Thunder Shard and Toxic Veins pictures have a wide empty border, so they're drawn larger to match. */
export const runeImageScale: Record<string, number> = { "thunder-shard": 1.6, "toxic-veins": 1.6 };
export const secondaryById = new Map(SECONDARIES.map((s) => [s.id, s]));
