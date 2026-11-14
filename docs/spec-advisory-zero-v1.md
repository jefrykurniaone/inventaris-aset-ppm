# Spec v1 - Advisory zero: eject the shadcn package, take minimatch 11 through typescript-eslint, audit the whole tree

> Tracker: Spec [#206](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/206) · Execution map [#211](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/211) · Tickets [#208](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/208), [#209](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/209), [#210](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/210) · Run label `run:advisory-zero` · Decision records ADR 0011 (new), [ADR 0004](adr/0004-pinned-transitive-overrides-for-postcss-and-sharp.md) (amended), [ADR 0008](adr/0008-dependency-vulnerability-checks.md) (amended).
> Point-in-time copy of the spec item as of 2026-11-14, against `main` at `3720670`. The spec item is the one written copy.

## Problem statement

As of 2026-11-14 the repository has four open Dependabot alerts. All four are in development scope:

| Alert | Package | Advisory | Severity | Patched in |
|---|---|---|---|---|
| #2 | `body-parser` 2.3.0 | GHSA-27r3-jxmh-p828, denial of service through trailing bytes after a compressed request body | high | 2.4.0 |
| #3 | `zod` 3.25.76 | GHSA-mrhx-c7xc-m3w5, memory exhaustion while validating oversized constrained collections | high | 4.6.6 (no 3.x fix) |
| #18 | `deepmerge` 4.3.1 | GHSA-gcqx-w48m-w2h4, prototype poisoning in `mergeObject()` | low | none |
| #23 | `minimatch` 10.2.6 | GHSA-g3hv-75wg-m249, denial of service through globparts amplification | medium | 11.0.1, a major |

Until 2026-11-14 the Security tab showed only two of them. GitHub's preset rule *Dismiss low-impact alerts for development-scoped dependencies* auto-dismissed #2 on 2026-11-01 and #3 on 2026-11-03, so the tab showed two alerts while the tree held four. ADR 0008 calls Dependabot the full-tree surface, and the preset broke that silently. The owner disabled the preset on 2026-11-14, and GitHub reopened #2 and #3 at 10:38:29Z.

Earlier on 2026-11-14, ADR 0004's amendment (issue #200, PR #205) accepted #18 and #23 because no upgrade could fix them. The owner has since decided to close every alert instead, and to keep the whole tree clean afterwards.

None of the four reaches the application, and `npm audit --omit=dev` reports 0. They are still noise that hides the next real alert. Under the stricter gate this spec introduces, they would also fail every pull request.

**Where they come from.** Read on 2026-11-14 from the lockfile at `3720670`:

- **The shadcn CLI package**, a devDependency at 3.8.5. It brings:
  - `deepmerge@4.3.1`, directly;
  - its own `zod@3.25.76`;
  - `@modelcontextprotocol/sdk` → `express@5.2.1` → `body-parser@2.3.0`;
  - `ts-morph@26.0.0` → `@ts-morph/common@0.27.0` → `minimatch@10.2.6`;
  - `fast-glob` → `micromatch` → `braces@3.0.3`, whose advisory GHSA-vfj7-8cjw-p6xm was withdrawn on 2026-10-23.
- **ESLint's TypeScript parser.** `eslint-config-next@15.5.29` → `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` → `@typescript-eslint/typescript-estree@8.67.0` → `minimatch@10.2.6`.

So every path but one enters through the shadcn CLI package. It is installed for one reason: the global stylesheet imports `shadcn/tailwind.css`. That file is 1.6 KB, MIT-licensed, and holds custom variants (`data-open`, `data-closed`, `data-checked` and others), the accordion keyframes and a `no-scrollbar` utility. The CLI itself is used rarely, to scaffold a component that is then edited by hand.

## Solution

1. **Eject the shadcn package.** Copy shadcn 3.8.5's stylesheet into the repository as a vendored file, import it where the package import was, and remove the package. shadcn documents this as `shadcn eject`: the CLI docs at shadcn 4.21, read through Context7 on 2026-11-14, say it "inlines `shadcn/tailwind.css` into your global CSS file and removes the `shadcn` dependency". This closes #2, #3 and #18, removes the ts-morph path of #23, and removes the `braces` chain.
2. **Take minimatch 11 through typescript-eslint, with no override.** Every `@typescript-eslint/typescript-estree` canary since 8.72.3-alpha.1 (2026-11-10) declares `minimatch ^11.0.1`. Once a stable release with that range is on npm, refreshing the lockfile closes #23. typescript-eslint releases on Mondays, so the expected date is 2026-11-16. That is not guaranteed: no release came out on 2026-11-02.
3. **Audit the whole tree in CI.** The security check fails on a high advisory anywhere in the tree, not only in production scope. The job is renamed to match, and branch protection moves with it.
4. **Record it.**
   - A new ADR 0011 for the eject.
   - An ADR 0004 amendment resolving the 2026-11-14 acceptances.
   - An ADR 0008 amendment for the full-tree audit and the disabled preset.

## Goals and non-goals

**Goals**

- Zero open Dependabot alerts, with #2, #3, #18 and #23 each closed as **fixed**, not dismissed.
- `npm audit` over the whole tree, with no flags, reports 0 vulnerabilities at every level.
- The CI security check fails on a high advisory anywhere in the tree.
- No visual change: the compiled CSS is identical before and after the eject.

**Non-goals**

- Moving the vendored stylesheet to shadcn 4.x content, or regenerating any component.
- Any npm override.
- Gating moderate or low advisories in CI.
- Changing the dependency review job, the Dependabot configuration, or ADR 0008's decisions against a scheduled audit and against CodeQL.

## User stories

1. As the repository owner, I want the Security tab to show zero open Dependabot alerts, so that a new alert is a real signal and not lost among accepted ones.
2. As the owner, I want each of the four alerts closed as fixed rather than dismissed, so that the record shows the vulnerable package left the tree.
3. As the owner, I want development-scope alerts never to be dismissed silently, so that the Security tab shows what the tree holds.
4. As a developer, I want the CI security check to fail on a high advisory anywhere in the tree, so that the tree stays clean after this run.
5. As a developer, I want the shadcn variants, keyframes and utility to behave exactly as before, so that no component changes appearance.
6. As a developer adding a shadcn component later, I want a documented way to run the CLI without installing it, so that the package and its dependencies do not come back.
7. As a developer, I want ESLint's TypeScript parser on the `minimatch` range its own maintainers declare, so that there is no out-of-range override to maintain and later remove.
8. As a future maintainer, I want the reversal of the 2026-11-14 acceptances recorded in the ADRs, so that nobody re-accepts the advisories or re-adds the package.
9. As the owner, I want `main` to keep exactly four required checks after the rename, so that the renamed audit job is still enforced.

## Implementation decisions

1. **Eject by hand, from 3.8.5, into a separate vendored stylesheet.** Do not run `npx shadcn@latest eject`. That would inline 4.x content into the global stylesheet, and copying the installed 3.8.5 content is what keeps the compiled CSS identical. The copy goes in its own file, not inline in the global stylesheet, for two reasons:
   - The global stylesheet is 185 lines and would approach the 300-line file limit.
   - A test-support module parses the global stylesheet for the colour-contrast tests, and its input should change by the one import line only.

   The vendored file starts with a header that names the source (`shadcn@3.8.5`, `dist/tailwind.css`), carries the package's MIT copyright line and permission notice, and says the content is not edited by hand: a change means re-copying from a named version. The import keeps its position, after `tailwindcss` and `tw-animate-css` and before the `dark` custom variant. The 3.8.5 content already passes Prettier under the repository's own configuration (checked 2026-11-14), so it stays verbatim below its header and needs no ignore entry.
2. **The shadcn package leaves the dependency tree entirely.** It is removed from devDependencies, and the lockfile drops its subtree. The `components.json` file stays, because it is the CLI's configuration and is read when the CLI runs through `npx`.
3. **How the CLI is run from now on.** `CLAUDE.md`'s Stack section gains a rule with three parts:
   - `shadcn` is not a dependency (ADR 0011).
   - The CLI runs as `npx shadcn@<exact version> add <component>`.
   - After it runs, check that neither `package.json` nor the global stylesheet has regained `shadcn` or the `shadcn/tailwind.css` import, and revert either if it has.

   There is no npm script, because the CLI is used rarely and its output is edited by hand anyway.
4. **SonarQube Cloud and the vendored stylesheet.** It is not excluded in advance: the global stylesheet already uses `@custom-variant` and `@theme` with 0 issues. If the SonarQube Cloud check on the pull request reports an issue in the vendored file, two things follow:
   - The file joins `sonar.exclusions` beside `public/vendor/**`, the existing precedent for a verbatim third-party copy, with a comment.
   - ADR 0011 records the exclusion.

   Never `// NOSONAR`, and never an edit to the vendored content to satisfy a rule.
5. **minimatch through typescript-eslint, with no override.**
   - **The gate is external.** A stable `@typescript-eslint/typescript-estree` release must be on npm whose `minimatch` range excludes every version below 11.0.1.
   - **Lockfile only.** The change touches only the lockfile; `package.json` is unchanged. The `@typescript-eslint/*` packages move together, because they pin each other exactly.
   - **The new transitive package.** minimatch 11 brings `@isaacs/nonrecursive-glob-match` (BlueOak-1.0.0, first published 2026-10-26). It gets the check `CLAUDE.md` asks for before a package is added: size, maintenance, licence and CVEs. The result goes in the ADR 0004 amendment.
   - **An override was rejected.** On 2026-11-14 it was rejected for the same reason ADR 0004 gives: it would put a major version under parents that declare `^10`.
6. **Full-tree audit at `high`.**
   - The audit job's command loses `--omit=dev` and keeps `--audit-level=high`.
   - It still has no install step.
   - Its display name and its step name become `Audit dependencies`. The job id stays `audit`.

   With the threshold at `high`, moderate and low development advisories appear only as Dependabot alerts. They are no longer dismissed silently now that the preset is off. The consequence is recorded: a high advisory in development tooling that has no patch fails every pull request until it is resolved. The emergency path is the administrator exemption, because enforcement on administrators is off.
7. **Branch protection moves with the rename.**
   - The required check `Audit production dependencies` is replaced by `Audit dependencies`, from the GitHub Actions app (id 15368).
   - The other three checks stay, and so does *require branches to be up to date*.
   - The orchestrator makes the change immediately before that pull request merges, then reads it back. Without it, the pull request waits for a check that never reports.
8. **Records.**
   - **ADR 0011, new: "shadcn CLI out of the dependency tree".** It records why (the alert paths above), what (the vendored stylesheet, the CLI run through `npx`, the check after `add`) and the consequences (the stylesheet no longer updates by itself, plus the SonarQube exclusion if one was needed). It is listed in the ADR index.
   - **ADR 0004 amendment.** It marks the 2026-11-14 `deepmerge` and `minimatch` acceptances resolved, because their removal conditions are met. The 2026-11-14 text stays; nothing is deleted.
   - **ADR 0008 amendment.** It records:
     - the full-tree audit;
     - the rename and the protection change;
     - the owner disabling the preset on 2026-11-14, and the reopening of #2 and #3.

     It marks two earlier passages superseded rather than deleting them: the *Dev tooling is not gated* consequence and the rejected *Audit the full tree* alternative. The reason is that the `braces` chain, which would have kept a full-tree audit permanently red, has left the tree, and the owner wants the tree kept at zero.
9. **Order.** The eject lands first, because it removes the two high advisories that would turn a full-tree audit red. The gate change and the minimatch refresh both follow it. The minimatch refresh also waits for the upstream release.

## Testing decisions

No unit test is added, because no business logic changes. The run is tested at four seams, confirmed with the owner on 2026-11-14:

1. **Compiled CSS.** The CSS that `next build` emits is byte-identical before and after the eject, chunk file names aside. *Catches* a variant or keyframe that is missing or reordered in the vendored copy. Tailwind v4 has a built-in `data-*` variant, so a missing `@custom-variant data-open` would not fail the build; it would silently stop matching `data-state="open"`. *Misses* nothing visual, because identical CSS renders identically.
2. **`npm audit` over the whole tree.** After the eject, `npm audit --audit-level=high` exits 0. After the minimatch refresh, `npm audit` reports 0 vulnerabilities at every level. *Catches* a vulnerable version left in the tree. *Misses* behaviour changes in the new typescript-eslint, which seam 3 covers.
3. **The existing gate in CI**: typecheck, lint, test, build, the end-to-end job and SonarQube Cloud. *Catches* regressions from the lockfile changes, including lint running on the new parser.
4. **The GitHub API.**
   - The alert states: #2, #3 and #18 are `fixed` after the eject merges, #23 is `fixed` after the refresh merges, and no alert is open.
   - The branch protection readback after the rename.

Prior art: ADR 0008 established on 2026-10-23 that `npm audit` reads the lockfile with no install, checked from a directory holding only `package.json` and the lockfile.

## Success criteria

- The repository has 0 open Dependabot alerts, and #2, #3, #18 and #23 are each in state `fixed`.
- On `main`, `npm audit` with no flags exits 0 and reports 0 vulnerabilities.
- `npm ls shadcn deepmerge` lists nothing, and `npm ls minimatch` lists no version in `>=7.0.0 <11.0.1`.
- Seam 1 holds: the compiled CSS is identical.
- The audit job runs `npm audit --audit-level=high` with no `--omit=dev`, and both the job and the step are named `Audit dependencies`.
- `main`'s branch protection has exactly four required checks: `Typecheck, lint, test, build`, `Audit dependencies`, `Review dependency changes` and `SonarQube Cloud`. *Require branches to be up to date* is on.
- ADR 0011 exists and is indexed, ADR 0004 and ADR 0008 carry their amendments, and `CLAUDE.md`'s Stack section carries the CLI rule.
- The full completion gate is green on `main`.

## Out of scope

- shadcn 4.x stylesheet content, or regenerating any component.
- Upgrading `eslint-config-next` or Next.js.
- Any npm override, for `minimatch` or anything else.
- Gating moderate or low advisories in CI.
- The dependency review job, `.github/dependabot.yml`, a scheduled audit, or CodeQL.
- The *Dismiss package malware alerts* preset. It showed Disabled on 2026-11-14 and is left as it is.

## Further notes

- **#23 is not reachable here anyway.** The vulnerable `firstPhasePreProcess()` runs only at `optimizationLevel >= 2`. The default is 1, according to the minimatch v11 README read through Context7 and to the installed source. Both callers call `minimatch(path, pattern)`, with `{ dot: true }` at most, and never set the level. The fix is about the alert and the gate, not about an exposure.
- **typescript-eslint's release cadence.** Stable releases come out on Mondays at about 17:08 UTC: 8.72.0 on 2026-10-19, 8.72.1 on 2026-10-26 and 8.72.2 on 2026-11-09, with nothing on 2026-11-02.
- **Context7 sources** read on 2026-11-14: the shadcn docs at 4.21.0 (the `eject` command and `shadcn/tailwind.css`), and the minimatch docs at v11.0.0 (`optimizationLevel` and the main export).

