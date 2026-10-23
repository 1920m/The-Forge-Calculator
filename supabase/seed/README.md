# PRD source extraction

`source/` contains deterministic copies of the PRD's five CSV blocks, raw ore tables, raw trait descriptions and a source hash. Run `npm run data:extract` after an approved PRD change and `npm run data:check` to verify synchronization. CI checks the files against the current PRD.

These are source records, **not a ready-to-run database seed**. No script uploads them. Before import, reconcile outdated multipliers and missing ores with Cris's screenshots and the open wiki tabs, assign world pools from evidence, structure trait parameters, and retain confidence/provenance. In particular, a trait row without a multiplier row must not receive a made-up value.

Never replace a measured class-odds row with normalized values just because its displayed percentages sum to 99 or 101. Blank source cells mean zero. The existing weapon and armour source CSVs preserve the published denominators; documented defaults such as the unresolved Wolf 1/4 override belong in the reviewed seed transformation, with the source discrepancy retained.

## Wiki audit

`wiki-ores-2026-10-23.csv` records all 150 displayed ore names, multipliers and rarities observed in Cris's open [Ores tab](https://forgewiki.org/wiki/Ores), last edited 20 October 2026. Attribution: The Forge Official Roblox Wiki contributors, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The statistical snapshot is adapted from their All Ores table; retain this attribution and license with redistributed adaptations.

Run `npm run data:audit` to regenerate `wiki-ore-audit.json`. The report identifies 17 ore names absent from the PRD multiplier tables. Cris confirmed the wiki's Aite 1.10 and Arcane Crystal 9.00 values on 24 October; the PRD is corrected and the regenerated comparison has no multiplier or rarity conflicts after treating Mythical/Mythic as aliases. Wiki-only entries must carry an Unverified badge. In particular Fichillium's zero multiplier does not prove it is a forgeable material.

The wiki's Used For column describes trait applicability; it must not restrict the materials available for weapon versus armour forging. Full trait effects require individual ore pages or direct in-game evidence.

`source/provenance.json` flags six class-odds rows whose totals lie outside 99–101: weapon counts 9 and 12, and armour counts 10, 13, 16 and 21. Keep them Unverified and preserve the source values pending confirmation.

## Catalogue seed

`npm run data:seed` generates `catalogue.sql` for the initial schema. It contains 150 ores, 62 raw trait descriptions, 10 weapon classes, 81 weapons, 37 per-piece armour variants/pieces, 848 class probability cells, 11 enhancement levels, nine provisional quality labels, and 101 trait-strength points. Run the migration first, then this SQL only in the named Forge Calculator project. Source imports do not run during deployment.

Unknown world assignments remain null; region evidence is retained in each ore's source record. Source trait text is retained with null structured parameters and an unknown parameter status, preventing accidental numeric substitution in cooldowns, durations or thresholds. The baseline does not claim a complete world-aware calculator dataset. Exact world membership and structured multi-effect traits remain work to finish before the functional UI is connected. Armour variants are represented per piece to preserve source denominators without inventing shared set membership. Wolf keeps the documented Unverified 1/4 default and stores the wiki denominator 3 separately.

The seed is safe to rerun unchanged: existing keys are skipped. Approved future source corrections need an explicit update migration; this file does not overwrite reviewed rows silently. `supabase/verify-catalogue.sql` checks counts, RLS, grants, policies and the image bucket.
