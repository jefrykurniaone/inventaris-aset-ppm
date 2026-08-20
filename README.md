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

Development needs no cloud account: the database is local Postgres and photos are written to a
git-ignored local directory. Supabase is introduced only at the deployment cutover — see
[`docs/adr/0003-local-postgres-development-supabase-deployment.md`](docs/adr/0003-local-postgres-development-supabase-deployment.md).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke test |
| `npm run db:seed` | Seed demo data (idempotent) |

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Used by Prisma Client at runtime. Local instance in development; Supabase **transaction pooler** (port 6543, `?pgbouncer=true&connection_limit=1`) in deployment |
| `DIRECT_URL` | Used by `prisma migrate`. Same as above locally; Supabase **session mode** (port 5432) in deployment. Migrations must not run through the transaction pooler |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Absolute base URL of this deployment |
| `NEXT_PUBLIC_APP_URL` | Absolute base URL, used to build QR payload URLs |
| `STORAGE_DRIVER` | `local` or `supabase`. Selects the implementation behind `src/lib/storage.ts` |
| `LOCAL_STORAGE_DIR` | Development only. Git-ignored directory for uploaded photos |
| `SUPABASE_URL` | Deployment only |
| `SUPABASE_SERVICE_ROLE_KEY` | Deployment only. Server-side, used to issue signed upload URLs. Never exposed to the browser |
| `SUPABASE_STORAGE_BUCKET` | Deployment only. Bucket holding asset photos |

## Documentation

- [`docs/prd.md`](docs/prd.md) — product requirements
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`CLAUDE.md`](CLAUDE.md) — coding standards and conventions binding on all contributors

Specifications and work items live as GitHub issues, grouped by `wave:*` labels.

## Contributing

No direct commits to `main`. Branch as `feat/`, `fix/`, or `chore/`, use Conventional Commits, and
open a pull request. CI must be green before merge.
