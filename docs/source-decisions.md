# Source decisions and build plan

Reviewed 23 October 2026. Owner: Cris (called Albert in the historical handoff).

**Visual freeze:** Cris explicitly asked that the approved look, CSS, and file views remain unchanged until he requests a visual change. Component internals may change, but rendered appearance must remain faithful. All original design files are untouched. The infrastructure route is an unstyled smoke page, not a proposed redesign.

## Authority

The current user brief overrides older instructions in the source documents. Cris's in-game screenshots outrank the PRD; the PRD's latest confirmed/measured sections outrank old assumptions and all sample design data. The handoff's documented defaults apply to unresolved issues. The PRD errata says the handoff wins on document conflicts; do not use that blanket sentence to override a confirmed game rule. Record an unresolved conflict instead.

Current scope: 3–55 total ores, unrestricted distinct ore types within that total, all four worlds, no login, no enhancement success odds, no recipe-ownership toggle, no runes in v1. Older 4-type/50-total limits, +7 cap, success rings, cost modelling, orange styling, and old two-column layouts are superseded.

World 1 and 2 share odds. World 3 and 4 replace weapon slots 3/4/5 with Mace/Axe/Spear. Variant and ore pools still depend on world. Do not interpret lock thresholds as the first nonzero chance: e.g. Straight Sword appears at 4 ores but is lockable at 9.

## Numerical discrepancies requiring in-game confirmation

**Confirmed correction from Cris, 23 October 2026:** armour rounds to the nearest whole number, not upward. Weapons keep two decimals, using the existing PRD weapon ceiling default. Keep calculations at full precision and round each final category output independently. The PRD and handoff have been updated at Cris's explicit request. The hidden precision and the order of enhancement rounding still require measurement; rounding once at the end remains the provisional implementation.

| Case | Exact arithmetic | Published expectation | Handling |
| --- | --- | --- | --- |
| Dark Knight recipe | 375.31 / 30 = 12.510333333… | M 12.51 | Assert display rounding separately from exact average |
| Dark Knight base stat | 2 × 25 × (375.31 / 30) = 625.516666… | Card shows 626 | Nearest-integer armour rounding gives 626, matching Cris's screenshot |
| Dark Knight +10 | Raw value × 1.5 = 938.275 | Old handoff said 938.25 | New armour display rule gives 938 DEF. Old decimal expectation is superseded. This is a calculated prediction; enhancement rounding order is not yet confirmed |
| Shogun recipe | 548.36 / 41 = 13.374634146… | M 13.375 | Matches three-decimal display; do not silently replace exact average |
| Mythril share | 18.2% gives 7.035% before display rounding | 7.02% | Likely a rounded share (e.g. 2/11); keep exact share input and ask for original counts |

Hachiwari is consistent: 76.16 / 7 = 10.88; 2 × 8.25 × 10.88 = 179.52. The Dark Knight's rounded whole-number output can pass without proving which multiplier precision the game uses. Never label contradictory golden cases as fully verified.

### Direct armour evidence from Cris

Two supplied in-game screenshots confirm Sun Stone ×9, Lucky Cat ×8, Sealed Curse ×8, Roosite ×5 (30 total), displayed multiplier 12.51×, and a completed Dark Knight Chestplate at Masterwork 100%, Legendary, 626 DEF. Visible class odds are Heavy Leggings 49%, Heavy Helmet 28%, Heavy Chestplate 13%, Medium Chestplate 8%, Medium Leggings 1%. The Heavy Chestplate panel visibly contains tiles labelled 1/1, 1/4 and 1/8; no readable variant names accompany them, so do not infer a name-to-weight mapping or silently remove other variants. Structured observations are in `tests/fixtures/cris-dark-knight.json`. Game art is not copied into the repository.

This proves the observed card value and those visible odds. Cris subsequently confirmed nearest-integer armour rounding in chat. Hidden multiplier precision and enhancement rounding order remain unmeasured.

Category-odds rows are measured rounded percentages and may sum to 99 or 101; do not normalise them or invent missing percentages. Conditional variant odds are normalised inverse weights. Multiply class and conditional variant probability only when showing overall odds.

## Data rules

- Preserve source, confidence, patch metadata, and null unknowns. Null is not zero.
- Use the later ore-traits table instead of stale trait descriptions in the first ore table.
- Wolf armour uses the documented 1/4 default, visibly Unverified, while preserving the wiki's conflicting 1/3 provenance.
- Mark wiki-only Shogun, Vanguard Helmet/Leggings, Raven pieces, Reaper Scythe and Batwing Reaver as Unverified. Halberd stats remain unknown.
- Early-world ore assignments are not given row by row in the first ore table; confirm them before claiming complete World 1/2 pools.
- Fichilliumorite has a special multiplier rule. A mix made entirely of it is undefined in the PRD; do not guess its behaviour. Trait effect scaling needs structured parameters: do not blindly scale durations, activation conditions, or cooldowns by replacing every number in a sentence.
- The PRD references 150 ores but its multiplier tables may not contain 150 distinct names; validate counts and omissions before seeding. Zephyte has a trait row but no multiplier row in this bundle.
- Real images stay in Supabase Storage; no scraped game artwork or competitor content is copied into the repository.
- The official-partner slot is reserved. Do not imply a partnership exists.

### External cross-check, 23 October 2026

The supplied forgewiki.org pages returned HTTP 403 to the web reader, and an initial new-tab navigation timed out. Cris then pointed out the five tabs he had already opened. Binding to those existing browser tabs succeeded. The ore, weapon and armour tables are readable there; use those tabs rather than repeating failed web fetches.

The supplied https://theforgecalculator.org/ loaded. Its current Arcane Crystal multiplier is 9.00 versus 7.50 in the older PRD table; it also supplies Zephyte at 18.50 where the bundle has only a trait row. Both values are also present in the open official ore wiki table (last edited 20 October 2026), so they have wiki corroboration but still do not outrank Cris's game index evidence. Preserve provenance when reconciling the seed. The site's own four-ore-type restriction does not override the current brief. No competitor art or implementation was copied.

The open weapon wiki confirms Hachiwari base damage 8.25, index speed 0.59s, true speed 0.70s, and denominator 2. The open armour wiki confirms Dark Knight Chestplate Health 25 and denominator 2, Shogun Leggings Health 36, and Wolf Chestplate denominator 3. The Wolf conflict with the documented 1/4 default therefore remains unresolved.

The existing comparison-calculator tab initially loaded blank. A reload rendered its public content, but the World 4 control did not respond. Browser console logs reported JavaScript and React errors. No recipe comparison was claimed from that broken interactive session; its visible reference content remains secondary evidence.

### Direct weapon evidence from Cris

Two additional screenshots confirm Sun Stone ×2, Yeti Heart ×2, Golem Heart ×1, Meteorite ×2 (7 total), displayed multiplier 10.88×, and a completed Hachiwari at Masterwork 100%, Mythic, 179.52 DMG, with displayed ATK Speed 0.59s. Forge chances show Straight Sword 74%, Mace 20%, Dagger 6%, and Spear 0%. The screenshots support the handoff's 2× weapon formula and displayed index speed; they do not measure true swing timing or enhancement gains. Observations are in `tests/fixtures/cris-hachiwari.json`.

### Complete ore audit, resumed 24 October 2026

The 23 October browser snapshot contains 150 distinct ores. All 133 PRD ore names are present, with 17 additional names: Fichillium, Boneite, Volcanic Rock Ore, Quartz, Amethyst, Topaz, Dark Boneite, Sapphire, Cuprite, Slimite, Orange Crystal Ore, Magenta Crystal Ore, Green Crystal Ore, Crimson Crystal Ore, Blue Crystal Ore, Grass and Zephyte. Wiki-only data stays Unverified; Fichillium's eligibility for forging remains unknown. The wiki's multiplier conflicts are Aite (PRD 1.00, wiki 1.10) and Arcane Crystal (PRD 7.50, wiki 9.00). Retain PRD values pending Cris's confirmation. No rarity conflicts remain after treating Mythical/Mythic as aliases.

The attributed snapshot and machine-readable comparison are in `supabase/seed/`. Table columns are resolved by header, because the early-world PRD table places Multiplier before Drop, while later tables reverse them. Raw extraction preserves both orders. The wiki All Ores page does not contain numerical trait effects; Used For must not be interpreted as material eligibility.

PRD class odds also need six explicit Unverified flags: weapons at 9 ores total 90%, at 12 total 97%; armour at 10 totals 95%, at 13 totals 96%, at 16 totals 106%, and at 21 totals 103%. No values are silently normalized or corrected.

Cris confirmed on 24 October that the wiki is correct for both disputed multipliers. The PRD is now corrected to Aite 1.10 and Arcane Crystal 9.00. The historical CSV snapshot is unchanged; regenerating the audit now reports zero scalar multiplier conflicts. This confirmation does not resolve unknown world membership or trait effects for wiki-only ores.

## Database plan

`patches`, `ores`, `ore_traits`, `weapon_types`, `weapons`, `armour_variants`, `armour_pieces`, `category_odds`, `enhancement_levels`, `quality_tiers`, `trait_strength`. Public Storage bucket: `forge-images`.

All public tables: enable RLS, revoke all from `anon`, `authenticated`, and inherited PUBLIC where applicable, grant `select` to `anon`, and create an anon-only SELECT policy. No public write policy or grant. Each game table carries confidence, source URL, patch link, and updated timestamp. No public success-rate fields are required for the enhancement UI.

## Implementation sequence

1. Foundation: Next.js, TypeScript, bundled fonts, Vitest, lint/typecheck/test/build CI, preview deployment.
2. Pure engine and golden tests: average, primary ore, traits, world-aware class lookup, conditional variants, quality stats, enhancements. Preserve unresolved expectations explicitly.
3. Validate PRD extraction, define tables, prepare reproducible seeds, verify RLS and storage rules using public credentials.
4. Shared layout, four theme token sets, loading skeleton, Supabase image fallback, React Bits logo/footer accents.
5. Three-column calculator and four reference pages, URL/localStorage world/recipe state, quality presets and collapsible enhancement/trait layout.
6. Browser checks at phone and desktop widths, keyboard/reduced motion/contrast checks, SEO and performance, then in-game checks by Cris.

## Current foundation status

Local scaffold and initial pure engine created. The only authorized identity for GitHub, Supabase and Vercel is **Cristi Excelsis**. Cris confirmed that the repository remains `1920m/Forge-Calculator`. No Clearpath account, credential or resource may be used, including as a fallback. Do not repeat connector calls known to use that identity. New connection profiles are visible in Cris's settings screenshots, but this session's callable schemas expose no connection-selection field. Cris completed an isolated GitHub CLI login; the authenticated user is **1920m**, with admin and push permission on the confirmed repository. Git author settings and both unpublished commits were corrected to Cris's supplied name/email. All Git network operations must use that isolated configuration and override global credential helpers. Supabase and Vercel are now provisioned in Cris's verified accounts. See docs/validation.md for the exact Forge project IDs, applied SQL and security verification.
