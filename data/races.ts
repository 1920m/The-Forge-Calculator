/**
 * Races and their reroll (spin) chances, from the Forge wiki's Races page
 * (https://forgewiki.org/wiki/Races, last edited 12 July 2026). Trait text is the wiki's, with spelling fixed.
 *
 * The wiki also says: luck buffs (event, totem, potion) don't change race rerolls, and rerolls come from Robux or codes.
 * It doesn't mention any pity or guarantee, so every spin is treated as a fresh roll.
 */
export type RaceRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythical" | "Relic";
export type Race = { id: string; name: string; rarity: RaceRarity; chance: number; traits: { name: string; text: string }[] };

export const RACE_RARITIES: RaceRarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Relic"];

/** Chance is the percent per spin. */
export const RACES: Race[] = [
  { id: "human", name: "Human", rarity: "Common", chance: 35.05, traits: [
    { name: "Blessed", text: "+3% Luck and +3% Extra XP." },
  ] },
  { id: "elf", name: "Elf", rarity: "Uncommon", chance: 11.5, traits: [
    { name: "Superior Genes", text: "+15% Stamina and +5% Height." },
    { name: "Glorious", text: "+7% Luck Boost." },
  ] },
  { id: "zombie", name: "Zombie", rarity: "Uncommon", chance: 11.5, traits: [
    { name: "Rotten", text: "−25% Health." },
    { name: "Mutated Genes", text: "+2% Health regeneration every 5 seconds." },
    { name: "Absorb", text: "15% chance to convert incoming damage to Health." },
  ] },
  { id: "goblin", name: "Goblin", rarity: "Rare", chance: 7.5, traits: [
    { name: "Tiny", text: "−15% Health, −15% Size." },
    { name: "Sneaky", text: "+15% Movement Speed, +10% Attack Speed with daggers." },
    { name: "Bargain", text: "12% discount when shopping." },
  ] },
  { id: "undead", name: "Undead", rarity: "Rare", chance: 7.5, traits: [
    { name: "Fragile Bones", text: "−12% Health." },
    { name: "Sharp Surface", text: "Reflect 10% of the damage taken." },
    { name: "Second Chance", text: "Refills 50% of Health when Health is under 10%, every 5 minutes." },
  ] },
  { id: "orc", name: "Orc", rarity: "Rare", chance: 7.5, traits: [
    { name: "Heavy", text: "−10% Stamina, −10% Movement Speed." },
    { name: "Muscular", text: "+10% Physical Damage, +15% Health, +10% Size." },
  ] },
  { id: "dwarf", name: "Dwarf", rarity: "Epic", chance: 4, traits: [
    { name: "Heavy Short", text: "−20% Height, −5% Movement Speed." },
    { name: "Gifted Miner", text: "+15% Mining Damage, +5% Better Forge." },
    { name: "Critical Mining", text: "20% chance to deal +50% damage to rocks." },
  ] },
  { id: "shadow", name: "Shadow", rarity: "Epic", chance: 4, traits: [
    { name: "Shadow Pact", text: "+15% Movement Speed, +10% Attack Speed, +10% Stamina, +5% Physical Damage, −10% Health." },
    { name: "Phantom Step", text: "Upon taking damage, there is a 15% chance to turn into a shadow to dodge the attack." },
  ] },
  { id: "vampire", name: "Vampire", rarity: "Epic", chance: 4, traits: [
    { name: "Bloodthirst", text: "+15% Life Steal." },
    { name: "Blade Adept", text: "10% damage boost with straight swords." },
  ] },
  { id: "minotaur", name: "Minotaur", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Beast", text: "+20% Health, −10% Movement Speed, −10% Stamina, +10% Height, +20% Width & Depth." },
    { name: "Bull's Fury", text: "While under 50% Health, activate Rage Mode, increasing Movement Speed and Physical Damage by 30%." },
  ] },
  { id: "dragonborn", name: "Dragonborn", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Durable Scales", text: "+20% Max HP and +10% Height." },
    { name: "Sharp Fangs", text: "+12% Physical Damage." },
    { name: "Dragon's Breath", text: "40% chance to burn enemies and deal 30% of weapon damage per second for 3 seconds." },
  ] },
  { id: "golem", name: "Golem", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Tank", text: "+30% Health, −10% Movement Speed, +30% Size." },
    { name: "Heavy Hitter", text: "+15% Attack Speed with heavy weapons." },
    { name: "Stone Heart", text: "50% chance to reduce incoming damage by 25%." },
  ] },
  { id: "felynx", name: "Felynx", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Lightfooted", text: "+20% Stamina Boost, +20% Movement Speed, −20% Dash Cooldown, +20% Dash Distance." },
    { name: "Cat Reflexes", text: "20% chance to parry the next attack." },
    { name: "Clawed Grip", text: "+20% Attack Speed/Damage with Gauntlets." },
  ] },
  { id: "fairy", name: "Fairy", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Fairy Dust", text: "+15% Luck Boost, +20% XP Boost." },
    { name: "Fragile Body", text: "−15% Health, −50% Size, +15% Movement Speed, +25% Jump Height, −15% Dash Cooldown, +15% Stamina." },
    { name: "Fae's Reach", text: "+15% Attack Speed/Damage with Spears." },
    { name: "Last Spark", text: "Refills 50% of HP when health is under 10%, every 5 minutes." },
  ] },
  { id: "angel", name: "Angel", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Wings", text: "−20% Dash Cooldown, +50% Dash Distance, +15% Longer Dash IFrame, +20% Movement Speed, +25% Jump Boost, +20% Stamina." },
    { name: "Mighty Clover", text: "+30% Luck Boost." },
    { name: "Smite", text: "50% chance to call upon Smite on-hit for 30% of Physical Damage." },
    { name: "Holy Hand", text: "Infinite Stamina while below 20% Health." },
  ] },
  { id: "demon", name: "Demon", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Demonic Powers", text: "+20% Movement Speed, +20% Attack Speed, +20% Physical Damage, +20% Stronger Fire Damage, +30% Height, +10% Width & Depth." },
    { name: "Backfire", text: "25% chance to burn the enemy when taking damage." },
    { name: "Cursed Aura", text: "While in combat, deal 10% of your weapon damage per second to nearby enemies." },
    { name: "Devil's Finger", text: "When dashing, teleport with hellfire particles and have a 35% chance to create a hellfire circle dealing 45% of your weapon damage per second for 3 seconds." },
  ] },
  { id: "orc-lord", name: "Orc Lord", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Brute Force", text: "+40% Physical Damage, +10% Health, +50% Size, −10% Movement Speed." },
    { name: "Warbringer", text: "+7.5% Physical Damage for every 10% of Health missing." },
    { name: "Lord of War", text: "Killing an enemy grants +7.5% Attack Speed and Movement for 5 seconds. Stacks up to 5 times." },
    { name: "Titanic Earthquake", text: "Attacks have a 25% chance to slam the ground, dealing 100% of your Physical Damage and stunning them for 1s. 10s cooldown." },
  ] },
  { id: "dryad", name: "Dryad", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Nature's Blessing", text: "+30% Health, +10% Healing Done." },
    { name: "Healing Grove", text: "When you hit an enemy, 20% chance: a 5s grove heals you and allies 2% max HP/s. 20s cooldown." },
    { name: "Barkskin", text: "You and allies inside your Healing Grove gain 10% Damage Reduction, +15% Critical Chance and +15% Critical Damage." },
    { name: "Vital Power", text: "Fire, Poison, Black Hole and Lightning damage +5% per 1,000 max health, up to +50% at 10,000." },
  ] },
  { id: "archangel", name: "ArchAngel", rarity: "Relic", chance: 0.1, traits: [
    { name: "Wings", text: "−35% Dash Cooldown, +75% Dash Distance, +15% Longer Dash, IFrame on Dash, +25% Movement Speed, +25% Jump Boost, +25% Stamina." },
    { name: "Demonic Powers", text: "+20% Attack Speed, +20% Physical Damage, +30% Height, +10% Width & Depth." },
    { name: "Mighty Clover", text: "+30% Luck Boost." },
    { name: "Trial of Judgement", text: "50% chance when dashing to create a holy circle dealing 45% of your weapon damage per second for 3 seconds." },
    { name: "Archangel's Smite", text: "33% chance to summon 3 consecutive beams of light, each dealing 50% Physical Damage (150% total)." },
    { name: "Heaven's Invincibility", text: "At ≤20% HP, taking Physical Damage grants 10s of I-frames and restores Health to 25%, 5 min cooldown." },
  ] },
  { id: "kitsune", name: "Kitsune", rarity: "Relic", chance: 0.1, traits: [
    { name: "Fox Agility", text: "+25% Movement Speed, −25% Dash Cooldown, +20% Stamina, +20% Dash Distance." },
    { name: "Fox Claws", text: "On hit, 25% chance to summon a spirit Kitsune that slashes the target 3 times, each dealing 25% of your Physical Damage. Up to 3 spirits at a time." },
    { name: "Foxfire", text: "Attacks have a 50% chance to apply Foxfire, dealing 30% of your Total Damage per second for 3 seconds." },
    { name: "Illusion Step", text: "+20% Dodge Chance for 3 seconds after dashing. 6 second cooldown." },
    { name: "Nine-Tailed Spirit", text: "Dropping below 30% health grants +25% Movement Speed and 15% Damage Reduction for 4 seconds, and Fox Claws triggers on every hit. 15 second cooldown." },
    { name: "Kitsune's Trickery", text: "+20% Lethality, +20% Attack Speed, +15% Critical Damage. A successful dodge doubles these for 3 seconds. 5 second cooldown." },
  ] },
];

export const RACES_SOURCE = { url: "https://forgewiki.org/wiki/Races", edited: "12 July 2026" };
