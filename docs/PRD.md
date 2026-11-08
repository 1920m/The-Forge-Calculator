# The Forge Calculator: PRD and Build Plan

> **Cris's correction, 23 Oct 2026:** Armour defence rounds to the **nearest whole number**, not upward and not to two decimals. Weapon damage keeps two decimals and also rounds to the nearest value (confirmed 24 Oct 2026: Tachi 247.7223 shows 247.72, Uchigatana 234.889 shows 234.89), so the ceiling formulas below are superseded. Apply the category-specific rounding once after quality and enhancement, retaining the exact weighted multiplier internally. Whether the game itself rounds before enhancement still needs a direct enhancement measurement. This correction supersedes historical rounding assumptions and the old decimal armour enhancement example.

> **Quality correction, 25 Oct 2026:** quality adds on top of a full 1×: **value = base × M × (1 + quality)**, not 2 × base × M × quality. Found from an in-game craft: Dark Knight's Gauntlets (base 10) from 5 Kitsunite, 5 Galaxite and 4 Fichilliumorite (26.25×) at "Excellent (92)%" shows 504.46 DMG = 262.5 × 1.9218, so the game's exact quality was 92.18% (the card rounds it). The old formula gives 483. Both formulas agree at 100%, which is why the 100% checks below still hold. The quality-label ranges are also off: the game calls 92% "Excellent".

> **Errata (added when the folder was packed, 23 Oct 2026).** Three older lines were corrected: the ore count is 3 to 55 (not "up to four"), and the rarity tag colours now live in `Handoff-Guide.md` (the old list used orange). Wherever this document and `Handoff-Guide.md` differ, the Handoff Guide wins. Everything in the "Measured mechanics", "Rules confirmed in game", class-odds and enhancement sections is the latest. Older guide-based ore tables further down may be stale: compare them with the "Ore traits" table and the wiki before seeding.

Oct 22, 2026 · @Albert Einstein

## Overview

The Forge Calculator is a free, no-login web app where a player builds an ore mix and sees, before spending any ore, which weapon or armour they can roll, at what odds, with which traits, and what damage or defence it reaches at every enhancement stage. The existing community calculators are outdated, so the main selling point is **current data that is easy to update after each patch**.

**Goals**

- Show the % chance of every weapon and armour type and variant for any ore count and mix.
- Calculate forged damage (weapons) and defence (armour) from base stat, average ore multiplier and quality.
- Show which ore traits activate and how strongly, based on each ore's share of the mix.
- Show the stats at each enhancement stage (+0 to the maximum), plus success odds and expected cost.
- Keep all game data in Supabase so a patch is a data edit, not a redeploy.

**Non-goals**

- No login, accounts or server-side saved builds (saved builds stay in the browser).
- No inventory sync with Roblox, and no claim of being official.

**Audience and targets (proposed)**

- Roblox Forge players, mostly on phones, so the layout is mobile-first.
- Calculator output within 1% of the in-game forge preview on 20 test recipes.
- Page interactive in under 2 seconds on a mid-range phone.
- A patch (new ore, changed multiplier) live in under 10 minutes.

## How forging works: what is confirmed and what is not

The core loop is well documented, but three things the calculator needs are not: the quality scale, the per-level enhancement gains, and how variant odds are normalised. Each row below carries a confidence rating, and anything marked Low or Unknown becomes a data-collection task (see Open questions).

| Mechanic | What the sources show | Confidence |
| --- | --- | --- |
| Item category | Decided only by total ore count. Ore type and rarity have no effect. More ore shifts odds toward heavier gear (dagger at 3 ores, colossal sword and heavy chestplate at 40+). Maximum is about 50 ores; sources say 50 or 51. | High |
| Variant inside a category | A second roll picks the variant using the "1/N" chance listed per item (Dagger 1/1, Hook 1/16). No source says whether these are relative weights that get normalised to 100%. I assume they are. | Medium |
| Average multiplier | Sum of (ore multiplier × count) ÷ total ore count. Up to 4 different ores per forge. | High |
| Quality | Three minigames (bellows, casting, hammer) set a tier from Broken to Masterwork. Calculators assume Masterwork. One source says each 1% of mastery adds 0.01 to the multiplier, calculators use ×1.00 at the top. | Low |
| Weapon damage | Base damage × average multiplier × quality. Matches a published example: 8 × 2.17 × 1.00 = 17.33. One source says the multiplier also scales attack speed and range, others show those unchanged. | Medium for damage, Low for speed and range |
| Armour defence | Derived by me from five published recipes: piece base defence × average multiplier. At 1× the heavy chestplate is 50, leggings 44, helmet about 37. These reproduce published values within about 1.5%. Light and medium bases are not published. | Medium for heavy, Unknown for light and medium |
| Trait activation | An ore's trait applies once that ore is at least 10% of the mix. Several traits can be active at once. | High |
| Trait strength | Rises with the ore's share and is full at 30%. From published recipe outputs: 25% share gives 77.5% of the effect, 26.7% gives 85%, 30% or more gives 100%. | Medium (derived) |
| Primary ore | No source describes a "primary ore" rule. The largest-share ore appears to drive item appearance, and one source says it sets the rarity-tier buffs on weapons. | Low |
| Enhancement | Cap of +7 on the Fandom wiki, though one calculator mentions shields for +8 and above. Success to reach each level: +1 100%, +2 100%, +3 70%, +4 60%, +5 50%, +6 45%, +7 45%. A failure drops one level. Rune slots open at +3 and +6. Costs are gold plus essence. | Medium for odds, Unknown for stat gain per level |

Where sources disagree I use the newest one and flag the row.

## Formulas the calculator will use

Every formula below is stored as code in one `engine` module with unit tests, and each carries a status of confirmed, derived or assumed so the UI can show a small "verified" badge.

**1. Average multiplier (confirmed)**

```latex
M = \frac{\sum_i m_i \, n_i}{N}, \qquad N = \sum_i n_i
```

**2. Weapon damage (confirmed, quality scale assumed)**

```latex
\text{Damage} = \left\lceil 100 \cdot 2 \cdot D_{\text{base}} \cdot M \cdot q \right\rceil / 100
```

D\_base is the wiki's base damage for the weapon, q is the quality fraction (1.00 at Masterwork). Confirmed in game: Hachiwari, 8.25 base, 10.88×, 100% quality gives 179.52.

**3. Armour defence (derived)**

```latex
\text{Defence} = \operatorname{round}\left(2 \cdot H_{\text{piece}} \cdot M \cdot q\right)
```

Base values are twice the wiki's "Health %" number for the piece (Dark Knight Chestplate 25 gives a base of 50). Confirmed against two in-game items; see Defence formula, solved. Quality is a straight percentage multiplier.

**4. Trait strength (activation confirmed, curve derived)**

```latex
s_i = \frac{n_i}{N}, \qquad f(s) = \begin{cases} 0 & s < 0.10 \\ \min\left(1,\; 0.10 + 4.5\,(s - 0.10)\right) & s \ge 0.10 \end{cases}
```

Measured, not assumed: a trait's effect is its listed value times f(s). It is 10% of the effect at 10% share and 100% at 30% share, in a straight line. The same factor scales negative effects such as -10% Vitality on Eye Ore. Evidence is in the Measured mechanics section.

**5. Variant odds inside a category (assumed)**

```latex
P(v) = \frac{1 / c_v}{\sum_j 1 / c_j}
```

`c` is the "1/N" chance shown per item. Example: Dagger 1/1, Falchion Knife 1/2, Gladius Dagger 1/4, Hook 1/16 gives about 55%, 28%, 14% and 3%.

**6. Category odds by ore count (data, not a formula)**

No closed formula is known, but the full table now exists for 3 to 55 ores (see Measured mechanics). It depends only on the total ore count. The engine looks up the row for N and then applies the variant formula above inside each class. Above 55 ores the table is undefined, so the app uses the 55-ore row and says so.

**7. Enhancement stage (structure known, gains unknown)**

```latex
U_L = V_{100} \cdot q \cdot (1 + 0.05\,L), \qquad L = 0,\dots,10
\\
\text{Armour}_L = \operatorname{round}(U_L), \qquad
\text{Weapon}_L = \left\lceil 100 \cdot U_L \right\rceil / 100
```

`V_100` is the item's unrounded value at 100% quality (damage or defence), `q` is the quality fraction, and `L` is the enhancement level. The 5% per level is confirmed in game. Armour uses nearest-integer rounding; weapons round upward to two decimals under the existing weapon default. Whether rounding happens before or after the enhancement multiplier is not yet known; the engine rounds once at the end until Cris confirms otherwise. For the exact Dark Knight recipe, the calculated armour display at +10 is 938 DEF; the older 938.25 decimal expectation is superseded, and the enhancement sequence still needs an in-game check.

## Game data to seed the database

This is the starting dataset, collected from guides and the Fandom and BloxInformer wikis between late 2025 and October 2026. Drop chances are shown as 1/N. The blocked wiki pages (forgewiki.org, Fandom home) could not be opened directly, so a few rows are missing or conflicting and are flagged.

### Ores

| Ore | Rarity | Multiplier | Drop 1/N | Trait (applies to) |
| --- | --- | --- | --- | --- |
| Stone | Common | 0.20 | 1 | None |
| Sand Stone | Common | 0.25 | 2 | None |
| Copper | Common | 0.30 | 3 | None |
| Iron | Common | 0.35 | 5 | None |
| Cardboardite | Common | 0.70 | 31 | None |
| Tin | Uncommon | 0.425 | 7 | None |
| Silver | Uncommon | 0.50 | 12 | None |
| Gold | Uncommon | 0.65 | 16 | None |
| Bananite | Uncommon | 0.85 | 30 | None |
| Cobalt | Uncommon | 1.00 | 37 | None |
| Titanium | Uncommon | 1.15 | 50 | None |
| Lapis Lazuli | Uncommon | 1.30 | 73 | None |
| Mushroomite | Rare | 0.80 | 22 | None |
| Platinum | Rare | 0.80 | 28 | None |
| Diamond | Rare | 2.00 | 192 | None |
| Aite | Epic | 1.10 | 44 | None |
| Poopite | Epic | 1.20 | 131 | Poison aura below 35% HP, fears enemies (both) |
| Obsidian | Epic | 2.35 | 333 | +30% defence (armour) |
| Emerald | Epic | 2.55 | 363 | None |
| Ruby | Epic | 2.95 | 487 | None |
| Rivalite | Epic | 3.33 | 579 | +20% crit chance (weapon) |
| Uranium | Legendary | 3.00 | 777 | AoE damage of 5% max HP while in combat (armour) |
| Mythril | Legendary | 3.50 | 813 | +15% defence (armour) |
| Eye Ore | Legendary | 4.00 | 1,333 | +15% damage, -10% max HP (both) |
| Fireite | Legendary | 4.50 | 2,187 | 30% on-hit chance of burn for 20% weapon damage over 2s (weapon) |
| Lightite | Legendary | 4.60 | 3,333 | +15% movement speed (armour) |
| Magmaite | Legendary | 5.00 | 3,003 | 35% on-hit chance of explosion for 50% weapon damage (weapon) |
| Rainbow Crystal | Legendary | 5.25 | not found | None listed |
| Demonite | Mythical | 5.50 | 3,666 | 15% on-hit burn, Demon's Backfire on armour (both) |
| Darkryte | Mythical | 6.30 | 5,555 | 15% chance to dodge a hit (armour) |
| Arcane Crystal | Mythical | 9.00 | 100,000 (one source) | None listed |

### World 3 ores (from your in-game index screenshots)

These values come straight from the game's ore index, so they replace the conflicting guide values (Etherealite is 8.5, not 11.1; Duranite is 9, not 12). "Trait on" only says whether the ore has a trait and what it applies to. The trait effects themselves are still to be collected.

| Ore | Rarity | Drop 1/N | Multiplier | Price | Trait on |
| --- | --- | --- | --- | --- | --- |
| Tungsten | Common | 30 | 1.95 | 48.75 | None |
| Sulfur | Uncommon | 36 | 2.10 | 51.56 | None |
| Pumice | Rare | 44 | 2.20 | 54.38 | None |
| Graphite | Rare | 52 | 2.33 | 58.13 | Armour |
| Aetherit | Rare | 65 | 2.55 | 63.75 | Weapon and armour |
| Scheelite | Rare | 79 | 2.80 | 69.38 | None |
| Larimar | Epic | 96 | 3.10 | 76.88 | None |
| Neurotite | Epic | 115 | 3.20 | 80.63 | None |
| Frost Fossil | Epic | 137 | 3.34 | 84.38 | Weapon and armour |
| Tide Carve | Epic | 163 | 3.50 | 88.13 | None |
| Velchire | Legendary | 241 | 4.70 | 103.13 | Armour |
| Sanctis | Legendary | 305 | 5.00 | 112.50 | Armour |
| Mistvein | Rare | 437 | 5.40 | 135.00 | None |
| Lgarite | Rare | 520 | 5.70 | 140.63 | None |
| Voidfractal | Rare | 576 | 6.00 | 150.00 | None |
| Moltenfrost | Epic | 667 | 6.20 | 155.63 | None |
| Snowite | Legendary | 721 | 6.00 | 150.00 | Weapon |
| Crimsonite | Epic | 755 | 5.80 | 159.38 | Weapon |
| Malachite | Epic | 850 | 6.40 | 165.00 | Weapon |
| Aqujade | Epic | 888 | 6.75 | 168.75 | None |
| Cryptex | Epic | 1,010 | 7.00 | 174.38 | None |
| Galestor | Epic | 1,111 | 7.20 | 178.13 | None |
| Voidstar | Legendary | 1,363 | 7.50 | 187.50 | Weapon |
| Iceite | Mythic | 1,650 | 8.00 | 196.88 | Weapon |
| Etherealite | Mythic | 1,777 | 8.50 | 208.13 | Armour |
| Prismatic Heart | Legendary | 5,555 | 4.30 | 112.50 | Weapon (Prismarine Spider drop) |
| Yeti Heart | Mythic | 7,407 | 6.00 | 150.00 | Weapon (Yeti drop) |
| Suryafal | Relic | 8,341 | 11.50 | 328.13 | None |
| Golem Heart | Divine | 9,259 | 8.50 | 187.50 | Weapon (Golem drop) |
| Heavenite | Divine | 26,666 | 13.70 | 468.75 | Weapon |
| Gargantuan | Divine | 55,555 | 15.00 | 624.38 | Weapon |
| Mosasaursit | Exotic | 1 | 7.50 | 135.25 | Armour (Iceberg drop) |

**More World 3 ores** (corrected: these are World 3, not World 4)

| Ore | Rarity | Drop 1/N | Multiplier | Price | Trait on |
| --- | --- | --- | --- | --- | --- |
| Frogite | Epic | 1,133 | 6.20 | 159.38 | Armour |
| Moon Stone | Legendary | 1,328 | 7.20 | 178.13 | Weapon |
| Gulabite | Legendary | 1,666 | 7.77 | 187.50 | None |
| Coinite | Legendary | 2,525 | 1.00 | 300.00 | None |
| Duranite | Mythic | 3,570 | 9.00 | 225.00 | Armour |
| Evil Eye | Mythic | 5,555 | 9.50 | 249.38 | None |
| Stolen Heart | Divine | 9,054 | 12.50 | 288.75 | Weapon |
| Heart Of The Island | Relic | 20,576 | 13.00 | 346.88 | Armour |

Correction: Galaxite is in the index at 25× (World 4 table below), so the 11.5× from the guides was wrong.

### World 4 ores

| Ore | Rarity | Drop 1/N | Multiplier | Price | Trait on | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Bamboo | Uncommon | 6 | 4.00 | 93.75 | None | Rocks |
| Root Spire | Uncommon | 19 | 4.44 | 103.13 | None | Rocks |
| Water Stone | Rare | 54 | 4.70 | 105.94 | None | Rocks |
| Earthite | Rare | 84 | 5.00 | 117.19 | Armour | Rocks |
| Melonite | Rare | 100 | 5.20 | 121.88 | None | Rocks |
| Rock Seed | Rare | 124 | 5.50 | 128.44 | None | Rocks |
| Wraith | Epic | 142 | 5.75 | 134.06 | None | Rocks |
| Aurelia-No-Ki | Rare | 185 | 9.50 | 221.25 | None | Rocks |
| Tiger's Eye | Epic | 210 | 6.00 | 135.94 | Weapon | Rocks |
| Shikanite | Epic | 213 | 6.15 | 142.50 | None | Rocks |
| Cyanite Jade | Epic | 242 | 6.50 | 151.88 | Armour | Rocks |
| Sakuranite | Rare | 244 | 10.10 | 189.38 | None | Rocks |
| Heat Steel | Epic | 272 | 11.50 | 270.00 | None | Rocks |
| Fruite | Rare | 290 | 10.33 | 241.88 | None | Rocks |
| Magit | Epic | 300 | 6.80 | 159.38 | None | Rocks |
| Sealed Curse | Epic | 333 | 12.00 | 225.00 | Weapon and armour | Rocks |
| Blue Gem Quill | Epic | 375 | 11.00 | 257.81 | Armour | Rocks |
| Zenstone | Legendary | 380 | 12.21 | 228.94 | None | Rocks |
| Seedheart | Rare | 385 | 12.50 | 234.38 | None | Rocks |
| Sun Stone | Legendary | 390 | 13.39 | 314.06 | Weapon | Rocks |
| Azuryxite | Legendary | 485 | 13.00 | 304.69 | Armour | Rocks |
| Roosite | Legendary | 492 | 14.00 | 262.50 | None | Rocks |
| Viridite | Rare | 520 | 13.00 | 243.75 | None | Rocks |
| Meteorite | Mythic | 570 | 14.44 | 338.44 | Weapon | Rocks |
| Oni Mask | Epic | 666 | 14.50 | 271.88 | None | HellBringer |
| Heavenly Orb | Mythic | 777 | 15.15 | 355.31 | Armour | Rocks |
| Ancienite | Epic | 950 | 13.33 | 249.94 | None | Rocks |
| Kyomutite | Epic | 1,050 | 13.90 | 260.63 | None | Rocks |
| Lucky Cat | Epic | 1,111 | 11.10 | 260.63 | Armour | Rocks |
| Takiseki | Epic | 1,200 | 14.70 | 275.63 | None | Rocks |
| Dorabell | Legendary | 2,100 | 14.00 | 262.50 | None | Rocks |
| Ryuseki | Mythic | 2,400 | 15.80 | 296.25 | None | Rocks |
| Ceyite | Mythic | 3,600 | 16.50 | 309.38 | Armour | Rocks |
| Marblite | Mythic | 4,800 | 18.00 | 337.50 | Weapon | Rocks |
| Duquack | Legendary | 5,586 | 8.00 | 187.50 | Armour | Rocks |
| Onyx | Legendary | 6,666 | 10.00 | 234.38 | Weapon | Rocks |
| Onite | Legendary | 10 | 9.80 | 183.75 | None | Hellflame Oni |
| Kyubite | Divine | 100 | 17.00 | 18.75 | Weapon | Asura's Incarnate |
| Yin | Epic | 333 | 13.00 | 243.75 | Armour | Pale Oni |
| Yang | Epic | 333 | 13.00 | 243.75 | Weapon | Spirit Golem |
| Kokorite | Epic | Crafting | 14.75 | 276.56 | Weapon and armour | Crafting |
| Takenokoishi | Legendary | Crafting | 13.75 | 257.81 | Armour | Crafting |
| Sakurite | Mythic | Crafting | 14.20 | 266.25 | Armour | Crafting |
| Sentira | Relic | Crafting | 16.30 | 305.63 | Armour | Crafting |
| Wolfarite | Exotic | Crafting | 15.48 | 290.25 | Weapon | Crafting |
| Yin-Yang | Divine | Crafting | 13.50 | 253.13 | Weapon and armour | Crafting |
| Starite | Mythic | Crafting | 4.00 | 75.00 | Armour | Crafting |
| Matter | Relic | Crafting | 8.00 | 150.00 | None | Crafting |
| Anti Matter | Relic | Crafting | 11.50 | 215.63 | None | Crafting |
| Singularity | Exotic | Crafting | 12.75 | 239.06 | None | Crafting |
| Supermassive Black Hole | Exotic | Crafting | 18.00 | 337.50 | Weapon | Crafting |
| Galaxite | Divine | Crafting | 25.00 | 468.75 | Weapon and armour | Crafting |
| Star Dust | Epic | any rock | 2.50 | 46.88 | None | Any rock, rain event |
| Fierce Jade | Rare | 5 | 17.00 | 318.75 | Weapon and armour | Tower of Hell |
| Aether Lotus | Epic | 9 | 18.00 | 270.00 | Armour | Tower of Hell |
| Vanegos | Mythic | 20 | 19.50 | 292.50 | Weapon and armour | Tower of Hell |
| Vooite | Exotic | 30 | 21.00 | 393.75 | Weapon and armour | Tower of Hell |
| Fichilliumorite | Divine | 50 | 1.00 | 15.00 | Forging | Tower of Hell |
| Kitsunite | Divine | 75 | 27.50 | 515.63 | Weapon and armour | Tower of Hell |
| Pumpkinite | Rare | 1 | 1.50 | 22.50 | None | All caves, Haunted Night |
| Candy Ore | Legendary | 1 | 1.00 | 15.00 | None | All caves |
| Bismuth | Divine | 1 | 8.00 | 125.00 | Weapon and armour | Fallen Guardian |

Kitsunite is the highest multiplier in the index at 27.5×. Crafted ores (Crafting) have no drop chance, so they are stored with a null drop value and a source of "crafting".

### Ore traits (read from each ore's wiki page)

These are the trait lines from the [ore pages](https://forgewiki.org/wiki/Ores) for 68 of the 150 ores; the others show no trait. Rechecked against every ore page on 25 Oct 2026 (Wolfarite, Yin-Yang, Marblite, Ceyite and Sentira were missing, and Fierce Jade, Vanegos and Bismuth were incomplete). The wiki gives the effect at full strength only, so the 10% / 30% activation scaling is still unmeasured. Where the wiki and your screenshots disagree, recheck in game.

| Ore | Applies to | Trait effect (as listed) |
| --- | --- | --- |
| Poopite | Armour | Below 35% HP: enemies flee and an AoE poison cloud deals 15% of weapon damage/s for 5s |
| Obsidian | Armour | +30% Vitality |
| Rivalite | Weapon | +20% Crit Chance |
| Uranium | Armour | In combat, AoE damage of 1.2% max HP per second |
| Lightite | Armour | +15% Swiftness |
| Mythril | Armour | +15% Vitality |
| Eye Ore | Weapon and Armour | +15% Lethality, -10% Vitality |
| Darkryte | Armour | 15% chance to dodge fully; +50% move speed for 0.2s after a dodge |
| Fireite | Weapon | 20% chance to Burn 2s, 10% weapon damage/s |
| Demonite | Armour | 15% chance to Burn 2s at 20% weapon damage/s; 25% chance for the same Burn when hit |
| Magmaite | Weapon | 20% chance of an AoE explosion for 35% weapon damage |
| Graphite | Armour | +5% health; 20% chance to cut incoming damage by 12% |
| Aetherit | Weapon / Armour | Weapon: +8% attack speed. Armour: +5% move speed |
| Frost Fossil | Weapon and Armour | +17.5% physical damage, -5% move speed |
| Velchire | Armour | +20% move speed |
| Sanctis | Armour | +18% stamina |
| Snowite | Weapon | 30% chance to slow enemies 15% for 3s |
| Prismatic Heart | Weapon | +20% crit chance, +5% crit damage, 15% chance to freeze 2s (18s cooldown) |
| Crimsonite | Weapon | +20% physical damage |
| Iceite | Weapon | 25% chance to freeze 2s (12s cooldown) |
| Malachite | Weapon | 33% chance to Poison 3s, 10% weapon damage/s |
| Etherealite | Armour | +25% health |
| Voidstar | Weapon | +33.3% crit chance, +15% crit damage, -15% health |
| Heavenite | Weapon | 40% chance of Smite for 25% weapon damage |
| Mosasaursit | Armour | +35% health, -25% move speed |
| Yeti Heart | Weapon | +10% attack speed, +30% crit chance, +10% crit damage |
| Golem Heart | Weapon | +40% crit chance, +15% crit damage, 25% chance to slow 25% for 3s |
| Gargantuan | Weapon | 20% Burn (2s, 10%/s); 35% chance of AoE explosion for 50% weapon damage |
| Frogite | Armour | +12.5% jump, +7.5% dash distance |
| Moon Stone | Weapon | +25% physical damage at night |
| Duranite | Armour | +20% health; 25% chance to cut incoming damage by 25% |
| Stolen Heart | Weapon | Heal 7% of weapon damage per hit (cap 8% max HP) |
| Heart Of The Island | Armour | +15% health; below 35% HP gain +25% physical damage and move speed for 8s |
| Tiger's Eye | Weapon | +7.5% attack speed, +5% physical damage, +5% move speed, -10% health |
| Cyanite Jade | Armour | +20% health, -10% stamina |
| Onyx | Weapon | +35% crit chance, +17.5% crit damage |
| Duquack | Armour | +7.5% jump, +7.5% dash distance, +7.5% dash invincibility |
| Earthite | Armour | +10% health, -5% move speed |
| Blue Gem Quill | Armour | +5% jump, +10% dash distance, +8% dash invincibility, -12% dash cooldown |
| Sealed Curse | Weapon and Armour | Armour: Berserker (below 35% HP, +20% damage and speed for 6s). Both: +30% Lethality, -20% health, -10% stamina, -15% move speed |
| Azuryxite | Armour | +15 health; 40% chance to cut damage by 30%; -10% stamina; -15% move speed |
| Sun Stone | Weapon | 35% chance to Burn 5s at 35% weapon damage/s |
| Meteorite | Weapon | 25% chance of AoE explosion for 60% weapon damage |
| Heavenly Orb | Armour | +5% health, +15 regen/s, 45% chance to cut damage by 30% |
| Lucky Cat | Armour | +5% luck, +5% chance of an extra ore |
| Kyubite | Weapon | 40% chance of fire for 45% weapon damage/s over 5s, +40% crit chance, +18% crit damage |
| Yang | Weapon | +40% crit chance, +18% crit damage |
| Yin | Armour | +8% Vitality; below 35% HP +25% physical damage and move speed for 8s |
| Kokorite | Weapon and Armour | Armour: below 35% HP +25% damage and speed for 8s. Both: +30% Lethality, -5% Vitality, -5% Endurance, -5% Swiftness |
| Sakurite | Armour | +6% jump, +12% dash distance, +10% invincibility, +15% dash cooldown reduction |
| Ceyite | Armour | 40% chance to dodge attacks and gain a small move speed boost |
| Takenokoishi | Armour | -10% Swiftness, +15% Vitality, +5 regen, 70% chance to cut damage by 25% |
| Sentira | Armour | +5% Vitality, +10 regen/s, 50% chance to cut damage by 50%, +3% thorns |
| Wolfarite | Weapon | +8% attack speed, +15% Lethality, +6% Swiftness, -8% Vitality |
| Yin-Yang | Weapon and Armour | +45% crit chance, +20% crit damage, +8% Vitality; below 35% HP +25% physical damage and move speed for 8s |
| Marblite | Weapon | 40% chance of lightning for 60% weapon damage to up to 3 enemies within 20 studs (5s cooldown) |
| Galaxite | Weapon / Armour | Weapon: 30% chance of a black hole (60% weapon damage AoE), +45% crit chance, +20% crit damage. Armour: +8% Vitality, +8 regen, 50% chance to cut damage by 50%, +2% thorns |
| Starite | Armour | +4% luck, +6% yield chance |
| Supermassive Black Hole | Weapon | 45% chance of AoE explosion for 65% weapon damage; 45% chance of fire for 50% weapon damage/s over 5s |
| Fierce Jade | Weapon / Both | Weapon: +15% attack speed. Both: below 35% HP +35% physical damage and move speed for 10s, +35% crit chance, +20% crit damage, +20% physical damage |
| Vanegos | Armour / Both | Armour: below 35% HP +35% physical damage and move speed for 15s, +5% thorns. Both: +40% Lethality, -20% Vitality, -10% stamina, -10% move speed |
| Vooite | Armour / Both | Armour: +8% thorns, venom cloud below 35% HP (30% weapon damage/s, 12s, 25s cooldown). Both: poison cloud (40%/s, 10s) and 4% max HP AoE per second in combat |
| Fichilliumorite | Both | Takes the average multiplier of the other ores when forging |
| Bismuth (multiplier) | Both | Also takes the average multiplier of the other ores when forging; its listed 8× is not used (wiki ore page, and an in-game craft on 27 Oct 2026: 1 each of Bismuth, Fichilliumorite, Kitsunite and Galaxite shows 26.25×) |
| Kitsunite | Weapon / Armour | Weapon: lightning 60% for 80% damage, Smite 50% for 50%, Burn 50% (5s, 40%/s), explosion 40% for 70%. Armour: +25% Vitality, +15 regen, +6% thorns, +9% yield, +7% luck |
| Bismuth | Weapon / Armour | Weapon: +18% attack speed, random T3 attack rune on hit, rainbow wave of 125% weapon damage on Galaxite black hole. Armour: +15% crit chance, +15% crit damage, +15% Lethality, fire, poison, black hole and resonance damage +1% per 500 HP (up to +20%), +6 regen/s, heal 2.5% max HP when a Galaxite black hole triggers |
| Aether Lotus | Armour | +30% Vitality; 60% chance to cut damage by 65%; +18 regen/s |
| Zephyte | Armour | +30% move speed, +12.5% jump, +12.5% dash distance, +12.5% invincibility |
| Echotite | Weapon | Reverberation: 8% chance for an attack to hit twice (20% Daggers, 16% Straight Swords, 12% Gauntlets), damage only. Explosion: 40% chance for 50% weapon damage. Fracture: hits stun 20% faster. Echoes of Decay: hitting an Ancient Poison mark spreads it with the next 2 attacks |
| Frost Core | Weapon / Armour | Both: +15% Lethality, +10% crit damage. Armour: +12.5% Vitality; when hit above 60% HP, 30% chance of a blizzard for 60% weapon damage a second for 6 s (20 s cooldown; with Bismuth 100%, 12 s, no HP limit); +5% thorns; −5.5% move speed |
| Tetrinite | Weapon / Armour | Weapon: poison 75% for 40% a second (6 s); lightning 50% for 70% to up to 3 enemies (4 s cooldown); Ancient Poison: 50% chance to mark for 5 s, all poison deals +50% to it. Armour: −30% stun buildup, −35% stun time, +6 regen/s, +15% dash distance, +12.5% move speed |
| Bizzarite | Armour | Second Wind: below 10% HP, restores 25% over 5 s (90 s cooldown). Time Stop: after 75 hits, stuns enemies within 20 studs for 1.5 s (45 s cooldown). Void Mark: when hit, 30% chance to mark the attacker for 5 s, taking +15% from weapon hits (22.5% and 5 enemies with Galaxite). Void Phase: 12% chance to ignore a hit (15% with Galaxite). Heaven's Ascent: +0.5% move and attack speed per second in combat, up to 12.5%. +10% move speed |
| Frost Star | Weapon | Frost Slash: 30% chance for 25% weapon damage. Glacier Explosion: crits have a 50% chance for 65%. Polar Shift: every 10 s in combat, the next of +10% attack speed, Fracture, Lethality or crit damage. Snow: 70% chance to slow 30% for 8 s. Starfall: 20% chance for 125% (10 s cooldown; 225% with Galaxite). Stellar Mark: every 5 hits on the marked enemy, 150% |
| Royal Boneite | Weapon / Armour | Weapon: Life Steal 2.5% of weapon damage per hit (up to 8% max HP). Armour: +15% Vitality |

Candy Ore and Pumpkinite list "None".

## Measured mechanics (22 Oct 2026 update)

This section supersedes the assumed formulas earlier in the doc. I measured it by driving [theforgecalculator.org](https://theforgecalculator.org/) with controlled ore mixes and cross-checked it against the wiki's [Weapons](https://forgewiki.org/wiki/Weapons), [Armor](https://forgewiki.org/wiki/Armor) and [Ores](https://forgewiki.org/wiki/Ores) pages. The calculator is a third-party tool, so each rule carries its evidence and should still be spot-checked in game.

| Rule | Result | Evidence |
| --- | --- | --- |
| Average multiplier | M = Σ(multiplier × count) / N | 5 Mythril + 9 Iron gave 1.47×; (5×3.5 + 9×0.35) / 14 = 1.475 |
| Category odds | Depend only on total ore count, not on which ores | Iron-only and Mythril-only mixes gave identical tables for 3 to 20 ores |
| Category table range | Defined for 3 to 55 ores; the calculator shows no data above 55 | 56 or more ores shows "probability data is only available for 3-55 ores" |
| Variant odds in a category | P(v) = (1/c\_v) / Σ(1/c\_j) | Dagger class: 1, 1/2, 1/4, 1/16, 1/2, 1/6, 1/8 gives 38.40%, 19.20%, 9.60%, 2.40%, 19.20%, 6.40%, 4.80%, exactly as the formula predicts |
| Trait activation | Needs an ore share of at least 10% | 1 Mythril in 10 ores (10.0%) transferred; below 10% nothing transfers |
| Trait strength | f(s) = 0 if s < 0.10, else min(1, 0.10 + 4.5 × (s − 0.10)); full strength at 30% | Mythril (+15% Vitality): 18.2% share gave 7.02%, 27.8% gave 13.50%, 28.8% gave 14.22%, 30% gave 15.00%; Eye Ore at 26.3% gave 12.51 of 15; Obsidian at 26.3% gave 25.03 of 30 |
| Negative trait effects | Scale with the same f(s) | Eye Ore at 26.3%: -8.34% Vitality, which is 0.834 × 10 |
| Armour defence | Base value × M, where the base is the piece's "Health %" number from the wiki table | 38-ore Heavy Chestplate at 3.33×: low estimate 54.10 = 16.25 × 3.33 |
| Defence upper estimate | Calculator shows a high figure of 2 × (best variant base) × M | 246.34 = 37 × 3.33 × 2; unexplained, probably a quality or enhancement ceiling |
| World pools | Which weapon classes exist changes by world; the odds per slot do not | See the world table below |

The trait-strength curve replaces my earlier fitted exponent. It is a straight line from 10% of the effect at 10% share to 100% at 30% share, and it fits all six points I measured.

### Weapon category odds by ore count (%)

Columns are the seven weapon slots in order. In World 1 and 2 the slots are Dagger, Straight Sword, Gauntlets, Katana, Greatsword, Great Axe, Colossal Sword. In World 3 and 4 slot 3 is Mace, slot 4 is Axe and slot 5 is Spear. Blank means 0. Values are whole percents as the source calculator rounds them, so rows can sum to 99 or 101.

```csv
ores,slot1_dagger,slot2_straight_sword,slot3_gauntlets_mace,slot4_katana_axe,slot5_greatsword_spear,slot6_great_axe,slot7_colossal
3,100,,,,,,
4,86,14,,,,,
5,35,65,,,,,
6,14,86,,,,,
7,6,74,20,,,,
8,2,44,54,,,,
9,1,24,65,,,,
10,,11,47,42,,,
11,,5,32,63,,,
12,,3,22,72,,,
13,,1,14,62,22,,
14,,1,8,46,45,,
15,,,5,34,60,,
16,,,3,26,69,1,
17,,,2,19,68,11,
18,,,1,13,57,28,
19,,,1,9,46,45,
20,,,1,6,36,57,
21,,,,4,29,65,2
22,,,,3,23,67,7
23,,,,2,18,66,13
24,,,,2,15,64,20
25,,,,1,12,60,26
26,,,,1,10,56,32
27,,,,1,9,53,37
28,,,,1,7,50,42
29,,,,1,7,47,46
30,,,,1,6,45,49
31,,,,,5,43,51
32,,,,,5,41,54
33,,,,,4,39,56
34,,,,,4,38,58
35,,,,,4,37,59
36,,,,,3,36,61
37,,,,,3,35,62
38,,,,,3,34,63
39,,,,,3,33,64
40,,,,,3,32,65
41,,,,,3,32,65
42,,,,,3,31,66
43,,,,,2,31,67
44,,,,,2,30,67
45,,,,,2,30,68
46,,,,,2,29,69
47,,,,,2,29,69
48,,,,,2,28,69
49,,,,,2,28,70
50,,,,,2,28,70
51,,,,,2,27,71
52,,,,,2,27,71
53,,,,,2,27,71
54,,,,,1,27,72
55,,,,,1,26,73
```

The 12-ore Katana 72%, 16-ore Greatsword 69% and 50-ore Colossal 70% anchors from my earlier research all match this table.

### Armour category odds by ore count (%)

Nine classes: Light, Medium and Heavy, each as Helmet, Leggings and Chestplate. Blank means 0.

```csv
ores,light_helmet,light_leggings,light_chestplate,medium_helmet,medium_leggings,medium_chestplate,heavy_helmet,heavy_leggings,heavy_chestplate
3,100,,,,,,,,
4,100,,,,,,,,
5,89,11,,,,,,,
6,56,44,,,,,,,
7,32,67,1,,,,,,
8,17,67,17,,,,,,
9,8,51,41,,,,,,
10,4,34,53,4,,,,,
11,2,20,47,31,,,,,
12,1,12,37,50,,,,,
13,,4,28,60,4,,,,
14,,4,19,55,22,,,,
15,,2,12,43,43,,,,
16,,1,8,32,57,8,,,
17,,1,5,22,57,16,,,
18,,,3,14,48,35,,,
19,,,2,9,39,50,,,
20,,,1,6,32,60,1,,
21,,,1,7,25,63,7,,
22,,,,3,19,59,19,,
23,,,,2,14,52,32,,
24,,,,1,10,44,44,,
25,,,,,7,36,51,5,
26,,,,,5,28,51,15,
27,,,,,4,21,47,28,
28,,,,,3,16,42,39,
29,,,,,2,11,35,47,4
30,,,,,1,8,28,49,13
31,,,,,1,6,22,46,25
32,,,,,1,4,17,42,37
33,,,,,,3,13,37,47
34,,,,,,2,10,33,54
35,,,,,,2,8,30,60
36,,,,,,1,7,27,64
37,,,,,,1,6,25,68
38,,,,,,1,5,23,71
39,,,,,,1,4,22,73
40,,,,,,1,4,20,75
41,,,,,,1,4,19,77
42,,,,,,,3,18,78
43,,,,,,,3,17,79
44,,,,,,,3,17,80
45,,,,,,,3,16,81
46,,,,,,,2,16,82
47,,,,,,,2,15,82
48,,,,,,,2,15,83
49,,,,,,,2,14,83
50,,,,,,,2,14,84
51,,,,,,,2,14,84
52,,,,,,,2,13,85
53,,,,,,,2,13,85
54,,,,,,,2,13,85
55,,,,,,,2,12,86
```

One cell in my capture looked wrong and I excluded it: Heavy Chestplate at 27 ores read 21%, but the rest of that row already sums to 100%.

### Lock thresholds

The calculator marks each class with the ore count at which it can be locked. Weapons: Dagger 3, Straight Sword 9, Gauntlets or Mace 14, Katana or Axe 18, Greatsword or Spear 24, Great Axe 31, Colossal Sword 50. Armour: Light Helmet 3, Light Leggings 11, Light Chestplate 15, Medium Helmet 20, Medium Leggings 24, Medium Chestplate 30, Heavy Helmet 35, Heavy Leggings 42, Heavy Chestplate 52. I don't yet know what "lock" does in game, so it is stored as data and shown with a question mark in v1.

### Which variants each world adds

| World | Weapon change | Armour change |
| --- | --- | --- |
| 1 and 2 | Base pool: Dagger (7 variants), Straight Sword (9), Gauntlets (5), Katana (3), Greatsword (4), Great Axe (6), Colossal Sword (8) | Light, Medium (Samurai, Viking) and Heavy (Knight, Dark Knight, Wolf, Raven, Goblin's Crown) |
| 3 | Gauntlets slot becomes Mace (5 variants), Katana slot becomes Axe (5), Greatsword slot becomes Spear (5) | Same as 1 and 2 |
| 4 | Adds Tanto, Jitte, Kunai, Damascus Dagger; Hachiwari, Chokuto, Dragon Blade; Shakujo, Sodegarami, Naginata (and Bo Staff by the wiki); Otsuchi, Kinmon Kamagatana, Sharktooth Odachi | Adds Rootguard (Medium), Ninja's set (Light) and Vanguard Chestplate (Heavy) |

The wiki also lists Shogun pieces, Vanguard Helmet and Leggings, Raven's pieces for every slot, and a Halberd with unknown stats. The calculator has none of these, so they may be a newer world or not yet craftable. They are flagged "unverified" in the seed data.

## Full weapon and armour data (wiki, 20 Oct 2026)

This replaces the earlier weapons and armour tables, which had conflicts. It is the seed data for the `weapons` and `armour_pieces` tables. Source: [Weapons](https://forgewiki.org/wiki/Weapons) and [Armor](https://forgewiki.org/wiki/Armor). "True speed" is the real swing time; "index speed" is what the in-game index shows. Chance is the "1/N" weight inside the class.

### Weapons

```csv
class,name,base_damage,index_speed_s,true_speed_s,range_studs,base_price,chance_1_in
Dagger,Dagger,4.3,0.35,0.47,6,68,1
Dagger,Falchion Knife,4.45,0.35,0.47,6,68,2
Dagger,Gladius Daggers,4.6,0.35,0.47,6,68,4
Dagger,Hook,4.73,0.39,0.52,6,68,16
Dagger,Cultist Dagger,5.25,0.35,0.47,6,68,2
Dagger,Shark's Fangs,3.87,0.27,0.36,6,68,6
Dagger,Curved Dagger,4.95,0.30,0.41,6,68,8
Dagger,Kunai,3.87,0.29,0.39,6,68,1
Dagger,Jitte,4.95,0.37,0.49,6,68,2
Dagger,Damascus Dagger,4.73,0.35,0.47,6,75,3
Dagger,Tanto,4.95,0.29,0.39,6,78,4
Straight Sword,Falchion Sword,7.5,0.59,0.70,8,120,1
Straight Sword,Gladius Sword,8,0.62,0.74,8,120,2
Straight Sword,Cutlass,9.375,0.66,0.78,8,120,2
Straight Sword,Rapier,7.5,0.49,0.58,8,120,4
Straight Sword,Chaos,9.375,0.59,0.70,8,120,16
Straight Sword,Candy Cane,7.5,0.44,0.52,8.8,120,8
Straight Sword,Hell Slayer,11.125,0.59,0.70,9.2,120,10
Straight Sword,Crystallized Broadsword,9.975,0.62,0.74,8,120,6
Straight Sword,Hook Blade,8.25,0.44,0.52,8.8,120,5
Straight Sword,Hachiwari,8.25,0.59,0.70,8,120,2
Straight Sword,Chokuto,7.5,0.54,0.64,8,120,1
Straight Sword,Dragon Blade,10.5,0.59,0.70,9.2,150,16
Straight Sword,Thornspire,10.875,0.59,0.70,8,150,12
Mace,Mace,7,0.46,1.17,8,205,1
Mace,Spiked Mace,7.3,0.46,1.17,8,205,2
Mace,Winged Mace,7.6,0.46,1.17,8,205,4
Mace,Hammerhead Mace,7.9,0.46,1.17,8,205,8
Mace,Grave Maker,8.8,0.46,1.17,8,205,16
Mace,Tetsubo,7.72,0.44,1.11,7.6,226,4
Mace,Kanabo,8.2,0.51,1.30,8.8,246,8
Gauntlets,Ironhand,7.6,0.51,0.55,6,205,1
Gauntlets,Boxing Gloves,8,0.59,0.63,6,205,4
Gauntlets,Relevator,9.6,0.69,0.74,6,205,4
Gauntlets,Savage Claws,8,0.47,0.51,6,205,4
Gauntlets,Dark Knight's Gauntlets,10,0.47,0.51,6,205,6
Axe,Axe,7,0.48,0.88,8,205,1
Axe,Battleaxe,7.35,0.48,0.88,8,205,1
Axe,Curved Handle Axe,7.7,0.48,0.88,8,205,4
Axe,Spade Armed Axe,8.05,0.48,0.88,8,205,8
Axe,Ornate Short Axe,8.4,0.48,0.88,8,205,6
Katana,Uchigatana,8.5,0.60,0.69,9,324,1
Katana,Tachi,8.925,0.63,0.73,9.45,324,4
Katana,Straight Edge Katana,9.35,0.60,0.69,9.45,324,6
Katana,Juto Katana,8.5,0.60,0.69,9.45,340,2
Katana,Kurokiba-gatana,9.35,0.55,0.63,9,356,8
Katana,Washi-maru,10.2,0.50,0.58,10.35,324,16
Greatsword,Crusader Sword,12,1.00,1.20,9,485,1
Greatsword,Long Sword,12,1.11,1.33,9.9,485,2
Greatsword,Dark Knight's Greatsword,15,1.11,1.33,9.9,485,4
Greatsword,Anchored Greatsword,13.8,0.91,1.09,9.9,485,6
Greatsword,Zweihander,14.4,1.05,1.26,10.35,485,1
Spear,Spear,7.5,0.45,0.73,11,120,1
Spear,Angelic Spear,13.11,0.41,0.66,11,120,8
Spear,Trident,8.25,0.45,0.73,11,120,2
Spear,Knight Spear,10.125,0.38,0.60,11,120,4
Spear,Compass Spear,10.5,0.47,0.76,11,120,6
Spear,Shakujo,8.25,0.45,0.73,11,144,2
Spear,Sodegarami,10.13,0.41,0.66,11,168,4
Spear,Bo Staff,10.5,0.41,0.66,11,162,8
Spear,Naginata,10.88,0.45,0.73,12.65,174,16
Great Axe,Double Battle Axe,15.75,1.05,1.70,9,850,1
Great Axe,Scythe,14.25,0.95,1.54,9,850,4
Great Axe,Reaper Scythe,17,0.95,1.54,9,850,3
Great Axe,Greater Battle Axe,17.25,1.00,1.62,9,850,4
Great Axe,Wyvern Axe,18.75,0.91,1.47,9,850,4
Great Axe,Anchored Straight Blade,18,1.00,1.62,9,850,6
Great Axe,Executioner's Greataxe,19.5,1.05,1.70,9,850,5
Great Axe,Sun Great Axe,19.5,0.83,1.35,9,850,8
Great Axe,Batwing Reaver,19.05,1.05,1.70,9,850,10
Colossal Sword,Great Sword,20,1.12,1.40,10,1355,1
Colossal Sword,Hammer,22,1.24,1.56,10,1355,4
Colossal Sword,Skull Crusher,24,1.40,1.75,10,1355,8
Colossal Sword,Dragon Slayer,22,1.12,1.40,11,1355,16
Colossal Sword,Comically Large Spoon,18,1.12,1.40,10,1355,16
Colossal Sword,Excalibur,30,1.12,1.40,15,1355,1000
Colossal Sword,Colossal TerrorBlade,22,1.02,1.28,10,1355,2
Colossal Sword,Colossal Gemblade,23,1.12,1.40,12,1355,6
Colossal Sword,Kinmon Kamagatana,23.4,1.12,1.40,10,1355,3
Colossal Sword,Otsuchi,25,1.24,1.56,10,1355,6
Colossal Sword,Sharktooth Odachi,27,1.12,1.40,13,2033,12
```

Notes for the seed script: I corrected three typos on the wiki page ("8,25 DMG" for Shakujo, and "0.38" and "1.05" missing their "s"). Reaper Scythe and Batwing Reaver are on the wiki but not in the calculator, so mark them unverified. Halberd is listed with every stat as "???" and is left out. I store the published numbers as is.

### Armour

The wiki column is called "Health" but the calculator turns it into the base number that M multiplies, so I store it as `base_health_pct` and derive defence from it.

```csv
class,name,slot,base_health_pct,base_price,chance_1_in
Light,Light Helmet,helmet,3.75,65,1
Light,Light Chestplate,chestplate,5,225,1
Light,Light Leggings,leggings,4.375,112.5,1
Light,Ninja's Helmet,helmet,9,65,1
Light,Ninja's Armor,chestplate,13.5,225,1
Light,Ninja's Leggings,leggings,10,112.5,1
Medium,Medium Helmet,helmet,6.25,335,1
Medium,Medium Chestplate,chestplate,8.75,850,1
Medium,Medium Leggings,leggings,7.5,485,1
Medium,Samurai Helmet,helmet,8,335,2
Medium,Samurai Chestplate,chestplate,12.75,850,2
Medium,Samurai Leggings,leggings,9,485,2
Medium,Viking Helmet,helmet,10.5,335,4
Medium,Viking Chestplate,chestplate,15,850,4
Medium,Viking Leggings,leggings,11,485,4
Medium,Rootguard Helmet,helmet,15,335,2
Medium,Rootguard Chestplate,chestplate,21,850,2
Medium,Rootguard Leggings,leggings,17,485,2
Heavy,Knight Helmet,helmet,12.5,1020,1
Heavy,Knight Chestplate,chestplate,16.25,1355,1
Heavy,Knight Leggings,leggings,13.75,1200,1
Heavy,Dark Knight Helmet,helmet,18.75,1020,2
Heavy,Dark Knight Chestplate,chestplate,25,1355,2
Heavy,Dark Knight Leggings,leggings,21.875,1200,2
Heavy,Wolf Helmet,helmet,25,1020,3
Heavy,Wolf Chestplate,chestplate,35,1355,3
Heavy,Wolf Leggings,leggings,28,1200,3
Heavy,Goblin's Crown,helmet,26,1020,6
Heavy,Raven's Helmet,helmet,26.5,1020,8
Heavy,Raven's Chestplate,chestplate,37,1355,8
Heavy,Raven's Leggings,leggings,29.25,1200,8
Heavy,Vanguard Helmet,helmet,29,1020,4
Heavy,Vanguard Chestplate,chestplate,40,1355,4
Heavy,Vanguard Leggings,leggings,32,1200,4
Heavy,Shogun Helmet,helmet,34,1020,8
Heavy,Shogun Chestplate,chestplate,46,1355,8
Heavy,Shogun Leggings,leggings,36,1200,8
```

Two conflicts remain: the wiki gives Wolf a 1/3 chance but the calculator uses 1/4, and the wiki lists Shogun, Vanguard Helmet and Leggings and Raven's pieces that the calculator lacks. The defence conflict I noted earlier is resolved: base defence is 2 × the wiki Health %, so no tuning constant is needed.

## Rules confirmed in game (from Albert)

These come from you playing the game, so they outrank anything I inferred from third-party sources.

| Rule | What happens | How the engine uses it |
| --- | --- | --- |
| Appearance (primary ore) | The ore with the largest count takes the item's appearance. If every ore has the same count, the ore with the highest multiplier wins. Example: 1 + 1 + 2 means the ore with 2 wins. | `primary = argmax(count)`, ties broken by `argmax(multiplier)`. A tie between two top counts with a third lower is not yet confirmed; I assume the same tie-break. |
| Locking | A weapon or armour piece can be locked once you have enough total ores. The small black text next to the lock on each piece shows the number. The lock thresholds I recorded earlier are those numbers. | Each result shows "lockable at N ores" and whether the current mix meets it. |
| Quality | The game computes the item's value at 100% quality, then multiplies by your quality percentage. Apply category-specific rounding afterward: armour to the nearest whole number; weapons to two decimals. A raw value of 699.55 displays as 700 DEF for armour and 699.55 DMG for a weapon. | Armour: `round(full_value × quality)`. Weapon: `ceil(full_value × quality × 100) / 100`. The calculator shows the 100% value and a quality slider. |
| Enhancement multiplier | Level L multiplies all stats (damage or defence) by 1 + 0.05 × L, from +0 (1.00×) to +10 (1.50×). | Table of 11 levels. This replaces the +7 cap from the Fandom wiki. |

### Enhancement levels

```csv
level,all_stats_multiplier
0,1.00
1,1.05
2,1.10
3,1.15
4,1.20
5,1.25
6,1.30
7,1.35
8,1.40
9,1.45
10,1.50
```

The screenshot you sent shows the enhance screen for Shogun's Leggings (item name Sakuranite, 803 DEF, quality 86% "Great", worth 27,517.45 gold). Going from +0 to +1 shows All Stats 1.00× to 1.05×, Rune Slots 0 to 0, a craft chance of HIGH (100%), and three requirement items with counts x3, x1 and x4 (they look like three tiers of crystal). The screen does not show a gold price. The 100% success at +1 matches the wiki's odds.

### Defence test: your Shogun's Leggings

Recipe: 4 Meteorite (14.44×), 12 Roosite (14×), 12 Heat Steel (11.5×), 13 Sakurite (14.2×), 41 ores in total. M = (4×14.44 + 12×14 + 12×11.5 + 13×14.2) / 41 = 548.36 / 41 = 13.375. The item shows 803 DEF at 86% quality.

| Reading of the data | Implied base for Shogun's Leggings | Verdict |
| --- | --- | --- |
| Quality is ignored: 803 / 13.375 | 60.04 (60 × 13.375 = 802.5, which rounds to the nearest integer, 803) | Fits neatly, but contradicts your rule that quality scales the value |
| Quality applies as a straight percentage: 803 / (0.86 × 13.375) | 69.81, or exactly 70 if the true quality is 85.8% (it is shown rounded) | Fits your rule if the base is 70 |
| Wiki Health % (36) used as the base | 36 × 13.375 = 481.5 | Does not fit. The wiki's Health % is the in-game index display, not the defence base |

### Defence formula, solved with your Dark Knight Chestplate

Your crafting screenshot gives a clean second data point: Sun Stone x9 (13.39×), Lucky Cat x8 (11.1×), Sealed Curse x8 (12×), Roosite x5 (14×), 30 ores. M = (9×13.39 + 8×11.1 + 8×12 + 5×14) / 30 = 375.31 / 30 = 12.51, which matches the 12.51× the forge screen shows. The result is a Dark Knight Chestplate at Masterwork (100%) with 626 DEF. The wiki's Health % for Dark Knight Chestplate is 25.

| Check | Calculation | Result |
| --- | --- | --- |
| Dark Knight Chestplate, 100% quality | Exact recipe: 2 × 25 × (375.31 / 30) = 625.516666…; nearest integer is 626. Using displayed M = 12.51 gives 625.5, also rounding to 626. | 626, exact match |
| Shogun's Leggings (wiki Health % 36) | 2 × 36 × 13.375 = 963 at 100% quality; 803 / 963 | quality of 83.4%, which is "Great" (75 to 84%), matching the label on your screenshot |
| Earlier Heavy chestplate figures | 166 / 3.33 and 280 / 5.6 both gave 50 | 2 × 25 = 50, so they were Dark Knight chestplates at full quality |

So the defence base of a piece is exactly twice its wiki Health %, and the rest of your rule holds:

DEF = round( 2 × Health% × M × quality ), rounded to the nearest whole number. Cris confirmed this correction on 23 Oct 2026; armour does not use the weapon's upward two-decimal rounding rule.

The 2× also explains the third-party calculator's high estimate, which was exactly twice its low one. One loose end: the leggings screenshot showed "\[86\]%" beside "Great", but the numbers need quality 83.4%. The 86 may be a different stat on that card (it is not the quality), so the app will trust the quality percentage you enter and not that number.

### Damage formula, solved with your Hachiwari

Your weapon screenshot: Sun Stone x2 (13.39×), Yeti Heart x2 (6×), Golem Heart x1 (8.5×), Meteorite x2 (14.44×), 7 ores. M = (2×13.39 + 2×6 + 8.5 + 2×14.44) / 7 = 76.16 / 7 = 10.88, matching the 10.88× on the forge screen. The result is a Hachiwari at Masterwork (100%) with 179.52 damage and a 0.59s attack speed.

| Check | Calculation | Result |
| --- | --- | --- |
| Damage | 2 × 8.25 (wiki base damage) × 10.88 × 1.00 | 179.52, exact match |
| Class odds | 7 ores gives Straight Sword 74%, Mace 20%, Dagger 6% | Matches the game's Forge Chances panel (74 / 20 / 6) |
| Variant odds | Hachiwari is 1/2 in the Straight Sword class | Matches the 1/2 shown |
| Rarity | Mythic | Meteorite is a Mythic ore, and it ties for the largest count (2 each with Sun Stone and Yeti Heart) but has the top multiplier, so it is the primary ore |

Weapons use the same underlying 2× formula as armour but different final rounding: **Damage = 2 × base damage × M × quality**, rounded up to two decimals under the documented weapon default. Armour instead rounds to the nearest whole number. The armour piece earlier was Legendary with Sun Stone (Legendary) the largest count, so **an item's rarity is the rarity of its primary ore**.

Two details from the screenshots for the app:

- The result card shows "ATK Speed 0.59s", which is the wiki's index speed, not the "true" 0.70s. The app shows the card value as the attack speed. DPS will use it too, with a note, until you tell me which one the game really swings at.
- In the forge panel a greyed-out class just means the ore count is too low to unlock it, and a padlock marked "Missing Recipe!" on a variant means the player hasn't unlocked that recipe. The app shows every variant from the wiki pages, whatever recipes the player owns, and marks each one with its minimum ore count.

### Still unknown after this

You said success chances are out of scope: the calculator only shows the stats (defence, or damage) at each enhancement level, not the odds, so I dropped them. The costs and rune slots are optional extras.

### Quality labels (unverified)

You supplied this list from a web search summary in your last tab. It is a search summary, not the game, and it contradicts your own screenshot: your leggings show 86% as "Great", but this list puts 75 to 84% at Great and 85 to 89% at Excellent. I store it as `quality_tiers` with a low-confidence badge and will fix the boundaries once you confirm them in game.

| Label | Range (unverified) |
| --- | --- |
| Broken | 0 to 24% |
| Poor | 25 to 39% |
| Rough / Worn | 40 to 49% |
| Average | 50 to 64% |
| Good | 65 to 74% |
| Great | 75 to 84% |
| Excellent | 85 to 89% |
| Perfect | 90 to 94% |
| Masterwork | 95 to 100% |

The same search also claimed Masterwork gives double the damage of Broken, and that final defence is base × ore multiplier × a quality multiplier running from 1× to 2×. That contradicts your rule (value × quality percentage, so a 25% quality item is worth 25% of the full value). I follow your rule. I also asked it for the base defence of every armour piece and it gave only the wiki Health % table back and said it was unsure about Shogun, so it added nothing.

### Runes (optional extension)

Rune slots open at +3 and +6. Values are ranges because each rune rolls its numbers, and Tier 2 and 3 versions exist.

| Rune | Effect | Range at tier I |
| --- | --- | --- |
| Drain Edge | Life steal | Heals 5 to 13% of physical damage dealt |
| Blast Chip | AoE explosion | 8 to 20% on-hit chance, 20 to 40% weapon damage |
| Flame Spark | Burn | 15 to 25% chance, 5 to 10% weapon damage per second for 1 to 2s |
| Venom Crumb | Poison | 25 to 35% chance, 4 to 7% weapon damage per second |
| Chill Dust | Slow | 5 to 10% slow for 1 to 2s |
| Frost Speck | Freeze | 10 to 20% chance to freeze for 1 to 2s |
| Rage Mark | Berserk | 12 to 26% damage and speed for a few seconds |
| Ward Patch | Shield | 5 to 15% chance to cut incoming damage by 6 to 14% |
| Briar Notch | Thorns | Reflects 2 to 10% of damage taken |

## What I need from you

Most of the original gaps are now closed: ore traits, the trait-strength curve, category odds for 3 to 55 ores, and the full weapon and armour tables. What is still missing, in order of importance:

1. **Enhancement costs and odds for +1 to +10.** The multipliers are known. Still needed: the success chance, the three crystal requirements (names and counts) and the rune slots gained at each level. One screenshot of the enhance screen per level is enough.
2. **The recipe behind your Shogun's Leggings.** The ore counts used, so I can test the defence formula against 803 DEF at 86% quality (933.72 at 100%).
3. **A weapon check.** One weapon with its ore counts, name, quality % and the damage shown.
4. **Quality labels.** The percentage ranges for each label (for example "Great" at 86%), and how the three minigames combine into the percentage.
5. **Failed enhancements.** Does a failure drop one level and keep quality? The wiki says it drops one level.
6. **Tie rule check.** For 2 + 2 + 1 ores, does the highest multiplier among the two tied ores win the appearance?
7. **Rune effects per rarity.** Optional. The calculator lists value ranges for 12 runes and the app can ship with those.

**Decisions that affect scope**

- Should version 1 include runes, or only ores, forging odds and enhancement? I recommend leaving runes for a later phase.
- Which worlds must be covered at launch? Newer ores have the most conflicting data.
- Do you want a name for the site, or should I use a placeholder like "Forge Planner"?

## Product requirements

The main flow is one screen: pick weapon or armour, add ores (3 to 55 in total), and watch odds, traits, stats and enhancement stages update live. P0 is the launch scope, P1 follows within two weeks, P2 is later.

| ID | Requirement | Priority |
| --- | --- | --- |
| F1 | Weapon and Armour mode switch. Pick up to 4 different ores and set a quantity for each, with a running total from 3 to 50. | P0 |
| F2 | Category odds: a stacked bar of every weapon or armour class for the current ore count (for example dagger 14%, straight sword 86%). | P0 |
| F3 | Variant odds: for each class, every variant with its % chance, base stats and forged stat. | P0 |
| F4 | Average multiplier and forged damage (weapons) or defence (armour) per variant, at +0. | P0 |
| F5 | Traits panel: each trait ore with its share of the mix, whether it is active (10% or more), and its strength toward the 30% cap. A hint such as "add 2 more Obsidian to reach 30%". | P0 |
| F6 | Enhancement view: a stage selector from +0 to the cap showing damage or defence, defence multiplier, success chance, and cumulative expected attempts, gold and essence to reach that stage. A line chart of stat against stage. | P0 |
| F7 | Ore picker with search, rarity filter, multiplier and trait shown on each card. | P0 |
| F8 | Data confidence badge on every number (confirmed, derived, assumed) and a "data last updated for patch X" label. | P0 |
| F9 | Shareable link that encodes the recipe in the URL. No account needed. | P1 |
| F10 | Save up to 3 builds in the browser and compare them side by side. | P1 |
| F11 | Goal mode: choose a target variant and see the best ore count range and cheapest mix that reaches a chosen multiplier. | P2 |
| F12 | Runes: slot unlocks at +3 and +6, rune effects added to the stat view. | P2 |
| F13 | Game data edited through the Supabase dashboard and seed script, with no admin page. | P1 |

**Non-functional requirements**

- Mobile-first: usable one-handed at 380px width, tap targets at least 44px.
- All calculation runs in the browser, so results appear instantly and the database only serves data.
- Accessible: keyboard operable, colour is never the only signal, contrast meets WCAG AA.
- Works with the database down: the last fetched dataset is cached, plus a bundled fallback copy.
- Clear disclaimer that it is an unofficial fan tool.

**Edge cases the calculator must handle**

- Fewer than 3 ores or more than 50: show the limit, do not calculate.
- A fifth ore type: block with a message.
- Trait ore under 10%: show it as inactive with the shortfall, not as an error.
- Weapon-only trait chosen in armour mode: show it as not applicable.
- Any value marked unknown: show "not yet measured" instead of a guessed number.

## Visual and UX direction

The look is a dark blacksmith's workshop: charcoal surfaces, glowing ember accents, and rarity colours that players already recognise. The calculator should feel like a heated crucible you load, not a spreadsheet.

**Style**

- Dark theme by default, charcoal background with slightly lighter raised panels, a thin warm border, and a soft ember glow on the active result.
- Display font with a hammered, slab feel for headings (for example Rajdhani or Oswald), a clean sans for numbers (Inter), tabular figures so values do not jitter as they change.
- Original icons and illustrations only. Do not copy Roblox or game assets, and keep the unofficial disclaimer in the footer.
- Motion is functional: odds bars ease to new values in 200ms, the heat glow intensifies with the average multiplier, and everything respects reduced-motion settings.

**Colour tokens**

| Token | Use | Value |
| --- | --- | --- |
| Background | Page | #0f0f12 |
| Surface | Panels and cards | #18181d |
| Ember | Primary accent, active states | #ff6a2b |
| Gold | Highlights, best result | #f5b942 |
| Common to Divine | Rarity tags | superseded: use the rarity colours in Handoff-Guide.md (no orange) |
| Confirmed, derived, assumed | Confidence badges | green, amber, grey |

**Layout**

- Phone: one column. Mode switch at the top, ore picker as a horizontally scrolling card row, a sticky summary bar (ore count, multiplier, headline stat), then result sections that expand and collapse: Odds, Traits, Stats, Enhancement.
- Desktop: two columns. Left holds the forge (mode, ores, quantities, traits). Right holds results, with the enhancement table and chart below.
- The ore picker shows a quantity stepper on each card, with a quick-fill control to fill the remaining slots with one ore.
- Enhancement stages appear as a horizontal stepper from +0 to the cap. Tapping a stage highlights its row and updates the stat card, with success chance shown as a ring.

**Empty and loading states**

- First visit loads a sample recipe so the screen is never empty.
- A skeleton shows while data loads, and a banner shows if cached data is being used.

## Architecture, database and deployment

A Next.js app on Vercel does every calculation in the browser and reads game data from a read-only Supabase Postgres database. That means no login, instant results, and a game patch is a data edit rather than a code change.

&#91;embedded content: system architecture · 4 parts\]

The browser never talks to GitHub or the database admin tools. Vercel reads game data from Supabase and serves it with the page, and the browser runs the calculation itself.

### Stack

- Next.js (App Router) with TypeScript, Tailwind CSS and shadcn/ui components, plus Recharts for the enhancement chart.
- The calculation engine is a pure TypeScript module in `lib/engine` with no framework imports, unit tested with Vitest. The UI only calls it.
- The current recipe lives in the URL query string, so sharing a build is copying the link. Saved builds go in localStorage.
- Data is fetched on the server and refreshed hourly. A JSON snapshot committed to the repo is the fallback if Supabase is unreachable.

### Database tables

| Table | Holds | Key columns |
| --- | --- | --- |
| patches | Patch label and date | version, released\_on |
| ores | Every ore | slug, name, rarity, multiplier, drop\_one\_in, world |
| ore\_traits | Trait per ore | ore\_id, applies\_to (weapon, armour, both), effect\_type, params (json) |
| weapon\_types | Weapon classes | name, min\_ore |
| weapons | Weapon variants | type\_id, name, chance\_one\_in, base\_damage, attack\_speed, range, base\_price |
| armour\_variants | Armour sets | class, name, weight\_one\_in |
| armour\_pieces | Piece stats | variant\_id, slot, vitality\_pct, base\_defence, base\_price |
| category\_odds | Odds by ore count | item\_kind, ore\_count, category, probability |
| enhancement\_levels | Per-stage data | level, success\_rate, damage\_mult, defence\_mult, gold\_cost, essence\_cost, rune\_slot |
| quality\_tiers | Forge quality | name, multiplier |
| trait\_strength | Strength by ore share | share\_pct, strength |

Every table also carries `confidence` (confirmed, derived, assumed, unknown), `source_url`, `patch_id` and `updated_at`. That is how the UI shows its data badges and how you can see what still needs measuring.

### Security

- Row Level Security is switched on for every table with one policy: anonymous users may select. There are no insert, update or delete policies, so the public key can only read.
- Only the publishable (anon) key is used in the app. The service role key is never put in the repo or in Vercel's public variables.
- Data changes go through the Supabase dashboard or SQL migrations kept in `supabase/migrations`. There is no admin page in version 1, which keeps the app login-free.

### Hosting

- GitHub repository connected to Vercel gives a preview deploy per branch and production on merge to main. Environment variables are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Vercel's free Hobby plan is for non-commercial use, so check its terms before adding ads.
- Free Supabase projects have been paused after about a week without activity, so verify the current limits. The bundled fallback data keeps the site working either way, and a weekly scheduled request can keep the database awake.

## Step-by-step build plan

The plan has eight phases and roughly two to three weeks of part-time work. The order matters: data first, then the engine, then the screen, because the engine is only as good as the numbers and a wrong formula is much cheaper to find before there is a UI on top of it.

### Phase 0: Collect the missing data (1 to 2 days, in game)

1. Work through the six measurement tasks in "What I need from you". Put results in a spreadsheet with one tab per table.
2. Why: the odds-by-ore-count table and per-stage enhancement gains are not published. Without them the calculator would guess, which is what made the old ones outdated.
3. Done when: every table in this document has no "not found" cell, or the gap is accepted and marked unknown.

### Phase 1: Accounts and scaffold (half a day)

1. Create a GitHub repository, a Supabase project and a Vercel project, and link Vercel to the repository.
2. Scaffold Next.js with TypeScript and Tailwind, then add shadcn/ui, Recharts and Vitest.
3. Add the two environment variables locally in `.env.local` and in Vercel.
4. Why: getting an empty page live early proves the deploy pipeline before any real work depends on it.
5. Done when: a placeholder page loads at the Vercel preview URL.

### Phase 2: Database and seed data (1 day)

1. Write the table definitions as SQL migrations from the schema in this document, including the `confidence`, `source_url`, `patch_id` and `updated_at` columns.
2. Turn on Row Level Security for every table and add the single anonymous select policy.
3. Write a seed script that loads the Phase 0 spreadsheet (exported as CSV) so a data update is one command.
4. Run Supabase's security advisor and confirm no table is writable by the public key.
5. Done when: the public key can read every table and cannot write to any of them.

### Phase 3: Calculation engine (2 to 3 days)

1. Build pure functions in this order: average multiplier, trait share and strength, category odds lookup, variant odds, weapon damage, armour defence, then the enhancement Markov chain for expected attempts and cost.
2. Write tests from the published recipes. Each should match to within 1.5%.
3. Golden test 1: 18 Mythril, 10 Eye Ore, 10 Obsidian as a heavy chestplate gives multiplier 3.33 and defence about 166.
4. Golden test 2: 20 Darkryte, 13 Demonite, 6 Mythril as a heavy chestplate gives multiplier 5.60 and defence 280.
5. Golden test 3: 8 Ruby, 8 Emerald, 8 Cuprite as a heavy helmet gives defence about 98.7, once Cuprite's multiplier is added to the data.
6. Why: tests built from real recipes catch formula mistakes immediately and stop future patches from silently changing results.
7. Done when: all golden tests pass and every function handles zero, one and 55-ore inputs.

### Phase 4: Core screen (3 to 4 days)

1. Build the ore picker with quantity steppers and the 4-ore, 3 to 50 total limits.
2. Build the odds panel (stacked class bar plus variant list), the traits panel and the stats panel, each reading from the engine.
3. Keep the recipe in the URL so a refresh or a shared link restores it.
4. Why: this is the part players use every time, so it gets built before any extras.
5. Done when: a recipe typed in the app matches the in-game forge preview for five recipes you test.

### Phase 5: Enhancement view (2 days)

1. Add the stage stepper from +0 to the cap, the stat and multiplier per stage, the success ring and cumulative expected cost.
2. Add the line chart of stat against stage, with unmeasured stages greyed out.
3. Why: this is the feature you asked for specifically, and it depends on the Phase 0 measurements.
4. Done when: stage values match your screenshots for the weapon and armour you measured.

### Phase 6: Polish (2 to 3 days)

1. Apply the visual direction: theme, rarity colours, motion, confidence badges and the "data updated for patch X" label.
2. Add share link, three saved builds with comparison, and the offline fallback data.
3. Check phone layout at 380px, keyboard use, contrast and reduced motion.
4. Done when: the page scores 90 or higher for performance and accessibility in Lighthouse on mobile.

### Phase 7: Verify, launch and maintain (1 day, then ongoing)

1. Test 20 recipes in game against the calculator. Fix any engine or data difference above 1%.
2. Add the unofficial-fan-tool disclaimer, a feedback link and basic analytics.
3. Merge to main for the production deploy, then add a custom domain if you want one.
4. After each game update: edit the data in Supabase, bump the patch label, and spot-check three recipes. No redeploy is needed because pages refresh hourly.

## Repository, deployment and handoff

The project lives in one GitHub repository, deploys to Vercel and reads its data and images from Supabase. A separate agent will take over the build from this document, so every step below is written to be followed without any of the earlier chat.

| Part | Decision |
| --- | --- |
| Repository | [github.com/1920m/The-Forge-Calculator](https://github.com/1920m/The-Forge-Calculator). All code, the SQL migrations, the seed data (the CSV blocks in this document) and the design files go here. |
| Frontend hosting | Vercel. Import the GitHub repository as a Next.js project; every push to `main` deploys to production and every pull request gets a preview URL. |
| Database | Supabase Postgres holding every game table, read-only to the public through Row Level Security. Migrations live in the repository under `supabase/migrations`. |
| Images | Every image (ore icons, weapon and armour pictures, rune icons, logos, backgrounds) is stored in Supabase Storage in a public bucket named `forge-images`. The database stores each image's path, and the app builds the URL from the Supabase project URL. Nothing is committed to the repository except placeholders. |
| Placeholders | Until the real images are uploaded, every image slot shows a neutral placeholder (a dark tile with a faint anvil mark). The app falls back to it whenever a Supabase image is missing or fails to load. |
| Environment variables | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (Production and Preview) and in a local `.env.local`. No secret keys are needed, because the public app only reads. |
| Handoff | The agent starts from this document, the design reference below and the repository. It follows Phases 0 to 7, commits in small steps, and opens pull requests against `main`. |

### Deployment steps

1. Clone the repository and scaffold the Next.js app in it (Phase 1).
2. Create the Supabase project, run the migrations, create the `forge-images` bucket as public, and run the seed script (Phase 2).
3. Copy the project URL and the public (anon) key into the Vercel project's environment variables and into `.env.local`.
4. Connect the repository to Vercel, confirm the first preview deploy loads data from Supabase, then merge to `main` for production.
5. Upload the real images into the `forge-images` bucket under the same paths the placeholders use; no code change is needed.

### Image storage layout

```text
forge-images/
  ores/<ore-slug>.webp
  weapons/<weapon-slug>.webp
  armour/<piece-slug>.webp
  runes/<rune-slug>.webp
  ui/logo.svg
  ui/forge-bg.webp
  ui/placeholder.svg
```

The `image_path` column on `ores`, `weapons`, `armour_pieces` and the rune table holds the path inside the bucket (for example `ores/mythril.webp`). The wiki's own ore images are not copied automatically, since their licence needs a check before reuse; the existing placeholders keep the app working in the meantime.

## Risks, launch checklist and sources

The biggest risk is wrong numbers, not technical difficulty, so the plan puts measurement and testing ahead of design polish.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Published data is wrong or conflicting (several rows already are) | Calculator gives bad advice and loses trust | Confidence badges, golden tests from real recipes, 20-recipe in-game check before launch |
| Game patch changes multipliers or adds ores | Results drift out of date, the exact problem with older calculators | All data in Supabase, patch label on screen, a three-recipe spot-check after each update |
| Unmeasured values (quality scale, enhancement gains, odds by ore count) | Features ship with guesses | Phase 0 measurements, and the UI shows "not yet measured" instead of guessing |
| Supabase free project pauses | Data fails to load | Bundled JSON fallback plus a weekly keep-alive request |
| Using game names, images or logos | Possible takedown | Original art, names only as plain text, and a clear unofficial-fan-tool notice |
| Vercel Hobby plan terms | Account issue if monetised | Stay non-commercial or move to a paid plan before adding ads |

**Launch checklist**

- [ ] All Phase 0 tables filled or marked unknown
- [ ] Row Level Security verified read-only for the public key
- [ ] Golden tests and 20 in-game recipes pass within 1%
- [ ] Mobile layout checked at 380px, Lighthouse 90+ on performance and accessibility
- [ ] Disclaimer, feedback link and patch label visible
- [ ] Fallback data snapshot committed and tested with Supabase blocked
- [ ] Production deploy live and sample recipe link opens correctly

**Sources**

The wiki pages you linked blocked direct access, so these come from search results and were not opened in full. Where they disagree, the newer page was preferred and the row is flagged.

- [Fandom wiki: Weapons](https://forge-roblox.fandom.com/wiki/Weapons), [Armors](https://forge-roblox.fandom.com/wiki/Armors), [Enhancer](https://forge-roblox.fandom.com/wiki/Enhancer)
- [BloxInformer: calculator mechanics](https://bloxinformer.com/wikis/the-forge/the-forge-calculator/), [Ores](https://bloxinformer.com/wikis/the-forge/ores/), [Armor](https://bloxinformer.com/wikis/the-forge/armor/), [Weapons](https://bloxinformer.com/wikis/the-forge/weapons/)
- [forgewiki.org: Runes](https://forgewiki.org/wiki/Runes)
- [Pro Game Guides: crafting chances and quality](https://progameguides.com/roblox/the-forge-crafting-guide-best-quality-forging-chances-mini-games/), [best armour recipes](https://progameguides.com/roblox/the-forge-best-armor-recipe-ores-runes-traits/)
- [Pocket Tactics: armour](https://www.pockettactics.com/the-forge-armor)
- [Stealthy Gaming: best armour recipes](https://stealthygaming.com/the-forge-best-armor-recipes-guide/)
- [Destructoid: crafting guide](https://www.destructoid.com/the-forge-crafting-guide/)
- [Insider Gaming: weapons and damage formula](https://insider-gaming.com/roblox-all-forge-weapons-how-to-craft/)
- [allthings.how: ore table](https://allthings.how/the-forge-ores-explained-locations-drop-chances-and-traits/)
- [GameWith: enhancement success rates](https://gamewith.net/the-forge/72259)
- [Bloxodes: crafting calculator](https://bloxodes.com/tools/the-forge-crafting-calculator)
