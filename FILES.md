# What each file does

## App (`app/`)
| File | Purpose |
| --- | --- |
| `layout.tsx` | Page frame on every route: sign-in and saved-forge state, world theme shell, header, footer, page titles. |
| `globals.css` | All styling: game-style panels with corner brackets, tiles, tables, skeleton shimmer, footer wordmark, mobile layout. |
| `page.tsx` | The calculator (home page). |
| `ores/page.tsx` | Ore browser with search, world filter and trait details. |
| `weapons/page.tsx`, `armour/page.tsx` | Class lists, lock thresholds and variant stats. |
| `builds/page.tsx` | Recommended ore mixes per world and stage. |
| `how-it-works/page.tsx` | The formulas explained, with the trait-strength chart. |
| `forger/page.tsx` | Forger page: the player's saved forges (private, not indexed). |
| `login/page.tsx` | Sign in with Google or Discord. |
| `auth/callback/page.tsx` | Where Google and Discord send players back after signing in. |
| `settings/page.tsx` | Change display name, delete account. |
| `privacy/page.tsx` | What the site stores and how to delete it. |
| `not-found.tsx` | 404 page. |
| `error.tsx` | Error screen with "Start with an empty forge", shown instead of a blank page if anything fails. |
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
| `auth.tsx` | Sign-in state for the whole site: the player, their profile, sign in and sign out. |
| `account-menu.tsx` | Header "Sign in" button, or the player's avatar with Forger page, Settings and Sign out. |
| `login-page.tsx`, `auth-callback.tsx`, `settings-page.tsx` | The sign-in, return-from-sign-in and settings screens. |
| `saved-forges.tsx` | Loads the player's saved forges once and shares them between pages; save, rename, delete. |
| `save-star.tsx` | The ☆ in the forge panel's corner: saves or unsaves the current forge, or sends signed-out players to sign in. |
| `forger-page.tsx` | Forger page: the loadout, then filters, search, sort and a card per saved forge (drag handle, Equip, Rename, Delete). |
| `loadout.tsx` | The LOADOUT panel (armour left, weapon and pickaxe right, totals in the middle), saving it, drag and drop with mouse or finger, and the slot picker. |
| `game-image.tsx` | Shows an image from Supabase Storage, or the striped placeholder tile. |
| `icons.tsx` | Anvil, lock and chevron icons. |

## Logic and data
| File | Purpose |
| --- | --- |
| `lib/engine/index.ts` | Pure maths: multiplier, primary ore, trait strength, stats and rounding, enhancement, variant and class odds. No React or network code. |
| `lib/engine/forge.ts` | Combines the maths with the catalogue: world pools, variants per class, transferred traits, the full forge result. |
| `lib/engine/armour.ts` | Armour score (effective health from defence, Vitality, shields and dodge) used to rank armour builds. |
| `lib/engine/dps.ts` | Weapon DPS with trait effects (crit, lethality, attack speed, procs, damage over time), ported from the wiki's DPS calculator. |
| `lib/data/catalogue.ts` | Loads the newest catalogue: the latest Supabase release, unless the bundled copy has a higher `revision` or Supabase is unreachable. |
| `lib/data/supabase.ts` | Public Supabase URL and key, and image URLs. |
| `lib/ore-filter.ts` | Sorting and filtering rules for the ore picker. |
| `lib/forge-slots.ts` | Forge slot limits (4 ore types, 99 of each) and adding ores. |
| `lib/supabase/browser.ts` | The browser's Supabase client (sign-in session kept in a cookie). |
| `lib/safe-next.ts` | Keeps "go back to" links after sign-in on this site; cleans display names. |
| `lib/saved-forges.ts` | Saved-forge rows: checking them, names, matching a save to the current forge, calculator links. |
| `lib/loadout.ts` | Loadout slots, which slot a forge goes in, and reading the saved loadout safely. |
| `lib/forge-stats.ts` | Works out a saved forge's stats from today's game data (used by cards and the loadout). |
| `lib/ui.ts` | Rarity colours and number formatting. |
| `data/catalogue.json` | Generated game data (do not edit by hand; edit `docs/PRD.md` and run `npm run data:build`). |
| `data/dps-stats.json` | Each ore's DPS stats at a 10% and a 30% share, from the wiki's `Data:Ores.json`. |
| `data/builds.ts` | Recommended recipes by area and stage: weapons from the wiki's Guide page, armour from `armour-builds.json`. |
| `data/armour-builds.json` | Best Heavy armour mixes per world and stage, generated by `scripts/best-armour.ts`. |
| `data/images.json` | Which images exist in the `forge-images` bucket. |
| `data/pickaxes.ts` | Every pickaxe with its region, world and rarity, from the wiki's `Module:Pickaxe/Data`. Pictures are in the bucket under `pickaxes/`. |
| `scripts/best-armour.ts` | Tries every mix of up to 4 ores per world and stage and writes the best armour (`npm run builds:armour`). |
| `scripts/build-catalogue.mjs` | Builds `data/catalogue.json` from the PRD, including the world assignments. |

## README art (`docs/readme/`)
| File | Purpose |
| --- | --- |
| `banner.png` | README banner (World 4 sakura, moon and torii). |
| `divider.svg` | Section divider. |
| `*.png` | Framed screenshots of the site used in the README. |

## Database (`supabase/migrations/`)
| File | Purpose |
| --- | --- |
| `20261023230836_forge_catalogue.sql` | First schema: read-only game tables and the public `forge-images` bucket. |
| `20261023231538_restrict_auto_rls_function.sql` | Locks down a Supabase helper function. |
| `20261024190000_catalogue_releases.sql` | `catalogue_releases`: the published game data the site reads. |
| `20261025100000_security_hardening.sql` | Drops `pg_net`; anonymous visitors can read only the newest catalogue release. |
| `20261025120000_accounts.sql` | `profiles` (name and picture, made on first sign-in) and `delete_my_account`. Owner-only access. |
| `20261025140000_saved_forges.sql` | `saved_forges`: owner-only, at most 200 per player, ores and names checked by the database. |
| `20261025160000_loadouts.sql` | `loadouts`: one per player, owner-only; each slot must hold the player's own forge of the right kind. |

## Tests (`tests/`)
| File | Purpose |
| --- | --- |
| `engine.test.ts` | Golden in-game crafts and edge cases for the pure maths. |
| `ore-filter.test.ts` | Ore sorting, "best for" and the multiplier range. |
| `forge-slots.test.ts` | The 4-ore-type limit and count caps. |
| `traits.test.ts` | Every ore with weapon stats lists a weapon trait; mixed weapon/armour traits split correctly. |
| `dps.test.ts` | DPS against results from the wiki's own calculator. |
| `armour.test.ts` | The armour score: Vitality, shields, dodge and the 10% trait threshold. |
| `builds.test.ts` | Every recommended recipe uses real ores from its world, at most 4 types, and valid classes. |
| `forge.test.ts` | Full forge results against the real catalogue (odds, variants, values, traits). |
| `safe-next.test.ts` | Sign-in return links can't leave the site; display-name cleaning. |
| `loadout.test.ts` | Which slot each forge fits, reading saved loadouts, and that every pickaxe has a picture. |
| `saved-forges.test.ts` | Reading untrusted saved rows, names, matching saves and calculator links. |
| `fixtures/*.json` | What the in-game screenshots showed for the Dark Knight Chestplate and the Hachiwari. |

## Docs (`docs/`)
| File | Purpose |
| --- | --- |
| `PRD.md` | Product requirements and the full game dataset. Source of truth for the data. |
| `design-reference/` | The approved design boards (`.dc.html`, read as source) and `DESIGN-NOTES.md` with colours and motion values. |
| `BRANCH-ARCHIVE.md` | What each deleted feature branch was and four ways to bring any of them back. |

## Config
`package.json` (scripts and dependencies), `next.config.ts` (security headers and Content Security Policy), `tsconfig.json`, `eslint.config.mjs` (blocks framework imports in the engine), `vitest.config.ts`, `.github/workflows/ci.yml` (checks every pull request), `.github/workflows/codeql.yml` (CodeQL security scan), `.github/dependabot.yml` (weekly dependency updates), `SECURITY.md` (how to report a problem and how the site is protected), `.nvmrc` (Node 24), `.env.example`.
