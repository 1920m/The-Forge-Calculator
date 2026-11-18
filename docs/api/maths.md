# Worked example: Dark Knight's Gauntlets

Every number below is what the API and the calculator page return for this request, worked out by hand so you can follow each step. The same figures are checked by the tests in `tests/api.test.ts` and `tests/api-docs.test.ts`.

```json
{ "type": "forge", "kind": "weapon", "item": "dark-knights-gauntlets",
  "ores": [{ "id": "galaxite", "count": 5 }, { "id": "kyubite", "count": 5 },
           { "id": "fierce-jade", "count": 5 }, { "id": "bismuth", "count": 1 }] }
```

## 1. World

Dark Knight's Gauntlets is only in the World 1–2 forge, so the API uses forge world 2 (shown as `1–2`) and sets `worldInferred: true`. If an item were in several forges, the API would look for the one world where all the ores are found, and otherwise answer `WORLD_REQUIRED` (see [discord-handoff.md](discord-handoff.md#world-required)).

## 2. Multiplier

16 ores in total. Each ore's multiplier, weighted by how many there are:

| Ore | Count | Share | Multiplier | Rule |
| --- | ---: | ---: | ---: | --- |
| Galaxite | 5 | 31.25% | 25 | fixed |
| Kyubite | 5 | 31.25% | 17 | fixed |
| Fierce Jade | 5 | 31.25% | 17 | fixed |
| Bismuth | 1 | 6.25% | (average) | takes the average of the others |

Bismuth has no multiplier of its own (`multiplier: null`, `multiplierRule: "average"`), so it counts as neither more nor less than the rest and drops out:

```
M = (25 × 5 + 17 × 5 + 17 × 5) ÷ 15 = 295 ÷ 15 = 19.6667
```

## 3. Rarity

The primary ore is the one there's most of. Galaxite, Kyubite and Fierce Jade tie at 5; ties go to the higher multiplier, so Galaxite (25) wins. Galaxite is Divine, so the item is **Divine**.

## 4. Damage

Dark Knight's Gauntlets has base damage 10. At 100% quality the stat is doubled:

```
damage = base × M × (1 + quality) = 10 × 19.6667 × 2 = 393.33 DMG
```

At 50% quality it's `10 × 19.6667 × 1.5 = 295 DMG`, which is what the quality buttons in the Discord example show.

## 5. Chance

Only the total ore count picks the class. The 16-ore row of the odds table, for World 1–2's classes:

| Dagger | Straight Sword | Gauntlets | Katana | Greatsword | Great Axe | Colossal Sword |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0% | 0% | **3%** | 26% | 69% | 1% | 0% |

Inside the Gauntlets class each item has a weight of 1/N:

| Item | N | 1/N |
| --- | ---: | ---: |
| Ironhand | 1 | 1 |
| Boxing Gloves | 4 | 0.25 |
| Relevator | 4 | 0.25 |
| Savage Claws | 4 | 0.25 |
| Dark Knight's Gauntlets | 6 | 0.1667 |
| **Total** | | **1.9167** |

```
in class = 0.1667 ÷ 1.9167 = 8.6957%
overall  = 3% × 8.6957%    = 0.2609%
```

**Lock**: the Gauntlets slot can be locked from 14 ores (the lock row is 3, 9, 14, 18, 24, 31, 50 for the seven slots). With 16 ores it's lockable, so `lock.lockable: true`. Sending `lockClass: true` would make the chance 8.6957%.

## 6. Traits

A trait starts working when its ore is at least 10% of the craft (at 10% strength) and reaches full strength at 30%:

```
strength = 0.10 + 4.5 × (share − 0.10), between 0 and 1
```

Galaxite, Kyubite and Fierce Jade are at 31.25%, so all three are at full strength. Bismuth is at 6.25%, below 10%, so its own traits are off (it's in `traits.inactive`). Two Bismuth effects don't need a share: with any Galaxite in the weapon, its Resonance adds a rainbow wave to every black hole.

## 7. DPS at +0

The weapon traits that matter for damage, added up and then capped:

| Stat | Galaxite | Kyubite | Fierce Jade | Total | Cap | Used |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Crit chance | 45% | 40% | 35% | 120% | 100% | **100%** |
| Crit damage | 20% | 18% | 20% | 58% | 100% | **58%** |
| Lethality | – | – | 20% | 20% | 300% | **20%** |
| Attack speed | – | – | 15% | 15% | 150% | **15%** |

The real swing time of the Gauntlets is 0.506 s (the wiki's `Data:Weapons.json`, which has the game's own precision):

```
hits per second = (1 + 0.15) ÷ 0.506           = 2.2727
crit blend      = 1.00 × (1.45 + 0.58) + 0     = 2.03
hit DPS         = 393.33 × (1 + 0.20) × 2.03 × 2.2727 = 2177.64
```

Procs don't crit, and use the weapon's damage before enhancement. Their chances are rolled the way the game rolls them, one of 101 outcomes: `(⌊chance × 100⌋ + 1) ÷ 101`, so 30% counts as 31/101 = 30.69%.

| Proc | From | Sum | DPS |
| --- | --- | --- | ---: |
| Black hole | Galaxite's 60%; 30% chance (30.69% rolled) with a 1 s cooldown: `1 ÷ (1 + 1 ÷ (0.3069 × 2.2727))` = 0.4109 a second. Bismuth's 125% wave needs a 10%+ share, and 1 in 16 is 6.25% | 393.33 × 0.60 × 0.4109 | 96.98 |
| Burn | Kyubite: 45% a second, 45% chance (45.54% rolled), 5 s. Up when any hit in the last 5 s applied it: 2.2727 × 5 = 11.36 hits, so `1 − 0.5446^11.36` = 0.999 | 393.33 × 0.45 × 0.999 | 176.82 |
| **Total procs** | | | **273.79** |

```
estimated DPS = 2177.64 + 273.79 = 2451.43
```

The API reports it as `dps.total: 2451.43` with `estimated: true` and the `ESTIMATED_DPS` warning: it's a damage model averaged over time, checked against in-game tests (docs/wiki-dps-comparison.md).

## 8. At +9 with a rune (the `dps` example)

```json
{ "type": "dps", "weapon": { "item": "dark-knights-gauntlets", "ores": [ ...same ores... ] },
  "enhancement": 9, "runes": [{ "id": "blast-chip", "level": 3, "secondaries": ["crit_chance", "lethality", "atk_speed"] }] }
```

- +9 multiplies the **hits** by 1.50. Procs stay at the +0 weapon damage (tested in game, 12 Nov 2026).
- Blast Chip III's side effects add before the caps: crit chance (already capped at 100%), lethality +15% (now 35%) and attack speed +18% (now 33%), so `hits per second = 1.33 ÷ 0.506 = 2.6285`.
- Its explosion joins the ores' explosions: 80% damage, 50% chance (50.50% rolled): `393.33 × 0.8 × 0.5050 × 2.6285 = 417.64`.

Result: **4949.9** estimated DPS (hit 4249.94, procs 699.96). The `breakdown` shows how much each layer adds: base weapon 777.34, ore traits 1674.09, enhancement 1088.82, runes 1409.65.

## 9. Armour and Golemites, briefly

- **Dark Knight Chestplate**, World 4, 10 Galaxite + 10 Kyubite: M = 21, health 25%, so `25 × 21 × 2 = 1050 DEF`. At 20 ores its class (lock at 52) has a 0% chance, so the API adds `CLASS_NOT_AVAILABLE`.
- **Lucky Cat Golemite**, 10 Lucky Cat: Lucky Cat is Epic, so it's named "Lucky Cat Golemite", Epic, with 23% mining help and 15% ore-trait share. At level 13 and above it also fights: `combat.hitShare` is 2% of the weapon's damage at level 13, rising to 6% at 25, at `combat.hitsPerSecond` 0.6667 (the wiki's model).
