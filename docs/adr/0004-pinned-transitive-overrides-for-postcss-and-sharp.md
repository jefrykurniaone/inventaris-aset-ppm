# 0004 — Pinned transitive overrides for `postcss`, `sharp`, and `deepmerge-ts`

- **Status**: Accepted
- **Date**: 2026-08-21; amended 2026-08-21 for `deepmerge-ts` (issue #30); amended 2026-10-23 for
  the override re-check and the `braces` chain (issue #150); amended 2026-11-14 for the accepted
  `minimatch` and `deepmerge` advisories (issue #200); amended 2026-11-14 again, for the `shadcn`
  eject that resolves `deepmerge` and the ts-morph path of `minimatch` (issue #208); amended
  2026-11-19 for the `minimatch` resolution (issue #210); amended 2026-11-22 for the `effect`
  override (issue #215)
- **Deciders**: Jefry Kurniawan

## Context

`next@15.5.23` brings two transitive packages that carry open high-severity advisories, and it
does not let npm resolve past them on its own:

- `postcss` is a **hard pin** in Next's `dependencies` (`"postcss": "8.4.31"`), not a range, so
  no amount of hoisting picks up a newer patch.
- `sharp` is an optional dependency declared as `^0.34.3`.

With no `overrides` block, `npm audit` reports 3 high-severity vulnerabilities:

| Package | Advisory |
|---|---|
| `postcss <= 8.5.22` | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) — XSS via an unescaped `</style>` in stringify output |
| `postcss <= 8.5.22` | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) — attacker-controlled `sourceMappingURL` reads arbitrary `.map` files (path traversal) |
| `sharp < 0.35.0` | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — inherited libvips CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 |

`npm audit fix --force` resolves all three by installing `next@16.3.1` — a major-version upgrade,
which is a decision of its own and not one this scaffolding pull request gets to make. PRD §7.6
forbids shipping a package with a known unpatched CVE, so doing nothing was not an option either.

## Decision

Pin both packages through npm `overrides` in `package.json`:

```json
"overrides": {
  "postcss": "^8.5.26",
  "sharp": "^0.35.3"
}
```

With the block in place, `npm audit` reports **0 vulnerabilities**.

**Remove each entry when Next itself depends on a patched version** — that is, when `next`
depends on `postcss >= 8.5.26` and on `sharp >= 0.35.3`. The check is mechanical: delete the
entry, run `npm install --package-lock-only`, then `npm audit`. If it still reports zero, the
override is dead weight and should go. Do not delete the block casually during a dependency
bump; that is exactly how an unexplained override gets lost and an advisory quietly returns.

## Consequences

- `postcss@^8.5.26` is a straightforward forward pin within the same major. Next's pin is exact
  rather than ranged for reproducibility, not for compatibility, and `@tailwindcss/postcss`,
  `shadcn`, and `vite` all already resolve to `8.5.26`, so the whole tree dedupes onto one copy.
- `sharp@^0.35.3` is **outside** Next's declared `^0.34.3` optional range. This is a deliberate
  range violation: it buys the libvips CVE fixes at the cost of running Next's image optimiser
  against a `sharp` major Next has not tested. `sharp` is optional, so a mismatch degrades image
  optimisation rather than breaking the build.
- The `sharp` override is currently **untested by anything**. `next build` does not exercise
  `sharp` at all, because nothing in the app uses `next/image` yet — the build output is five
  static routes and no optimised image. The photo pipeline ticket (**#9**) is its first real
  test. If `next/image` misbehaves there, suspect this override before suspecting the pipeline
  code, and consider `next@16` instead of loosening the pin back to a vulnerable range.

## Alternatives considered

- **Upgrade to `next@16.3.1`**, as `npm audit fix --force` proposes. Rejected for now: a major
  framework upgrade is not in scope for a scaffolding pull request, and it needs its own ADR.
- **Do nothing and accept the advisories.** Rejected: PRD §7.6 forbids a package with a known
  unpatched CVE, and CI would carry three high-severity findings from day one.
- **Fork or vendor `postcss`.** Rejected as disproportionate; an override achieves the same with
  one line and no maintenance surface.

## Amendment — `deepmerge-ts`, reached through the Prisma CLI (issue #30)

### Context

Installing Prisma 7 added a third advisory, on the same shape of path:

- [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) — `deepmerge-ts < 8.0.0`,
  stack exhaustion on recursive object graphs (CWE-674), high severity.
- Path: `prisma@7.9.1 → @prisma/config@7.9.1 → deepmerge-ts@7.1.5`.
- `@prisma/config` declares `deepmerge-ts` at **exactly** `7.1.5`, so npm cannot resolve past it.
- `npm audit fix --force` proposes `prisma@6.12.0` — abandoning Prisma 7, which ADR 0001 selects and
  `CLAUDE.md` forbids substituting. That option was closed from the start.

It was accepted rather than fixed inside the wave 0 spike (#2) because it is not attacker-reachable
here: `@prisma/config` is what loads `prisma.config.ts` for `prisma generate` and `prisma migrate`,
it is not in the runtime bundle, no user input reaches it, and triggering the advisory needs a
self-referencing config object this repository does not have. But three high findings on every
`npm audit` is the kind of noise that hides something real later.

### Decision

Add the override, and it works:

```json
"overrides": {
  "deepmerge-ts": "^8.0.1",
  "postcss": "^8.5.26",
  "sharp": "^0.35.3"
}
```

`deepmerge-ts` resolves to **8.0.2**, and `npm audit` reports **0 vulnerabilities at every severity**
— down from 3 high.

This is an override across a **major version** on the loader that reads `prisma.config.ts`, so the
risk was that the Prisma CLI would silently stop reading its own configuration. It does not. Proven,
rather than assumed:

| Check | Result |
|---|---|
| `npx prisma validate` | `Prisma schema loaded from prisma` / `The schemas at prisma are valid` |
| `npx prisma generate` | `Generated Prisma Client (7.9.1) to .\src\generated\prisma` |
| `npx prisma migrate status` | `4 migrations found` / `Database schema is up to date!` |
| `npx prisma migrate dev --create-only` | created a migration directory, then discarded |
| `npm run auth:generate` | `Your schema is already up to date.` |
| `npm run build` | `✓ Compiled successfully` |

The first line is the load-bearing evidence, and it is worth spelling out why. **`schema: "prisma"`
— a directory rather than a file — exists only in `prisma.config.ts`.** It is not a Prisma default
and cannot be inferred. So `Prisma schema loaded from prisma` is direct proof that `@prisma/config`
parsed the config file successfully under `deepmerge-ts@8`. Had the loader broken, the CLI would
have fallen back to looking for a schema Prisma's defaults name, and found nothing.

### Removal condition

Delete the entry when `@prisma/config` itself depends on `deepmerge-ts >= 8.0.0`. Same mechanical
check as the other two: remove the line, `npm install --package-lock-only`, `npm audit`. If it still
reports zero, the override is dead weight.

### Enforcement

`npm audit --audit-level=high --omit=dev` now runs in CI, so this outcome is enforced rather than
recorded. `--omit=dev` scopes the gate to what actually ships, which is consistent with the
reachability argument above rather than in tension with it: a CLI-only advisory should not fail a
pull request that did not cause it, while anything reaching a user should.

Worth knowing for whoever revisits this: with all three overrides in place the tree is currently
clean **even without** `--omit=dev`. The flag is about which future advisory is allowed to break the
build, not about hiding a finding that exists today.

*2026-10-23:* the audit no longer runs in `verify`. It moved to its own workflow, with the same scope
and threshold, and is recorded in [ADR 0008](0008-dependency-vulnerability-checks.md).

## Amendment — 2026-10-23: override re-check, and the accepted `braces` chain (issue #150)

### Context

Spec #147 moves `next` and `eslint-config-next` to `15.5.28`, and moves the Prisma packages to
`7.10.1` (ADR 0007). Both parents changed what they declare, so each override went through the
mechanical check above:

1. Remove the entry.
2. Run `npm install --package-lock-only`.
3. Run `npm audit`.

Each check started from the same tree: the new pins in place, and the lockfile refreshed with
`npm audit fix` **without** `--force`. On that tree, `npm audit` reported 8 high advisories, every
one rooted in `braces` (see below), and `npm audit --omit=dev` reported 0. The parents now declare,
according to `npm view`:

| Parent | Declares |
|---|---|
| `next@15.5.28` | `"postcss": "8.4.31"` (dependency); `"sharp": "^0.34.3 \|\| ^0.35.5"` (optional) |
| `@prisma/config@7.10.1` | `"deepmerge-ts": "8.0.2"` |

### Outcomes

| Entry | Tree with the entry removed | `npm audit` with it removed | Outcome |
|---|---|---|---|
| `deepmerge-ts` | `prisma@7.10.1 → @prisma/config@7.10.1 → deepmerge-ts@8.0.2` | 8 high, all `braces`; `--omit=dev`: 0 | **Removed** |
| `postcss` | `next@15.5.28 → postcss@8.4.31`, nested under `node_modules/next/node_modules/postcss` | 10 (9 high, 1 moderate): `postcss <= 8.5.22` returns. `--omit=dev`: 1 high, 1 moderate | **Kept**, unchanged at `^8.5.26` |
| `sharp` | `next@15.5.28 → sharp@0.35.5` | 8 high, all `braces`; `--omit=dev`: 0 | **Kept**, floor raised to `^0.35.5` |

- **`deepmerge-ts`.** Its removal condition, that `@prisma/config` itself depends on
  `deepmerge-ts >= 8.0.0`, is now met. `@prisma/config@7.10.1` pins `8.0.2` exactly, and that is
  the version that resolves with no override. The audit stays clean, so the entry was dead weight
  and is gone.
- **`postcss`.** `next@15.5.28` still hard-pins `8.4.31`. Without the override that copy comes back
  nested under `next`, and the audit reports it again under GHSA-qx2v-qp2m-jg93,
  GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp and GHSA-r28c-9q8g-f849. The condition is not met.
- **`sharp`: the mechanical check says "remove", and that result is wrong.** The audit stays clean
  without the entry only because the lockfile already holds `sharp@0.35.5`, and the override is what
  put it there: `npm audit fix` raised it from `0.35.3` inside the old `^0.35.3` range.
  `npm install --package-lock-only` keeps a locked version whenever that version still satisfies the
  parent's range, so the check measured the lockfile, not Next. Next declares
  `^0.34.3 || ^0.35.5`, and that range still admits `0.34.3` through `0.34.5`. Every one of those is
  vulnerable:
  - [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c): libheif,
    `sharp < 0.35.4`.
  - [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w): librsvg,
    `sharp < 0.35.5`.

  The removal condition in the Decision above is stated against what **Next** depends on, and Next
  does not yet depend only on a patched `sharp`. So the entry stays, with its floor raised to the
  first release patched against both, `0.35.5`. Spec #147 had already set this expectation on
  2026-10-23, and this record shows why the clean audit does not overturn it.

For future runs of the check: when the parent declares a **range**, a clean audit after
`--package-lock-only` only shows that the version currently locked is safe. Before removing such
an entry, also read the parent's declared range against the advisory's vulnerable range.

Two consequences in the original Decision no longer hold as written:

- `sharp@^0.35.5` now sits **inside** Next's declared optional range, so the "deliberate range
  violation" described in Consequences is over.
- `next/image` is no longer untested. The public scan page sends its full-size photo through the
  optimiser (issue #110), and the orchestrator's Playwright walk for issue #150 checks that request.
  The `15.5.x` line has also gained a runtime libheif version guard
  ([vercel/next.js#97954](https://github.com/vercel/next.js/pull/97954), released in `15.5.25`):
  AVIF optimisation is enabled only when the installed `sharp` carries a fixed libheif. The photo
  pipeline produces WebP, so this guard does not affect this repository's images.

The block is now:

```json
"overrides": {
  "postcss": "^8.5.26",
  "sharp": "^0.35.5"
}
```

### Accepted: the `braces` chain

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) is a high advisory
(CVSS 7.5, CWE-674): stack-exhaustion denial of service through deeply nested brace patterns. It
covers `braces <= 3.0.3`. As of 2026-10-23 it has no patched release: the advisory's
`first_patched_version` is `null`, and `3.0.3` is the newest `braces` on npm. It is accepted, and it
accounts for all 8 entries that `npm audit` still reports:

- `braces`, `micromatch`, `fast-glob`
- `@next/eslint-plugin-next`, `eslint-config-next`
- `@ts-morph/common`, `ts-morph`, `shadcn`

`npm explain braces` marks it `dev` and shows three paths, each ending in `micromatch@4.0.8 → braces@3.0.3`:

- `eslint-config-next@15.5.28 → @next/eslint-plugin-next@15.5.28 → fast-glob@3.3.1`
- `shadcn@3.8.5 → fast-glob@3.3.3`
- `shadcn@3.8.5 → ts-morph@26.0.0 → @ts-morph/common@0.27.0 → fast-glob@3.3.3`

It is reached only through dev tooling: ESLint's Next.js plugin and the shadcn CLI. Nothing on these
paths is in the production scope, and `npm audit --omit=dev` reports 0. The patterns that reach
`braces` on these paths come from this repository's configuration and from a developer's own CLI
invocations, never from a request to the deployed application.

There is no override that fixes it, because no fixed version exists to override to.
`npm audit fix --force` offers only a downgrade: `shadcn@1.0.0` for this chain, and
`eslint-config-next@14.2.35` for the plugin path. Neither is acceptable.

**Removal condition**: a patched `braces` is published, and Dependabot's security update pull
request brings it into the lockfile. At that point `npm audit` over the full tree should report
zero, and this section is closed.

**The alerts stay open on purpose** (decided 2026-10-23). Dismissing a Dependabot alert also stops
the security update pull request for it, and that pull request is exactly the removal path above.

## Amendment — 2026-11-14: accepted `minimatch` and `deepmerge` advisories (issue #200)

### Context

Two Dependabot alerts were still open after run `advisory-unblock` (map #191). Both are
development scope, and neither can be fixed by an upgrade today. Every version, range and path
below was read on 2026-11-14 from `package-lock.json` at `89abe1a`, from `npm view`, and from
`gh api repos/jefrykurniaone/inventaris-aset-ppm/dependabot/alerts/<n>`. `npm explain minimatch`
fails in this checkout with `Invalid string length`, and `npm explain deepmerge` marks the
package `extraneous`, because `node_modules` here is shared with another tree. So the paths are
read from the lockfile instead.

### Accepted: `minimatch`

[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (alert #23) is a medium
advisory: denial of service through globparts amplification. It covers `minimatch >=7.0.0
<11.0.1`, and the first patched release is `11.0.1`, a major version. Two copies in the lockfile
are in range, both `10.2.6` and both marked `dev`:

- `eslint-config-next@15.5.29 → @typescript-eslint/parser@8.67.0 →
  @typescript-eslint/typescript-estree@8.67.0 → minimatch@10.2.6` (declared `^10.2.2`; the same
  `typescript-estree` is also reached through `@typescript-eslint/eslint-plugin`)
- `shadcn@3.8.5 → ts-morph@26.0.0 → @ts-morph/common@0.27.0 → minimatch@10.2.6` (declared
  `^10.0.1`)

The copy at `minimatch@3.1.5`, used by `eslint`, `@eslint/eslintrc` and the ESLint plugins, is
outside the range.

The newest parents still declare `^10`. On 2026-11-14 `@typescript-eslint/typescript-estree@8.72.2`
declares `^10.2.2` and `@ts-morph/common@0.29.0` declares `^10.0.1`, and both are `latest` on npm.
`minimatch` itself is at `11.0.8`. Dependabot's security update failed on 2026-11-14 (run
`43569995227`): "The latest possible version that can be installed is 10.2.6 because of the
following conflicting dependency".

It does not reach the application. Both paths are dev tooling, ESLint's TypeScript parser and the
shadcn CLI, and `npm audit --omit=dev` reports 0 (read 2026-11-14). The globs those copies match
come from this repository's configuration and from a developer's own CLI invocations, never from a
request to the application.

There is no override. `minimatch` 11 is a major version placed under parents that declare `^10`,
so an override would break the parents' declared range. That is unlike the `sharp` floor, which
stayed inside its parent's range.

**Removal condition**: a release of each parent accepts `^11.0.1`, and Dependabot's security
update pull request brings it into the lockfile.

### Accepted: `deepmerge`

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) (alert #18) is a low
advisory: `mergeObject()` allows prototype poisoning of the returned objects. It covers
`deepmerge >=4.2.0 <=4.3.1`. It has no patched release: the advisory's `first_patched_version` is
`null`, and `4.3.1` is the newest `deepmerge` on npm.

The lockfile has one copy, `deepmerge@4.3.1`, marked `dev`, and one path:
`shadcn@3.8.5 → deepmerge@4.3.1` (declared `^4.3.1`). The newest `shadcn` on 2026-11-14 is
`4.23.0`, and it still declares `^4.3.1`. This is not the `deepmerge-ts` package of the 2026-08-21
amendment.

It does not reach the application. The only path is the shadcn CLI, `npm audit --omit=dev` reports
0, and the objects it merges come from this repository's configuration and from a developer's own
CLI invocations, never from a request to the application.

There is no override, because no fixed version exists to override to.

**Removal condition**: a patched `deepmerge` is published, or `shadcn` stops depending on it.

### Alerts stay open

**Alerts #18 and #23 stay open on purpose** (decided 2026-11-14), for the same reason as the
`braces` chain. Dismissing a Dependabot alert also stops the security update pull request for it,
and that pull request is the removal path for both advisories.

## Amendment — 2026-11-14: the `shadcn` eject resolves `deepmerge` (issue #208)

### Context

The 2026-11-14 amendment above accepted alerts #18 (`deepmerge`) and #23 (`minimatch`) because no
upgrade could fix them. The same day the owner decided to close every alert instead (spec #206).
ADR 0011 takes the `shadcn` package out of the dependency tree, and both advisories ran through it.
Nothing in the acceptance text above is deleted: it records what was decided and why on the day it
was written.

### Resolved: `deepmerge`

The removal condition of the `deepmerge` section above, "`shadcn` stops depending on it", is met.
`shadcn` left the tree under ADR 0011, and with it `deepmerge@4.3.1`, which had no other parent.
`npm ls deepmerge` lists nothing. Alert #18 closes as fixed when the lockfile reaches `main`.

### Partly resolved: `minimatch`

The `shadcn@3.8.5 → ts-morph@26.0.0 → @ts-morph/common@0.27.0 → minimatch@10.2.6` path is gone with
`shadcn`. The `@typescript-eslint/typescript-estree` path is still open, and the `minimatch` ticket
of spec #206 closes it. That ticket completes this amendment. Alert #23 stays open until then.

### The braces chain

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was withdrawn on
2026-10-23 (GitHub's `withdrawn_at` reads 2026-10-23T12:53:02Z), so `npm audit` no longer reports
the chain. Two of its three paths, `shadcn → fast-glob` and
`shadcn → ts-morph → @ts-morph/common → fast-glob`, left with `shadcn`. The third,
`eslint-config-next → @next/eslint-plugin-next → fast-glob@3.3.1 → micromatch@4.0.8 →
braces@3.0.3`, stays and carries no open advisory. The 2026-10-23 "Accepted: the `braces` chain"
section above describes the advisory as it stood then, and it is not deleted.

### The audit gate

Spec #206 widens the CI audit to the whole tree through ADR 0008's amendment. So the `--omit=dev`
passages of this ADR describe the gate as it was.

The owner reversed the 2026-11-14 acceptance of alerts #18 and #23, which was to live with them
until an upstream fix, in favour of removing them. They are fixed rather than accepted. They were
never dismissed, so they close as fixed when the lockfile reaches `main`.

## Amendment — 2026-11-19: `minimatch` resolved (issue #210)

### Resolved: `minimatch`

The removal condition of the 2026-11-14 section, "a release of each parent accepts `^11.0.1`", is
met. The `@ts-morph/common` parent left the tree with `shadcn` (ADR 0011). On 2026-11-19
`npm view @typescript-eslint/typescript-estree@latest version dependencies.minimatch` printed
`version = '8.73.0'` and `dependencies.minimatch = '^11.0.1'`. Nothing in the sections above is
deleted.

`@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` moved from `8.67.0` to `8.73.0`
in `package-lock.json` only, together with the `@typescript-eslint/*` packages that pin each other
exactly. `eslint-config-next@15.5.29` accepts both at `^8.0.0`, so `package.json` is unchanged and
there is no override. The command was `npm update @typescript-eslint/parser
@typescript-eslint/eslint-plugin --ignore-scripts`. `minimatch` moved from `10.2.6` to `11.0.9`,
`brace-expansion` from `5.0.12` to `5.0.13`, and `@isaacs/nonrecursive-glob-match@1.1.0` is new.
`npm ls minimatch` lists `11.0.9` and the `3.1.5` copy used by ESLint, which is outside the
advisory range. `npm audit` reports `found 0 vulnerabilities`. Alert #23 closes as fixed when the
lockfile reaches `main`.

### Release notes

The GitHub releases of typescript-eslint from `8.68.0` to `8.73.0` (`8.67.0` was the installed
version) were read on 2026-11-19. They change rule behaviour, mostly as false-positive and autofix
fixes in `eslint-plugin` rules, and add the rules `no-generated-empty-object-type`,
`no-unsafe-enum-assignment` and `no-unsafe-class-instance-assignment`. The `strict-type-checked`
and `all` presets enable all three in `8.73.0`, and `recommended` does not. This repository
extends `next/core-web-vitals` and `next/typescript`, which build on the recommended set, so none
of the three runs here. Parsing changes in `typescript-estree`: `8.70.1` adds the missing `<` token before type
arguments and requires string literal import attribute values, `8.72.0` includes leading and
trailing comments in the `Program` range and errors on `abstract` before `export`, and `8.73.0`
adds an experimental `projectService` backend for the TypeScript 7.1 native parser, behind an
optional peer that is not installed. `8.72.1` makes the project service use one `Program` per
tsconfig in single-run mode. None of these needed a change in this repository: `npm run lint` passes
with `--max-warnings=0` on the new parser.

### Package check

`@isaacs/nonrecursive-glob-match@1.1.0` is the only new package. It is maintained by `isaacs`, who
also maintains `minimatch`; the package was first published on 2026-10-26, has had six releases
since, and the repository was last pushed on 2026-11-17. Its licence is BlueOak-1.0.0, a permissive
licence. It is 426,992 bytes unpacked in 36 files, has no dependencies and is a development-only
package. GitHub's advisory database lists no vulnerability for it, and `npm audit` reports none.
It is a young package, which is accepted because its author maintains its only consumer.
`brace-expansion@5.0.13` is MIT, 133,109 bytes unpacked, and an existing package at a patch
release. `minimatch@11.0.9` is BlueOak-1.0.0, 507,556 bytes unpacked, and a major version above
the previous copy; it requires Node 20 or later, which CI and this repository already use.

## Amendment — 2026-11-22: `effect`, reached through the Prisma CLI (issue #215)

### Context

[GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw) (CVE-2026-121707,
Dependabot alert #24) is a high advisory: `Schema.TemplateLiteral` compiles each `Schema.String`
span to a lazy wildcard, so a template with two or more such spans backtracks cubically on a
non-matching input. It covers `effect <= 3.22.0`, and the first patched release is `3.22.1`.

The lockfile had one copy, `effect@3.20.0`, marked `dev`, on one path:
`prisma@7.10.1 → @prisma/config@7.10.1 → effect@3.20.0`. `@prisma/config` declares `effect` at
**exactly** `3.20.0`, so npm cannot resolve past it. Since ADR 0008's whole-tree amendment
(issue #209) the audit gate covers dev tooling at `high`, so `npm audit` reported 3 high and the
next pull request to `main` would have failed the required `Audit dependencies` check.

No upgrade fixes it. Read on 2026-11-22 with `npm view`:

- Every stable `@prisma/config` 7.x, from `7.9.0` to `7.10.1`, declares `effect` `3.20.0`.
  `7.10.1` is the newest stable Prisma and the version installed.
- `prisma@latest` is `8.0.0-rc.34`, a release candidate of the next major. Its CLI no longer
  depends on `@prisma/config`, and `@prisma/client` and `@prisma/adapter-pg` have no
  `8.0.0-rc.34`; their `latest` is still `7.10.1`.
- `npm audit fix --force` proposes `prisma@6.12.0`, a downgrade, which ADR 0001 and `CLAUDE.md`
  rule out.

The advisory is not reachable here. `@prisma/config` uses `effect` to decode `prisma.config.ts` for
the Prisma CLI: its bundle calls `Schema` and `Either`, and `TemplateLiteral` does not occur in it.
The input is this repository's own configuration, never a request to the application, and the
package is not in the runtime bundle. The override is about keeping the gate green and closing the
alert, not about a live exposure.

### Decision

The owner chose on 2026-11-22 to override now and to bump Prisma later, once a stable release
depends on a patched `effect`. The block is now:

```json
"overrides": {
  "effect": "^3.22.1",
  "postcss": "^8.5.26",
  "sharp": "^0.35.5"
}
```

`effect` resolves to `3.22.5` (MIT, published 2026-11-19). It declares the same dependencies as
`3.20.0`, `fast-check ^3.23.1` and `@standard-schema/spec ^1.0.0`, so the lockfile diff is the
`effect` entry alone and no package is new. It stays inside the `3.x` major, but outside
`@prisma/config`'s exact pin, so this is a deliberate range violation of the kind the original
Decision describes for `sharp`.

As with `deepmerge-ts`, the risk is that the Prisma CLI silently stops reading its own
configuration. It does not:

| Check | Result |
|---|---|
| `npm ls effect` | one copy, `prisma@7.10.1 → @prisma/config@7.10.1 → effect@3.22.5` |
| `npm audit` | `found 0 vulnerabilities` |
| `npx --no prisma validate` | `Prisma schema loaded from prisma.` / `The schemas at prisma are valid` |
| `npx --no prisma generate` | `Loaded Prisma config from prisma.config.ts.` / `Generated Prisma Client (7.10.1)` |
| `npx --no prisma migrate status` | read `Datasource "db"` at `127.0.0.1:5432` from the config, then `P1001`: no database on the machine that ran the check |
| `npm run auth:generate` | `Your schema is already up to date.` |
| `npm run build` | passes |

`Prisma schema loaded from prisma` is the load-bearing line, for the reason the `deepmerge-ts`
amendment gives: `schema: "prisma"` exists only in `prisma.config.ts`. `migrate status` resolved
the datasource URL, which also lives only in that file, before it failed on the connection.

### Removal condition

Delete the entry when a stable Prisma release depends on `effect >= 3.22.1` through
`@prisma/config` or its successor, or no longer depends on `effect` at all. The Prisma upgrade is
ADR-gated, so the entry goes in that upgrade's pull request: remove it,
`npm install --package-lock-only`, `npm audit`, and read the parent's declared range as the
2026-10-23 amendment requires.
