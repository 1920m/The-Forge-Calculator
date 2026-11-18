# DPS compared with the game and the wiki's calculator

**Reference order:** in-game tests first, then the wiki's data (ore pages, `Data:*.json`), then the wiki's calculator. The calculator (`MediaWiki:ForgeCalculator.js`) was reviewed with one of the game's developers and found off in how it applies DPS and stats in many cases, so where a rule isn't tested in game we work it out from the trait text. `docs/dps-rules.md` lists every rule and its source.

## 12 November 2026

An in-game test on the test server (Excalibur with 12 Kitsunite, 12 Galaxite, 12 Tetrinite and 4 Bismuth, +9, no runes) averaged about **5,600 DPS as Human** and **7,400 as Kitsune**. Our old model gave 8,320 and 10,897, too high mainly because procs grew with enhancement.

What changed since, all checked against the in-game results below:

- **Enhancement grows hits only.** Procs use the damage before enhancement.
- **Burn and poison uptime** is `1 − (1 − chance)^(hits in the duration)` (hits land one swing at a time), not the wiki calculator's `load ÷ (1 + load ÷ 2)`.
- **Black holes** need Galaxite's trait (a 10%+ share), and **Bismuth's wave** needs 10%+ Bismuth (an 8% Bismuth card lists no Bismuth traits). A Golemite's black hole comes with its own, scaled chance.
- **Bismuth**: crits are armour-only, **Prismatic Shift** is counted (fitted to in-game tests).
- Weapon damage and swing times from `Data:Weapons.json` (Gemblade 25, Executioner's 20, Batwing 19.5); Fireite and Gargantuan burn 10%/s.

`tests/wiki-dps.test.ts` still runs 34 builds from the wiki's calculator part by part: every part where we use the same rule must match, and the parts above are listed as known differences.

### In-game tests, 12 November

Test server, Human unless named, no armour, no runes, no Golemites, 100% quality, +0 unless named. "In game" is the average on a dummy over a long run; proc-heavy builds vary by several percent from run to run.

| Build | In game | Calculator | Difference |
|---|---|---|---|
| Excalibur, 50 Vooite (hits only) | 898 | 898 | – |
| Same, +9 | 1,360 | 1,347 | −1% |
| Excalibur, 12 Kitsunite / 12 Galaxite / 12 Tetrinite / 4 Bismuth | 4,500 | 4,968 | +10% |
| Same, +9 | ~5,600 | 5,681 | +1% |
| Same, Kitsune | 6,686 | 6,722 | +1% |
| Same, Kitsune, +9 | ~7,400 | 7,799 | +5% |
| Excalibur, 46 Vooite + 4 Bismuth (8%) | 953 | 898 | −6% |
| Excalibur, 45 Vooite + 5 Bismuth (10%) | 1,328 | 1,314 | −1% |
| Excalibur, 35 Vooite + 15 Bismuth (30%) | 1,585 | 1,535 | −3% |

What they settle:

- **Hits, swing time and enhancement are right.** The card shows 1,260 damage and 1,890 at +9 (×1.5), and the hits-only weapon matches. The card's ATK SPD (1.4 for Excalibur) is the swing time, rounded.
- **Procs don't grow with enhancement.** If they did, +9 would add about 2,400 DPS to the Excalibur; the game added about 1,100 (Human) and 700 (Kitsune).
- **Bismuth's Lethality, crit chance and crit damage are armour-only.** The Excalibur's card lists +1.8% attack speed (Bismuth at 10%), +45% crit chance and +20% crit damage (exactly Galaxite's) and no Lethality. Below a 10% share Bismuth shows no traits.
- **Prismatic Shift is big.** The wiki's data splits each rune stat by 8 (so 0.0875 explosion damage, a 0.375 s lightning cooldown), which gave the Vooite + Bismuth weapons almost nothing. The cards show Attack Speed, Prismatic Shift and Resonance (no black hole of Bismuth's own). We now count the four damage runes at their middle tier III rolls, each up `1 − (1 − 0.5 ÷ 7)^(hits in 10 s)` of the time. The 50% trigger is fitted to these two tests, so it's an estimate until the exact rule is known.
- **Golemites (open).** With two Kitsunite Golemites (30% traits, growth 0) the Excalibur did 5,420 (Human) and 9,300 (Kitsune); we give 5,852 and 7,691, so Golemite traits need their own check.

### Ore pages, 12 November

Every ore page on forgewiki.org (156 pages with `Infobox Ore`) was compared with `data/dps-stats.json`, `data/armour-dps.ts` and the trait texts:

- Fireite and Gargantuan burn for **10%** a second ("dealing 10% of Base Weapon Damage per second"); `Data:Ores.json` has 20%.
- Voidstar's crit chance is 33.3% (was 33%).
- Kokorite's, Sealed Curse's and Yin's Berserker is an armour trait only, so it's no longer listed as a weapon trait (it still counts on armour).
- Texts: Azuryxite +15% health (not +15), Tetrinite −15% stun time (not −35%), Vooite's Bad Smell (40% a second for 5 s, 10 s cooldown) and Radioactive (4% max HP a second), Bismuth's Prismatic Shift and Unshaken.
- Everything else with a damage trait matches: Aetherit, Crimsonite, Echotite, Eye Ore, Fierce Jade, Frost Core, Frost Fossil, Frost Star, Galaxite, Golem Heart, Heavenite, Kitsunite, Kyubite, Magmaite, Malachite, Marblite, Meteorite, Moon Stone, Onyx, Prismatic Heart, Rivalite, Sun Stone, Supermassive Black Hole, Tetrinite, Tiger's Eye, Vanegos, Wolfarite, Yang, Yeti Heart and Yin-Yang, and the armour traits in `data/armour-dps.ts`.
- Not counted in DPS (as before): Vooite's and Uranium's Radioactive (needs your max health), the below-35%-HP poison clouds (Bad Smell, Toxic Veins), thorns, freezes and slows, and life steal.

The sections below are the older comparisons, kept for history; the gaps they list are closed.

## 3 November 2026

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

### Known differences at the time

1. **Procs and enhancement.** The enhancement table now matches the wiki and the game: +5% a level up to +8, ×1.50 at +9, and +9 is the top. The wiki's procs (burn, explosions and so on) use the damage before enhancement; ours grow with enhancement like hits do. We keep that until it's checked in the game. An `it.todo` in the tests marks the switch.
2. **Ore procs.** The wiki now rolls proc chances the way it thinks the game does (`(floor(chance × 100) + 1) ÷ 100`, so 30% counts as 31%) and uses a burn and poison uptime that levels off (`load ÷ (1 + load ÷ 2)`). Our ore and rune maths are the ones the site already used, so saved forges and links show the same numbers as before. That is most of the gap on trait-heavy weapons (build 3). The small Demon and Angel gaps come from the same two rules.
3. **Cooldown procs.** Race procs with a cooldown (Orc Lord, ArchAngel) use the wiki's `1 ÷ (cooldown + 1 ÷ (chance × hits per second))`, so those match.

Apart from the enhancement table, nothing here has been checked against the game yet; the wiki's script is a community model.

## Version 1.10 (8 November 2026)

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
