/**
 * Weapon and Armor Molds (added in game update 1.08, 5 September 2026).
 * Pictures from the Forge wiki (WeaponMold.png and ArmorMold.png, CC BY-SA 4.0), resized to 128px.
 * Where they drop is from the wiki's Version 1.09 page (rechecked 28 Oct 2026).
 */
import type { Kind } from "@/lib/engine";

export type Mold = { kind: Kind; name: string; image: string; from: string };

export const MOLDS: Record<Kind, Mold> = {
  weapon: { kind: "weapon", name: "Weapon Mold", image: "/molds/weapon-mold.webp", from: "Cthulhu (1 in 8), Reaper, Asura's Incarnate" },
  armour: { kind: "armour", name: "Armor Mold", image: "/molds/armour-mold.webp", from: "Demonic Queen Spider (1 in 10), Prismarine Spider, Deathaxe Skeleton, Golem, Frostspire Grandmaster quest (12 molds)" },
};
