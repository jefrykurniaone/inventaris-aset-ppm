# 0010 — Upgrade Better Auth from 1.7.1 to 1.7.23 and drop `account.issuer`

- **Status**: Accepted
- **Date**: 2026-11-14
- **Deciders**: Jefry Kurniawan

## Context

`CLAUDE.md` pins `better-auth` to an exact version and allows it to move only with an ADR. This is
that ADR. The `auth` CLI is pinned the same way and moves with it. Spec #186 settled the design, and
ticket #188 carries it out.

### The advisories

The required check *Audit production dependencies* (ADR 0008) fails on `main`. On 2026-11-14,
`npm audit --audit-level=high --omit=dev` against `better-auth@1.7.1` reported three advisories, all
fixed from 1.7.7:

| Advisory | Severity | Affected | What it is |
|---|---|---|---|
| [GHSA-965c-763c-88jm](https://github.com/advisories/GHSA-965c-763c-88jm) | critical | `better-auth >=1.4.0-beta.18 <1.7.7` | An OAuth `state` value can be used as a magic-link token to sign in as another user. |
| [GHSA-r4xp-prcw-77qf](https://github.com/advisories/GHSA-r4xp-prcw-77qf) | high | `better-auth >=1.5.0-beta.12 <1.7.7` | The OAuth proxy lets an attacker sign in as another user. |
| [GHSA-44jh-23m7-hpcf](https://github.com/advisories/GHSA-44jh-23m7-hpcf) | low | `@better-auth/drizzle-adapter >=1.6.17 <1.7.7`, `better-auth >=1.6.17 <1.7.7`, `@better-auth/kysely-adapter >=1.6.17 <1.7.0` | Concurrent requests can exceed rate limits on PostgreSQL. |

`src/lib/auth.ts` configures `emailAndPassword`, the `admin()` plugin and `nextCookies()`, and
nothing else. `src/lib/auth-client.ts` adds only `adminClient()`. The database adapter is
`prismaAdapter` from `better-auth/adapters/prisma`.

**The first two advisories do not reach this configuration.** There is no magic-link plugin, no
OAuth or social provider and no OAuth proxy.

**The third advisory is narrower than its package list, and its text does not name this path.**
GHSA-44jh-23m7-hpcf was read with `gh api /advisories/GHSA-44jh-23m7-hpcf` on 2026-11-14. Its "Am I
affected?" section limits it to applications that do all of the following:

- use `@better-auth/drizzle-adapter` from 1.6.17 up to 1.7.7, or `@better-auth/kysely-adapter` from
  1.6.17 through 1.6.31;
- enable rate limiting;
- store rate-limit records in a PostgreSQL database through one of those adapters.

The advisory also lists `better-auth`, without saying why. `better-auth@1.7.1` pins
`@better-auth/drizzle-adapter` exactly, and the advisory gives both packages the same range, which
would account for the listing. This application does store rate-limit records in PostgreSQL
(`rateLimit.storage: "database"` in `src/lib/auth.ts`), and rate limiting is on whenever
`NODE_ENV` is `production` (`enabled: options.rateLimit?.enabled ?? isProduction` in
`dist/context/create-context.mjs`). It does so through the Prisma adapter. The advisory names
neither the Prisma adapter nor any other adapter beyond those two, so it does not say whether
the Prisma path has the same race.

What the shipped code shows is this. In `dist/api/rate-limiter/index.mjs`, the database storage
wrapper (`createDatabaseStorageWrapper`, `:76` in 1.7.1 and `:79` in 1.7.23) is the same in both
versions, apart from one line that converts `lastRequest` to a number (`:88` and `:91`). Elsewhere
in the file, 1.7.23 adds a `Content-Type: application/json` header to the 429 response
(`rateLimitResponse`, `:68-71`). The wrapper admits a request on one of three paths, the same in
both versions (line numbers are 1.7.1, then 1.7.23):

- **No row for the key** (`:97`, `:100`): the `create` of a new row succeeds. No `incrementOne` is
  involved.
- **Window expired** (`:114`, `:117`): `incrementOne` resets the row, with a `where` of `key` and
  `lastRequest <=` the value just read. There is no `count < max` condition.
- **Inside the window** (`:139`, `:142`): `incrementOne` increments the count, with a `where` of
  `key`, `lastRequest >` the start of the window, and `count < max`.

In both versions the Prisma adapter's `incrementOne` (`@better-auth/prisma-adapter`'s
`dist/index.mjs`, `:361` in 1.7.1 and `:418` in 1.7.23) finds the row, then issues an `update`
whose `where` repeats the call's conditions plus the row's id (`:393`, `:450`). It runs both inside
`db.$transaction`, unless it is already running in one (`:409`, `:466`). Whether Prisma 7 sends
that as one conditional SQL `UPDATE` was not verified, because that needs a database. The Prisma
path is therefore not shown to be safe here. 1.7.23 carries the advisory's fix either way. The
Drizzle adapter is installed as a dependency of `better-auth`, but nothing loads it.

The audit fails all the same, because it judges the installed versions and not the configuration.

### Why 1.7.23 and not 1.7.7

1.7.7 is the first release that clears the audit. The upgrade goes to 1.7.23, published on
2026-11-13, for a reason the audit does not show yet. According to spec #186's research:

- Eleven further Better Auth advisories were published on 2026-11-03 and are patched only from
  1.7.16. As of 2026-11-14 they are not yet in the global advisory database, so `npm audit` does
  not report them.
- None of those eleven reaches this configuration.

Stopping at 1.7.7 would pass the check today and fail it again on the day those eleven are imported.

### The `issuer` column

According to spec #186's research, Better Auth 1.7.3 stopped writing `account.issuer`. The
1.7.23 table definitions no longer contain it: the only mention of `issuer` in
`@better-auth/core/dist/db/` is the hint text in `schema-diff.mjs`. In this repository the column
came from `prisma/migrations/20260821044421_better_auth_init/migration.sql`, as `"issuer" TEXT NOT
NULL` with the unique index `account_issuer_accountId_uidx` on `("issuer", "accountId")`. While the
column stays `NOT NULL`, every insert into `account` fails. That includes the admin plugin's
create-user, and therefore the seed, which goes through create-user.

**The start-up schema check does not catch this.** The Prisma adapter compares the generated
client's data model with the tables Better Auth writes. With the `prisma-client` generator that
data model is compact and carries no nullability (upstream database docs, v1.7.15). The shipped
source agrees: `introspectPrismaDataModel` in `@better-auth/prisma-adapter`'s `dist/index.mjs` says
a compact model "reports missing tables and columns but never a required column". This was also
checked in this repository: the `runtimeDataModel` in `src/generated/prisma/internal/class.ts`
carries no nullability for any field, and `isRequired` occurs 0 times in the file.
The failure would therefore surface only at the first account insert.

### The CLI cannot remove a column

`npm run auth:generate` runs the generator with `--output prisma/models/auth.prisma`, and that file
is also the schema it reads. Its Prisma generator, `generatePrismaSchema` in
`node_modules/auth/dist/api.mjs` of `auth@1.7.23`, was read on 2026-11-14. It walks the tables that
Better Auth defines and adds each model, field or index it cannot find. It does change some things
that already exist:

- it renames a `prisma-client-js` generator provider (`api.mjs:477`) and removes the datasource
  `url` (`api.mjs:482`);
- for a field that already exists, it can retype `Int`/`BigInt` (`api.mjs:597-601`) and, on
  MySQL, replace `@db.*` attributes (`api.mjs:611`), before it moves on (`continue`);
- it adds a `map:` name to a matching unmapped index (`api.mjs:703`).

It never removes a model, a model field or an index. A column that Better Auth stops writing
therefore stays in the schema until someone removes it by hand. The upstream 1.7 upgrade guide
(`docs/content/docs/guides/1-7-upgrade-guide.mdx`, v1.7.15, read through Context7 on 2026-11-14)
says the opposite: "The generated `account` model drops both the field and the compound unique
index". That holds for a fresh generation, not for a run that reads an existing file through
`--output`, as `npm run auth:generate` does.

### The CLI's new required-column check

`auth@1.7.23` adds a check that `auth@1.7.1` does not have: the packed 1.7.1 `dist` contains no
`schemaProblems`. After generating, the CLI compares the existing schema with the tables Better
Auth writes. For each column that is required, has no default and is never written, it prints
`⚠ N columns reject every insert Better Auth makes.` (`node_modules/auth/dist/index.mjs:2531-2534`).
It still exits 0, and it still prints `Your schema is already up to date.`

The check reads only the `--output` file. `introspectPrismaSchema` (`index.mjs:2048-2063`) builds
its set of model names from that one parsed file. It skips a field only if the field's type is one
of those models or the field carries `@relation`. In this multi-file schema, four reverse relation
fields on `User` point at models defined in other files: `createdAssets` (`Asset`),
`uploadedPhotos` (`AssetPhoto`), `handledLoans` (`Loan`) and `activities` (`AssetActivity`). They
carried no attribute, so the check reported all four as required columns that Better Auth never
writes. It was a false positive, and it appeared on every run once `issuer` was gone.
`activityAsSubject` and `activityAsActor` were not reported, because they already carry
`@relation("…")`.

## Decision

### Move `better-auth` and `auth` to exactly 1.7.23, together

Both stay exact pins. They have to move together, because of exact-version coupling, read from the
npm registry on 2026-11-14:

- `auth@1.7.23` declares `better-auth`, `@better-auth/core` and `@better-auth/telemetry` at exactly
  `1.7.23`. Moving one without the other installs a second copy of `better-auth`.
- `better-auth@1.7.23` declares its adapters (`@better-auth/prisma-adapter`, `kysely-adapter`,
  `drizzle-adapter`, `memory-adapter`, `mongo-adapter`) and `@better-auth/telemetry` and
  `@better-auth/core` at exactly `1.7.23`, as well as `better-call` at `1.4.5`,
  `@better-fetch/fetch` at `1.3.3` and `@better-auth/utils` at `0.5.1`.

No other dependency moves. Prisma stays at 7.10.1 (ADR 0007). `better-auth@1.7.23` and
`@better-auth/prisma-adapter@1.7.23` both declare `prisma` and `@prisma/client` as
`^5.0.0 || ^6.0.0 || ^7.0.0` peer dependencies. `auth@1.7.23` declares no peer dependencies.

### How the lockfile was produced

The lockfile was produced by two installs in sequence: first `npm install --save-exact
better-auth@1.7.23`, then `npm install --save-exact --save-dev auth@1.7.23`.

A single `npm install` naming both packages was tried first and rejected. npm re-resolves the whole
dependency subtree of a package named on the command line and prefers the newest version that
satisfies each range, even with `--prefer-dedupe`. It therefore also moved `kysely` (0.29.5 to
0.29.9), `nanostores` (1.5.2 to 1.5.5) and `@noble/hashes` (2.3.0 to 2.4.0). No 1.7.23 package
needs those: the versions already locked satisfy every declared range. `npm dedupe` was rejected
as well. A dry run showed it would move 25 unrelated packages.

The two-step lockfile changes these resolved versions and nothing else:

| Package | Before | After |
|---|---|---|
| `better-auth` | 1.7.1 | 1.7.23 |
| `auth` | 1.7.1 | 1.7.23 |
| `@better-auth/core` | 1.7.1 | 1.7.23 |
| `@better-auth/telemetry` | 1.7.1 | 1.7.23 |
| `@better-auth/{prisma,kysely,drizzle,memory,mongo}-adapter` | 1.7.1 | 1.7.23 |
| `@better-auth/utils` | 0.4.2 | 0.5.1 |
| `@better-fetch/fetch` | 1.3.1 | 1.3.3 |
| `better-call` | 1.4.0 | 1.4.5 |
| `@opentelemetry/semantic-conventions` | 1.43.0 | removed |
| `better-call`'s nested `@better-auth/utils` | 0.5.0 | removed, deduped to 0.5.1 |

The five adapters now sit under `node_modules/better-auth/node_modules/` instead of at the top
level. Before, only the Drizzle adapter sat there. Placement does not change what is resolved.
`hono` and `@hono/node-server` are unchanged. `npm ci` installs from the lockfile, and
`npm install --dry-run` reports it up to date, so the next plain `npm install` leaves it alone.

### Remove `account.issuer` by hand, and drop it with a migration

`issuer` and `@@unique([issuer, accountId], map: "account_issuer_accountId_uidx")` are removed
from the `Account` model in `prisma/models/auth.prisma`. This is the one hand edit of an auth
column that this ADR sanctions, and it has to be one, for the reason given in the context: the
generator never removes a model field or an index.

The column is removed rather than made nullable. With it removed, the auth models match what a
fresh generation by `auth@1.7.23` produces, plus the six hand-written reverse relation fields on
`User`. A nullable `issuer` would be a column that Better Auth neither writes nor reads, kept only
for history.

The removal loses nothing. No code under `src/`, `scripts/` or `prisma/` reads `issuer`. The only
databases are local development ones (ADR 0009).

The migration, `prisma/migrations/<timestamp>_drop_account_issuer/migration.sql`, was produced
without a database. `npx --no prisma migrate diff --from-schema <main's prisma/> --to-schema prisma
--script` compared the schema folder on `main` with the edited one. It drops
`account_issuer_accountId_uidx` and then the `issuer` column, and nothing else. That is the order
the upstream 1.7 upgrade guide prescribes: "Drop the index before the column."
(`docs/content/docs/guides/1-7-upgrade-guide.mdx`, v1.7.15, read through Context7 on 2026-11-14.)

### Give every reverse relation field on `User` a `@relation`

The four unnamed reverse relation fields (`createdAssets`, `uploadedPhotos`, `handledLoans`,
`activities`) each get a bare `@relation`. All six reverse relation fields on `User` then carry the
attribute, and the CLI's required-column check skips them. The attribute changes nothing in the
database:

- `npx --no prisma validate` reports the schema valid.
- `migrate diff` from the schema without the attributes to the schema with them prints
  `-- This is an empty migration.`
- `prisma format` leaves the file unchanged.

With the attributes in place, `npm run auth:generate` prints `Your schema is already up to date.`
with no `⚠` line. This was decided under ticket #188 when the executor found the false positive.

### Add `set-phone` to the access-control statements

`src/lib/auth.ts` restates the admin plugin's `defaultStatements`, `adminAc` and `userAc` under this
project's own role names. In 1.7.23
(`node_modules/better-auth/dist/plugins/admin/access/statement.mjs`), `defaultStatements.user` and
`adminAc.user` both list `set-phone` between `set-email` and `get`, and `userAc` still grants
nothing. According to spec #186's research it arrived in 1.7.16. `set-phone` is added to the `user`
statements and to `ADMIN_ROLE`. `STAFF_ROLE` keeps no permission. The comment saying the sets are
copied unchanged is true again.

## What else 1.7.23 changes here

Spec #186 read the release notes from 1.7.2 to 1.7.23 for anything that touches the parts of Better
Auth this project uses. Apart from the points above, it found these:

- **`PASSWORD_TOO_LONG` (from 1.7.6, per spec #186).** In 1.7.23, `/sign-in/email` calls
  `assertPasswordNotTooLong` (`dist/api/routes/sign-in.mjs:316`) before it looks the user up. A
  password longer than `maxPasswordLength` (default 128, `dist/context/create-context.mjs:187`) is
  rejected with `400 PASSWORD_TOO_LONG` (`dist/utils/password.mjs:10-14`). The sign-in lockout does
  not count it, because `classifySignInOutcome` in `src/lib/sign-in-lockout.ts` records only a 401
  as a failed attempt. A 400 is not a credential guess, and the check runs before the lookup, so it
  says nothing about whether an account exists. No code changes. Two consequences follow:
  - **Lock state shows in the status code.** Take a password over 128 characters. An unlocked
    address now gets `400 PASSWORD_TOO_LONG`. A locked address gets `401` from the lockout's
    `hooks.before`, which runs before the endpoint. On 1.7.1, whose sign-in had no length check,
    both got `401`. This discloses lock state, which the before-hook already accepts through timing
    (see `signInLockoutBefore`'s doc comment in `src/lib/auth.ts`). It does not disclose whether an
    account exists, because the counter keys on the submitted string, so an address with no account
    locks the same way. Accepted for that reason. No code change.
  - **Admin create-user has the same limit.** In 1.7.23, `/admin/create-user` calls
    `assertPasswordNotTooLong` too (`dist/plugins/admin/routes.mjs:195`). In 1.7.1 it hashed the
    password without a length check; that version's only admin length check was in
    `/admin/set-user-password`. The admin form's schema (`src/app/(app)/admin/users/schemas.ts:21`)
    sets only a minimum length, so a password over 128 characters now fails there with a generic
    error. That is tracked in #193, outside this ADR.
- **Cookies follow RFC 6265bis (1.7.8, per spec #186).** This was not verified separately here. The
  *End-to-end smoke test* job covers it: it signs in through a real browser against a database built
  from the full migration history.

## Rollback

The upstream blog post *The account change in Better Auth 1.7*
(`docs/content/blogs/1-7-account-schema.mdx`, v1.7.15, read through Context7 on 2026-11-14) warns:
"once 1.7.3 creates accounts without issuer values, downgrading packages alone is not a safe
rollback." This repository makes that concrete. After the migration the column and its index are
gone. 1.7.1, by contrast, defines `issuer` as a required field with a unique index on
`(issuer, accountId)`, in `@better-auth/core@1.7.1`'s `dist/db/get-tables.mjs`, read from the
packed tarball. A rollback is therefore a forward migration that re-adds the column and backfills
it for every account created since, followed by the package downgrade. Reverting this change alone
would leave a migration history that no longer matches the schema.

## Running the generator in a fresh checkout

`npm run auth:generate` loads `src/lib/auth.ts`, which imports the generated Prisma client through
`src/lib/db.ts`. In a fresh checkout, run `npx --no prisma generate` first. Otherwise the CLI stops
with `Couldn't load your auth config` and `Cannot find module '@/generated/prisma/client'`, and
writes nothing.

Generating afterwards is not always enough. The CLI loads the config through `jiti`, which caches
each transpiled file in `/tmp/jiti/` by source content. A run made before the client existed caches
`src/lib/db.ts` with its `@/generated/prisma/client` specifier unresolved, and later runs reuse that
copy until `db.ts` changes or the stale cache entry is deleted.

## Verification

Rows marked #188 need the development database. The orchestrator runs them and posts the results on
that issue. Executors never touch the database.

| Check | Result |
|---|---|
| `npm ls better-auth` | a single `better-auth@1.7.23`, deduped under `auth@1.7.23` |
| `npm audit --audit-level=high --omit=dev` | `found 0 vulnerabilities` |
| `npm ci`, then `npm install --dry-run` | installs; `up to date` |
| `npx --no prisma validate` | `The schemas at prisma are valid` |
| `npx --no prisma migrate diff --from-schema <main> --to-schema prisma --script` | `DROP INDEX "account_issuer_accountId_uidx";` then `ALTER TABLE "account" DROP COLUMN "issuer";` |
| `migrate diff` across the bare `@relation` edit alone | `-- This is an empty migration.` |
| `npm run auth:generate`, twice | `Your schema is already up to date.`, no `⚠` line, `auth.prisma` byte-identical after each |
| `npx --no prisma generate`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` | pass; output on the pull request for #188 |
| Upgrade-guide duplicate check: `SELECT "providerId", "accountId", count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1;` | #188 |
| `npx --no prisma migrate deploy`, then `npx --no prisma migrate status` | #188 |
| `npx tsx scripts/verify-admin-role-model.ts` | #188 |
| `npx tsx scripts/verify-sign-in-lockout.ts` | #188 |
| *End-to-end smoke test*: seed an administrator through create-user, then sign in through a browser | CI on the pull request for #188 |

## Consequences

- The three advisories close upstream, and so, per spec #186, do the eleven not yet in the advisory
  database. *Audit production dependencies* passes again.
- An administrator can create accounts again: inserts into `account` no longer fail on `issuer`.
- `better-auth` and `auth` remain exact pins that move together. Each future upgrade still needs an
  ADR, and it now also needs a clean `npm run auth:generate`, with no `⚠` line, as evidence.
- A column that Better Auth drops upstream needs a hand edit and a migration, because the generator
  never removes anything. `CLAUDE.md` now states this as a rule.
- Every reverse relation field on `User` has to carry `@relation`, including any added later. The
  CLI's required-column check reads only `auth.prisma`. A relation field without the attribute that
  points at a model in another file reappears as a `⚠` line.
- Rollback below 1.7.3 needs a data migration as well as the package change.

## Alternatives considered

- **Stop at 1.7.7.** Rejected: it clears today's audit, and fails again once the eleven 2026-11-03
  advisories, which are patched only from 1.7.16, reach the advisory database.
- **Make `issuer` nullable instead of removing it.** Rejected: it keeps a column that nothing writes
  or reads, and leaves the auth models different from what a fresh generation produces.
- **Keep the four `⚠` lines as known false positives.** Rejected: "no warning" would become "no
  warning except these", which is the habit the new `CLAUDE.md` rule exists to prevent.
- **Install both packages in one command, or run `npm dedupe` afterwards.** Rejected: each moves
  packages that the upgrade does not need, as described above.
- **Override the vulnerable packages and stay on 1.7.1.** Rejected: the advisories are in
  `better-auth` itself, not in a transitive dependency an override could replace, and 1.7.1 would
  still lack the fixes for the eleven later advisories.
- **Move to the standalone `@better-auth/prisma-adapter` package, or to Better Auth 1.8.** Out of
  scope for spec #186.
