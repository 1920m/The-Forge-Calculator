/**
 * Races and their reroll (spin) chances, from the Forge wiki's Races page
 * (https://forgewiki.org/wiki/Races, Version 1.10, 7 November 2026). Trait text is the wiki's, with spelling fixed.
 * The wiki gives all six Mythicals 0.25%, so its chances add up to 100.5%; Human is 0.5% lower here (34.55%) so they add up to 100%.
 *
 * The wiki also says: luck buffs (event, totem, potion) don't change race rerolls, and rerolls come from Robux or codes.
 * It doesn't mention any pity or guarantee, so every spin is treated as a fresh roll.
 */
export type RaceRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythical" | "Relic";
/**
 * What a race does to weapon damage, from the wiki's DPS calculator (MediaWiki:ForgeCalculator.js, 7 Nov 2026).
 * "Physical Damage" counts as Lethality, as on the wiki. `stats` add before the caps; `uncapped` after them.
 * `classes` only apply with that weapon class. `conditions` are never in the normal DPS.
 */
export type RaceCombat = {
  stats?: { lethality?: number; atk_speed?: number };
  uncapped?: { lethality?: number; atk_speed?: number; crit_dmg?: number };
  classes?: { classes: string[]; stats?: { lethality?: number; atk_speed?: number }; uncapped?: { lethality?: number; atk_speed?: number }; burn?: { dmg: number; chance?: number; dur: number }; specials?: import("@/lib/engine/dps").SpecialProc[] }[];
  /** Merged into the weapon's own burn or smite: damage adds, the higher chance and duration are used. */
  burn?: { dmg: number; chance?: number; dur: number };
  smite?: { dmg: number; chance: number };
  specials?: import("@/lib/engine/dps").SpecialProc[];
  /** Physical damage while low on health (Minotaur's Bull's Fury below 50%, Fallen Angel's Last Descent below 30%). */
  lowHp?: number;
  conditions?: ("orc-lord-missing-hp" | "orc-lord-kills" | "dryad-grove" | "max-hp" | "kitsune-dodge")[];
};
export type Race = { id: string; name: string; rarity: RaceRarity; chance: number; traits: { name: string; text: string }[]; combat?: RaceCombat };

export const RACE_RARITIES: RaceRarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Relic"];

/** Chance is the percent per spin. */
export const RACES: Race[] = [
  { id: "human", name: "Human", rarity: "Common", chance: 34.55, traits: [
    { name: "Blessed", text: "+3% Luck Boost and +3% Extra XP." },
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
    { name: "Sneaky", text: "+15% Movement Speed, +10% Attack Speed with Daggers." },
    { name: "Bargain", text: "12% discount when shopping." },
  ], combat: { classes: [{ classes: ["Dagger"], stats: { atk_speed: 0.1 } }] } },
  { id: "undead", name: "Undead", rarity: "Rare", chance: 7.5, traits: [
    { name: "Fragile Bones", text: "−12% Health." },
    { name: "Sharp Surface", text: "Reflects 10% of the damage taken." },
    { name: "Second Chance", text: "Refills 50% of Health when it drops below 10% (5 min cooldown)." },
  ] },
  { id: "orc", name: "Orc", rarity: "Rare", chance: 7.5, traits: [
    { name: "Heavy", text: "−10% Stamina, −10% Movement Speed." },
    { name: "Muscular", text: "+10% Physical Damage, +15% Health, +10% Size." },
  ], combat: { stats: { lethality: 0.1 } } },
  { id: "dwarf", name: "Dwarf", rarity: "Epic", chance: 4, traits: [
    { name: "Heavy Short", text: "−20% Height, −5% Movement Speed." },
    { name: "Gifted Miner", text: "+15% Mining Damage, +5% Better Forge." },
    { name: "Critical Mining", text: "20% chance to deal +50% damage to rocks." },
  ] },
  { id: "shadow", name: "Shadow", rarity: "Epic", chance: 4, traits: [
    { name: "Shadow Pact", text: "+15% Movement Speed, +10% Attack Speed, +10% Stamina, +5% Physical Damage, −10% Health." },
    { name: "Phantom Step", text: "Upon taking damage, there is a 15% chance to turn into a shadow to dodge the attack." },
  ], combat: { stats: { lethality: 0.05, atk_speed: 0.1 } } },
  { id: "vampire", name: "Vampire", rarity: "Epic", chance: 4, traits: [
    { name: "Bloodthirst", text: "+15% Life Steal." },
    { name: "Blade Adept", text: "+10% Physical Damage with Straight Swords." },
  ], combat: { classes: [{ classes: ["Straight Sword"], stats: { lethality: 0.1 } }] } },
  { id: "minotaur", name: "Minotaur", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Beast", text: "+20% Health, −10% Movement Speed, −10% Stamina, +10% Height, +20% Width & Depth." },
    { name: "Bull's Fury", text: "While under 50% Health, activates Rage Mode, increasing Movement Speed and Physical Damage by 30%." },
  ], combat: { lowHp: 0.3 } },
  { id: "dragonborn", name: "Dragonborn", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Durable Scales", text: "+20% Health and +10% Height." },
    { name: "Sharp Fangs", text: "+12% Physical Damage." },
    { name: "Dragon's Breath", text: "40% chance to burn enemies and deal 30% of base weapon damage per second for 3 seconds." },
  ], combat: { stats: { lethality: 0.12 }, burn: { dmg: 0.3, chance: 0.4, dur: 3 } } },
  { id: "golem", name: "Golem", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Tank", text: "+30% Health, −10% Movement Speed, +30% Size." },
    { name: "Heavy Hitter", text: "+15% Attack Speed with heavy weapons." },
    { name: "Stone Heart", text: "50% chance to reduce incoming damage by 25%." },
  ], combat: { classes: [{ classes: ["Colossal Sword", "Great Axe"], stats: { atk_speed: 0.15 } }] } },
  { id: "felynx", name: "Felynx", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Lightfooted", text: "+20% Stamina Boost, +20% Movement Speed, −20% Dash Cooldown, +20% Dash Distance." },
    { name: "Cat Reflexes", text: "20% chance to parry the next attack." },
    { name: "Clawed Grip", text: "+20% Attack Speed and Physical Damage with Gauntlets." },
  ], combat: { classes: [{ classes: ["Gauntlets"], stats: { lethality: 0.2, atk_speed: 0.2 } }] } },
  { id: "fairy", name: "Fairy", rarity: "Legendary", chance: 1.25, traits: [
    { name: "Fairy Dust", text: "+15% Luck Boost, +20% XP Boost." },
    { name: "Fragile Body", text: "−15% Health, −50% Size, +15% Movement Speed, +25% Jump Height, −15% Dash Cooldown, +15% Stamina." },
    { name: "Fae's Reach", text: "+15% Attack Speed and Physical Damage with Spears." },
    { name: "Last Spark", text: "Refills 50% of Health when it drops below 10% (5 min cooldown)." },
  ], combat: { classes: [{ classes: ["Spear"], uncapped: { lethality: 0.15, atk_speed: 0.15 } }] } },
  { id: "angel", name: "Angel", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Wings", text: "−20% Dash Cooldown, +50% Dash Distance, +15% Longer Dash IFrame, +20% Movement Speed, +25% Jump Boost, +20% Stamina." },
    { name: "Mighty Clover", text: "+30% Luck Boost." },
    { name: "Smite", text: "50% chance to call upon Smite on-hit for 30% of base weapon damage." },
    { name: "Holy Hand", text: "Infinite Stamina while below 20% Health." },
  ], combat: { smite: { dmg: 0.3, chance: 0.5 } } },
  { id: "demon", name: "Demon", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Demonic Powers", text: "+20% Movement Speed, +20% Attack Speed, +20% Physical Damage, +20% Burn Tick Damage, +30% Height, +10% Width & Depth." },
    { name: "Backfire", text: "25% chance to burn the enemy when taking damage." },
    { name: "Cursed Aura", text: "While in combat, deals 10% of base weapon damage per second to nearby enemies." },
    { name: "Devil's Finger", text: "When dashing, teleports with hellfire particles and has a 35% chance to create a Hellfire Circle dealing 45% of base weapon damage per second for 3 seconds (3 s cooldown)." },
  ], combat: { stats: { lethality: 0.2, atk_speed: 0.2 }, burn: { dmg: 0.2, dur: 3 }, specials: [{ label: "Cursed Aura", type: "aura", dmg: 0.1 }] } },
  { id: "orc-lord", name: "Orc Lord", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Brute Force", text: "+40% Physical Damage, +10% Health, +50% Size, −10% Movement Speed." },
    { name: "Warbringer", text: "+7.5% Physical Damage for every 10% of Health missing." },
    { name: "Lord of War", text: "Killing an enemy grants +7.5% Attack Speed and Movement Speed for 5 seconds. Stacks up to 5 times." },
    { name: "Titanic Earthquake", text: "Attacks have a 25% chance to slam the ground, dealing 100% of base weapon damage and stunning enemies for 1 s (10 s cooldown)." },
  ], combat: { stats: { lethality: 0.4 }, specials: [{ label: "Titanic Earthquake", type: "cooldown", dmg: 1, chance: 0.25, cd: 10 }], conditions: ["orc-lord-missing-hp", "orc-lord-kills"] } },
  { id: "dryad", name: "Dryad", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Nature's Blessing", text: "+30% Health, +10% Healing Done." },
    { name: "Healing Grove", text: "When hitting an enemy, 20% chance to spawn a Healing Grove for 5 seconds, healing everyone by 2% Health a second (20 s cooldown)." },
    { name: "Barkskin", text: "Everyone inside the Healing Grove gains 10% Damage Reduction, +15% Critical Chance and +15% Critical Damage." },
    { name: "Vital Power", text: "Fire, Poison, Black Hole and Lightning damage +5% per 1,000 max Health, up to +50% at 10,000." },
  ], combat: { conditions: ["dryad-grove", "max-hp"] } },
  { id: "imp", name: "Imp", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Impish Agility", text: "+20% Movement Speed, −15% Dash Cooldown, 10% shorter." },
    { name: "Pitchfork Mastery", text: "+25% Damage and +20% Attack Speed with Spears." },
    { name: "Hellfire Prod", text: "Spear hits have a 25% chance to burn for 3 seconds, dealing 20% of weapon damage per second." },
    { name: "Trident Toss", text: "Every 8 seconds, a Spear hit hurls a burning copy of your spear. It sticks in the first enemy for 120% weapon damage plus burn, and 50% to enemies around it." },
  ], combat: { classes: [{ classes: ["Spear"], stats: { lethality: 0.25, atk_speed: 0.2 }, burn: { dmg: 0.2, chance: 0.25, dur: 3 }, specials: [{ label: "Trident Toss", type: "limited", dmg: 1.2, cd: 8 }] }] } },
  { id: "fallen-angel", name: "Fallen Angel", rarity: "Mythical", chance: 0.25, traits: [
    { name: "Broken Wings", text: "Dash: +50% Distance, −20% Cooldown, +15% Invincibility. +15% Movement Speed, +20% Jump and Stamina." },
    { name: "Fallen Grace", text: "+20% Physical Damage, +10% Attack Speed, −10% Max Health." },
    { name: "Black Halo", text: "When you hit an enemy: 30% chance of a dark smite for 35% of your damage." },
    { name: "Last Descent", text: "Below 30% Health: +30% damage and 10% Life Steal for 4 seconds (60 s cooldown)." },
  ], combat: { stats: { lethality: 0.2, atk_speed: 0.1 }, specials: [{ label: "Black Halo", type: "onhit", dmg: 0.35, chance: 0.3 }], lowHp: 0.3 } },
  { id: "archangel", name: "ArchAngel", rarity: "Relic", chance: 0.1, traits: [
    { name: "Wings", text: "−35% Dash Cooldown, +75% Dash Distance, +15% Longer Dash Invincibility Duration, +25% Movement Speed, +25% Jump Boost, +25% Stamina." },
    { name: "Demonic Powers", text: "+20% Attack Speed, +20% Physical Damage." },
    { name: "Mighty Clover", text: "+30% Luck Boost." },
    { name: "Trial of Judgement", text: "50% chance when dashing to create a Holy Circle dealing 45% of base weapon damage per second for 3 seconds (3 s cooldown)." },
    { name: "Archangel's Smite", text: "33% chance to summon 3 consecutive beams of light, each dealing 50% of base weapon damage (150% total, 10 s cooldown)." },
    { name: "Heaven's Invincibility", text: "Taking Physical Damage while below 20% Health grants 10 s of Invincibility and restores Health to 25% (5 min cooldown)." },
  ], combat: { stats: { lethality: 0.2, atk_speed: 0.2 }, specials: [{ label: "Archangel's Smite", type: "cooldown", dmg: 1.5, chance: 0.33, cd: 10 }] } },
  { id: "kitsune", name: "Kitsune", rarity: "Relic", chance: 0.1, traits: [
    { name: "Fox Agility", text: "+25% Movement Speed, −25% Dash Cooldown, +20% Stamina, +20% Dash Distance." },
    { name: "Fox Claws", text: "On hit, 25% chance to summon a spirit Kitsune that slashes the target 3 times, each dealing 25% of base weapon damage. Up to 3 spirits at a time." },
    { name: "Foxfire", text: "Attacks have a 50% chance to apply Foxfire, dealing 30% of base weapon damage per second for 3 seconds." },
    { name: "Illusion Step", text: "+20% Dodge Chance for 3 seconds after dashing (6 s cooldown)." },
    { name: "Nine-Tailed Spirit", text: "Dropping below 30% Health grants +25% Movement Speed and 15% Damage Reduction for 4 seconds, and Fox Claws triggers on every hit for the duration (15 s cooldown)." },
    { name: "Kitsune's Trickery", text: "+20% Lethality, +20% Attack Speed, +15% Critical Damage. A successful dodge doubles these for 3 seconds (5 s cooldown)." },
  ], combat: { uncapped: { lethality: 0.2, atk_speed: 0.2, crit_dmg: 0.15 }, specials: [{ label: "Fox Claws", type: "spirits", dmg: 0.75, chance: 0.25, max: 3 / 2.22 }, { label: "Foxfire", type: "foxfire", dmg: 0.3, chance: 0.5, dur: 3 }], conditions: ["kitsune-dodge"] } },
];

export const RACES_SOURCE = { url: "https://forgewiki.org/wiki/Races", edited: "7 November 2026" };
export const raceById = new Map(RACES.map((r) => [r.id, r]));
