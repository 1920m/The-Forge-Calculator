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

Galaxite, Kyubite and Fierce Jade are at 31.25%, so all three are at full strength. Bismuth is at 6.25%, below 10%, so its normal traits are off (it's in `traits.inactive`). Bismuth's random tier-3 attack rune on hit is the exception: the damage model counts it at any share.

## 7. DPS at +0

The weapon traits that matter for damage, added up and then capped:

| Stat | Galaxite | Kyubite | Fierce Jade | Total | Cap | Used |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Crit chance | 45% | 40% | 35% | 120% | 100% | **100%** |
| Crit damage | 20% | 18% | 20% | 58% | 100% | **58%** |
| Lethality | – | – | 20% | 20% | 300% | **20%** |
| Attack speed | – | – | 15% | 15% | 150% | **15%** |

The real swing time of the Gauntlets is 0.51 s (the item card says 0.47, which is an index, not the real time):

```
hits per second = (1 + 0.15) ÷ 0.51           = 2.2549
crit blend      = 1.00 × (1.45 + 0.58) + 0     = 2.03
hit DPS         = 393.33 × (1 + 0.20) × 2.03 × 2.2549 = 2160.56
```

Procs, which don't crit:

| Proc | From | Sum | DPS |
| --- | --- | --- | ---: |
| Black hole | Galaxite: 30% chance, 60% weapon damage, plus Bismuth's 125% rainbow wave | 393.33 × 1.85 × 0.30 × 2.2549 | 492.25 |
| Burn | Kyubite 45%/s plus Bismuth's rune 3.25%/s; fire is up all the time (0.40 × 2.2549 × 4 s ≥ 1) | 393.33 × 0.4825 × 1 | 189.78 |
| Explosion | Bismuth's rune: 5.25% chance, 8.75% damage | 393.33 × 0.0875 × 0.0525 × 2.2549 | 4.07 |
| Lightning | Bismuth's rune: 5.875% chance, 10% damage, 0.375 s cooldown | 393.33 × 0.10 × 0.05875 × 2.2549 | 5.21 |
| **Total procs** | | | **691.31** |

```
estimated DPS = 2160.56 + 691.31 = 2851.87
```

The API reports it as `dps.total: 2851.87` with `estimated: true` and the `ESTIMATED_DPS` warning: it's the community damage model averaged over time, not something measured in game.

## 8. At +9 with a rune (the `dps` example)

```json
{ "type": "dps", "weapon": { "item": "dark-knights-gauntlets", "ores": [ ...same ores... ] },
  "enhancement": 9, "runes": [{ "id": "blast-chip", "level": 3, "secondaries": ["crit_chance", "lethality", "atk_speed"] }] }
```

- +9 multiplies damage by 1.50: `393.33 × 1.5 = 590`.
- Blast Chip III's side effects add before the caps: crit chance (already capped at 100%), lethality +15% (now 35%) and attack speed +18% (now 33%), so `hits per second = 1.33 ÷ 0.51 = 2.6078`.
- Its explosion adds 615.45 DPS.

Result: **5986.78** estimated DPS (hit 4216.61, procs 1770.17). The `breakdown` shows how much each layer adds: base weapon 771.24, ore traits 2080.63, enhancement 1425.94, runes 1708.97.

## 9. Armour and Golemites, briefly

- **Dark Knight Chestplate**, World 4, 10 Galaxite + 10 Kyubite: M = 21, health 25%, so `25 × 21 × 2 = 1050 DEF`. At 20 ores its class (lock at 52) has a 0% chance, so the API adds `CLASS_NOT_AVAILABLE`.
- **Lucky Cat Golemite**, 10 Lucky Cat: Lucky Cat is Epic, so it's named "Lucky Cat Golemite", Epic, with 23% mining help and 15% ore-trait share. `combat.damage` is `null`: how Golemites fight isn't known, so the API doesn't make a number up.
