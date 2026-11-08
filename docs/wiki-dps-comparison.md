# DPS compared with the wiki's calculator

The Forge wiki has a DPS calculator (`MediaWiki:ForgeCalculator.js`). On 3 November 2026 we ran its `calculate()` in a browser on forgewiki.org with the builds below, and ran the same builds through `combatDps` (`lib/engine/loadout-dps.ts`). All builds are 100% quality. Armour on our side is one piece made only of that ore; on the wiki side it's the same numbers typed into its armour boxes.

| # | Build | Wiki DPS | Our DPS | Difference | Why |
|---|---|---|---|---|---|
| 1 | Mace (14 Iron), +0 | 4.188 | 4.188 | – | |
| 2 | Mace (14 Iron), +9 | 6.282 | 6.282 | – | Matches since +9 became ×1.50 (checked in game, 3 Nov 2026) |
| 3 | Hell Slayer (Bismuth, Fichilliumorite, Galaxite, Kitsunite) | 2,265.49 | 2,485.05 | +9.7% | Ore procs (see below) |
| 4 | Hell Slayer, Vampire | 2,380.63 | 2,600.19 | +9.2% | Same as 3; Vampire adds +115.14 on both |
| 5 | Kunai (3 Iron), Goblin | 7.641 | 7.641 | – | |
| 6 | Dark Knight's Gauntlets (15 Iron), Felynx | 19.765 | 19.765 | – | |
| 7 | Spear (24 Iron), Fairy | 9.511 | 9.511 | – | |
| 8 | Mace, Orc | 4.607 | 4.607 | – | |
| 9 | Mace, Demon | 6.550 | 6.521 | −0.4% | Demon's burn: burn uptime formula |
| 10 | Mace, Dragonborn | 5.697 | 5.696 | rounding | |
| 11 | Mace, Angel | 4.822 | 4.816 | −0.1% | Angel's smite: rolled chance |
| 12 | Mace, ArchAngel | 6.598 | 6.598 | – | |
| 13 | Mace, Kitsune | 8.358 | 8.358 | – | |
| 14 | Mace, Orc Lord | 6.197 | 6.197 | – | |
| 15 | Mace, Shadow, Vanegos + Yin-Yang armour | 8.634 | 8.634 | – | |
| 16 | Hell Slayer, Minotaur, Fierce Jade armour | 2,896.81 | 3,116.37 | +7.6% | Same ore-proc gap as 3 (+219.6); below 35% HP adds +965.6 on both |
| 17 | Hell Slayer, Dragonborn, +6 | 2,965.74 | 3,637.97 | +22.7% | Ore procs, and procs grow with enhancement here |

Builds 1, 2, 5–8, 10, 12–15 and the race and low-health differences in 4 and 16 are checked in `tests/loadout-dps.test.ts`.

## What matches

- Race Lethality and attack speed, class bonuses (Goblin dagger, Felynx gauntlets, Fairy spear, Vampire straight sword) and the bonuses that skip the caps (Kitsune, Fairy).
- Race procs: Orc Lord's slam, Kitsune's claws and foxfire, ArchAngel's smite, Dragonborn's fire.
- Armour Lethality, crit chance and crit damage, added before the caps.
- The below-35%-HP scenario (armour Berserker capped at 200%, plus Minotaur).

## Known differences, kept on purpose

1. **Procs and enhancement.** The enhancement table now matches the wiki and the game: +5% a level up to +8, ×1.50 at +9, and +9 is the top. The wiki's procs (burn, explosions and so on) use the damage before enhancement; ours grow with enhancement like hits do. We keep that until it's checked in the game. An `it.todo` in the tests marks the switch.
2. **Ore procs.** The wiki now rolls proc chances the way it thinks the game does (`(floor(chance × 100) + 1) ÷ 100`, so 30% counts as 31%) and uses a burn and poison uptime that levels off (`load ÷ (1 + load ÷ 2)`). Our ore and rune maths are the ones the site already used, so saved forges and links show the same numbers as before. That is most of the gap on trait-heavy weapons (build 3). The small Demon and Angel gaps come from the same two rules.
3. **Cooldown procs.** Race procs with a cooldown (Orc Lord, ArchAngel) use the wiki's `1 ÷ (cooldown + 1 ÷ (chance × hits per second))`, so those match.

Apart from the enhancement table, nothing here has been checked against the game yet; the wiki's script is a community model.

## Version 1.10 (7 November 2026)

The wiki's calculator was updated for Version 1.10 the same evening. On 8 November we ran the revision of 7 Nov, 22:52 with these builds (100% quality, +0, the race's weapon class picked where it has one):

| Build | Wiki DPS | Our DPS | Difference | Why |
|---|---|---|---|---|
| Spear (24 Iron), Imp | 11.575 | 12.438 | +0.863 | Hellfire Prod's spear burn, which the wiki leaves out; the rest (Trident Toss 0.788) matches |
| Angelic Spear (24 Iron) | 13.905 | 13.905 | – | 13.11 damage |
| Angelic Spear (24 Iron), Imp | 22.233 | 23.902 | +1.669 | Hellfire Prod, as above |
| Demonic Spear (24 Iron) | 13.827 | 13.827 | – | 14.42 damage, 0.73 s |
| Demonic Spear (24 Iron), Imp | 22.255 | 23.915 | +1.659 | Hellfire Prod, as above |
| Mace (14 Iron), Imp | 4.188 | 4.188 | – | Imp's bonuses are for spears only |
| Mace (14 Iron), Fallen Angel | 6.023 | 6.012 | −0.2% | Black Halo: the wiki rolls the 30% chance to 30.7%, we use 30% (as for Angel's smite) |
| Mace (14 Iron), Fallen Angel, below 35% HP | 7.405 | 7.394 | −0.2% | Same; Last Descent adds +1.382 on both |
| Jack's Crest (11 Iron) | 9.657 | 9.657 | – | 14.9 damage, 1.08 s |
| The Carver (11 Iron) | 8.944 | 8.944 | – | 1.08 s |

Coffin's Lid keeps 23 damage (its item page and the Weapons table); the wiki's calculator data has 25. Knight Spear keeps 10.125 (the game file); the calculator data has 7.5. These builds are checked in `tests/loadout-dps.test.ts`.

### Version 1.10 ores

Same calculator revision, single-ore builds plus one mix (100% quality, +0):

| Build | Wiki DPS | Our DPS | Difference | Why |
|---|---|---|---|---|
| Dagger (3 Echotite) | 567.96 | 563.57 | −0.8% | Reverberation and the explosion use 20% and 40%; the wiki rolls them to 20.8% and 40.6% |
| Falchion Sword (4 Echotite) | 646.46 | 641.14 | −0.8% | Same, at 16% |
| Ironhand (6 Echotite) | 809.66 | 802.56 | −0.9% | Same, at 12% |
| Mace (14 Tetrinite) | 511.79 | 503.98 | −1.5% | Lightning uses our existing rule (the gap in build 3 above); poison and Ancient Poison match |
| Dark Knight's Gauntlets (14 Frost Core) | 1,025.98 | 1,025.98 | – | +15% Lethality, +10% crit damage |
| Great Sword (19 Frost Star) | 1,222.90 | 1,220.20 | −0.2% | Frost Slash and Starfall rolled chances; Stellar Mark matches exactly |
| Great Sword (10 Frost Star, 9 Galaxite) | 1,701.35 | 1,770.62 | +4.1% | Our existing black hole rule; Frost Star's parts match as above |
| Dark Knight's Gauntlets (5 Echotite, 5 Tetrinite, 4 Frost Star) | 2,063.46 | 2,024.43 | −1.9% | Lightning and rolled chances, as above |

Bizzarite and Royal Boneite have no damage traits. Frost Core's armour Lethality and crit damage count in the Loadout; its blizzard and Bizzarite's Void Mark and Heaven's Ascent are listed but not counted, as in the wiki's calculator.
