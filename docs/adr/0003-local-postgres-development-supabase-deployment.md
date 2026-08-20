# 0003 — Local Postgres for development, Supabase for deployment

- **Status**: Accepted
- **Date**: 2026-08-21
- **Deciders**: Jefry Kurniawan
- **Supersedes**: the database, photo storage, and driver adapter rows of
  [0001](0001-stack-selection.md). Everything else in 0001 stands.

## Context

ADR 0001 selected Neon Postgres accessed through `@prisma/adapter-neon`, with Vercel Blob for
photos. Two things changed after that decision:

1. Development should not require a cloud account. PostgreSQL 17.10 is already installed and
   running on the development machine, so local development can start immediately with no signup,
   no connection limits, and no network dependency.
2. Deployment moves to **Supabase**, which provides both Postgres and object storage. Keeping
   Neon for the database and Vercel Blob for files would mean two vendor accounts for capability
   one account covers.

This changes the driver story in a way that is worth recording, because it simplifies rather than
complicates: local Postgres and Supabase Postgres are both plain Postgres over TCP. One adapter
covers both, and the environment-branching driver configuration that Neon would have forced is not
needed.

## Decision

**Database.**

- Development: the local PostgreSQL 17 instance. Database `inventaris_aset_ppm`, owned by a
  dedicated non-superuser role.
- Deployment: Supabase Postgres.
- One Prisma driver adapter for both: **`@prisma/adapter-pg`**. `@prisma/adapter-neon` is dropped.
- Connection strings follow Prisma's convention, not the wording in Supabase's own quickstart
  (see Consequences):
  - `DATABASE_URL` — used by Prisma Client at runtime. Locally, the plain local instance. On
    Supabase, the **transaction mode** pooler on port 6543 with `?pgbouncer=true&connection_limit=1`.
  - `DIRECT_URL` — used by `prisma migrate`. Locally, the same local instance. On Supabase, the
    **session mode** connection on port 5432. Migrations must not run through the transaction
    pooler.

**Photo storage.**

- A storage seam at `src/lib/storage.ts` with two implementations behind one interface, selected by
  environment:
  - Development: local filesystem under a git-ignored directory, served through a route handler.
  - Deployment: Supabase Storage, using `createSignedUploadUrl` server-side and
    `uploadToSignedUrl` in the browser.
- The architecture from ADR 0001 is unchanged in substance: image bytes go from the browser
  straight to storage, never through a serverless function. Only the provider changes.

**Hosting.** Still Vercel. Supabase does not host the Next.js application; it provides the database
and the object store.

## Consequences

**Made easy.** Development starts today with no cloud account and no signup. One adapter instead of
two, and no environment-branching driver configuration. One vendor account for deployment instead
of two. The local database has no row limit, no connection cap, and no cold start, so seeding and
iterating are faster than against any free-tier hosted database.

**Made hard.**

- The Supabase side of the stack is **unverified** until an account exists. The wave 0 spike can
  only prove the local path. Prisma against Supavisor in transaction mode has known sharp edges —
  prepared statements are unsupported, hence `pgbouncer=true` — and driver adapters change who
  issues those statements, so the interaction needs its own verification. A dedicated cutover
  ticket carries this rather than pretending the spike covers it.
- Two storage implementations means the photo pipeline is exercised locally against a code path that
  is not the one used in production. The interface must be narrow enough that this is a low risk,
  and the cutover ticket must exercise the real one.
- Free-tier Supabase projects **pause after one week without API requests**, and there is no fixed
  demonstration date. This is recorded as risk R4 in `docs/prd.md` §10.
- Free tier ceilings are lower than the previous plan: 500 MB database and 5 GB egress against
  Neon's more generous allowance. Not binding at prototype scale, but worth knowing.

**Foreclosed.** Nothing that was previously available. Neon's database branching per preview
deployment is given up, but it was never in the prototype scope.

## Alternatives considered

- **Keep Neon for deployment, local Postgres for development.** Rejected: that is what forced the
  dual-adapter branch, and it needs a second vendor account for file storage on top.
- **Run Supabase locally via its CLI.** This would make development and production identical, which
  is genuinely attractive. Rejected for now: it requires Docker, which is not installed on the
  machine, and a working local Postgres already exists. Worth revisiting before the cutover.
- **Use Supabase Storage in development too**, against the hosted project. Rejected: it reintroduces
  the cloud-account dependency that motivated this change, and burns free-tier egress on
  development traffic.
- **Supabase Auth instead of Better Auth.** Not considered a live option here, and deliberately not
  adopted: ADR 0001's reasoning for Better Auth is unaffected by where the database is hosted, and
  swapping the authentication layer to match the hosting provider would discard the `admin()` role
  model already specified across the ticket set. Supabase is used as Postgres and object storage
  only.
- **Local filesystem storage in production too.** Rejected: a serverless deployment has no durable
  writable filesystem.
