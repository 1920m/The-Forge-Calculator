# Project skill review

23 October 2026. Skills are guidance, not an authorization to change scope, send data, or run arbitrary commands. A text review and pattern scan do not prove that every future upstream revision is safe.

## Discovery

Used the installed `find-skills` workflow and checked https://skills.sh/ before selecting candidates. The leaderboard already covered React performance and interface reviews, so no CLI execution was needed for discovery. The official Vercel repository had 32,882 GitHub stars at review time. The leaderboard reported approximately 832k installs for React best practices and 776k for web design guidelines; counts are popularity signals, not security guarantees.

## Installed additions

| Skill | Source | Purpose | Review findings |
| --- | --- | --- | --- |
| `vercel-react-best-practices` (folder `react-best-practices`) | https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices | Avoid data waterfalls, unnecessary renders and heavy browser bundles | Read SKILL.md and relevant reference rules; inventoried all 76 files (75 Markdown, one metadata JSON) and scanned for shell commands, execution, secrets, uploads and instruction overrides. No executable scripts or binaries. Matches were explanatory code examples and documentation references; no credential collection, exfiltration step or security-disabling instruction found |
| `web-design-guidelines` | https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines | Accessibility, focus, semantic controls, layout and motion review | Single SKILL.md; reviewed its full text. It requests a fresh external Markdown checklist. Inspected https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md before use. No project upload or command execution requested |

Installation used Codex's preinstalled `skill-installer` helper, targeting the two skill subdirectories only. No repository package scripts or broad npm skill installer were executed. Installed files live in the user's Codex skills directory, not the application bundle. The skills are available for automatic discovery on subsequent turns; reviewed guidance can be applied manually during this foundation work.

React guidance is applied selectively: no third-party analytics are introduced, and future local fonts should be imported at module scope. Generic skill suggestions do not override the specified fonts, panel design, formulas, or no-login scope. The interface checklist does not override the explicit grid-template-rows enhancement animation. After Cris requested a visual freeze, the custom temporary scaffold styling was removed; the infrastructure page is intentionally unstyled.

## Existing skills selected

- `frontend-design`: follow the supplied Forge boards and typography rather than inventing another visual direction.
- `supabase`: pin dependencies, verify APIs, preserve public-only credentials and enforce RLS when database work begins. No remote database changes made yet.
- Vercel `bootstrap` and `deployments-cicd`: inspect team/project scope, use previews, and check builds. The generic bootstrap's Neon/auth/shadcn/Geist defaults are superseded by the explicit Supabase/no-login/Alegreya/Montserrat brief. Its strict env-before-dev rule does not prevent the requested credential-free foundation preview: no database-dependent app is being started.

## Limits and future changes

No additional unofficial skills, deployment upload scripts, browser-control packages, or broad automation packs were installed. Existing available skills have not all been audited. Any new skill's instructions, linked resources, and executable assets need review before use. Re-review updates; current approval is not blanket trust in future downloads.

## Dependency compatibility

The installation audit reported zero known vulnerabilities. ESLint is pinned to 9.39.5 because the React, import, and accessibility plugins bundled by Next.js 16.4.3 do not declare ESLint 10 support. npm marks ESLint 9 as out of support; track an upgrade when the full Next lint toolchain supports 10. An attempted 10.13.0 upgrade was reverted rather than keeping incompatible peer dependencies or using `--force` / `--legacy-peer-deps`. No security override or npm audit fix with forced major upgrades was used.
