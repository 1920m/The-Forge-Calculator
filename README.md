# Forge Calculator

A free, no-login calculator for the Roblox game The Forge. Next.js App Router and TypeScript on Vercel, with public read-only game data and images in Supabase.

**Status: foundation preview.** The pure calculation engine has an initial implementation and tests. The dataset and calculator screens are not implemented yet. The unstyled homepage deliberately shows no fabricated game results. Cris's approved design files are untouched; see [the visual contract](docs/visual-contract.md).

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The foundation runs without Supabase credentials. Later, copy `.env.example` to `.env.local` and fill in the project's public URL and publishable key (the legacy anon key is also supported). Never use a secret or service-role key in a `NEXT_PUBLIC_` variable.

```sh
npm run check
```

Runs lint, type generation and strict typechecking, tests, and a production build. CI runs the same checks on feature branch pushes and pull requests to `main`. Dependencies use exact versions and a committed lockfile. Builds do not fetch Google Fonts. The approved Alegreya/Montserrat fonts will be bundled when the reference UI is implemented.

## Read first

1. [PRD](forge-calculator-handoff/docs/PRD.md)
2. [Handoff guide](forge-calculator-handoff/docs/Handoff-Guide.md)
3. [Design notes](forge-calculator-handoff/design/DESIGN-NOTES.md) and the seven boards in that folder
4. [Source decisions and open discrepancies](docs/source-decisions.md)

The original design folder is preserved. The PRD and handoff include Cris's requested correction: armour rounds to the nearest integer; weapons keep two decimals. Design markup is reference material only and is not copied into production components. Cris is the owner referred to as Albert in the original documents.

## Structure

```text
app/                    App Router routes and global styling
components/             Shared UI (planned)
lib/engine/             Pure TypeScript calculations
lib/data/               Public configuration, then queries and fallback data
tests/                  Vitest tests
supabase/migrations/    Reproducible schema changes (planned)
supabase/seed/          Extracted PRD data and attributed wiki ore audit
scripts/                Reproducible extraction and source checks
docs/                   Build plan, source decisions, skill review
forge-calculator-handoff/ Original PRD, guide, and reference boards
```

The engine must have no React, Next.js, or Supabase imports. An ESLint rule rejects these dependencies in `lib/engine`. Game tables, class pools, and variant odds must come from PRD-derived data, not reference-board sample lists.

## Deployment

Intended Vercel configuration: `forge-calculator` in **Cristi Excelsis**, Node.js 24, Next.js preset, repository root as the root directory, `npm run build` as the build command. Production remains gated on review; the current app has `noindex` metadata.

Link `1920m/Forge-Calculator` through Cris's GitHub account in Vercel. Automatic branch previews require the intended account connection and repository link. Git author settings are project-local; they do not authenticate a push. CLI authentication can use an isolated, ignored `.local-auth/github` configuration with inherited `GH_TOKEN` and `GITHUB_TOKEN` unset in that process. Never use another project's credentials as a fallback.

Supabase is not provisioned or linked yet. Only **Cristi Excelsis** accounts are authorized for GitHub, Supabase and Vercel. Do not inspect, provision, deploy to, or modify Clearpath resources. No Supabase project was changed and no source was deployed there. The accidental empty Vercel project is outside this project's authorized account and must not be reused or modified. Correct account routing is required before publishing.

Once connected to the intended project, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to local and Vercel Preview/Production environments. The image allowlist is restricted to the configured project and the `forge-images` public bucket.

No automatic seed or migration runs during build or deployment. Database changes must be applied deliberately after the schema and seed review. No login or administrative credentials belong in the public app.
