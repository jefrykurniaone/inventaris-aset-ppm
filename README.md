# Sistem Inventaris Aset — Direktorat PPM

QR-based asset inventory for Direktorat Penelitian dan Pengabdian kepada Masyarakat,
Telkom University.

Every asset carries a printed QR label. Scanning it with an ordinary phone camera opens a page
describing that exact item, with photos — no application install, no login. Signed-in staff see
the full record, including financial and custodian data.

## Status

Prototype under construction. See [`docs/prd.md`](docs/prd.md) for the full product requirements,
scope boundaries, and delivery plan.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Database | Local PostgreSQL 17 through `@prisma/adapter-pg` |
| ORM | Prisma 7 (`prisma-client` generator) |
| Auth | Better Auth (email/password, `admin()` plugin) |
| Photos | Stored in PostgreSQL, uploaded through one route handler and served from the application's own origin — see ADR 0009 |
| UI | Tailwind CSS v4 + shadcn/ui |
| i18n | `next-intl` — Indonesian (default) and English |
| Tests | Vitest (unit), Playwright (smoke) |
| Hosting | None. There is no deployment target — see ADR 0009 |

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET
                               # and SEED_ADMIN_PASSWORD — see below
npx prisma generate
npx prisma migrate dev
npm run db:seed                # creates the first administrator
npm run dev
```

Requires Node.js 24 or later and a local PostgreSQL 17 instance. The project uses **npm**, not pnpm.

**`npm run db:seed` is not optional.** A freshly migrated database has no users; public sign-up is
closed and creating a user requires an existing admin session, so without the seed there is no way
to sign in at all. The seed creates one administrator using `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`
and `SEED_ADMIN_PASSWORD`.

`SEED_ADMIN_PASSWORD` has no default and the seed refuses to run without it — a default password
would survive into whatever environment the seed ran in next. Generate one with
`openssl rand -base64 24`. Running the seed again changes nothing and says so; it never rewrites an
existing account's password. It also refuses any `DATABASE_URL` that is not local unless
`SEED_ALLOW_REMOTE=true` is set deliberately.

**Photos need nothing beyond the local database.** They are stored in PostgreSQL, so uploading,
showing and deleting them works offline. See
[`docs/adr/0009-photos-stored-in-postgresql.md`](docs/adr/0009-photos-stored-in-postgresql.md).
There is no deployment target: the project runs locally and in CI only.

The `overrides` block in `package.json` pins `postcss` and `sharp` past advisories that
`next@15.5.23` still depends on. It is not decoration — do not drop it during a dependency bump.
The reason, and the condition for removing it, are in
[`docs/adr/0004-pinned-transitive-overrides-for-postcss-and-sharp.md`](docs/adr/0004-pinned-transitive-overrides-for-postcss-and-sharp.md).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` then `next build`. The generate half is not optional — `src/generated/prisma` is git-ignored, so a fresh clone has no client to import |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke test |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run format` | Prettier, check only |
| `npm run format:write` | Prettier, rewrite in place |

A Husky pre-commit hook runs ESLint and `tsc --noEmit` over staged files, so a
lint or type error cannot be committed.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Used by Prisma Client at runtime. The local PostgreSQL instance |
| `DIRECT_URL` | Used by `prisma migrate`, through `prisma.config.ts`. The same string as `DATABASE_URL` |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Absolute base URL of the running application |
| `NEXT_PUBLIC_APP_URL` | Absolute base URL, used to build QR payload URLs |

## Before a demonstration

There is no deployed environment, so a demonstration runs from a local checkout. Check the day
before, not on the morning.

1. **The database answers.** Open `/api/health` on the running application. It must answer
   `{"status":"ok"}`. That endpoint runs a real query, so a good answer means the database replied,
   not merely that the server is up.
2. **The seed data is present.** Sign in and open the dashboard. The asset count and the status
   breakdown must be the seeded figures, not zeros, and the seeded assets must show their photos.
   `npm run db:seed` restores both on a reset database.
3. **One label scans.** Point a phone camera at a printed label and confirm the public page opens
   with its photos. A label encodes `NEXT_PUBLIC_APP_URL`, so the phone must be able to reach that
   address.

## Documentation

- [`docs/prd.md`](docs/prd.md) — product requirements
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/sonarcloud-analysis.md`](docs/sonarcloud-analysis.md) — how static analysis runs, why
  Automatic Analysis must stay off, and why the coverage exclusions have to track `vitest.config.mts`
- [`CLAUDE.md`](CLAUDE.md) — coding standards and conventions binding on all contributors

Work is tracked as GitHub issues in three kinds, distinguished by the title prefix:

- `spec:` — the output of a grilling session over one coherent surface. Problem, solution, user
  stories, decisions, testing, out of scope. Decided work, not a wish list.
- `map:` — the execution plan for one spec, read by the orchestrator: wave order, executor
  assignment, merge protocol, completion gate, rework protocol. Its tickets hang off it as
  sub-issues.
- A conventional-commit prefix — `feat:`, `fix:`, `chore:`, `test:`, `refactor:` — is a ticket: one
  unit of work, one sub-agent, one pull request. Labelled `wave:N` and `executor:opus` /
  `executor:sonnet`, with blockers recorded as GitHub issue dependencies.

The orchestrator runs every check and fixes none of them. A ticket that fails the completion gate,
a review pass, or a runtime check goes back to the executor that wrote it, on the same branch, as a
further commit.

Current work: spec [#20](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/20), map
[#21](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/21).

## Contributing

No direct commits to `main`. Branch as `feat/`, `fix/`, or `chore/`, use Conventional Commits, and
open a pull request. CI must be green before merge.
