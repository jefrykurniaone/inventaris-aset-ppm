# Deployment cutover — Vercel and Supabase Postgres

How this application is deployed, and how the cutover from local PostgreSQL 17 to Supabase Postgres
is carried out and proved. Issue #17 owns the cutover;
[ADR 0003](adr/0003-local-postgres-development-supabase-deployment.md) is why the database moves and
[ADR 0005](adr/0005-supabase-storage-in-all-environments.md) is why object storage does not — it has
been Supabase Storage in every environment since wave 2, and the cutover only changes which bucket
name is configured.

Supabase here is Postgres and object storage. Supabase Auth is not enabled and never will be —
authentication is Better Auth on our own tables ([ADR 0002](adr/0002-auth-persistence-layer.md)).

**Read [§7](#7-the-transaction-pooler-what-is-actually-true) before debugging a database error
against the deployment.** It is the part of this document that was expensive to establish, and it
contradicts most of what a search engine will offer.

## Constraints that bound every step below

- **No label may be printed for real use until `NEXT_PUBLIC_APP_URL` is final.** A QR code is
  physically stuck to an asset. Changing the host afterwards kills every label already printed.
- **Migrations must never run through the transaction pooler.** `DIRECT_URL`, session mode, port
  5432. See [§7](#7-the-transaction-pooler-what-is-actually-true).
- **`SUPABASE_SERVICE_ROLE_KEY` is server-side only.** Never prefixed `NEXT_PUBLIC_`, never
  committed, never pasted into an issue or a pull request body. If it leaks, rotate it in the
  Supabase dashboard.
- **Do not create a second Supabase project.** The project and both buckets already exist from issue
  #27 — see [`supabase-storage-provisioning.md`](supabase-storage-provisioning.md). The free plan
  allows two projects in total and the second is reserved.
- **No real credential goes in this repository.** Every value below is described by its *shape*. The
  connection strings themselves are read from the Supabase dashboard at the moment they are needed
  and pasted into Vercel's environment settings, nowhere else.

---

## 1. Create the Vercel project

1. Vercel dashboard → **Add New… → Project** → import `jefrykurniaone/inventaris-aset-ppm`.
2. Framework preset: **Next.js**, detected automatically. Root directory `./`. Build command, output
   directory and install command all stay at their defaults — `vercel.json` in this repository sets
   only `crons` and touches no build setting. **Do not override the build command in the dashboard**:
   a dashboard override is configuration nobody reviewing this repository can see.
3. Node.js version: **24 or later** (`package.json` `engines`).
4. **Do not deploy yet.** Add the environment variables from [§2](#2-environment-variables) first: a
   build with no `DATABASE_URL` fails, and a build with the wrong `NEXT_PUBLIC_APP_URL` bakes that
   value into the client bundle, because `NEXT_PUBLIC_*` is substituted at build time and not read
   at runtime.

### The build generates the Prisma client

`package.json`'s build script is `prisma generate && next build`, and the `prisma generate` half is
not optional. `src/generated/prisma` is generated output and git-ignored, so a fresh clone — which
is what Vercel builds — does not contain it, and `src/lib/db.ts` fails with
`Module not found: Can't resolve '@/generated/prisma/client'`. CI does not hit this because
`.github/workflows/ci.yml` runs `npx --no prisma generate` as its own step before `npm run build`;
Vercel runs only the build script.

It is in the **build** script rather than in `postinstall`, which is what Prisma's own Vercel page
still recommends
(<https://www.prisma.io/docs/orm/more/help-and-troubleshooting/vercel-caching-issue>). That page
predates Prisma 7: it argues from a dependency `postinstall` hook that Prisma **removed** in 7.0
(<https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7> — "the post-install hook was removed and
developers are now required to explicitly call `prisma generate`"). Its conclusion survives, its
premise does not. The build script wins here on three counts: it runs on every build whatever the
dependency cache did, this repository's own CI installs with `npm ci --ignore-scripts` so a
`postinstall` would never be exercised by the gate that is supposed to catch its absence, and one
ordering in one place beats two.

Inside an npm script the binary needs no `npx --no`: `npm run` puts `node_modules/.bin` on `PATH`
(<https://docs.npmjs.com/cli/v10/commands/npm-run-script>), so `prisma` is already the pinned local
7.9.1. `npx --no` earns its keep in `ci.yml`, where a bare `run:` step has no such `PATH`.

### `prisma generate` needs `DIRECT_URL` set, even though it opens no connection

`prisma generate` reads the schema and never connects — since 7.2.0 it does not require a database
URL at all. **`prisma.config.ts` requires one anyway**, because its `datasource.url` is
`env<PrismaEnv>("DIRECT_URL")` and that helper is evaluated when the config file loads, before any
command runs. Prisma's config reference says so outright: *"Commands like `prisma generate` don't
need a database URL, but will still fail if `env()` throws an error when loading the config file"*
(<https://www.prisma.io/docs/orm/reference/prisma-config-reference>). Confirmed against the
installed 7.9.1, which words the failure
`Cannot resolve environment variable: DIRECT_URL` rather than the phrasing the docs quote.

So `DIRECT_URL` must exist in **both** the Production and the Preview scope or the build fails —
and it fails inside `prisma generate`, naming an environment variable, which reads as a migration
problem rather than as a build one. [§2](#2-environment-variables) already lists it; this is why it
is required at build time and not only at migration time.

## 2. Environment variables

Set these in **Settings → Environment Variables**. The Environment column says which of Vercel's
scopes each value belongs to.

| Variable | Scope | Value shape |
|---|---|---|
| `DATABASE_URL` | Production + Preview | Supabase → **Connect** → *Transaction pooler*. Host `…pooler.supabase.com`, **port 6543**, user `postgres.<project-ref>`, database `postgres`, query string `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Production + Preview | Same **Connect** panel, *Session pooler*, **port 5432**, otherwise identical |
| `BETTER_AUTH_SECRET` | Production + Preview | A **fresh** secret, `openssl rand -base64 32`. Not the one in `.env.local` — a development secret that also signs production sessions makes the laptop a key to the deployment |
| `BETTER_AUTH_URL` | Production | The production URL, `https://…`, no trailing slash |
| `BETTER_AUTH_URL` | Preview | The **branch** preview URL — see [§6](#6-running-the-smoke-path-against-the-deployment) for why this must not be the production URL |
| `NEXT_PUBLIC_APP_URL` | Production | The same production URL. This is what a printed QR code encodes |
| `NEXT_PUBLIC_APP_URL` | Preview | The same branch preview URL as `BETTER_AUTH_URL` above |
| `SUPABASE_URL` | Production + Preview | The project URL — the **same project** development uses |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | The project's service-role key. Server-side only |
| `SUPABASE_STORAGE_BUCKET` | Production + Preview | `asset-photos`. **Not** `asset-photos-dev`, and not anywhere near this project's settings |

`SUPABASE_STORAGE_BUCKET` is the entire storage half of the cutover. The signed-upload flow, the
bucket policies, the object lifecycle and the public read path were all exercised for real against
`asset-photos-dev` during wave 2, so nothing about that pipeline is unproven — only which bucket
name it is pointed at.

### The seed variables are deliberately not in Vercel

`SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD`, `SEED_STAFF1_*` and `SEED_STAFF2_*`
appear in `.env.example` but are read by `prisma/seed.ts` alone, and `prisma/seed.ts` never runs on
Vercel — the seed is run once from a laptop, in [§4](#4-seed-the-hosted-database). Putting them in
Vercel would park an administrator password in a second system that nothing reads from.

Setting them anyway breaks nothing, so this is a recommendation rather than a rule. It is a
deliberate departure from issue #17's "set every environment variable from `.env.example`", recorded
here rather than done silently.

### One database behind both scopes

Production and Preview share `DATABASE_URL`, so a preview deployment writes to the demonstration
database. At this scale that is the intended trade — the alternative is a second Supabase project,
which ADR 0005 rejected. The consequence is concrete and worth expecting: every run of the smoke
path against a preview leaves one asset row behind, exactly as `e2e/label-printing.spec.ts` already
documents for local runs. `npx --no prisma migrate reset` is the reset, and it must never be pointed
at the hosted database once real demonstration data is in it.

## 3. Run the migrations

Migrations run **from a laptop against the hosted database**, through session mode. Vercel's build
does not run them, and must not: a build has no `DIRECT_URL` semantics of its own and a failed
migration mid-build leaves a half-migrated database with a green deployment in front of it.

**Override the variables in the shell. Do not put them in a file, and do not edit `.env.local`.**

`prisma.config.ts` and `prisma/seed.ts` both call `process.loadEnvFile(".env.local")`, and that file
holds the *local* database. The reason a shell override is safe rather than a race was measured, not
assumed: on Node 24, `process.loadEnvFile` **does not overwrite a variable that is already set in
the environment** — the shell wins. Verified on this machine against `node v24.18.0`.

That precedence is the whole safety property of this step. Without it, `.env.local` would quietly
redirect `prisma migrate deploy` at the local database, where it would succeed, print every
migration as applied, and leave Supabase empty behind a green deployment.

Do not create an `.env.cutover` or similar. `.gitignore` covers `.env`, `.env.local` and
`.env.*.local` and nothing else, so a file named anything outside those three patterns is
**committable**, and it would hold a production database password.

In PowerShell:

```powershell
$env:DIRECT_URL = "<the 5432 session mode string>"
$env:DATABASE_URL = "<the 6543 transaction pooler string>"
npx --no prisma migrate deploy
```

`prisma.config.ts` points the CLI's datasource at `DIRECT_URL`, so that is the one `migrate` uses;
`DATABASE_URL` is set here because the seed in [§4](#4-seed-the-hosted-database) needs it in the
same shell. **Close that shell when both steps are done** — the values are live production
credentials for as long as it is open.

`migrate deploy` and not `migrate dev`: it replays the committed migration history and never
generates a new migration, never prompts, and never resets. `prisma.config.ts` points `migrations`
at the `prisma` directory, so the full history in `prisma/migrations` applies to the empty Supabase
database in order.

**Expected**: every migration listed as applied, and a final `All migrations have been successfully
applied.` **If it fails with a prepared-statement or advisory-lock error, `DIRECT_URL` is pointing
at port 6543** — see [§7](#7-the-transaction-pooler-what-is-actually-true).

Confirm afterwards, still against the hosted database:

```
npx --no prisma migrate status
```

## 4. Seed the hosted database

In the same shell as [§3](#3-run-the-migrations), so that `DATABASE_URL` still points at Supabase:

```powershell
$env:SEED_ALLOW_REMOTE = "true"
$env:SUPABASE_STORAGE_BUCKET = "asset-photos"
$env:SEED_ADMIN_EMAIL = "<the real administrator address>"
$env:SEED_ADMIN_PASSWORD = "<a fresh generated password>"
npm run db:seed
```

Every variable not overridden here comes from `.env.local`, because `prisma/seed.ts` loads it too.
That is why the two below are named explicitly rather than left to the file.

Two things this run needs that a local one does not:

- **`SEED_ALLOW_REMOTE=true`.** `decideSeedTarget` in `src/lib/seed-admin.ts` refuses any
  `DATABASE_URL` whose host is not `localhost`, `127.0.0.1` or `::1`, and says so by name. That
  guard is an allow-list of local hosts rather than a deny-list of production ones, so it fails
  closed: the failure it exists to prevent is seeding a live database by accident — running the seed
  with `.env.local` still loaded, or with a stale shell. Setting the flag is the deliberate "yes,
  this one, on purpose". Set it for this single command and do not leave it in any file.
- **`SUPABASE_STORAGE_BUCKET=asset-photos`.** The seed uploads roughly fifteen assets' photos
  through `prisma/seed-data/photo-writer.ts`. With the development bucket configured they would land
  in `asset-photos-dev` and the deployment would render nothing. Do **not** set `SEED_SKIP_PHOTOS`
  here — that flag exists for CI, which holds no real Supabase secrets.

`SEED_ADMIN_PASSWORD` has no default and the seed refuses to run without it. Generate one with
`openssl rand -base64 24`, keep it out of every file in this repository, and hand it over the way
any other production credential is handed over. The seed is idempotent and never rewrites an
existing account's password, so a second run is safe.

## 5. Verification — the actual point of the cutover

Tick these off in order. Nothing below is a formality: waves 0 to 4 ran every one of them against
local Postgres, and the hosted database path has never executed.

- [ ] **Migrations.** `prisma migrate deploy` applied the full history cleanly to the empty Supabase
      database over `DIRECT_URL` (port 5432, session mode). `prisma migrate status` reports no
      pending migration.
- [ ] **Reads and writes through the transaction pooler.** With the deployment live on
      `DATABASE_URL` (port 6543), sign in, list assets, open an asset, edit it, save. Then exercise
      enough separate requests to be confident connections are not leaking — repeated cold
      invocations, not one page held open. The dashboard, the asset list with filters applied, and
      several scan pages are the cheapest way to generate them.
- [ ] **Seed parity.** The dashboard figures on the deployment match what the local run produced:
      same asset count, same status breakdown, same category chart.
- [ ] **Photo upload from a phone.** Upload a real photo against the deployed application from a
      phone. Confirm the object landed in **`asset-photos`** and not in `asset-photos-dev` — check
      the bucket in the Supabase dashboard, not only that the image renders.
- [ ] **Photo delete.** Delete that photo through the interface and confirm the object is gone from
      the bucket, not merely the row. Its public URL may still answer `200` for a while: that is the
      CDN, and a cache-busting query string does not defeat it — the cache key is the object path
      alone. List the bucket instead. See
      [`supabase-storage-provisioning.md`](supabase-storage-provisioning.md).
- [ ] **A printed label carrying the production `NEXT_PUBLIC_APP_URL`.** Print it, scan it with a
      phone **on mobile data, not on the office network**, and confirm the public page renders with
      photos and no restricted fields.
- [ ] **Performance.** The public scan page is interactive in under **2.5 s** on a mid-range Android
      device over 4G, with photos served from the public bucket (PRD §7.5, FR-6.4).
- [ ] **Smoke path against the deployment.** [§6](#6-running-the-smoke-path-against-the-deployment).
- [ ] **The health endpoint answers.** `GET <production URL>/api/health` returns `{"status":"ok"}`.
- [ ] **The scheduled request reaches it.** The first cron invocation is recorded as `200` in
      Vercel → Cron Jobs, not `401`. [§8](#check-the-first-cron-invocation-actually-returned-200) —
      this one is easy to skip and is exactly the failure R4 exists to prevent.

Only when every box is ticked does PRD acceptance criterion 10 hold, and only then may issue #17 be
closed. Until it closes, no claim is made that the application's **database** runs on Supabase.

## 6. Running the smoke path against the deployment

`playwright.config.ts` starts a local development server unless `PLAYWRIGHT_BASE_URL` is set. Set
it, and no server is started — the run goes entirely against the deployed URL:

```powershell
$env:PLAYWRIGHT_BASE_URL = "<the deployed URL>"
$env:E2E_EMAIL = "<the seeded administrator address>"
$env:E2E_PASSWORD = "<that administrator's password>"
npm run test:e2e
```

PowerShell has no inline `VAR=value command` prefix — the bash one-liner form is a parse error
there, not a no-op, so use the assignments above and then run the command.

**If the target is a preview URL rather than the production domain, this is not enough on its own**
— read the next subsection first.

Both specs skip themselves when `E2E_EMAIL`/`E2E_PASSWORD` are unset, which the runner cannot tell
apart from "no tests" — hence `--pass-with-no-tests`. A run that reports zero tests proved nothing;
read the summary rather than the exit code.

**The credentials are the ones `npm run db:seed` created in [§4](#4-seed-the-hosted-database)**, and
they are passed by environment variable at the point of running. They are not written into any file
in this repository.

### A preview deployment answers `401` until Deployment Protection is bypassed

On the Hobby plan, **Vercel Authentication with Standard Protection is on by default**: the
production domain stays public, but every preview deployment and every generated deployment URL
demands a signed-in Vercel session
(<https://vercel.com/docs/deployment-protection>). A Playwright browser has no such session, so
without a bypass the smoke path fails at its first navigation and reports a broken application
rather than a locked door.

Protection Bypass for Automation is available on Hobby
(<https://vercel.com/docs/deployment-protection/automated-agent-access>). Mint a secret in
**Settings → Deployment Protection → Protection Bypass for Automation → Create**, label it for this
use, and pass it:

```powershell
$env:PLAYWRIGHT_BASE_URL = "<the branch preview URL>"
$env:VERCEL_AUTOMATION_BYPASS_SECRET = "<the bypass secret>"
$env:E2E_EMAIL = "<the seeded administrator address>"
$env:E2E_PASSWORD = "<that administrator's password>"
npm run test:e2e
```

`playwright.config.ts` turns that variable into the `x-vercel-protection-bypass` header on every
request, plus `x-vercel-set-bypass-cookie: true` so that redirects and sub-resources are covered.
Unset, no headers are sent and nothing about a local or CI run changes.

The secret is passed on the command line, never committed, and never written into `vercel.json` —
that file is in the repository.

### Why the preview scope needs its own `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`

Two failures follow from pointing a preview deployment at the production URL, and neither announces
itself as a configuration problem:

- `buildScanUrl` in `src/lib/scan-url.ts` returns an **absolute** URL built from
  `NEXT_PUBLIC_APP_URL`. `e2e/label-printing.spec.ts` reads the scan link off the detail page and
  navigates to it, so the last assertion of the smoke path would leave the preview and check
  **production** instead — and pass, while proving nothing about the deployment under test.
- Better Auth derives its base URL from `BETTER_AUTH_URL` and rejects a request whose origin does
  not match. Signing in on a preview whose `BETTER_AUTH_URL` names production fails at the origin
  check, which reads as a broken sign-in rather than as a wrong variable.

Use the **branch** preview URL (`https://<project>-git-<branch>-<scope>.vercel.app`), which is
stable for the branch, rather than the per-deployment URL, which changes on every push and cannot be
baked into a build variable in advance.

## 7. The transaction pooler: what is actually true

This section exists because the received wisdom about Prisma and Supavisor is written for the Rust
query engine, and this project does not use it. Prisma 7 requires a driver adapter; the connection
string goes to `@prisma/adapter-pg` and then to `pg`, not to a Prisma engine. Everything below was
verified against the exact installed builds — `@prisma/adapter-pg@7.9.1`, `prisma@7.9.1`, `pg@8.23.0`
— rather than taken from a documentation page. Prisma's own pgbouncer page is stale against that
code: it still describes "named prepared statements, which Prisma ORM uses", which was true of the
Rust engine and is not true of `PrismaPg`'s defaults.

### `?pgbouncer=true` is inert here, and prepared statements are fine anyway

- **Nothing in this stack reads `pgbouncer`.** `@prisma/adapter-pg@7.9.1` contains no reference to
  it. `pg-connection-string` copies every query parameter onto the config object and `pg`'s
  `ConnectionParameters` then reads a fixed allow-list of keys, so an unrecognised one is dropped
  silently — no error, no warning.
- **What actually makes transaction mode work is the adapter's default.** node-postgres issues a
  *named* prepared statement only when a query carries a `name`, and `PrismaPg` supplies one only if
  it is given a `statementNameGenerator`. `src/lib/db.ts` passes `connectionString` and nothing
  else, so every query this application issues is an unnamed extended-protocol query — precisely
  what Supavisor transaction mode supports. Supabase's own guidance to node-postgres users is the
  same instruction stated the other way round: omit the `name`.
- **Keep `?pgbouncer=true` in `DATABASE_URL` regardless.** It is inert, not wrong, and both the
  Prisma and the Supabase guides tell a reader to add it. A deployment that differs from every
  troubleshooting page somebody will open at two in the morning costs more than a parameter that
  does nothing.

Sources: <https://www.prisma.io/docs/orm/overview/databases/supabase>,
<https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer>,
<https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL>,
<https://node-postgres.com/features/queries>.

### `connection_limit=1` is inert too, and that one has a consequence

Under a driver adapter the pool is `pg`'s, and Prisma 7 says so directly: *"Driver adapters rely on
the Node.js driver you supply, so connection pooling defaults (and configuration) now come from the
driver itself"*, mapping the old `connection_limit` onto `pg`'s `max`
(<https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool>).
`pg.Pool` defaults to `max: 10`. So each warm serverless instance may hold up to **ten** client
connections to Supavisor, whatever the URL says.

At sixty assets and one demonstrator this is very unlikely to bite. If it does, the symptom is
`P2024` — *Timed out fetching a new connection from the connection pool* — or Supavisor refusing new
clients, and the fix is one line in `src/lib/db.ts`:

```ts
new PrismaPg({ connectionString, max: 1 })
```

`max` is a `pg.PoolConfig` key and belongs in `PrismaPg`'s **first** argument, beside
`connectionString`, not in its second options argument.

**Deliberately not changed as part of issue #17.** It is an unverified edit to the single database
seam, made on the eve of a cutover, and `max: 1` would also serialise every parallel query in local
development, where ten is the right number. It is written down here so that the decision is a
decision and the fix takes a minute when it is needed.

### Error shapes, so the diagnosis takes minutes

| What you see | SQLSTATE | What it means |
|---|---|---|
| `prepared statement "s0" already exists` | `42P05` | Named prepared statements are reaching a transaction pooler. **Not a Prisma bug.** |
| `prepared statement "s3" does not exist` | `26000` | The same fault from the other side: the statement was prepared on one pooled server connection and executed on another |
| `Can't reach database server` (`P1001`) | — | Wrong host or port, or **the Supabase project is paused** — check that first, see [§8](#8-keeping-the-project-awake-r4) |
| `Timed out fetching a new connection from the connection pool` (`P2024`) | — | Pool exhaustion, not a pooler-mode problem. See the `max` note above |

When `42P05` or `26000` appears, work through these in order — the cause is one of them, and it is
never "Prisma is broken":

1. **`prisma migrate` was run through port 6543.** The CLI does not go through the driver adapter at
   all — it opens its own connection from `prisma.config.ts`'s `DIRECT_URL`, so none of the
   reasoning above about unnamed statements applies to it, and ADR 0003 requires session mode for
   exactly that reason. This is the most likely cause by a distance, because it is the one step run
   by hand with variables assembled in a shell.
2. **`src/lib/db.ts` gained a `statementNameGenerator`.** That option is the only thing in this
   codebase that can turn on named prepared statements. If it is there, it was added by mistake.
3. **`DATABASE_URL` is a session-mode or direct string that something else is pooling.** Session
   mode and direct connections both support prepared statements, so this shape only appears where a
   second pooler has been introduced.

## 8. Keeping the project awake (R4)

A free Supabase project receiving no API requests for one week is paused automatically. Data
survives, but the project must be resumed by hand — and the realistic failure is arriving at the
client demonstration to a paused database and a scan page erroring in front of the client. Wave 2 to
wave 4 development traffic kept the project awake. After the last commit, nothing does.

Two pieces in this repository close that:

- **`src/app/api/health/route.ts`** — `GET /api/health` runs `SELECT 1` through the `src/lib/db.ts`
  seam and answers `{"status":"ok"}`. The query is the point: *the thing that pauses is the Supabase
  project*, so an endpoint that returned `200` out of Vercel without touching the database would
  keep the scheduler happy and let the database sleep anyway. It sends `Cache-Control: no-store` for
  the same reason — a response served from Vercel's edge is not a request against Supabase. It
  requires no session, selects no row, names no table, and returns `503` with a generic body and a
  server-side log if the database does not answer.
- **`vercel.json`** — one cron, `/api/health`, daily at `0 3 * * *`.

### Why Vercel cron and not a GitHub Actions schedule

Both were considered. Vercel cron wins on the two things that matter for this specific risk:

- **It needs no URL.** Vercel invokes the project's own production deployment, so nothing has to be
  parameterised with a production URL that is not final until [§1](#1-create-the-vercel-project) is
  done. A GitHub Actions workflow would have to `curl` a URL held in a repository variable.
- **It cannot be switched off by the repository going quiet.** GitHub disables scheduled workflows
  in a public repository after 60 days with no repository activity
  (<https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>).
  That is *exactly* the R4 scenario — a quiet stretch between the last commit and the demonstration
  — so the mitigation would switch itself off in the one situation it exists for. Scheduled runs are
  also explicitly delayed under load on that platform, and queued jobs may be dropped.

Notes on the mechanism, from <https://vercel.com/docs/cron-jobs> and
<https://vercel.com/docs/cron-jobs/usage-and-pricing>:

- The Hobby plan allows 100 cron jobs per project but a **minimum interval of once per day**, and a
  more frequent expression **fails at deployment**. Daily is far inside the one-week requirement, so
  this costs nothing.
- Scheduling precision on Hobby is **per hour**: `0 3 * * *` fires somewhere between 03:00 and 03:59
  UTC (10:00–10:59 WIB). Irrelevant here — the requirement is "not a week", not "at ten".
- Vercel issues a plain `GET`, follows no redirects, retries nothing, and may occasionally miss or
  duplicate an invocation. `GET /api/health` is idempotent, so none of that matters.
- Crons run against the **production** deployment only, never previews.
- `CRON_SECRET` is offered and is **not** used here. The endpoint returns no data, holds no
  authorisation, and requiring a bearer token would also stop the pre-demonstration check in
  `README.md` from being a URL somebody can simply open on a phone.

### Check the first cron invocation actually returned `200`

This is a verification step, not a formality, and it is the one silent failure mode left in the R4
mitigation. **Vercel's documentation does not say whether a cron invocation is exempt from
Deployment Protection.** Cron is absent from the list of callers allowed through Vercel
Authentication, and the protection page says protection *"requires authentication for all
requests"* without naming cron either way. If protection does apply, the cron records a `401`, never
reaches the route, never reaches Supabase — and the schedule keeps reporting that it ran, every day,
while the project pauses anyway.

So after the first scheduled run, open **Vercel → the project → Cron Jobs** and read the status of
the invocation. `200` means the mitigation works. `401` means it does not, and there are two ways
out, neither free:

- Turn Vercel Authentication off for the project. On Hobby that only un-protects preview and
  generated deployment URLs — the production domain was already public — but those previews share
  the production database (see [§2](#one-database-behind-both-scopes)), so this widens what an
  unauthenticated visitor can reach.
- Append `?x-vercel-protection-bypass=<secret>` to the cron path. **That would put a live secret in
  `vercel.json`, which is committed**, so it is not an option here as written. A Deployment
  Protection Exception is the supported alternative and is Pro-and-above only.

Until that invocation has been read, treat R4 as mitigated *on paper*.

### One more thing to settle before this is the real deployment

Vercel's Hobby plan is restricted to **non-commercial, personal use**
(<https://vercel.com/docs/plans/hobby>). This application is being built for a directorate of Telkom
University. Whether that counts is a question for the account holder and possibly for the client
conversation, not something this document can answer — but it should be answered before the
deployment is presented as the institution's system rather than as a prototype.

## 9. Before a demonstration

The short version lives in [`../README.md`](../README.md) so that it is found without knowing this
document exists. Confirm the project is awake, confirm the seed data is present, confirm one label
scans — the day before, not on the morning.
