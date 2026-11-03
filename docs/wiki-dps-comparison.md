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
