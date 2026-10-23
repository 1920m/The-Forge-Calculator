You are building "Forge Calculator": a free, no-login web calculator for the Roblox game The Forge. The repo is https://github.com/1920m/Forge-Calculator.git. Stack: Next.js (App Router, TypeScript) on Vercel, Supabase for data and image storage. Albert (the owner) hopes to make this the official calculator and work with the game's developers, so quality and polish matter.

## Read first, in this order
1. `docs/PRD.md`: the source of truth for all rules, formulas, tables and data.
2. `docs/Handoff-Guide.md`: accounts and setup, repo layout, engine function names, golden tests, page behaviour and design rules. If it differs from the PRD, the Handoff Guide wins.
3. `design/` (start with `design/DESIGN-NOTES.md`): a visual and behavioural reference, not production code. Rebuild it in React and Tailwind or CSS modules. Do not copy the markup. The `.dc.html` files do not open on their own in a browser, so read them as source.

If the PRD and Albert's in-game screenshots disagree, the screenshots win. Ask Albert rather than guessing.

## What the product does
The user picks ores and counts (3 to 55 ores in total) and chooses Armour or Weapon. The app shows:
- the average multiplier, the primary ore, and the item rarity
- class odds for that ore count, and variant odds inside each class
- which traits transfer, with strength and effects (a trait needs a 10% share and is at full strength from 30%; the same factor scales negative effects)
- armour defence or weapon damage at a chosen craft quality
- the stat at every enhancement level from +0 to +10

The ore pool, class pool and variant list depend on the world (1, 2, 3, 4). Worlds 1 and 2 share the same odds. Do not show enhancement success chances. There is no "recipes I own" toggle; do not add one.

## IMPORTANT: the data in the design is placeholder
Everything displayed in the design folder is sample content:
- There are no real ores implemented. The ore list, multipliers, rarity colours and the three real trait texts are examples only. The real ore data (all worlds) is in the PRD tables and must be loaded into Supabase. Do not hard-code the sample list.
- Traits 4, 5 and 6 on the Main board ("Roosite", "Heat Steel", "Sakurite", "Placeholder effect line") are placeholders. The traits panel must support any number of traits, usually 1 to 3 and up to 6 in special crafts.
- The Weapons and Armour boards show only real unlock thresholds plus one worked example each (Hachiwari, Heavy Chestplate). Real variant tables come from the PRD.
- All images are placeholder tiles (diagonal-stripe boxes). Real images are uploaded later to the Supabase Storage bucket `forge-images`. Build an image component that loads from Supabase and falls back to the striped tile when the file is missing or still loading.
- Strings marked "Placeholder" or "comes from the ores table" must be replaced by data.
- The Mobile board is an older style. Use the desktop boards as the reference and make everything responsive, with panels stacking on phones.

## Pages and behaviours (match the design boards)
Header on every page: logo, nav (Calculator, Ores, Weapons, Armour, How it works), and a World switch 1/2/3/4. The selected world is global app state (store it in the URL, for example `?world=4`, and in localStorage).

1. **Calculator (Main):** three columns like the game's own UI.
   - Left: "Forge Chances" panels per class with the odds and lock thresholds.
   - Centre: forge slots with + and - per ore, the multiplier, a share bar, and the result card (Craft Quality, Materials, Class, Rarity, Defense or Damage, At 100%) with quality presets 25/50/75/90/100.
   - Right: "Forge / Select Ores" with a search box, ore tiles, and an Armor and Weapon toggle.
   - Below: a variants table, an "Enhance Equipment" panel, and "Traits that transfer".
   - Enhance Equipment is collapsible. Default is collapsed, showing only +0, with a "Show +1 to +10" toggle. When open, the traits panel moves up under the variants table to fill the space. When closed, traits sit full width at the bottom. Animate this smoothly (grid-template-rows 0fr to 1fr plus opacity).
2. **Ores:** searchable grid of all ores with a detail panel (multiplier, rarity, traits at full strength).
3. **Weapons:** class table with unlock thresholds, a timeline of unlocks across 3 to 55 ores, a worked example, and damage at +0 to +10.
4. **Armour:** the same, plus the variant table per class.
5. **How it works:** eight cards explaining the formulas, with the trait-strength chart.

## Loading
Show a skeleton on first load. The grey boxes shimmer left to right, with a thin progress bar under the header. Panels fill in column by column: left, centre, right, then lower panels. Mirror `design/Loading.dc.html`. Respect `prefers-reduced-motion`.

## World themes
Each world has its own texture, edge glow and ambient particles, applied through CSS variables on the root (exact values in `design/DESIGN-NOTES.md`):
- World 1: stone grey, brick-line texture, slow dust.
- World 2: dark ash with a crimson tint, rising embers. The look of Worlds 1 and 2 is a designer suggestion; confirm with Albert.
- World 3: ice blue, frost lattice, falling snow.
- World 4: sakura pink, wave pattern, drifting petals.
Particles are decoration only: `pointer-events:none`, hidden under reduced motion. Use real React Bits components where they fit (ShinyText for the logo shimmer, a dot-matrix text or DotGrid for the footer wordmark), and keep the Forge look.

## Visual rules
Match the game's own interface: flat dark panels, grey corner brackets, dark title bars, serif body text (Alegreya) with bold Montserrat titles, cream text, green action buttons. No orange gradients and no gradient washes. The footer is a grey panel with link columns, a reserved "Official partner badge" slot and a big dotted "FORGE" wordmark. Keep contrast accessible and use real buttons and links.

## Rules you must not break
- Put the maths in a pure, tested engine (no React or Supabase imports). The golden tests in the Handoff Guide must pass: Dark Knight Chestplate (M = 12.51, 626 DEF at 100%), Hachiwari (M = 10.88, 179.52 DMG), Shogun's Leggings (M = 13.375, about 83.4% quality for 803 DEF).
- Supabase: enable RLS on every table, `revoke all` then `grant select` to anon, and add a read-only policy. Public reads only; there is no login. Use `remotePatterns` in next.config for the Supabase image host.
- Do not invent game data. Unknown values stay flagged "Unverified" (a visible badge) until Albert confirms them.
- Open questions are at the end of the Handoff Guide (quality label ranges, whole-number armour defence, true attack speed, Wolf armour odds, wiki-only items, rune effects). Use the documented defaults and flag them in the UI.

## Suggested order of work
1. Scaffold the repo, CI (lint, typecheck, tests), and a Vercel preview deploy.
2. Write the engine and its tests from the PRD.
3. Create the Supabase schema, seed it from the PRD tables, and lock down RLS.
4. Build the shared layout: header, footer, themes, skeleton, panel components, image component.
5. Calculator page, then Ores, Armour, Weapons, How it works.
6. Polish: animations, responsive, accessibility, SEO, performance.

Before writing code, reply with: your understanding in a few lines, a file and folder plan, the Supabase table list, and any question that blocks you. Then start with step 1.
