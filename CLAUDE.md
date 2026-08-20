# Project instructions — inventaris-aset-ppm

Read this before writing any code in this repository. It is binding, including on prototype work.
Product requirements live in `docs/prd.md`; architecture decisions in `docs/adr/`.

## What this is

QR-based asset inventory for Direktorat PPM, Telkom University. A printed QR label on each asset
resolves to a public page describing that item. Signed-in staff see the full record.

## Stack — do not substitute

- Next.js 15, App Router, TypeScript, server components by default
- Prisma 7 with the `prisma-client` generator, output `src/generated/prisma`,
  `importFileExtension = ""`. The datasource URL lives in `prisma.config.ts`, not in
  `schema.prisma`. `prisma-client-js` is legacy — do not use it.
- Neon Postgres through `@prisma/adapter-neon`. `DATABASE_URL` is pooled and used at runtime;
  `DIRECT_URL` is direct and used by migrations.
- Better Auth: `emailAndPassword`, `admin()` plugin, `nextCookies()`
- Vercel Blob, client-direct upload with a server-issued signed token
- Tailwind CSS v4 + shadcn/ui
- `next-intl`, default locale `id`
- Vitest + Playwright
- npm. pnpm is not available.

Look up library APIs before using them. Do not write third-party API calls from memory.

## Architectural seams — respect these

Two files exist specifically so that a dependency swap stays cheap:

- `src/lib/db.ts` — the only place the generated Prisma client is imported. Everything else
  imports `db` from here.
- `src/lib/auth.ts` and `src/lib/auth-client.ts` — the only places Better Auth is configured.

Do not import `@/generated/prisma` or `better-auth` anywhere else.

`prisma`, `@prisma/client`, and `better-auth` are pinned to exact versions. Do not widen the
version range and do not upgrade them without an ADR.

## Auth tables

Generated with `npx auth generate --adapter prisma`, then applied with `prisma migrate dev`.
Never hand-write or hand-edit the auth models. `npx auth migrate` does not support Prisma.

## Code quality — zero SonarQube issues, first write

Not "fix when reported". Clean on the first write.

- Zero warnings, zero vulnerabilities, zero deprecated components
- Functions at most 40 lines. Files at most 300 lines. Split rather than exceed.
- Nesting depth at most 3. Prefer early return.
- No magic numbers. Named constants only.
- No empty catch blocks. Log errors with location, input, and message.
- No stack trace or internal error text reaches a user. User-facing errors are localised.
- Fix every lint and type error before calling a task done.

Rules that bite most often here: props must be `Readonly<Props>` (S6759); no redundant fragment
around a single child (S6749); no component defined inside another component's render (S6478);
no deprecated APIs (S1874); cognitive complexity — split, do not nest (S3776); prefer `for…of`
(S4138); no unused imports, locals, or dead stores (S1128 / S1481 / S1854); no nested ternaries
(S3358); click handlers need keyboard equivalents (S1082); insecure randomness is never acceptable
for tokens (S2245).

Never silence a finding with `// NOSONAR`. Fix the cause.

## Naming

| Thing | Convention |
|---|---|
| Variables, functions | `camelCase` |
| Classes, React components | `PascalCase` |
| Constants | `SCREAMING_SNAKE_CASE` |
| Component files | `PascalCase.tsx` |
| Utility and hook files | `kebab-case.ts` — `use-assets.ts`, `format-currency.ts` |
| Booleans | prefixed `is`, `has`, `should` |

## Security

- OWASP Top 10 applies.
- Validate input server-side at every entry point: server actions, route handlers, URL params,
  forms. Use Zod schemas, and share them between client and server.
- Authorisation is checked server-side on every mutation. Hiding a UI control is not authorisation.
- The public/restricted field split (see `docs/prd.md` §8.2) is enforced at the **data-fetch**
  layer. A public query must not select restricted columns at all. Do not fetch everything and
  hide it in the component.
- `qrToken` uses `nanoid`, 12 characters. Never `Math.random()`. Never derive it from the row ID
  or the asset code.
- Never expose custodian or borrower personal data on a public route.
- No runtime script from a third-party CDN. The `browser-image-compression` worker is self-hosted
  via its `libURL` option.

## Internationalisation

Every user-facing string goes through `next-intl`. Zero hardcoded display text — including
validation messages, empty states, toasts, and error pages. Keys are written in English; both
`id` and `en` message files must be complete in the same pull request that adds a key. Format
dates, numbers, and IDR currency through the locale.

## Accessibility

WCAG AA. Contrast at least 4.5:1 in both themes. Everything keyboard-navigable, including photo
upload and table filters. Descriptive `alt` on every image; asset photos use asset name and
category. Semantic elements before ARIA roles.

## Testing

- Vitest unit tests for business logic and utilities: asset code generation, QR tokens, field
  visibility, report aggregation, formatting, export shaping. Co-locate as `*.test.ts` beside the
  source.
- Test behaviour, not implementation.
- One Playwright smoke path: sign in → create asset → upload photo → label print view → public
  scan page renders. It must perform a real sign-in.

## Git

- Branches: `feat/`, `fix/`, `chore/`, `hotfix/`
- Conventional Commits
- No direct commit or push to `main`. Branch, then pull request.
- CI must pass before merge.
- One ticket, one pull request. Reference the issue number in the pull request body.

## Dependencies

Before adding a package, check bundle size, maintenance status, licence, and known CVEs. Nothing
unmaintained for two or more years without written justification. Remove unused dependencies
before merge.
