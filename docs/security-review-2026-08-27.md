# Security review — authorization audit and baseline scan

**Date:** 2026-08-27
**Ticket:** [#90](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/90)
**Parent spec:** [#81](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/81) — production hardening and table UX v2
**Reviewed revision:** `chore/90-security-review`, branched from `5e4681e`
**Reviewer:** automated agent review, authorized by the repository owner against the owner's own application.

This review changed no application code. The only file it adds is this report.

## 1. Scope

Two crown jewels frame the review, both named by the ticket:

- **The public QR surface.** `GET /a/<qrToken>` answers a phone that has never signed in. Anything it selects is effectively published.
- **The admin/staff role split.** `admin` may manage master data and user accounts; `staff` may run the asset register. A staff caller reaching an admin mutation is a privilege escalation.

In scope: every server-side mutation and its authorization check; the public/restricted field split at the data-fetch layer; QR token generation and enumeration resistance; sign-in rate limiting and account lockout; session invalidation on deactivation; and whatever the OWASP Top 10 frame surfaced while reading.

Out of scope: penetration testing, active attack scanning, load generation, Supabase project-level configuration (bucket policies and database roles were read as documented, not verified against the live project), and the Vercel account's own settings.

## 2. Method

Manual source reading of the branch, plus these one-shot commands:

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` — all pass on this branch.
- `npm audit` — 0 vulnerabilities at every severity (info, low, moderate, high, critical).
- Targeted reading of `node_modules/better-auth/dist` at the pinned `better-auth@1.7.1`, because several conclusions below depend on what the *installed* library actually does rather than on what its documentation describes. Every claim about Better Auth behaviour in this report is cited to a file and line inside the installed package.

Secrets were referred to by environment-variable name throughout. No secret value was read, printed, logged, or committed.

## 3. Authorization audit

### 3.1 The boundary

`src/lib/require-user.ts` is the single authorization boundary. `getSessionUser()` (line 35) is the one call site of `auth.api.getSession` for authorization purposes, memoized per request with React `cache()`. `requireUser()` (line 48) redirects a sessionless caller to the sign-in path; `requireAdmin()` (line 62) layers the `admin` role check on top and redirects to the not-authorized path.

The construction is sound in a way worth stating explicitly: `redirect()` throws a `NEXT_REDIRECT` signal rather than returning a value, so there is no code path on which a missing session falls through and returns to the caller. A forgotten `await` would be a type error, and a missing check is a missing statement rather than a mis-set flag.

Defence is layered. `src/app/(app)/layout.tsx:18` calls `requireUser()` for the whole route group and `src/app/(app)/admin/layout.tsx:16` calls `requireAdmin()` for the admin subtree — but a layout gate protects *navigation*, not the action endpoint. A server action is an HTTP endpoint reachable directly with a forged request regardless of which layout rendered the form. Every action therefore repeats the check itself, which is the half that actually matters.

### 3.2 Mutation table

Every `"use server"` module and every mutating route handler on the branch. Line numbers are the line of the authorization call, or of the function declaration where noted.

| Mutation | file:line | Authz check found | Verdict |
|---|---|---|---|
| `createAssetAction` | `src/app/(app)/assets/actions.ts:173` | `requireUser()` | confirmed |
| `updateAssetAction` | `src/app/(app)/assets/actions.ts:209` | `requireUser()` | confirmed |
| `deleteAssetAction` | `src/app/(app)/assets/actions.ts:237` | `requireUser()` | confirmed |
| `checkOutAssetAction` | `src/app/(app)/loans/actions.ts:147` | `requireUser()` | confirmed |
| `returnLoanAction` | `src/app/(app)/loans/actions.ts:176` | `requireUser()` | confirmed |
| `requestPhotoUploadAction` | `src/app/(app)/assets/photos/actions.ts:93` | `requireUser()` | confirmed |
| `attachPhotoAction` | `src/app/(app)/assets/photos/actions.ts:146` | `requireUser()` | confirmed |
| `deletePhotoAction` | `src/app/(app)/assets/photos/actions.ts:174` | `requireUser()` | confirmed |
| `setPrimaryPhotoAction` | `src/app/(app)/assets/photos/actions.ts:196` | `requireUser()` | confirmed |
| `reorderPhotosAction` | `src/app/(app)/assets/photos/actions.ts:218` | `requireUser()` | confirmed |
| `createUserAction` | `src/app/(app)/admin/users/actions.ts:98` | `requireAdmin()` | confirmed |
| `deactivateUserAction` | `src/app/(app)/admin/users/actions.ts:170` | `requireAdmin()` | confirmed |
| `reactivateUserAction` | `src/app/(app)/admin/users/actions.ts:215` | `requireAdmin()` | confirmed |
| `createBuildingAction` | `src/app/(app)/admin/buildings/actions.ts:88` | `requireAdmin()` | confirmed |
| `updateBuildingAction` | `src/app/(app)/admin/buildings/actions.ts:117` | `requireAdmin()` | confirmed |
| `deleteBuildingAction` | `src/app/(app)/admin/buildings/actions.ts:152` | `requireAdmin()` | confirmed |
| `deactivateBuildingAction` | `src/app/(app)/admin/buildings/actions.ts:194` | `requireAdmin()` | confirmed |
| `reactivateBuildingAction` | `src/app/(app)/admin/buildings/actions.ts:202` | `requireAdmin()` | confirmed |
| `createCategoryAction` | `src/app/(app)/admin/categories/actions.ts:95` | `requireAdmin()` | confirmed |
| `updateCategoryAction` | `src/app/(app)/admin/categories/actions.ts:129` | `requireAdmin()` | confirmed |
| `deleteCategoryAction` | `src/app/(app)/admin/categories/actions.ts:165` | `requireAdmin()` | confirmed |
| `deactivateCategoryAction` | `src/app/(app)/admin/categories/actions.ts:207` | `requireAdmin()` | confirmed |
| `reactivateCategoryAction` | `src/app/(app)/admin/categories/actions.ts:215` | `requireAdmin()` | confirmed |
| `createFundingSourceAction` | `src/app/(app)/admin/funding-sources/actions.ts:93` | `requireAdmin()` | confirmed |
| `updateFundingSourceAction` | `src/app/(app)/admin/funding-sources/actions.ts:122` | `requireAdmin()` | confirmed |
| `deleteFundingSourceAction` | `src/app/(app)/admin/funding-sources/actions.ts:158` | `requireAdmin()` | confirmed |
| `deactivateFundingSourceAction` | `src/app/(app)/admin/funding-sources/actions.ts:200` | `requireAdmin()` | confirmed |
| `reactivateFundingSourceAction` | `src/app/(app)/admin/funding-sources/actions.ts:208` | `requireAdmin()` | confirmed |
| `createRoomAction` | `src/app/(app)/admin/rooms/actions.ts:90` | `requireAdmin()` | confirmed |
| `updateRoomAction` | `src/app/(app)/admin/rooms/actions.ts:119` | `requireAdmin()` | confirmed |
| `deleteRoomAction` | `src/app/(app)/admin/rooms/actions.ts:154` | `requireAdmin()` | confirmed |
| `deactivateRoomAction` | `src/app/(app)/admin/rooms/actions.ts:194` | `requireAdmin()` | confirmed |
| `reactivateRoomAction` | `src/app/(app)/admin/rooms/actions.ts:200` | `requireAdmin()` | confirmed |
| `setLocale` | `src/i18n/set-locale.ts:26` | none — by design | confirmed (see 3.3) |
| `setTheme` | `src/lib/set-theme.ts:26` | none — by design | confirmed (see 3.3) |

**Counts: 35 mutations. 33 session-gated and confirmed. 2 intentionally unauthenticated and confirmed appropriate. 0 flagged.**

Read-side route handlers, for completeness:

| Route handler | file:line | Authz check found | Verdict |
|---|---|---|---|
| `GET /assets/export` | `src/app/(app)/assets/export/route.ts:91` | `requireUser()` | confirmed |
| `GET /api/health` | `src/app/api/health/route.ts:57` | none — by design | confirmed (see 3.3) |
| `/api/auth/[...all]` | `src/app/api/auth/[...all]/route.ts` | delegates to `authRouteHandlers` | confirmed |

### 3.3 The three deliberately unauthenticated endpoints

Each was examined rather than accepted on its comment.

`setLocale` and `setTheme` write one cookie each, scoped to the calling browser, after `themeSchema.parse` / the locale equivalent rejects any value outside a closed allowlist (`src/lib/set-theme.ts:27`). An unauthenticated caller can set its own cookie to one of a fixed set of strings. There is no stored state, no other user's data, and no reflected output. Requiring a session here would break the locale switcher on the public scan page, which FR-10.3 requires.

`GET /api/health` issues `db.$queryRaw\`SELECT 1\`` and returns `{"status":"ok"}` or `{"status":"unavailable"}`. It names no table, reads no row, and the failure path logs the reason server-side while the body says only that the probe failed (`src/app/api/health/route.ts:61-66`). The information disclosed is whether the database is reachable. That is acceptable for a liveness probe a scheduler must reach without credentials.

### 3.4 Role model

Worth recording because it is the part most likely to be got wrong. `src/lib/auth.ts:31-69` declares the access-control statements explicitly rather than leaving `admin()`'s `roles` option unset. Two consequences the file documents and the code bears out: `STAFF_ROLE` is granted the empty permission set (line 66-69), so every admin-plugin permission check against a staff caller fails closed inside the library before `requireAdmin()` runs; and configuring `roles` is what activates `/admin/create-user`'s own validation that a requested role exists, which does not run at all when the map is absent. The application check and the library check are independent, and both are present.

Mass assignment was checked on the create path. `createAssetAction` reads only the names in `ASSET_FIELD_NAMES` out of the `FormData` (`src/app/(app)/assets/actions.ts:112-118`), so `assetCode` and `qrToken` cannot be supplied by a client even though both are columns on the row; both are generated server-side in `createAsset`. `src/app/(app)/assets/actions.test.ts:121-127` asserts exactly this with an attacker-chosen `qrToken`.

## 4. Public surface verification

**Result: no restricted column reaches the anonymous query, and no custodian or borrower personal data reaches the public page.**

The design decision that makes this verifiable is that **the audience selects the query, not the rendering**. `src/app/a/[token]/queries.ts:105-117` holds two separate Prisma calls, `selectAnonymousRow` and `selectSignedInRow`, and `findAssetByQrToken` (line 213) branches between them on the audience. Nothing downstream can undo the choice, because the restricted columns were never fetched.

`src/lib/asset-visibility.ts` is the authority. `ANONYMOUS_ASSET_SCAN_SELECT` (line 176) is `PUBLIC_ASSET_SELECT` spread with `loans: ANONYMOUS_LOAN_SELECT`. Traced against the PRD §8.2 table (`docs/prd.md:332-353`):

| §8.2 classification | Field | In anonymous select? |
|---|---|---|
| PUBLIC | `assetCode`, `name`, `category`, `photos`, `condition`, `status`, `room`/`building`, `brand`, `model`, `serialNumber`, `universityAssetCode`, `acquisitionYear`, `notes`, `qrToken` | yes — all 14 |
| RESTRICTED | `purchasePrice`, `fundingSource`, `procurementDocNo`, `vendor`, `warrantyUntil`, `custodianName`, `custodianEmail`, `createdBy`, `createdAt`, `updatedAt`, `id` | **no — none** |
| RESTRICTED (loan) | `borrowerName`, `borrowerEmail`, `borrowerUnit`, `handledById`, `handledBy`, `checkedOutAt` | **no — none** |

Two entries in the anonymous select are not §8.2 fields and both check out. `deletedAt` is the discriminator for the FR-2.5 "withdrawn" branch; only its nullness is tested (`queries.ts:225`) and its value never reaches a component. `loans: { select: { dueAt: true } }` (`asset-visibility.ts:109-114`) selects the due date and nothing else, which is precisely the partial disclosure FR-6.2 permits — "on loan, due `<date>`" with no borrower.

`notes` and `qrToken` deserve a note because both look restricted at a glance and are not. `docs/prd.md:344` classifies `notes` PUBLIC as "operational notes, not commercial", and line 345 classifies `qrToken` PUBLIC because "it is the URL" — the visitor is holding it. Both are correctly placed.

Three further properties hold:

- **`id` is deliberately absent from the public select** (`asset-visibility.ts:139-140`), added back only in the signed-in half. The public page therefore exposes no database identifier at all.
- **The type guard narrows on a restricted column.** `isSignedInRow` tests `"createdBy" in row` (`queries.ts:125-127`), so if the two selections ever converged the guard would start passing rather than silently failing — the failure mode points the safe way.
- **The guard is tested against the selection object, not the rendering.** `src/lib/asset-visibility.ts:14-19` documents that `asset-visibility.test.ts` walks the anonymous object recursively and fails if any name from `RESTRICTED_ASSET_COLUMNS` or `RESTRICTED_LOAN_COLUMNS` appears anywhere in it, nested selects included. Adding a restricted column to the schema and forgetting the public query is a test failure, not a review question. Both restricted lists include the scalar foreign key *and* the relation field (`fundingSourceId` and `fundingSource`, `createdById` and `createdBy`, `handledById` and `handledBy`), because naming either is the same leak.

The label-printing query was checked too, since it also handles tokens: `src/app/(app)/assets/labels/queries.ts:38` selects `id`, `assetCode`, `name`, `qrToken` only.

The unknown-token response was checked for an enumeration oracle. `notFound()` renders one localised 404 (`src/app/a/[token]/page.tsx:165-167`) and a soft-deleted row renders the withdrawn state, so a token that never existed and a mistyped token are indistinguishable.

## 5. QR token

**Result: confirmed compliant and enumeration-resistant.**

`src/lib/qr-token.ts:22-24` is `nanoid(12)` and nothing else. Not the row id, not a hash of the asset code, not a counter — which is also what makes FR-2.2's "stable across renumbering" true, since a derived token would need reissuing whenever its source changed and a printed sticker cannot be reissued.

`nanoid` draws from `crypto.getRandomValues`, so `Math.random()` (S2245) is not involved. A repository-wide grep for `Math.random` found no occurrence in `src/`. Twelve characters over the 64-symbol URL alphabet is approximately 71 bits of entropy; the collision retry in `src/app/(app)/assets/mutations.ts:57` is a backstop rather than an expected path. Guessing a valid token by brute force is not feasible, and since the token is the entire authorization for reading a scan page, that is the property that matters.

`isQrTokenShape` (line 48) validates length and alphabet by scanning characters rather than by regular expression, deliberately avoiding the unbounded-quantifier-before-`$` shape that S8786 flags and that this repository has been bitten by three times. It is a shape check that refuses the obviously impossible before a query is spent, not authorization — the comment says so, and the code matches.

The `?photo=` parameter on the same route was checked as a second untrusted input. It is bounded at 64 characters (`src/app/a/[token]/schemas.ts:27`) and then matched against the ids of the photos already fetched for *this* asset, falling back to the primary (`page.tsx:59-70`), so a hand-edited URL cannot pull an image out of a different record.

## 6. Rate limiting and account lockout

This section corrects an assumption worth flagging: the project configures no `rateLimit` block at all, but the installed library is **not** unprotected by default.

`src/lib/auth.ts:102-119` passes no `rateLimit` option and no `session` option. The effective configuration therefore comes from `node_modules/better-auth/dist/context/create-context.mjs:168-173`:

```js
rateLimit: {
  ...options.rateLimit,
  enabled: options.rateLimit?.enabled ?? isProduction,
  window: options.rateLimit?.window || 10,
  max: options.rateLimit?.max || 100,
  storage: options.rateLimit?.storage || (options.secondaryStorage ? "secondary-storage" : "memory")
}
```

So rate limiting **is enabled in production** (and off in development), with a global default of 100 requests per 10 seconds. On top of that, `node_modules/better-auth/dist/api/rate-limiter/index.mjs` ships default special rules, and the first one covers the sign-in path:

```js
pathMatcher(path) {
  return path.startsWith("/sign-in") || path.startsWith("/sign-up")
    || path.startsWith("/change-password") || path.startsWith("/change-email");
},
window: 10,
max: 3
```

**Three sign-in attempts per 10 seconds is a real throttle, and it is active in production without any configuration.** That is the good news.

The gap is the storage backend. No `secondaryStorage` is configured, so `storage` resolves to `"memory"` — an in-process `Map` (`rate-limiter/index.mjs:7-12`). On Vercel's serverless platform that counter is per-instance and non-durable: it is lost on every cold start, and concurrent instances each keep their own. The effective ceiling is therefore three attempts per 10 seconds *per warm instance* rather than per application, and an attacker who spreads requests across instances, or simply benefits from scaling and cold starts, multiplies their allowance by an amount the application does not control. This is **F-01**.

Separately, **there is no account lockout**. Better Auth 1.7.1 offers no lockout primitive — the only `banned` gate is the admin-initiated one examined in section 7 — and nothing in `src/` implements one. A throttle bounds the *rate* of guessing but never the *total*, so a patient attacker who knows an administrator's email address (and `SEED_ADMIN_EMAIL` is a predictable starting guess for a seeded deployment) can grind indefinitely at whatever rate the throttle permits, with no counter accumulating against the account and no signal raised to anyone. This is **F-02**.

`trustedOrigins` was checked and is **not** a finding: it defaults to the configured base URL via `getTrustedOrigins(options)` (`create-context.mjs:127`), and `origin-check.mjs:108-111` rejects a request whose `Origin` header matches no trusted pattern. The CSRF origin check is active without configuration.

Password storage was not re-implemented — Better Auth's own `emailAndPassword` handles hashing (scrypt by default in 1.7.1), and `src/lib/auth.ts:104-107` adds only `enabled` and `disableSignUp`. `disableSignUp: true` closes the public `/sign-up/email` endpoint, satisfying FR-1.1's no-public-self-registration requirement, and does not affect the admin plugin's `/admin/create-user`.

## 7. Session invalidation on deactivation

**Result: confirmed. A deactivated user is locked out on their very next request.**

Two independent mechanisms close the loop, both verified in the installed `better-auth@1.7.1`.

**Existing sessions are destroyed.** `node_modules/better-auth/dist/plugins/admin/routes.mjs:534-541` shows `banUser` updating the user row and then, unconditionally, calling `deleteUserSessions`:

```js
await ctx.context.internalAdapter.deleteUserSessions(ctx.body.userId);
```

`deleteUserSessions` (`dist/db/internal-adapter.mjs:504-523`) deletes every `session` row matching that `userId` — all of them, not merely the current one. Because this project configures no `secondaryStorage`, the secondary-storage branches are skipped and it lands on the plain database delete. The sibling path is covered too: `routes.mjs:305` revokes sessions when `adminUpdateUser` sets `banned: true`.

**New sign-ins are refused.** `dist/plugins/admin/admin.mjs:33-49` hooks `session.create.before` and throws `FORBIDDEN` / `BANNED_USER` when `user?.banned`. Since `deactivateUserAction` passes no `banExpiresIn` (`src/app/(app)/admin/users/actions.ts:187-190`) and `admin()` sets no `defaultBanExpiresIn` (`src/lib/auth.ts:111-116`), `banExpires` is `undefined`, so the ban is permanent and the block never auto-lifts. That is the correct semantics for "deactivate".

The next request from the deactivated user finds no session row, `findSession` returns null (`dist/api/routes/session.mjs:146-156`), the session cookie is cleared, `getSessionUser()` returns `null`, and `requireUser()` redirects to sign-in.

One structural caveat, which is **F-04** rather than a present vulnerability. `auth.api.getSession` does **not** inspect `user.banned` on each request — a grep for `banned` across `dist` hits only admin-plugin files, with zero hits in `dist/api/routes/session.mjs` or `dist/db`. Enforcement is revoke-on-ban plus block-on-new-sign-in, not a per-request flag check. That is sufficient *today* only because cookie-session caching is off: `session.cookieCache` is unconfigured, the cached fast path is gated on an explicit opt-in (`session.mjs:48`), and the one place Better Auth auto-enables caching applies only when no server session store exists (`create-context.mjs:47-53`) — this project passes `database: prismaAdapter(db, ...)`, so it stays off and every request reads the session from the database.

The consequence is a latent trap. If anyone later enables `session.cookieCache` as a latency optimization — an entirely reasonable-looking change, and this repository has already done one round of performance work — a deactivated user would keep browsing on their cached cookie until it expired (default `maxAge` 300 seconds), because nothing in the cached path re-reads `banned`. Neither `src/lib/require-user.ts` nor any middleware re-checks the flag; there is no `middleware.ts` in the repository, and the only `banned` references in `src/` are display-level (`UserRow.tsx:33`, `UserRow.tsx:82`).

## 8. OWASP Top 10 notes

Observations while reading, kept brief by design.

**A01 Broken Access Control** — the substance is sections 3 and 4. No horizontal-access defect found: photo and loan mutations key off ids that the mutation layer re-validates against live, un-withdrawn rows, and object paths are built server-side from the looked-up asset id and the accepted content type, never from a client-supplied filename (`src/app/(app)/assets/photos/actions.ts:88-91`), so a client cannot choose where its bytes land.

**A02 Cryptographic Failures** — `qrToken` uses a CSPRNG (section 5). Password hashing is the library's. `BETTER_AUTH_SECRET` is read from the environment and never restated in source.

**A03 Injection** — clean. Only three raw-SQL call sites exist in application code, and all three are tagged templates with interpolated values, which Prisma parameterizes: `src/app/(app)/assets/photos/mutations.ts:59-61`, `src/app/(app)/assets/mutations.ts:108`, and `src/app/api/health/route.ts:59`. Neither `$queryRawUnsafe` nor `$executeRawUnsafe` appears anywhere in `src/` outside the generated client's own type declarations. Everything else goes through the Prisma query builder. All entry points validate with Zod schemas shared between client and server.

**A04 Insecure Design** — the audience-selects-the-query construction in section 4 is the notable positive: the design makes the leak unrepresentable rather than merely absent. The missing account lockout (F-02) is the notable negative.

**A05 Security Misconfiguration** — `next.config.ts` defines no `headers()` at all, so the application sends no Content-Security-Policy, `X-Frame-Options` or `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. This is **F-03**, and it is the finding a ZAP baseline scan will report most loudly. The `images.remotePatterns` entry is appropriately narrowed to the public object route of a Supabase host (`next.config.ts:22-28`) rather than left open.

**A06 Vulnerable and Outdated Components** — `npm audit` reports 0 vulnerabilities across all severities. `prisma`, `@prisma/client`, and `better-auth` are pinned to exact versions, and `auth@1.7.1` matches `better-auth@1.7.1` deliberately.

**A07 Identification and Authentication Failures** — sections 6 and 7. F-01 and F-02 live here.

**A08 Software and Data Integrity Failures** — no runtime script is loaded from a third-party CDN; the `browser-image-compression` worker is self-hosted via its `libURL` option, which is what keeps a CDN out of the public scan page. Photo integrity is checked against what the bucket actually holds before a row is written (`attach-photo.ts`), not against what the client claimed — the client-side check only saves a pointless upload.

**A09 Security Logging and Monitoring Failures** — `createActionErrorLogger` gives errors a location, input context, and message, and no stack trace or internal error text reaches a user. Deactivation and reactivation write `UserActivity` rows, so the account-status trail names the actor. There is, however, no logging or alerting of *failed sign-in attempts*, which is the monitoring half of F-02 — an ongoing password-guessing campaign would currently be invisible.

**A10 Server-Side Request Forgery** — no user-controlled URL is fetched server-side. Object storage is reached through the `src/lib/storage.ts` seam with paths the server constructs; `next/image` is constrained by `remotePatterns` and the components render with `unoptimized` anyway.

## 9. Automated baseline scan (OWASP ZAP)

Passive baseline only — no active attack scan and no load generation, per the ticket.

The command to run against the production deployment. `zap-baseline.py` spiders and passively scans; it performs no active attack by default:

```sh
zap-baseline.py \
  -t "$NEXT_PUBLIC_APP_URL" \
  -m 5 \
  -I \
  -r zap-baseline-report.html \
  -J zap-baseline-report.json
```

`-t` is the production base URL, which the repository carries as `NEXT_PUBLIC_APP_URL` (`.env.example:44`, documented in `README.md:94`). `-m 5` caps the spider at five minutes. `-I` makes the process exit 0 on warning-level alerts so the scan reports rather than gates.

**Deployment Protection.** Per `playwright.config.ts:20-31`, Vercel Authentication with Standard Protection leaves the *production* domain public while every preview and generated deployment URL returns `401`. Scanning production therefore needs no bypass. Scanning a preview deployment does, and the mechanism already used by the end-to-end tests is two request headers — `x-vercel-protection-bypass`, carrying the secret held in the `VERCEL_AUTOMATION_BYPASS_SECRET` environment variable, and `x-vercel-set-bypass-cookie: true`, which asks Vercel to set a bypass cookie so redirects and sub-resources are covered too (`playwright.config.ts:51-58`). To send them from ZAP, add the replacer configuration:

```sh
  -z "-config replacer.full_list\(0\).description=vercel-bypass \
      -config replacer.full_list\(0\).enabled=true \
      -config replacer.full_list\(0\).matchtype=REQ_HEADER \
      -config replacer.full_list\(0\).matchstr=x-vercel-protection-bypass \
      -config replacer.full_list\(0\).regex=false \
      -config replacer.full_list\(0\).replacement=$VERCEL_AUTOMATION_BYPASS_SECRET \
      -config replacer.full_list\(1\).description=vercel-bypass-cookie \
      -config replacer.full_list\(1\).enabled=true \
      -config replacer.full_list\(1\).matchtype=REQ_HEADER \
      -config replacer.full_list\(1\).matchstr=x-vercel-set-bypass-cookie \
      -config replacer.full_list\(1\).regex=false \
      -config replacer.full_list\(1\).replacement=true"
```

The secret is referenced by environment-variable name only and must never be pasted into this document, a commit, or a CI log.

Expect the missing response headers of F-03 to dominate the results. Raw output need not be committed.

### 9.1 Scan run

OWASP ZAP 2.17.0, passive baseline only — a traditional spider followed by the passive scanner, no active attack rules and no load generation. Run on 2026-08-27 against the production deployment at `https://inventaris-aset-ppm.vercel.app` (public under Standard Protection, so no bypass header was needed). The spider reached 19 URLs; the passive scanner raised 64 alerts across 8 types. Raw output is not committed, per the acceptance criteria.

### 9.2 Results

| Risk | Alert (CWE) | Count | Where | Disposition |
|---|---|---|---|---|
| Medium | Content Security Policy (CSP) Header Not Set (CWE-693) | 3 | `/`, `/sign-in`, `/robots.txt`, `/sitemap.xml` | **Confirms F-03** ([#113](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/113)) |
| Medium | Missing Anti-clickjacking Header (CWE-1021) | 1 | `/sign-in` | **Confirms F-03** ([#113](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/113)) |
| Low | X-Content-Type-Options Header Missing (CWE-693) | 15 | document routes and `_next/static` chunks | **Confirms F-03** ([#113](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/113)) |
| Medium | Cross-Domain Misconfiguration (CWE-264) | 14 | `_next/static/chunks/*.js` only | Not actionable — see below |
| Low | Big Redirect Detected (CWE-201) | 2 | `/` and its trailing-slash form | Not actionable — see below |
| Low | Server Leaks Information via `X-Powered-By` (CWE-497) | 5 | all document routes | New; folded into F-03's remediation ([#113](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/113)) |
| Informational | Modern Web Application (CWE--1) | 5 | document routes | No action — a fingerprint, not a defect |
| Informational | Retrieved from Cache (CWE-525) | 19 | document routes and chunks | No action — Vercel edge cache, expected |

As predicted, the missing response headers dominate the scan, and every Medium and every actionable Low reduces to **F-03** — the passive scan raised no finding that the manual header audit had not already named. The scan surfaced **no** alert touching the two crown jewels: nothing under broken access control, nothing exposing restricted or personal data, no injection, no authentication bypass. That silence is itself evidence, consistent with sections 3, 4 and 7.

Three alerts were examined and dismissed rather than filed:

- **Cross-Domain Misconfiguration** fires only on the `_next/static/chunks/*.js` assets, which Vercel's CDN serves with `Access-Control-Allow-Origin: *`. Wildcard CORS on immutable, public, credential-free build artefacts is the intended behaviour of a static CDN; no document route and no data endpoint carries it. Not a vulnerability.
- **Big Redirect Detected** fires on the root `/`, which issues the locale/auth redirect. The response is a framework-standard redirect whose body lists no sensitive data. Not a vulnerability.
- **X-Powered-By** is a genuine but minor information leak — the framework advertises itself in a response header. It is squarely part of hardening the HTTP response headers, so rather than open a near-duplicate of F-03 it is folded into [#113](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/113) as an additional item (`poweredByHeader: false` in `next.config.ts`, alongside the headers that issue already covers).

**Net: the automated baseline opened no new issue.** It corroborated F-03 with concrete evidence and added one small remediation item to it. The findings table in section 10 stands unchanged at four.

## 10. Findings summary

Four actionable findings. None is a broken access control, and none exposes restricted data on the public surface — the two crown jewels both held up. All four sit in authentication hardening and platform configuration.

| ID | Finding | Severity | Area | OWASP | Issue |
|---|---|---|---|---|---|
| F-01 | Sign-in rate limiting uses in-process `memory` storage, which is per-instance and non-durable on Vercel serverless, so the default 3-per-10s sign-in throttle is not enforced application-wide | Medium | `area:auth` | A07 | [#111](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/111) |
| F-02 | No account lockout and no failed-sign-in logging or alerting, so password guessing is rate-bounded but unlimited in total and invisible while it happens | Medium | `area:auth` | A07, A09 | [#112](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/112) |
| F-03 | No security response headers — no CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` | Medium | `area:infra` | A05 | [#113](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/113) |
| F-04 | `getSessionUser()` does not re-check `banned`; correct today only because `session.cookieCache` is off, so enabling it later would silently reopen a ~300s window for a deactivated user | Low | `area:auth` | A01, A07 | [#114](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/114) |

Confirmed clean, for the record: all 35 server-side mutations authorized server-side (0 flagged); the anonymous scan query selects no restricted column and no custodian or borrower personal data; `qrToken` is `nanoid(12)` from a CSPRNG and enumeration-resistant; session invalidation on deactivation works on the next request; no SQL injection; `npm audit` clean; CSRF origin check active by default.
