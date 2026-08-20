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
| Database | Neon Postgres via `@prisma/adapter-neon` |
| ORM | Prisma 7 (`prisma-client` generator) |
| Auth | Better Auth (email/password, `admin()` plugin) |
| Photos | Vercel Blob, client-direct signed upload |
| UI | Tailwind CSS v4 + shadcn/ui |
| i18n | `next-intl` — Indonesian (default) and English |
| Tests | Vitest (unit), Playwright (smoke) |
| Hosting | Vercel |

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL, DIRECT_URL, BLOB_READ_WRITE_TOKEN, BETTER_AUTH_SECRET
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

Requires Node.js 24 or later. The project uses **npm**, not pnpm.

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
| `DATABASE_URL` | Neon **pooled** connection string, used at runtime |
| `DIRECT_URL` | Neon **direct** connection string, used by migrations |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Absolute base URL of the deployment |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token |
| `NEXT_PUBLIC_APP_URL` | Absolute base URL, used to build QR payload URLs |

## Documentation

- [`docs/prd.md`](docs/prd.md) — product requirements
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`CLAUDE.md`](CLAUDE.md) — coding standards and conventions binding on all contributors

Specifications and work items live as GitHub issues, grouped by `wave:*` labels.

## Contributing

No direct commits to `main`. Branch as `feat/`, `fix/`, or `chore/`, use Conventional Commits, and
open a pull request. CI must be green before merge.
