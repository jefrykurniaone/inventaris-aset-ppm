# Spec v1 - Dependency security: remediate open advisories and add vulnerability checks to CI

> Tracker: Spec [#147](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/147) · Execution map: pending · Run label `run:dependency-security` · Split-out issue [#148](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/148).
> Point-in-time copy of the spec item as of 2026-10-23, written against `main` at `ac5cb02`. The spec item is the one written copy; this mirror is regenerated from it when the run closes.

## Problem statement

As of 2026-10-23, `npm audit` against the lockfile on `main` reports **27 advisories: 2 critical, 17 high, 8 moderate**. Ten of them (1 critical, 5 high, 4 moderate) fall inside the production scope (`--omit=dev`) that CI gates on. `main` last went green on 2026-08-28 and these advisories were published after that, so the next pull request will fail at the audit step whatever it changes. The audit runs inside the `verify` job, so when it fails, the coverage upload is skipped, and SonarQube analysis and the end-to-end smoke test are skipped along with it.

Two packages reach the deployed server:

- `next@15.5.23` is affected by GHSA-2xp9-vwfh-vxw4, an unauthenticated remote code execution in the Image Optimization API when AVIF files are optimised. The public scan page sends its full-size photo through that optimiser, and the image allow-list accepts the public bucket of any Supabase project. The same release is affected by GHSA-p293-qw3h-jr36 (remote code execution on Windows-hosted servers). Production runs on Vercel and is not exposed to that one, but every developer running the app on Windows is. Two further advisories cover cache poisoning in self-hosted deployments.
- `sharp@0.35.3` is affected by the libheif and librsvg advisories GHSA-rgj7-g3m4-5g8c and GHSA-wq5f-xc86-pv6w.

Everything else is tooling:

- Vitest and Vite
- the Prisma CLI, through `mysql2`, `source-map-js` and `fast-uri`
- the shadcn CLI, through `proxy-addr` (critical), `undici`, the MCP SDK and `hono`
- the ESLint and shadcn file-globbing chain `fast-glob` → `micromatch` → `braces`, for which no patched release exists (GHSA-vfj7-8cjw-p6xm, `braces <= 3.0.3`)

`--omit=dev` does not mean "what ships" in this repository. `better-auth` declares `vitest`, `prisma` and `next` as optional peer dependencies, so npm classifies Vitest, Vite and the Prisma CLI as production.

The larger problem is detection. The audit runs only when someone pushes, and nothing watches the dependency tree between pull requests, so two months of advisories accumulated unnoticed. The repository is public, yet Dependabot alerts, Dependabot security updates, secret scanning and push protection were all disabled, and `main` had no branch protection, so even a red audit would not have stopped a merge (as of 2026-10-23).

## Solution

- **Remediation.** The dependency tree reaches zero advisories at every severity in production scope. In the full tree, the only remaining advisories are the `braces` chain, which has no upstream fix and is accepted with a recorded reason and removal condition.
- **Security workflow.** A dedicated workflow runs on every pull request and every push to `main` with two checks. The first is a blocking production-scope audit. The second is a dependency review that blocks any pull request that introduces or changes a dependency carrying a high-severity advisory. A new advisory against an existing dependency fails only the security check: `verify`, SonarQube and the end-to-end smoke test still report.
- **Dependabot.** Dependabot watches the full tree, dev tooling included. It raises an alert as soon as an advisory is published, opens a security update pull request automatically, and opens one grouped minor-and-patch version-update pull request per ecosystem per month.
- **Secret scanning.** Secret scanning and push protection are on.
- **Branch protection.** `main` requires `verify`, the audit and the dependency review to pass, on a branch that is up to date with `main`.

## Goals and non-goals

Goals:

- Close every advisory that has a non-breaking fix, including the ones in dev tooling.
- Make the production-scope audit a check that a new advisory cannot use to suppress other checks.
- Detect new advisories without waiting for a pull request.
- Block pull requests that introduce a vulnerable dependency.
- Enforce the checks on `main`.
- Record the policy so that it is not relitigated.

Non-goals:

- Upgrading to `next@16`.
- Code scanning with CodeQL. SonarQube Cloud is already the static-analysis gate.
- Licence policy in the dependency review.
- A scheduled (cron) audit.
- Narrowing the image allow-list to the project's own Supabase host. This is tracked as a separate issue.
- Fixing `braces` upstream.
- Changing the Better Auth pin.

## User stories

1. As the directorate that owns the system, I want the public scan page served by a framework release without the known image-optimiser remote code execution, so that an unauthenticated visitor cannot run code on the server.
2. As a developer on Windows, I want the framework patched against the Windows remote code execution advisory, so that running the app locally does not expose my machine.
3. As a maintainer, I want production-scope dependencies free of known advisories at every severity, so that what ships carries no known library flaw.
4. As a maintainer, I want the Prisma CLI, client and adapter upgraded together under an ADR, so that the project's pin rule holds and the CLI's `mysql2` advisories close.
5. As a maintainer, I want the upgrade to Prisma to produce no schema change and no migration, so that no production migration step is needed.
6. As a maintainer, I want overrides that no longer do anything removed through ADR 0004's mechanical check, so that `package.json` carries no unexplained override.
7. As a maintainer, I want the one accepted advisory chain recorded with its reason and removal condition, so that accepting it is a documented decision rather than an oversight.
8. As a developer opening a pull request, I want an advisory published against an existing dependency to fail only the security check, so that the typecheck, lint, test, build, SonarQube and end-to-end results of my change still appear.
9. As a developer, I want a pull request that adds or changes a dependency with a high-severity advisory to be blocked, with the advisory named, so that I do not introduce a vulnerability.
10. As a maintainer, I want an alert whenever an advisory is published against any dependency in the tree, dev tooling included, without waiting for a pull request, so that the two months of unnoticed drift before 2026-10-23 cannot recur.
11. As a maintainer, I want Dependabot to open security update pull requests on its own, so that the fix arrives together with the alert.
12. As a maintainer, I want one grouped minor-and-patch version-update pull request per ecosystem per month, so that drift stays small without a pull request per package.
13. As a maintainer, I want Dependabot never to propose a major upgrade, or any upgrade of a package the project rules gate behind an ADR, so that it never proposes a change that cannot be merged as-is.
14. As a maintainer, I want the GitHub Actions used by the workflows included in the monthly updates, so that workflow actions do not age silently.
15. As a maintainer, I want the accepted `braces` alerts left open, so that Dependabot opens a pull request the day a patch exists and closes the alert once the vulnerable version leaves the lockfile.
16. As a maintainer of a public repository, I want secret scanning and push protection on, so that a credential is refused at push time or caught after it lands.
17. As a maintainer, I want `main` to require `verify`, the audit and the dependency review to pass on an up-to-date branch, so that "CI must pass before merge" is enforced rather than hoped for.
18. As the repository owner, I want administrators exempt from that enforcement, so that I keep an emergency path.
19. As a future maintainer, I want the vulnerability-check policy recorded in an ADR, so that its scope, its threshold and the decision not to use a cron or CodeQL are not reopened by accident.

## Implementation decisions

### Remediation

- **`next` and `eslint-config-next`.** Both move from `15.5.23` to `15.5.28`, keeping exact pins. This is a patch inside 15.5, and the two packages move together as they always have. Per the advisory, 15.5.28 disables AVIF optimisation until the upstream library fix propagates. The photo pipeline produces WebP, so nothing visible should change.
- **Prisma.** `prisma`, `@prisma/client` and `@prisma/adapter-pg` move from `7.9.1` to `7.10.1` together, keeping exact pins. The project rules allow upgrading a pinned package only with an ADR, so this is recorded in a new ADR 0007.
  - `prisma@7.10.1` pins `mysql2@3.24.4`, which closes GHSA-3f6p-5ww8-9rcr and GHSA-rgwj-5xj2-c3m3.
  - This upgrade was chosen on 2026-10-23 over a `mysql2` override that would have kept Prisma at 7.9.1.
  - The generated client is regenerated. Creating a migration against the local database must produce nothing: the upgrade carries no schema change and no production migration step.
  - `better-auth` stays at `1.7.1`; its optional peer range for `prisma` covers 7.10.1.
- **Other transitive advisories.** Every remaining advisory that has a non-breaking fix is closed by refreshing the lockfile, which is what `npm audit fix` without `--force` does. `--force` is never used here: what it proposes is either a downgrade (`shadcn@1.0.0`, `eslint-config-next@14.2.35`) or a major upgrade.
- **Overrides.** These follow ADR 0004's removal condition, applied mechanically: remove the entry, refresh the lockfile, re-audit. As of 2026-10-23 the expectations are:
  - **`deepmerge-ts`**: dead weight, because `@prisma/config@7.10.1` itself pins `deepmerge-ts@8.0.2`. Remove it.
  - **`postcss`**: stays, because `next@15.5.28` still hard-pins `8.4.31`.
  - **`sharp`**: stays, with its floor raised to the first patched release (`^0.35.5`). `next@15.5.28` declares `sharp` as `^0.34.3 || ^0.35.5`, a range that still admits vulnerable releases, so ADR 0004's condition (Next itself depends only on a patched `sharp`) is not met.
- **Accepted advisory.** The `braces` chain (GHSA-vfj7-8cjw-p6xm, no patched release as of 2026-10-23) is accepted. It is reached only through dev tooling: ESLint's Next.js plugin and the shadcn CLI. It is recorded in an amendment to ADR 0004 with a removal condition: when a patched `braces` exists, Dependabot's security update closes it. The alerts stay open on purpose (decided 2026-10-23), because a dismissed alert does not receive a security update pull request.

### Security workflow

- A dedicated workflow, separate from the existing CI workflow, triggered by pull requests to `main` and pushes to `main`. It has no schedule (decided 2026-10-23); between pull requests, Dependabot alerts are what surface new advisories.
- **Audit job.**
  - Production scope (`--omit=dev`), threshold `high`, blocking. Scope and threshold are unchanged from today, so ADR 0004's reasoning about which future advisory may break the build still holds.
  - The job runs the audit from the lockfile without installing dependencies, so no third-party install script runs in it. If a lockfile-only audit turns out not to work on the runner, the fallback is the same `npm ci --ignore-scripts` that `verify` uses, with the reason recorded beside the step.
- **Audit removed from `verify`.** The audit step and its explanatory comment leave the `verify` job. This is what keeps a new advisory from skipping SonarQube and the end-to-end smoke test.
- **Dependency-review job.**
  - Runs on pull requests only, using GitHub's own dependency-review action, with failure at severity `high` across both runtime and development scopes, and no licence policy.
  - It posts no pull-request comment, so the workflow keeps read-only `contents` permission.
  - It judges only dependencies a pull request adds or changes, so the accepted `braces` chain does not trip it.
- **Conventions.** These follow the existing workflow:
  - GitHub-owned actions are referenced by major tag, and any third-party action is pinned by commit SHA.
  - Permissions are least-privilege.
  - The concurrency group is per ref.
  - Every job has a stable, human-readable name, because those names become the required status checks.

### Dependabot

- **Repository settings.** Dependabot alerts and Dependabot security updates are turned on.
- **Configuration.** Two ecosystems, `npm` at the repository root and `github-actions`, both on a **monthly** interval. The interval is required by Dependabot, and monthly was chosen on 2026-10-23 over weekly and daily.
- **`npm` rules.**
  - One group collects every minor and patch version update into a single pull request. That also keeps `next` and `eslint-config-next` moving together.
  - Version updates ignore every semver-major update. According to GitHub's options reference, this `update-types` filter affects version updates only, never security updates.
  - Version updates also ignore the ADR-gated packages entirely: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `better-auth` and `auth`. As of 2026-10-23 the reference does not say whether a full ignore also suppresses security update pull requests for those packages. This is accepted either way: the alert still appears, and upgrading those packages needs an ADR regardless.
- **`github-actions` rules.** Updates are grouped into one pull request.
- **Commit messages.** Dependabot commits use the Conventional Commits form `chore(deps): …`.
- **Validation.** The configuration is validated against Dependabot's published schema before its pull request opens.

### Repository settings

These are applied by the orchestrator through the GitHub API, in this order, after every pull request in this run has merged and `main` is green:

1. Secret scanning on, and push protection on.
2. Dependabot alerts and Dependabot security updates on, if they are not already.
3. Branch protection on `main` with required status checks: `verify`, the audit job and the dependency-review job, under their published job names, with "require branches to be up to date" on and administrator enforcement off.

No required review is added, because the repository has one developer. The exact commands are recorded on the ticket so they can be replayed by hand.

### Documentation

- **ADR 0007** records the Prisma upgrade.
- **ADR 0008** records the vulnerability-check policy:
  - where the audit lives and why it is outside `verify`
  - its scope and threshold
  - dependency review
  - Dependabot as the full-tree, between-pull-request surface
  - the open `braces` alerts
  - why there is no cron and no CodeQL
- **ADR 0004** gets an amendment for the override changes and the accepted `braces` chain. Its "Enforcement" section gains a pointer to ADR 0008 and is not rewritten.
- **Project instructions.** One line in the Dependencies section points to ADR 0008.

## Testing decisions

No business logic changes, so there are no new unit tests. A good test here observes external behaviour at the highest seam available. These three seams were confirmed with the user on 2026-10-23.

1. **CI on each pull request.**
   - What runs: `verify`, the end-to-end smoke test (real sign-in, photo upload to Supabase Storage, public scan page), SonarQube Cloud, the new security workflow, and the Vercel preview build.
   - What it catches: typecheck, build and runtime regressions from the framework and Prisma upgrades; a non-zero production-scope audit; an invalid workflow; a dependency review that does not run.
   - What it misses: whether the image optimiser actually serves an optimised image, the Dependabot configuration (GitHub parses it only from the default branch), and repository settings.
2. **Orchestrator walk with Playwright MCP against the local dev server**, after the framework and Prisma upgrade.
   - What it does: open the public scan page of an asset that has a photo and observe the request for the full-size photo through the image optimiser.
   - What it must observe: status 200 with an `image/*` content type.
   - What it catches: an optimiser broken by the new framework release combined with the `sharp` override change. ADR 0004 names this as the first place to suspect.
   - What it misses: Vercel's own image-optimisation infrastructure.
3. **API readback after the last merge.**
   - What it reads: secret scanning and push protection state; Dependabot alerts and security updates state; the branch protection's required checks, up-to-date flag and administrator enforcement; the open `braces` alerts; a successful Dependabot update run on the configuration.
   - What it catches: settings that did not apply.
   - What it misses: whether protection actually blocks a red merge. That is proven by the next real pull request.

Prior art in the repository:

- The encoding check in CI is the model for a cheap, early, dependency-free step.
- ADR 0004's verification table is the model for proving an override or upgrade, as opposed to assuming it.

## Success criteria

1. `npm audit --omit=dev` on `main` reports zero vulnerabilities at every severity.
2. `npm audit` over the full tree on `main` reports only advisories whose root is GHSA-vfj7-8cjw-p6xm (`braces`).
3. `package.json` pins `next` and `eslint-config-next` at exactly `15.5.28`, and `prisma`, `@prisma/client` and `@prisma/adapter-pg` at exactly `7.10.1`.
4. The overrides block no longer carries `deepmerge-ts`, and carries `sharp` at `^0.35.5` and `postcss` unchanged, or differs only where ADR 0004's mechanical check proved otherwise and the amendment says so.
5. Creating a migration against the local database after the upgrade produces nothing.
6. The public scan page's optimised photo request returns 200 with an `image/*` content type on the local dev server.
7. The security workflow has run green on the pull request that introduced it and on the following push to `main`. The `verify` job no longer contains an audit step. The dependency-review job reported on that pull request.
8. A Dependabot update run on the new configuration has completed without a configuration error.
9. GitHub reports secret scanning, push protection, Dependabot alerts and Dependabot security updates as enabled.
10. Branch protection on `main` lists exactly `verify`, the audit job and the dependency-review job as required checks, with "up to date" required and administrator enforcement off.
11. ADR 0007 and ADR 0008 exist with status Accepted. ADR 0004 carries the amendment. The project instructions point to ADR 0008.
12. A separate issue exists for narrowing the image allow-list.

## Out of scope

- `next@16`, and any other major upgrade.
- CodeQL or any second static-analysis tool.
- Licence checks in the dependency review.
- A scheduled audit.
- Narrowing the `next/image` remote allow-list from any Supabase project to this project's own host. This is a separate issue, because it trades against CI not holding `SUPABASE_URL` at build time.
- Upstream work on `braces`.
- Required pull-request reviews.

## Further notes

- Ordering matters. The remediation must merge before the security workflow can go green, because `verify` keeps its audit until the security workflow moves it out. Repository settings come last, because a required check must have run at least once, and `main` must be green before the branch is protected.
- Vercel builds run `prisma generate && next build` and never run migrations. The Prisma upgrade carries none, so no production database step precedes its merge.
- The figures in the problem statement are a snapshot of 2026-10-23. Advisories published after that date may change the counts before the run executes. The success criteria, not the snapshot, define done.
