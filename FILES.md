# What each file does

## App (`app/`)
| File | Purpose |
| --- | --- |
| `layout.tsx` | Page frame on every route: world theme shell, header, footer, page titles. |
| `globals.css` | All styling: game-style panels with corner brackets, tiles, tables, skeleton shimmer, footer wordmark, mobile layout. |
| `page.tsx` | The calculator (home page). |
| `ores/page.tsx` | Ore browser with search, world filter and trait details. |
| `weapons/page.tsx`, `armour/page.tsx` | Class lists, lock thresholds and variant stats. |
| `builds/page.tsx` | Recommended ore mixes per world and stage. |
| `how-it-works/page.tsx` | The formulas explained, with the trait-strength chart. |
| `not-found.tsx` | 404 page. |
| `icon.svg` | Browser tab icon. |

## Components (`components/`)
| File | Purpose |
| --- | --- |
| `shell.tsx` | World state (1 to 4, saved in the URL and browser), theme colours and textures, falling particles, the left-to-right skeleton load-in, the world switch. |
| `chrome.tsx` | Header with navigation and the loading bar. |
| `footer.tsx` | Footer with links, partner-badge slot and the dotted FORGE wordmark. |
| `calculator.tsx` | The calculator: Forge Chances, forge slots, result card, quality, ore picker, variants, collapsible Enhance Equipment, traits. |
| `ores-page.tsx` | Ore browser. |
| `ore-filter.tsx` | The ore picker's Filter dropdown: sort buttons, two-handle multiplier slider, trait marks on ore tiles. |
| `items-page.tsx` | Shared weapons/armour page. |
| `builds-page.tsx` | Builds page: weapon/armour toggle, one section per area, recipe cards worked out with the forge engine and linked to the calculator. |
| `game-image.tsx` | Shows an image from Supabase Storage, or the striped placeholder tile. |
| `icons.tsx` | Anvil, lock and chevron icons. |

## Logic and data
| File | Purpose |
| --- | --- |
| `lib/engine/index.ts` | Pure maths: multiplier, primary ore, trait strength, stats and rounding, enhancement, variant and class odds. No React or network code. |
| `lib/engine/forge.ts` | Combines the maths with the catalogue: world pools, variants per class, transferred traits, the full forge result. |
| `lib/engine/dps.ts` | Weapon DPS with trait effects (crit, lethality, attack speed, procs, damage over time), ported from the wiki's DPS calculator. |
| `lib/data/catalogue.ts` | Loads the newest catalogue from Supabase on the server, with the bundled copy as fallback. |
| `lib/data/supabase.ts` | Public Supabase URL and key, and image URLs. |
| `lib/ore-filter.ts` | Sorting and filtering rules for the ore picker. |
| `lib/forge-slots.ts` | Forge slot limits (4 ore types, 99 of each) and adding ores. |
| `lib/ui.ts` | Rarity colours and number formatting. |
| `data/catalogue.json` | Generated game data (do not edit by hand; edit `docs/PRD.md` and run `npm run data:build`). |
| `data/dps-stats.json` | Each ore's DPS stats at a 10% and a 30% share, from the wiki's `Data:Ores.json`. |
| `data/builds.ts` | Recommended recipes by area, stage and item, from the wiki's Guide page. |
| `data/images.json` | Which images exist in the `forge-images` bucket. |
| `scripts/build-catalogue.mjs` | Builds `data/catalogue.json` from the PRD, including the world assignments. |

## Database (`supabase/migrations/`)
| File | Purpose |
| --- | --- |
| `20261023230836_forge_catalogue.sql` | First schema: read-only game tables and the public `forge-images` bucket. |
| `20261023231538_restrict_auto_rls_function.sql` | Locks down a Supabase helper function. |
| `20261024190000_catalogue_releases.sql` | `catalogue_releases`: the published game data the site reads. |

## Tests (`tests/`)
| File | Purpose |
| --- | --- |
| `engine.test.ts` | Golden in-game crafts and edge cases for the pure maths. |
| `ore-filter.test.ts` | Ore sorting, "best for" and the multiplier range. |
| `forge-slots.test.ts` | The 4-ore-type limit and count caps. |
| `dps.test.ts` | DPS against results from the wiki's own calculator. |
| `builds.test.ts` | Every recommended recipe uses real ores from its world, at most 4 types, and valid classes. |
| `forge.test.ts` | Full forge results against the real catalogue (odds, variants, values, traits). |
| `fixtures/*.json` | What the in-game screenshots showed for the Dark Knight Chestplate and the Hachiwari. |

## Docs (`docs/`)
| File | Purpose |
| --- | --- |
| `PRD.md` | Product requirements and the full game dataset. Source of truth for the data. |
| `design-reference/` | The approved design boards (`.dc.html`, read as source) and `DESIGN-NOTES.md` with colours and motion values. |

## Config
`package.json` (scripts and dependencies), `next.config.ts` (security headers), `tsconfig.json`, `eslint.config.mjs` (blocks framework imports in the engine), `vitest.config.ts`, `.github/workflows/ci.yml` (checks every pull request), `.nvmrc` (Node 24), `.env.example`.
