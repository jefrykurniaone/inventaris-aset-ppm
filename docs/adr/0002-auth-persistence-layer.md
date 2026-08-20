# 0002 — Better Auth persistence layer on Prisma 7

- **Status**: Proposed — to be resolved by the wave 0 spike (issue: "Auth persistence spike")
- **Date**: 2026-08-20
- **Deciders**: Jefry Kurniawan

## Context

ADR 0001 selects Prisma 7 and Better Auth together, and
[ADR 0003](0003-local-postgres-development-supabase-deployment.md) settles the database as local
Postgres for development with Supabase for deployment, accessed through `@prisma/adapter-pg`. This
combination is the least-proven seam in the stack:

- Prisma 7 replaces `prisma-client-js` with the `prisma-client` generator, which emits a client
  into a project directory rather than into `node_modules/@prisma/client`, and moves the datasource
  URL into `prisma.config.ts`.
- Better Auth's Prisma adapter documentation shows `import { PrismaClient } from "@prisma/client"`
  — the legacy path.
- Better Auth exposes two Prisma integrations: a built-in `better-auth/adapters/prisma` and a
  standalone `@better-auth/prisma-adapter` package.
- `npx auth migrate` explicitly does not support Prisma. The documented flow is
  `npx auth generate --adapter prisma` followed by the ORM's own migration tooling.

The integration is expected to work, but "expected" is not a basis for building fourteen tickets
on top of it.

## Decision

Resolve empirically before any feature code is written, via a timeboxed spike, and descend the
following ladder, stopping at the first level that passes:

| Level | Approach | Cost if adopted |
|---|---|---|
| 1 | Built-in `better-auth/adapters/prisma` with the client generated to `src/generated/prisma` | None |
| 2 | Standalone `@better-auth/prisma-adapter` | One additional dependency |
| 3 | Prisma 7 owns application tables; Better Auth owns auth tables through its built-in Kysely/Postgres adapter on the same Neon database | No Prisma types on the user table; joins need a read-only mapped model or raw SQL |
| 4 | Prisma 6.19 with the legacy `prisma-client-js` generator | Project starts on a deprecated generator, against the coding standard |

**Pass condition for the spike**: sign up, sign in, and read both the session and the user's role
inside a server component. Nothing else ships in that pull request.

**Structural mitigations, adopted regardless of which level wins:**

1. All Prisma access is funnelled through `src/lib/db.ts`; all Better Auth configuration through
   `src/lib/auth.ts` and `src/lib/auth-client.ts`. No other file imports the generated client or
   the auth library. Moving between ladder levels therefore touches two files.
2. `prisma`, `@prisma/client`, and `better-auth` are pinned to exact versions until after the
   client demonstration. Automated dependency updates stay disabled.
3. Auth models are generated with `npx auth generate --adapter prisma` and applied with
   `prisma migrate dev`. They are never hand-written.
4. The Playwright smoke test performs a real sign-in, so a regression in this seam fails a pull
   request rather than surfacing during the demonstration.

## Consequences

The spike costs roughly ninety minutes at the very start of the project, before anything depends
on the outcome. In exchange, the failure mode moves from "discovered in wave 2 with twelve files to
unpick" to "discovered in wave 0 with two files to change".

Levels 3 and 4 both carry real cost and are recorded here so that adopting one is a visible,
justified decision rather than a quiet workaround.

This ADR is updated to **Accepted** with the winning level recorded once the spike closes.

## Alternatives considered

- **Build features first and fix the seam when it breaks.** Rejected: the breakage surface grows
  with every ticket that imports a user or session type.
- **Choose Drizzle to avoid the risk entirely.** Considered and rejected in ADR 0001.
- **Adopt level 3 up front** to sidestep the question. Rejected: it permanently gives up Prisma
  types on the user table to avoid a risk that has not yet been shown to exist.
