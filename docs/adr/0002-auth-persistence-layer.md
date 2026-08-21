# 0002 — Better Auth persistence layer on Prisma 7

- **Status**: Accepted — resolved by the wave 0 spike (issue #2) at **level 1**
- **Date**: 2026-08-20, outcome recorded 2026-08-21
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
| 3 | Prisma 7 owns application tables; Better Auth owns auth tables through its built-in Kysely/Postgres adapter on the same Postgres database | No Prisma types on the user table; joins need a read-only mapped model or raw SQL |
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

## Outcome of the spike

**Level 1 holds. Nothing was descended.** Better Auth's built-in `better-auth/adapters/prisma`
accepts the client that Prisma 7's `prisma-client` generator emits into `src/generated/prisma`, with
no shim, no extra package, and no change to the adapter call. Versions proven:
`prisma` and `@prisma/client` 7.9.1, `@prisma/adapter-pg` 7.9.1, `better-auth` 1.7.1, against local
PostgreSQL 17.

The pass condition was met in both halves. A one-shot script,
`scripts/verify-auth-persistence.ts`, signs a user up, signs them in, and reads the session and the
user's `role` back through `auth.api.*` — the same server-side surface a server component calls —
and `src/app/auth-check/page.tsx` renders the session and the role inside a server component. Both
are temporary and are deleted by the sign-in interface ticket.

The single documented incompatibility turned out to be the shallowest possible one. Better Auth's
Prisma page shows `import { PrismaClient } from "@prisma/client"`; the fix is to import from the
generator's output path instead, which `src/lib/db.ts` already does by construction. The adapter
never learns where its client came from. Level 1 was, in the end, a one-line difference from the
documentation.

Four things were worth the ninety minutes anyway, because none of them were in the documentation
we had read:

1. **`prisma migrate dev` does not generate the client in Prisma 7.** The migration applied
   cleanly, the schema was correct, and `tsc` then failed with
   `Property 'user' does not exist on type 'PrismaClient'` — the generated client was still the
   model-less one from before the auth models existed. An explicit `prisma generate` fixes it. This
   is also why CI carries its own generation step: nothing else in the pipeline produces the client,
   and the client is not committed.
2. **Prisma 7 loads no environment file at all**, and this project's is `.env.local`, which even
   Prisma's own `dotenv/config` recipe would miss. `prisma.config.ts` therefore loads it through
   Node's built-in `process.loadEnvFile`, guarded, so that CI — which has no such file and gets its
   variables from the workflow — is not a failure case. No `dotenv` dependency was added.
3. **`datasource.url` in `prisma.config.ts` is the CLI's connection, not the runtime client's.**
   The runtime connection comes from the driver adapter. That reads at first like a wrinkle and is
   actually the cleanest possible fit with
   [ADR 0003](0003-local-postgres-development-supabase-deployment.md): the config file holds
   `DIRECT_URL`, because the CLI is what runs migrations, and `src/lib/db.ts` holds `DATABASE_URL`,
   because the adapter is what serves queries. The two variables land where they belong without
   anything having to branch on environment.
4. **Better Auth 1.7's documentation now points at a separate `@better-auth/prisma-adapter`
   package**, which reads like level 2 having become the only option. It has not:
   `better-auth@1.7.1` still exports `better-auth/adapters/prisma`, and that is what is in use. The
   standalone package was never installed.

Two smaller notes for whoever reads this next. The auth models were generated with
`npx auth generate --adapter prisma --yes`; the CLI found `src/lib/auth.ts` on its own, so the
`admin()` plugin's columns — `role`, `banned`, `banReason`, `banExpires` on `user` and
`impersonatedBy` on `session` — came out in the same pass, which is the whole reason the role half
of the pass condition could be met at all. Despite announcing "Schema was overwritten successfully",
it left the hand-written `generator` and `datasource` blocks and the file's header comment intact.
And the role read back is `"user"`, the bare `admin()` default: mapping the product's `admin` /
`staff` model onto it is a later ticket, not a property of this seam.

One deviation from the ticket as written is worth recording, because it is visible in the diff. The
route handler at `src/app/api/auth/[...all]/route.ts` does not call `toNextJsHandler` itself. The
coding standard says `better-auth` is imported in exactly two files, so the handler pair is built in
`src/lib/auth.ts` and the route re-exports it. The seam count stays at two, and the route file
survives a move down the ladder untouched.

## Consequences

The spike costs roughly ninety minutes at the very start of the project, before anything depends
on the outcome. In exchange, the failure mode moves from "discovered in wave 2 with twelve files to
unpick" to "discovered in wave 0 with two files to change".

Levels 3 and 4 both carry real cost and are recorded here so that adopting one is a visible,
justified decision rather than a quiet workaround. Neither was needed; both stay on record as the
route back if a future Prisma or Better Auth release breaks level 1.

The structural mitigations above are kept even though level 1 won, because they are what makes the
ladder cheap to descend later. The version pins stay exact, and lifting either of them needs a new
ADR.

One mitigation had to be paid for rather than assumed: the three seam modules are pure wiring with
no branches, so they cannot reach the ninety-percent coverage gate on `src/lib/**` by being unit
tested — a test could only assert that a library was handed the object it was given. They are
excluded from coverage in `vitest.config.mts`, with the reasoning in a comment beside the exclusion,
and the Playwright smoke path's real sign-in is what actually holds them. The threshold itself is
untouched.

## Alternatives considered

- **Build features first and fix the seam when it breaks.** Rejected: the breakage surface grows
  with every ticket that imports a user or session type.
- **Choose Drizzle to avoid the risk entirely.** Considered and rejected in ADR 0001.
- **Adopt level 3 up front** to sidestep the question. Rejected: it permanently gives up Prisma
  types on the user table to avoid a risk that has not yet been shown to exist.
