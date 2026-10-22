# 0007 — Upgrade Prisma from 7.9.1 to 7.10.1

- **Status**: Accepted
- **Date**: 2026-10-23
- **Deciders**: Jefry Kurniawan

## Context

`CLAUDE.md` pins `prisma` and `@prisma/client` to exact versions and allows them to move only with
an ADR. This is that ADR. `@prisma/adapter-pg` is pinned the same way and moves with them.

On 2026-10-23, `npm audit` against `main` reported 27 advisories (2 critical, 17 high, 8 moderate),
10 of them in the production scope that CI gates on (spec #147). Prisma accounted for several:

- The Prisma CLI pins `mysql2` **exactly**. `prisma@7.9.1` declares `"mysql2": "3.15.3"`, and so does
  `prisma@7.10.0`, so npm cannot resolve past it. That version carries two advisories:
  - [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr): high, `mysql2 < 3.22.0`.
    An auth-plugin downgrade to `mysql_clear_password` leaks plaintext credentials.
  - [GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3): moderate,
    `mysql2 <= 3.23.0`. Unbounded zlib inflate allows a decompression-bomb DoS.
- The CLI also brought `fast-uri@3.1.5` and `source-map-js@1.2.1`, both under high advisories.
- `npm audit --omit=dev` counts all of this as production. `better-auth@1.7.1` declares `prisma`
  (`^5.0.0 || ^6.0.0 || ^7.0.0`) and `mysql2` (`^3.0.0`) as optional peer dependencies, so npm
  classifies the CLI and its tree as production even though they are `devDependencies` here.

`prisma@7.10.1`, published 2026-10-19, is the first release that fixes the pin. Its release notes
say: "Dependencies with security advisories were updated: `mysql2`, `fast-uri`, `deepmerge-ts`,
`mariadb` and `source-map-js`." From the npm registry:

| Package | `7.9.1` declares | `7.10.1` declares |
|---|---|---|
| `prisma` → `mysql2` | `3.15.3` | `3.24.4` |
| `@prisma/config` → `deepmerge-ts` | `7.1.5` | `8.0.2` |

## Decision

Move `prisma`, `@prisma/client` and `@prisma/adapter-pg` from `7.9.1` to `7.10.1` together, all three
still exact pins. The decision was taken on 2026-10-23 over a `mysql2` override that would have kept
Prisma at 7.9.1.

`better-auth` stays at exactly `1.7.1`, and `auth` stays at `1.7.1`. Both of their peer ranges
already cover the new version: `better-auth@1.7.1` and `@better-auth/prisma-adapter@1.7.1` declare
`prisma` and `@prisma/client` as `^5.0.0 || ^6.0.0 || ^7.0.0`.

The schema does not change, and no migration comes with the upgrade. Vercel builds run
`prisma generate && next build` and never run a migration, so no production database step has to
come before the merge.

### What the release notes change for this repository

From the [7.10.0](https://github.com/prisma/prisma/releases/tag/7.10.0) and
[7.10.1](https://github.com/prisma/prisma/releases/tag/7.10.1) release notes, read on 2026-10-23.
These items touch the generated client, the config loader or the adapter:

- **Config discovery.** Prisma 7 now looks for `prisma7.config.*` first, then `.config/prisma7.*`,
  and only then falls back to `prisma.config.*`. This repository has only `prisma.config.ts`, and
  the CLI still loads it: every command prints `Loaded Prisma config from prisma.config.ts.` Beware
  of this later: a `prisma7.config.*` file added to the repository would **take precedence** over
  `prisma.config.ts` without any warning. `schema: "prisma"` and `DIRECT_URL` would then quietly
  stop applying.
- **`prisma-client` generator `moduleFormat` inference.** Fixed for TypeScript projects using
  `module: "node16"` or `"nodenext"`. `tsconfig.json` here uses `"module": "esnext"` with
  `"moduleResolution": "bundler"`, so the fix does not apply. Typecheck and build pass on the
  regenerated client.
- **`@prisma/adapter-pg` error mapping.** `P2002` now keeps the database constraint name, and
  SQLSTATE `40P01` (deadlock) becomes `P2034`. SQLSTATE `23001` (`RESTRICT`) becomes `P2003`.
  `src/lib/prisma-errors.ts` matches on `code` alone and nothing under `src/` reads `meta.target`, so
  the richer `meta` changes nothing here. The `23001` mapping can only widen what
  `isForeignKeyConstraintError` already catches.
- **Nested `$transaction` options (7.10.1).** A nested `tx.$transaction(..., options)` no longer
  writes the outer transaction's id into a shared options object. The code under `src/` calls
  `$transaction` with an inline callback or an array and never passes a shared options object, so it
  was never exposed to this bug.
- **Migrate refuses a shadow database equal to the main database (`P3025`, 7.10.1).**
  `prisma.config.ts` sets no shadow database URL, so this does not apply.
- **`prisma generate` may offer to install Prisma's agent skills.** The prompt is skipped in CI,
  containers, Git hooks and npm lifecycle scripts, never fails generation, and times out after 30
  seconds. None of the `prisma generate` runs during this upgrade showed it.
- **Studio** now binds to `127.0.0.1` and refuses requests from foreign origins. This is a hardening
  only.

## Verification

The orchestrator rule is that executors never touch the development database, so the migration
check below was run by the orchestrator, not in the executor's worktree.

| Check | Result |
|---|---|
| `npm ls prisma @prisma/client @prisma/adapter-pg` | all three `7.10.1`, deduped under `better-auth` and `@better-auth/prisma-adapter` |
| `npm ls mysql2 deepmerge-ts` | `mysql2@3.24.4`, `deepmerge-ts@8.0.2`, with no override in effect for either |
| `npx --no prisma validate` | `Prisma schema loaded from prisma.` / `The schemas at prisma are valid` |
| `npx --no prisma generate` | `Generated Prisma Client (7.10.1) to .\src\generated\prisma` |
| `npx --no prisma version` | `prisma : 7.10.1`, `@prisma/client : 7.10.1`, schema engine `d1b3f377ca835d73fd50954a5e22128b9ebdd6b8` |
| `npm run auth:generate` | `Your schema is already up to date.`, and `prisma/models/auth.prisma` unchanged |
| `npm run typecheck`, `npm run test -- --coverage`, `npm run build` | pass, recorded on pull request for #150 |
| `npm audit --omit=dev` | `found 0 vulnerabilities` |
| `npx prisma migrate dev --create-only` against the local dev database | the orchestrator's check, recorded on issue #150 |

`Prisma schema loaded from prisma` is the load-bearing line, for the reason ADR 0004 gives:
`schema: "prisma"` exists only in `prisma.config.ts`. That line therefore proves the 7.10.1 loader
still found and parsed the old-style config file, despite the new `prisma7.config.*` search order.

## Consequences

- The `mysql2`, `fast-uri` and `source-map-js` advisories close with a fix from Prisma itself, not
  with an override we would have to maintain. The `deepmerge-ts` override from ADR 0004 becomes dead
  weight and is removed in the same change; see ADR 0004's 2026-10-23 amendment.
- The three Prisma packages keep moving together and remain exact pins. Each future Prisma upgrade
  still needs an ADR.
- Prisma 8 is now `latest` on npm (`8.0.0-rc.25` as of 2026-10-23), and `prisma generate` prints an
  "Update available" banner pointing at it. That banner is not an instruction. Prisma 8 is a major
  upgrade, would need its own ADR, and is outside the scope of spec #147.
- The new config search order means that adding a `prisma7.config.*` file is a configuration change,
  not a harmless extra file, and it needs the same review.

## Alternatives considered

- **Override `mysql2` and keep Prisma at 7.9.1.** Rejected on 2026-10-23. It would override an
  **exact** pin in the Prisma CLI, the same shape of debt that ADR 0004 already carries for
  `postcss`. It would add a fourth override with its own removal check, and it would leave
  `fast-uri` and `source-map-js` to be dealt with separately. The upgrade closes all of them from
  upstream and lets the project remove one override instead of adding one.
- **Upgrade to Prisma 8.** Rejected: it is a major version, still a release candidate on 2026-10-23,
  and out of scope for spec #147.
- **Do nothing.** Rejected: PRD §7.6 forbids shipping a package with a known unpatched CVE, and the
  production-scope audit in CI fails on the high `mysql2` advisory.
