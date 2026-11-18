# DPS rules and where each comes from

Model `2026-11-12`, in `lib/engine/dps.ts` and `lib/engine/loadout-dps.ts`. Trait **values** come from the wiki's data (ore pages, `Data:Ores.json`, `Data:Weapons.json`, `Data:Races.json`), which is right. The wiki's **calculator** (`MediaWiki:ForgeCalculator.js`) was found off in game in several places, so it's only a reference here. Every rule below says where it comes from:

- **Game**: confirmed by an in-game test or an item card (docs/wiki-dps-comparison.md).
- **Text**: worked out from the trait's in-game text.
- **Wiki calc**: taken from the wiki's calculator and not yet tested. These are what the next in-game tests should check first.
- **Fitted**: a number tuned to in-game tests because the game doesn't publish it.

## Weapon damage and hits

| Rule | Source |
| --- | --- |
| Damage = base × average multiplier × (1 + quality) | Game (card 1,260 for 50 Vooite Excalibur) |
| Bismuth and Fichilliumorite take the average multiplier of the other ores | Game |
| Swing time = the card's ATK SPD (1.4 s for Excalibur), from `Data:Weapons.json` | Game |
| Hits per second = (1 + attack speed) ÷ swing time | Game (hits-only Excalibur matches to 1%) |
| Enhancement multiplies hits only: +5% a level to +8, ×1.5 at +9 | Game (1,260 → 1,890; 898 → 1,360 DPS) |
| Procs use the damage before enhancement | Game (+9 added ~1,100, not ~2,400) |
| Hit = damage × (1 + Lethality) × crit blend; Lethality boosts hits only | Text ("Increases Physical Damage") |
| Crit blend = chance × (1.45 + crit damage) + (1 − chance) | Wiki calc (base crit damage 145%) |
| Caps: Lethality 300%, crit chance 100%, crit damage 100%, attack speed 150% | Wiki calc |

## Trait strength by share

| Rule | Source |
| --- | --- |
| A trait is off below a 10% share of the item | Game (8% Bismuth: no traits on the card) |
| At 10% it is a tenth of its full value, rising evenly to full at 30% | Game at 10% (Bismuth +1.8% attack speed) and 30% (Galaxite +45% crit, Kitsunite burn 40%/s 50%) |
| Several ores with the same effect: damage adds up, the best chance and longest duration are used, the shortest cooldown | Wiki calc (the card shows one line per effect) |

## Procs

| Rule | Source |
| --- | --- |
| Chances roll on 101 sides: (⌊chance × 100⌋ + 1) ÷ 101, so 30% is 30.7% | Wiki calc |
| Explosion, smite, Frost Slash, Glacier (on crits): damage × chance × hits per second | Text (no cooldown) |
| Burn and poison up 1 − (1 − chance)^(hits in the duration), hits landing one swing at a time | Text; fits the in-game tests slightly better than the wiki calc's `load ÷ (1 + load ÷ 2)` |
| Burn 1–5 s, poison 1–15 s | Wiki calc |
| Lightning and Starfall: 1 ÷ (cooldown + 1 ÷ (chance × hits per second)) a second | Text (cooldown) with the wiki calc's smooth average; timing it to whole swings fit the tests worse |
| No lightning cooldown given: 10 s | Wiki calc |
| Black hole: Galaxite's trait (10%+ share), 30% chance, 1 s cooldown | Wiki calc (chance and cooldown); 10% gate from Game |
| Bismuth's Resonance: +125% to a Galaxite black hole, needs 10%+ Bismuth and Galaxite's black hole | Text + Game (gate) |
| Starfall ×1.8 (225% instead of 125%) with any Galaxite | Text |
| Stellar Mark: 150% every 5th hit | Text |
| Echotite Reverberation: 20% daggers, 16% straight swords, 12% gauntlets, 8% the rest; repeats the hit | Text |
| Ancient Poison: +50% poison while the mark is up, mark up 1 − (1 − chance)^(hits in 5 s) | Text |
| Bismuth's Prismatic Shift: each of the 4 damage runes (at the middle of its tier III rolls) up 1 − (1 − 0.5 ÷ 7)^(hits in 10 s) | Text (random rune for 10 s) + **Fitted** (the 0.5) to 10% and 30% Bismuth weapons |
| Bismuth's Lethality, crit chance and crit damage count on armour only | Game (weapon card) |
| Fireite and Gargantuan burn 10% a second | Ore pages (`Data:Ores.json` says 20%) |

## Runes, armour, race, Golemites

| Rule | Source |
| --- | --- |
| Runes count at the best roll of their range | Site choice (shown on the runes panel) |
| Rune procs join the ores' pools (damage adds, best chance) | Wiki calc |
| Armour traits: each piece by its own ore shares, then added to the weapon's before the caps | Text |
| Race bonuses and abilities: values from `Data:Races.json` | Wiki data; formulas from the wiki calc (Kitsune +0 matched within 1%) |
| Golemite ore traits × its rarity's trait share (30% Divine), chances included | Card ("30% TRAITS") + wiki calc for chances |
| A Golemite's Galaxite black hole: chance 30% × trait share; with 10%+ Bismuth, its wave × trait share | Wiki data; untested |
| Golemites fight from growth level 13: 2% of damage, 6% at 25, 0.67 hits a second | Wiki calc |

## Not counted

Below-35%-HP effects outside the "below 35% HP" scenario, Radioactive (needs your max health), poison clouds when hit, thorns, freezes and slows, life steal, achievements.
