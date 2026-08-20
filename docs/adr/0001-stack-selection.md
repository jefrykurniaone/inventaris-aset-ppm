# 0001 — Stack selection for the PPM asset inventory prototype

- **Status**: Accepted, partially superseded by
  [0003](0003-local-postgres-development-supabase-deployment.md) — the database, photo storage, and
  driver adapter choices below were replaced on 2026-08-21 by local Postgres for development and
  Supabase for deployment. Everything else here stands.
- **Date**: 2026-08-20
- **Deciders**: Jefry Kurniawan

## Context

Direktorat PPM needs a QR-based asset inventory. The immediate deliverable is a prototype shown
to the client, but it must be production-shaped: real database, real photo uploads, deployed at a
public HTTPS URL so a phone can scan a printed label at the demonstration.

Constraints in play at the time of the decision:

- A phone scanning a label must reach a real HTTPS URL. Localhost and VPN-only hosting are
  disqualified outright.
- The public scan page benefits from server rendering: it is the performance-critical surface and
  is opened on mid-range Android phones over mobile data.
- The coding standard for this project forbids deprecated APIs and requires zero SonarQube issues,
  bilingual interface support, and WCAG AA accessibility.
- Client data belongs to a university directorate; hosting authentication with a third-party
  identity vendor is undesirable.
- Google SSO on the university domain would require an OAuth client on a domain not controlled by
  the developer, and a failed login in front of the client is the worst available demonstration
  failure.
- No pnpm on the build machine.

## Decision

- **Next.js 15, App Router, TypeScript** as a single full-stack application.
- **Neon Postgres**, accessed through **Prisma 7** with the `prisma-client` generator and the
  `@prisma/adapter-neon` driver adapter. Datasource configuration in `prisma.config.ts`.
- **Better Auth** with email/password and the `admin()` plugin for the `admin` / `staff` role
  model. Google SSO is deferred to production.
- **Vercel Blob** for photos, uploaded from the browser directly using a server-issued signed
  token.
- **Tailwind CSS v4 + shadcn/ui**, light and dark themes.
- **`next-intl`** with Indonesian as the default locale and English as the alternate.
- **Vitest** for unit tests, **Playwright** for one end-to-end smoke path.
- **Vercel** hosting, **GitHub Actions** CI, **npm** as the package manager.

## Consequences

**Made easy.** One repository, one deployment, a preview URL per pull request. The scan page is
server-rendered without extra machinery. Authentication data stays in our own database. shadcn/ui
places component source in the repository, so the accessibility and code-quality standards apply
to code we control rather than to a vendor's bundle.

**Made hard.** Prisma 7's generator emits a client to a custom output directory, and Better Auth's
documentation still assumes the legacy `@prisma/client` import path. That seam is unproven and is
addressed separately in ADR 0002. Driver adapters add two packages and two connection strings
rather than one. Choosing password authentication now means an SSO migration later, including a
user-record migration path.

**Foreclosed.** Edge runtime for database-touching routes is not pursued. A separate mobile
application is out of scope; the product is responsive web only.

## Alternatives considered

- **Drizzle ORM instead of Prisma.** Better-trodden with Better Auth, no generated-client
  indirection, smaller runtime. Not chosen: team familiarity with Prisma was judged more valuable
  than avoiding one integration risk, and the risk has a documented fallback ladder.
- **Split React SPA plus a separate API service.** Rejected: two deployments and a CORS surface
  for no prototype benefit, and it loses server rendering on the scan page.
- **Auth.js / NextAuth v5.** Rejected: its credentials provider leaves password storage to be
  hand-rolled, which is the last thing to hand-roll.
- **Clerk.** Rejected: external vendor holding user data, per-seat pricing, and the sign-in
  interface would not be ours to standardise.
- **Prisma 6.19 with `prisma-client-js`.** Rejected as a starting point: beginning a new project
  on a legacy generator conflicts with the standard forbidding deprecated APIs. Retained as the
  last rung of the ADR 0002 fallback ladder.
- **Supabase or Cloudinary for photo storage.** Rejected: an additional vendor account for
  capability already available alongside the hosting platform.
- **Material UI.** Rejected: the result reads as a template, and component internals sit outside
  our quality gates.
