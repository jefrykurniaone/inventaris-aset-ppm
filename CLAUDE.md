# Project instructions — inventaris-aset-ppm

Read this before writing any code in this repository. It is binding, including on prototype work.
Product requirements live in `docs/prd.md`; architecture decisions in `docs/adr/`.

## What this is

QR-based asset inventory for Direktorat PPM, Telkom University. A printed QR label on each asset
resolves to a public page describing that item. Signed-in staff see the full record.

## Stack — do not substitute

- Next.js 15, App Router, TypeScript, server components by default
- Prisma 7 with the `prisma-client` generator, output `src/generated/prisma`,
  `importFileExtension = ""`. The schema is a folder: `prisma/schema.prisma` carries the
  `generator` and `datasource` blocks and nothing else, and the models live in
  `prisma/models/*.prisma`. `prisma.config.ts` says `schema: "prisma"` — the directory itself,
  not a nested `prisma/schema`, because Prisma requires the file holding the `generator` block to
  sit at the schema root *and* requires `migrations` to sit beside it, so going deeper would move
  the migration history. The datasource URL lives in `prisma.config.ts`, not in `schema.prisma`.
  `prisma-client-js` is legacy — do not use it.
- Postgres through `@prisma/adapter-pg` — the **same adapter in both environments**. Local
  PostgreSQL 17 in development, Supabase Postgres in deployment. `DATABASE_URL` is used by Prisma
  Client at runtime; `DIRECT_URL` is used by migrations. On Supabase these differ: transaction
  pooler on port 6543 with `?pgbouncer=true&connection_limit=1` for the former, session mode on
  port 5432 for the latter. Locally they are the same string.
- Better Auth: `emailAndPassword`, `admin()` plugin, `nextCookies()`. Supabase is used as Postgres
  and object storage only — **not** as the auth provider. Do not reach for Supabase Auth.
- Object storage is **Supabase Storage in every environment** (`createSignedUploadUrl` /
  `uploadToSignedUrl`), behind one interface. Browser uploads directly; image bytes never pass
  through a serverless function. Buckets differ per environment — `asset-photos-dev` locally,
  `asset-photos` in deployment — selected by `SUPABASE_STORAGE_BUCKET`. There is no local-filesystem
  driver; see ADR 0005.
- Tailwind CSS v4 + shadcn/ui
- `next-intl`, default locale `id`
- Vitest + Playwright
- npm. pnpm is not available.

Look up library APIs before using them. Do not write third-party API calls from memory.

## Architectural seams — respect these

Three seams exist specifically so that a dependency or environment swap stays cheap:

- `src/lib/db.ts` — the only place the generated Prisma client is imported. Everything else
  imports `db` from here.
- `src/lib/auth.ts` and `src/lib/auth-client.ts` — the only places Better Auth is configured.
- `src/lib/storage.ts` — the only place object storage is touched. One interface, **one**
  implementation: Supabase Storage, in every environment. The interface exists so the module stays
  the single seam and so tests can inject an in-memory fake — it is not an environment switch, and
  there is no `STORAGE_DRIVER`. Calling code must never import a Supabase client directly.

Do not import `@/generated/prisma`, `better-auth`, or a Supabase client anywhere else.

`prisma`, `@prisma/client`, and `better-auth` are pinned to exact versions. Do not widen the
version range and do not upgrade them without an ADR.

## Auth tables

Generated with `npm run auth:generate`, then applied with `prisma migrate dev`. Run the script,
never the bare CLI:

```
npm run auth:generate
```

The script is `npx --no auth generate --adapter prisma --yes --output prisma/models/auth.prisma`,
and it exists as a script because both flags are load-bearing and **dropping either fails
silently**. `auth generate` with `--output` omitted exits 0 and prints
`🚀 Schema was overwritten successfully!` while leaving a schema that no longer compiles. A command
whose failure mode is a success message is not something to retype from memory. Do not inline it,
and do not "simplify" it back to the raw command.

What each part is for:

- The CLI is the `auth` package, pinned exactly at `auth@1.7.1` in `devDependencies` to match
  `better-auth@1.7.1` — it declares that exact version as a dependency, so npm dedupes rather than
  installing a second copy. `@better-auth/cli` is the old name: it stops at 1.4.21 and npm reports
  it deprecated.
- `--no` makes npx run that pinned local binary and fail loudly rather than quietly fetching
  whatever `latest` resolves to. "Regenerating produces a zero diff" is not a property an unpinned
  tool can have, so a silent version drift silently invalidates the guarantee this file documents.
- `--output` is not merely a destination. It is also the file the Prisma generator **reads** as the
  existing schema: it parses that file, adds only the models and fields it cannot already find, and
  writes the result back. Omit it and the path defaults to `prisma/schema.prisma` — the schema root,
  which holds no models — so the CLI writes a second set of auth models there and Prisma then fails
  with `P1012`, `The model "User" cannot be defined because a model with that name already exists`.

Because the generator only ever adds, a hand-written addition to a generated model survives a run.
That is what keeps the four reverse relation fields on `User` — `createdAssets`, `uploadedPhotos`,
`handledLoans`, `activities` — alive, and they have to live in `prisma/models/auth.prisma`: a Prisma
model block exists in exactly one file and cannot be reopened from another, and a Prisma relation
must be declared from both sides, so `Asset.createdBy` has nothing else to point at. Those four
lines are the only hand-written ones in that file.

Never hand-write or hand-edit an auth column — regenerate instead. A correct run prints
`Your schema is already up to date.` and touches nothing; `Schema was overwritten successfully!`
means the CLI wrote somewhere it should not have. `npx auth migrate` does not support Prisma.

## Code quality — zero SonarQube issues, first write

Not "fix when reported". Clean on the first write.

**Where this is checked: SonarQube Cloud, in CI, on every pull request.** The `sonar` job in
`.github/workflows/ci.yml` runs the analysis with `sonar.qualitygate.wait=true`, so a failing quality
gate fails the build. That is the authority, and `docs/sonarcloud-analysis.md` explains the parts of
it that are not obvious — including why Automatic Analysis must stay off and why the coverage
exclusions have to move in step with `vitest.config.mts`.

The VS Code SonarLint extension is a convenience, not a gate. **Do not treat its output as
verification and do not ask for it as evidence.** It reports a materially different set from the
server — workflow YAML is server-only, and each has caught TypeScript issues the other missed — and
its diagnostics channel returns an empty result both for a clean file and for a file the editor has
never opened, which are not the same thing. Neither is a superset of the other; CI is the one that
runs on every commit regardless of who has which editor open.

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
- Merge with a merge commit. Never squash and never rebase-merge — the per-commit trail stays on
  `main`, so `git log` and `git bisect` keep the granularity a pull request was written with. The
  one-ticket-one-pull-request rule is about scope, not about collapsing history. Squash and rebase
  merging are disabled on the repository.
- Delete the branch on both sides once its pull request is merged. `deleteBranchOnMerge` is enabled,
  so the remote branch goes by itself; delete the local one and run `git fetch --prune`. A merged
  branch carries nothing the merge commit does not, and stale branches make `git branch -a` useless
  for seeing what is actually in flight.

## Dependencies

Before adding a package, check bundle size, maintenance status, licence, and known CVEs. Nothing
unmaintained for two or more years without written justification. Remove unused dependencies
before merge.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary, matching the labels already on the repo. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context; the glossary lives at `docs/CONTEXT.md` (not the repo root), ADRs at `docs/adr/`. See `docs/agents/domain.md`.
