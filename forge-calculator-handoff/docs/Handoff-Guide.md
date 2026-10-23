# Forge Calculator: Handoff Instructions and Setup Guide

23 Oct 2026

## Start here

Build a free, no-login calculator for the Roblox game The Forge. The player adds ores (3 to 55 in total, any mix), sees which weapon or armour class and variant they can get and at what odds, the traits that transfer, its damage or defence at any quality, and its stats at every enhancement level from +0 to +10. It runs on Vercel, reads its data and images from Supabase, and lives in the GitHub repository https://github.com/1920m/Forge-Calculator.git.

Read these first; this document only tells you how to set things up and what to build in what order.

- `docs/PRD.md`: every rule, formula and data table (all ores, traits, weapons, armour, class odds by ore count 3 to 55). Where it says "confirmed in game", trust it; where it says "unverified", show a badge.
- `design/`: the layout reference (seven `.dc.html` boards plus `canvas.json`). See `design/DESIGN-NOTES.md`. It is a visual and behavioural reference, not code to copy, and all data in it is placeholder.
- `00-FIRST-PROMPT.md`: the brief to start from.

### The rules in one place

These are enough to write the engine; the PRD has the evidence.

| Rule | Formula |
| --- | --- |
| Average multiplier | M = sum(multiplier x count) / total ores |
| Class odds | Look up the row for the total ore count (3 to 55) in the odds tables. Depends only on the count. |
| Variant odds | P(v) = (1/c_v) / sum(1/c_j) inside the class |
| Primary ore | Largest count; ties broken by highest multiplier. It sets the look and the rarity. |
| Trait strength | 0 below a 10% share, else min(1, 0.10 + 4.5 x (share - 0.10)); full at 30% |
| Armour defence | round( 2 x HealthPct x M x quality ) to the nearest whole number; confirmed by Cris on 23 Oct 2026 |
| Weapon damage | ceil( 2 x BaseDamage x M x quality ) to two decimals |
| Enhancement | Stat at level L = value x (1 + 0.05 x L), L from 0 to 10 |

### Order of work

1. Set up the accounts and the repository (next section).
2. Write the calculation engine and its tests before any screen.
3. Create the database, load the seed data, and upload placeholder images.
4. Build the screens from the design.
5. Deploy to Vercel and check every item on the launch checklist in the PRD.

## Accounts and setup

Albert owns the GitHub, Supabase and Vercel accounts. Anything marked **Albert** needs him to click through a login; everything else the agent does.

### 1. GitHub

1. **Albert:** make sure the repository 1920m/Forge-Calculator (https://github.com/1920m/Forge-Calculator.git) exists and give the agent push access, or add the agent as a collaborator.
2. Clone it. Work on a branch named `feat/<topic>` and open pull requests into `main`; never push broken code to `main`, because Vercel deploys it.
3. Add a `.gitignore` that excludes `.env.local`, `node_modules` and `.next`.

### 2. Supabase

1. **Albert:** create a free project at supabase.com and send the agent the project URL and the public anon key (Settings, then API). Never send the `service_role` key; the public app does not need it. The seed script runs once from Albert's machine or the SQL editor.
2. Put each table in a migration file under `supabase/migrations`, named with a timestamp, so the schema is reproducible. The table list is in the PRD (patches, ores, ore_traits, weapon_types, weapons, armour_variants, armour_pieces, category_odds, enhancement_levels, quality_tiers, trait_strength).
3. Every table is read-only to visitors. Supabase's own guidance says RLS blocks everything until a policy exists, and that a grant is also required, because a missing grant fails with error 42501 before any policy runs. For each table:

```sql
alter table public.ores enable row level security;
revoke all on table public.ores from anon, authenticated;
grant select on table public.ores to anon;
create policy "Public read ores" on public.ores for select to anon using ( true );
```

Write no insert, update or delete policy and grant no write privilege. Repeat the four statements for every table.

4. Create a public Storage bucket named `forge-images` and make the folders in the PRD's image layout (`ores/`, `weapons/`, `armour/`, `runes/`, `ui/`). Public means anyone can read and nobody can write.
5. Get an image URL in code with `supabase.storage.from('forge-images').getPublicUrl('ores/mythril.webp')`. Supabase notes that this call does not check that the bucket is public; a private bucket gives a URL that will not download.
6. In `next.config`, allow the Supabase host for `next/image` with a `remotePatterns` entry for your project's `<ref>.supabase.co` host and the path `/storage/v1/object/public/**`.
7. Run Supabase's security advisor in the dashboard before launch.

### 3. Vercel

1. **Albert:** sign in at vercel.com with the GitHub account and import the repository as a new project. The framework preset is Next.js.
2. Add two environment variables for Production and Preview: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Put the same values in a local `.env.local`.
3. Every push to `main` deploys to production and every pull request gets a preview URL. Check the preview before merging.
4. The Hobby plan includes 100 GB of fast data transfer a month, 100 deployments a day, and a 45-minute build limit, which is plenty for this app. Check Vercel's terms for Hobby: the non-commercial wording could not be confirmed from the limits page, so read it before adding ads or paid features.

### 4. Check it works

Open the preview URL, confirm the ore list loads from Supabase, confirm an image slot shows the placeholder when its file is missing, and confirm the page still renders its bundled fallback data if Supabase is unreachable.

## Repository layout, engine and tests

Keep the maths in one pure TypeScript module that runs in the browser, with no network calls and no framework imports, so it is easy to test.

```text
Forge-Calculator/
  app/                    Next.js App Router pages
  components/             UI components (ore card, slot, class bar, enhancement table)
  lib/engine/             pure functions: multiplier, classOdds, variantOdds,
                          primaryOre, traitStrength, stat, enhancement
  lib/data/               Supabase client, queries, bundled fallback JSON
  supabase/migrations/    one SQL file per schema change
  supabase/seed/          CSV files copied from the PRD (ores, traits, weapons,
                          armour, category_odds_weapons, category_odds_armour)
  scripts/                seed.ts (loads CSVs), check-images.ts
  tests/                  Vitest tests for lib/engine
```

### Engine functions

Use these names so the screens and the tests agree.

| Function | Input | Output |
| --- | --- | --- |
| `averageMultiplier` | list of ore + count | M |
| `classOdds` | kind (weapon or armour), world, total ores | percentage per class; counts above 55 use the 55-ore row |
| `variantOdds` | list of variant weights | percentage per variant |
| `primaryOre` | list of ore + count | the ore with the largest count, ties by highest multiplier |
| `traitStrength` | share 0 to 1 | f(s) from the PRD |
| `rawStat` | base value, M, quality 0 to 1 | unrounded 2 x base x M x quality |
| `stat` | base value, M, quality 0 to 1, kind | armour: nearest whole number; weapon: ceiling to two decimals |
| `enhancementTable` | unrounded stat at level 0, kind | 11 rows, level 0 to 10, each x(1 + 0.05 x L), then category-specific rounding |

Armour uses nearest-integer rounding, confirmed by Cris on 23 Oct 2026. Weapons use a small epsilon (subtract 1e-6 from the scaled value before the ceiling) to avoid floating-point bumps. Keep the raw base stat for enhancements rather than compounding rounded display values; that rounding sequence remains provisional until measured in game.

### Tests to write first

These real items were checked in the game; each must pass exactly.

| Case | Inputs | Expected |
| --- | --- | --- |
| Dark Knight Chestplate | Sun Stone 9, Lucky Cat 8, Sealed Curse 8, Roosite 5; Health % 25; quality 100% | Display M = 12.51; exact M = 375.31/30; defence 626 after nearest-integer rounding |
| Hachiwari | Sun Stone 2, Yeti Heart 2, Golem Heart 1, Meteorite 2; base damage 8.25; quality 100% | M = 10.88, damage 179.52 |
| Shogun's Leggings | Meteorite 4, Roosite 12, Heat Steel 12, Sakurite 13; Health % 36 | M = 13.375; with defence 803 the quality is about 83.4% |
| Primary ore | the Hachiwari mix | Meteorite wins the three-way tie of 2 by highest multiplier; rarity Mythic |
| Class odds, weapons | 7 ores | Straight Sword 74, slot 3 (Gauntlets or Mace) 20, Dagger 6 |
| Class odds, armour | 30 ores | Heavy Leggings 49, Heavy Helmet 28, Heavy Chestplate 13, Medium Chestplate 8, Medium Leggings 1 |
| Variant odds | Dagger class weights 1, 2, 4, 16, 2, 6, 8 | 38.40, 19.20, 9.60, 2.40, 19.20, 6.40, 4.80 |
| Trait strength | Mythril at 18.2% share | 7.02% of +15% Vitality; 30% share gives the full 15% |
| Enhancement | Dark Knight Chestplate at 100% quality | Calculated +10 displays 938 DEF with final nearest-integer rounding. Old 938.25 decimal expectation superseded; enhancement rounding order still needs direct measurement |

### Data loading

Load all tables once on page load, cache them in memory, and run every calculation on the visitor's device. Keep a bundled JSON copy of the data and use it if Supabase cannot be reached. Share the recipe in the URL query string (ores and counts, quality, world) and save builds in the browser's local storage.

## Pages, behaviour and loading (from the design boards)

All data on the boards is placeholder. See `design/DESIGN-NOTES.md` for tokens, themes and animation values.

- **Header on every page:** logo, nav (Calculator, Ores, Weapons, Armour, How it works) and a World switch 1/2/3/4. World is global state: keep it in the URL (`?world=4`) and in localStorage.
- **Calculator:** Forge Chances (left), forge slots + result card (centre), Forge / Select Ores with an Armor/Weapon toggle (right). Below: variants table, Enhance Equipment, Traits that transfer.
- **Enhance Equipment** is collapsible: closed by default showing only +0, with a "Show +1 to +10" toggle. When open, the traits panel docks under the variants table to fill the space; when closed, traits are full width at the bottom. Animate with a grid-template-rows 0fr to 1fr transition plus opacity.
- **Traits** support any count: usually 1 to 3, up to 6 in special crafts. The grid wraps. The "Preview with 3/4/5/6" switch on the board is a design aid only; do not ship it.
- **Ores / Weapons / Armour / How it works:** as on the boards. Weapons and Armour show real unlock thresholds; the rest of their data comes from the PRD tables.
- **Loading:** first load shows a skeleton. Grey boxes shimmer left to right, a thin progress bar runs under the header, and panels fill in column by column (left, centre, right, lower). Respect `prefers-reduced-motion`.
- **World themes** (texture, edge glow, ambient particles): World 1 stone grey with dust; World 2 dark ash with crimson tint and embers (a suggestion, confirm with Albert); World 3 ice blue with frost lattice and snow; World 4 sakura pink with a wave pattern and petals. Particles are decoration only and must never block clicks.
- **Footer:** grey panel with link columns, a reserved "Official partner badge" slot, and a large dotted "FORGE" wordmark. It also carries the fan-project and not-affiliated line.
- **React Bits:** use the real React Bits components where they fit (ShinyText for the logo shimmer, a dot-matrix text or DotGrid for the footer wordmark). The design boards approximate them in CSS.

## Design rules: match the game's own interface

The calculator should look like it belongs in The Forge. That means flat dark panels with grey corner brackets, serif body text, bold sans titles and green action buttons. **Do not use orange or gradient fills.**

| Element | Rule | Value |
| --- | --- | --- |
| Page background | Near-black, flat | #0b0a09 |
| Panel | Flat dark brown-black, 1px border, grey L-shaped bracket on each corner (16px long, 3px thick) | fill #141210, border #34322e, brackets #9a9a9a |
| Panel title bar | Slightly lighter strip with a 1px bottom border; bold sans title, white | #1c1b1e, border #4a4850 |
| Fonts | Titles in a bold sans (Montserrat 700, a stand-in for the game's Gotham-style face); everything else in a serif (Alegreya) | approximations; swap if Albert finds the real font |
| Body text | Cream | #d8d0bd; muted #a39c8b; faint #8d8676 |
| Table rows | Alternating flat stripes, no gradient | #1c1a18 and transparent |
| Class header | Centred label with the chance in brackets, e.g. "Heavy Leggings (49%)", and a small padlock; under it, square variant tiles with "1/N" on the bottom edge | as the game's Forge Chances panel |
| Ore and ingredient tiles | Square tile, 2px border in the ore's rarity colour, name at the top, count or multiplier at the bottom corner | see rarity colours |
| Primary action | Dark green with a lighter green border and green corner brackets, bold serif text | fill #26391f, border #4f8a3d |
| Secondary button | Flat dark with a grey border | fill #141210, border #4a4850 |
| Result card | Centred item name in large bold serif, image, then label and value rows ("Craft Quality:", "Class:", "Rarity:", "Defense:") | highlight values in gold #e8d48a |
| Enhance panel | Same panel with a flat purple title bar, rows of "+N, 1.00x -> 1.05x" and the stat | #2a2140, border #5a4a86 |

**Rarity colours** (tile borders and rarity text): Common #8a8a8a, Uncommon #5a9a52, Rare #4a7fc0, Epic #8a5cc9, Legendary #d1a042, Mythic #c24a4a, Relic #c47a3a, Exotic #3fbfa8, Divine #e8d48a. (The Relic colour is an in-game tag colour; keep it only as a tile border and tag, never as a page or button fill.)

### Rules

- Layout mirrors the game: Forge Chances on the left, the forge slots and result in the middle, Select Ores on the right. On a phone, stack them in the order forge, result, chances, enhancement, traits, with at least 44px tap targets.
- Every image slot uses the placeholder (dark diagonal-stripe tile) until the real image loads from the Supabase `forge-images` bucket. Never commit real game art to the repository.
- Show a small badge on anything marked unverified in the PRD: Confirmed in game (green), Derived (tan), Unverified (red).
- Text must stay readable: body text 17px or larger, contrast at least 4.5 to 1 against its panel.
- Add a footer line saying the site is a fan project and not affiliated with the game or Roblox.
- Using game screenshots as a style guide is fine; do not reproduce the game's logos or art.

## What Albert still needs to provide or confirm

None of this blocks the first build. Each item has a default, so the agent keeps going and marks the value unverified.

| Item | Default until confirmed | What Albert sends |
| --- | --- | --- |
| GitHub, Supabase and Vercel access | none, needed to deploy | Collaborator access to the repository, the Supabase project URL and anon key, and a Vercel login |
| Real images | placeholder tiles | Ore, weapon and armour pictures uploaded to the `forge-images` bucket under the paths in the PRD |
| Quality label ranges | the unverified list in the PRD | The in-game percentage range of each label (for example, where "Great" starts and ends) |
| Armour rounding | Resolved: nearest whole number, confirmed by Cris on 23 Oct 2026 | No longer an open question |
| Which attack speed is real | the card value (index speed) | A stopwatch check on one weapon |
| Wolf armour odds | 1/4, as the calculator he trusts uses | A look at the Heavy class tiles in the Forge Chances panel |
| Items on the wiki but not in the calculator | shown with an Unverified badge | Whether Shogun, Vanguard Helmet and Leggings, Raven's pieces, Reaper Scythe and Batwing Reaver exist in game |
| Rune effects | left out of v1 | Say whether to include the 12 runes the third-party calculator lists |
| Real game font | Montserrat and Alegreya | The font name, if known |
| World 1 and 2 look | the suggested themes on the boards | Say if you want different colours or particles |

### Open questions the agent should not guess

- Resolved on 23 Oct 2026: armour rounds to the nearest whole number, not upward. Still open: does enhancement use the raw stat or the already-rounded card value?
- What does the "[86]%" on the Shogun's Leggings card mean? It is not the quality: the numbers need about 83.4%.
- For a tie at the top of the ore counts (for example 2 + 2 + 1), the highest multiplier among the tied ores is assumed to win the look. One screenshot of such a craft would confirm it.
- The odds above 55 ores are unknown; the app uses the 55-ore row and says so.

## Sources

Checked on 23 Oct 2026. The game rules themselves come from Albert's in-game screenshots and the pages listed in the PRD's Sources section.

- Supabase: Row Level Security, https://supabase.com/docs/guides/database/postgres/row-level-security.md (enabling RLS, the required grant, and the public read policy).
- Supabase JavaScript reference: getPublicUrl, https://supabase.com/docs/reference/javascript/file-buckets-getpublicurl (public image URLs; it does not check that a bucket is public).
- Vercel limits, https://docs.vercel.com/docs/limits (Hobby plan bandwidth, deployments, builds and environment variable limits; it does not state the non-commercial rule, so read Vercel's terms before adding ads or payments).
- The Forge Official Roblox Wiki: https://forgewiki.org/wiki/Ores , https://forgewiki.org/wiki/Weapons , https://forgewiki.org/wiki/Armor (ore, weapon and armour data).
- https://theforgecalculator.org/ (class odds by ore count and trait strength, measured by driving it with controlled mixes).
- Map guide used for world names: https://progameguides.com/roblox/the-forge-map-all-islands-locations-level-requirements/ (World 1 Stonewake's Cross, World 2 Forgotten Kingdom, World 3 Frostspire Expanse).

Albert's original screenshots and tests are the final word wherever they disagree with any source above.
