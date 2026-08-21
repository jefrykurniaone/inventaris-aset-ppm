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
| Database | Local PostgreSQL 17 in development, Supabase Postgres in deployment — one adapter, `@prisma/adapter-pg` |
| ORM | Prisma 7 (`prisma-client` generator) |
| Auth | Better Auth (email/password, `admin()` plugin) |
| Photos | Local filesystem in development, Supabase Storage in deployment, client-direct signed upload |
| UI | Tailwind CSS v4 + shadcn/ui |
| i18n | `next-intl` — Indonesian (default) and English |
| Tests | Vitest (unit), Playwright (smoke) |
| Hosting | Vercel |

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

Requires Node.js 24 or later and a local PostgreSQL 17 instance. The project uses **npm**, not pnpm.

Development runs the database locally, but **photos need a Supabase project**: object storage is
Supabase Storage in every environment, writing to an `asset-photos-dev` bucket locally and
`asset-photos` in deployment. There is no local-filesystem fallback, so photo upload requires
network access. Everything else works offline. See
[`docs/adr/0003-local-postgres-development-supabase-deployment.md`](docs/adr/0003-local-postgres-development-supabase-deployment.md)
for the database split and
[`docs/adr/0005-supabase-storage-in-all-environments.md`](docs/adr/0005-supabase-storage-in-all-environments.md)
for storage.

The `overrides` block in `package.json` pins `postcss` and `sharp` past advisories that
`next@15.5.23` still depends on. It is not decoration — do not drop it during a dependency bump.
The reason, and the condition for removing it, are in
[`docs/adr/0004-pinned-transitive-overrides-for-postcss-and-sharp.md`](docs/adr/0004-pinned-transitive-overrides-for-postcss-and-sharp.md).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
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
| `DATABASE_URL` | Used by Prisma Client at runtime. Local instance in development; Supabase **transaction pooler** (port 6543, `?pgbouncer=true&connection_limit=1`) in deployment |
| `DIRECT_URL` | Used by `prisma migrate`. Same as above locally; Supabase **session mode** (port 5432) in deployment. Migrations must not run through the transaction pooler |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Absolute base URL of this deployment |
| `NEXT_PUBLIC_APP_URL` | Absolute base URL, used to build QR payload URLs |
| `SUPABASE_URL` | Required in every environment. One project serves both |
| `SUPABASE_SERVICE_ROLE_KEY` | Required in every environment. Server-side only, used to issue signed upload URLs after the Better Auth session check. Never exposed to the browser |
| `SUPABASE_STORAGE_BUCKET` | Required in every environment. `asset-photos-dev` in development, `asset-photos` in deployment |

## Documentation

- [`docs/prd.md`](docs/prd.md) — product requirements
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`CLAUDE.md`](CLAUDE.md) — coding standards and conventions binding on all contributors

Work is tracked as GitHub issues in three kinds, distinguished by the title prefix:

- `spec:` — the output of a grilling session over one coherent surface. Problem, solution, user
  stories, decisions, testing, out of scope. Decided work, not a wish list.
- `map:` — the execution plan for one spec, read by the orchestrator: wave order, executor
  assignment, merge protocol, completion gate. Its tickets hang off it as sub-issues.
- A conventional-commit prefix — `feat:`, `fix:`, `chore:`, `test:`, `refactor:` — is a ticket: one
  unit of work, one sub-agent, one pull request. Labelled `wave:N` and `executor:opus` /
  `executor:sonnet`, with blockers recorded as GitHub issue dependencies.

Current work: spec [#20](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/20), map
[#21](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/21).

## Contributing

No direct commits to `main`. Branch as `feat/`, `fix/`, or `chore/`, use Conventional Commits, and
open a pull request. CI must be green before merge.
