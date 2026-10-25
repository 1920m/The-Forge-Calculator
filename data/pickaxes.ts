// Pickaxes from the community wiki's Module:Pickaxe/Data (CC BY-SA 4.0). Pictures are in the forge-images bucket under pickaxes/.
import type { Rarity } from "@/lib/engine/forge";

export type Pickaxe = { id: string; name: string; region: string; world: 1 | 2 | 3 | 4 | null; rarity: Rarity };

export const PICKAXES: Pickaxe[] = [
  { id: "stone-pickaxe", name: "Stone Pickaxe", region: "Stonewake", world: 1, rarity: "Common" },
  { id: "bronze-pickaxe", name: "Bronze Pickaxe", region: "Stonewake", world: 1, rarity: "Uncommon" },
  { id: "iron-pickaxe", name: "Iron Pickaxe", region: "Stonewake", world: 1, rarity: "Uncommon" },
  { id: "golden-pickaxe", name: "Golden Pickaxe", region: "Stonewake", world: 1, rarity: "Rare" },
  { id: "stonewakes-pickaxe", name: "Stonewake's Pickaxe", region: "Stonewake", world: 1, rarity: "Epic" },
  { id: "platinum-pickaxe", name: "Platinum Pickaxe", region: "Stonewake", world: 1, rarity: "Rare" },
  { id: "arcane-pickaxe", name: "Arcane Pickaxe", region: "Stonewake", world: 1, rarity: "Legendary" },
  { id: "cobalt-pickaxe", name: "Cobalt Pickaxe", region: "Forgotten Kingdom", world: 2, rarity: "Uncommon" },
  { id: "titanium-pickaxe", name: "Titanium Pickaxe", region: "Forgotten Kingdom", world: 2, rarity: "Uncommon" },
  { id: "uranium-pickaxe", name: "Uranium Pickaxe", region: "Forgotten Kingdom", world: 2, rarity: "Rare" },
  { id: "mythril-pickaxe", name: "Mythril Pickaxe", region: "Forgotten Kingdom", world: 2, rarity: "Rare" },
  { id: "lightite-pickaxe", name: "Lightite Pickaxe", region: "Forgotten Kingdom", world: 2, rarity: "Epic" },
  { id: "magma-pickaxe", name: "Magma Pickaxe", region: "Forgotten Kingdom", world: 2, rarity: "Legendary" },
  { id: "demonic-pickaxe", name: "Demonic Pickaxe", region: "Forgotten Kingdom", world: 2, rarity: "Mythic" },
  { id: "tungsten-pickaxe", name: "Tungsten Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Rare" },
  { id: "aqua-pickaxe", name: "Aqua Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Rare" },
  { id: "mist-pickaxe", name: "Mist Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Epic" },
  { id: "snow-pickaxe", name: "Snow Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Epic" },
  { id: "frost-pickaxe", name: "Frost Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Epic" },
  { id: "void-pickaxe", name: "Void Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Legendary" },
  { id: "prismatic-pickaxe", name: "Prismatic Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Legendary" },
  { id: "dragon-head-pickaxe", name: "Dragon Head Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Mythic" },
  { id: "heavenly-pickaxe", name: "Heavenly Pickaxe", region: "Frostspire Expanse", world: 3, rarity: "Mythic" },
  { id: "bamboo-pickaxe", name: "Bamboo Pickaxe", region: "Crimson Sakura Isles", world: 4, rarity: "Rare" },
  { id: "sakura-pickaxe", name: "Sakura Pickaxe", region: "Crimson Sakura Isles", world: 4, rarity: "Epic" },
  { id: "wolf-pickaxe", name: "Wolf Pickaxe", region: "Crimson Sakura Isles", world: 4, rarity: "Epic" },
  { id: "holy-pickaxe", name: "Holy Pickaxe", region: "Crimson Sakura Isles", world: 4, rarity: "Epic" },
  { id: "oni-pickaxe", name: "Oni Pickaxe", region: "Crimson Sakura Isles", world: 4, rarity: "Legendary" },
  { id: "kitsune-pickaxe", name: "Kitsune Pickaxe", region: "Crimson Sakura Isles", world: 4, rarity: "Legendary" },
  { id: "spirit-pickaxe", name: "Spirit Pickaxe", region: "Crimson Sakura Isles", world: 4, rarity: "Mythic" },
  { id: "yin-yang-pickaxe", name: "Yin-Yang Pickaxe", region: "Crimson Sakura Isles", world: 4, rarity: "Mythic" },
  { id: "candy-cane-pickaxe", name: "Candy Cane Pickaxe", region: "Limited-time", world: null, rarity: "Exotic" },
  { id: "christmas-pickaxe", name: "Christmas Pickaxe", region: "Limited-time", world: null, rarity: "Exotic" },
];

export const pickaxeById = new Map(PICKAXES.map((p) => [p.id, p]));
