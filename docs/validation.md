# Foundation validation

23 October 2026. Local checks; Cris's isolated GitHub login is now verified as `1920m`, with repository push access. Remote CI results must be checked after publishing.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed |
| `npm test` | 34 passed, zero TODOs, after Cris's nearest-integer armour correction |
| `npm run build` | Passed again with the final module configuration |
| npm dependency audit during final install | Zero known vulnerabilities reported |
| Design references | Unchanged against the local `main` baseline |

**Rounding correction:** Cris confirmed armour rounds to the nearest whole number, replacing the previous upward/two-decimal assumption. The obsolete decimal-armour TODO was replaced with category-specific regression tests. The exact Dark Knight recipe displays 626 at +0 and predicts 938 at +10 when rounding once at the end. Enhancement rounding order still needs direct in-game verification; the predicted +10 is not a measured result. Weapons retain two decimals.

The direct in-game screenshots are represented as structured text fixtures. They confirm the Dark Knight card's whole-number 626 DEF and Hachiwari's 179.52 DMG, not every hidden rounding step. The test suite also exercises trait activation/full-strength boundaries, negative effect scaling, invalid/empty mixes, world slot mapping, Fichilliumorite filler behaviour, variant probability normalisation, the 55-row cap, and rejection of administrative credentials in public configuration.

The current page is an unstyled infrastructure placeholder. No full calculator screen, Supabase dataset, mobile visual verification, game-image pipeline, or remote deployment is claimed complete. The intended next work is PRD data reconciliation and schema/seed preparation, followed by the approved UI. Read `visual-contract.md` before changing any frontend appearance.
