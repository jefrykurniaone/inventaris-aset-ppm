# Product Requirements Document — Sistem Inventaris Aset Direktorat PPM

| Field | Value |
|---|---|
| Product | Sistem Inventaris Aset (QR-based asset inventory) |
| Client | Direktorat Penelitian dan Pengabdian kepada Masyarakat (PPM), Telkom University |
| Document owner | Jefry Kurniawan |
| Status | Approved for prototype build |
| Version | 1.0 |
| Date | 2026-08-20 |
| Repository | `jefrykurniaone/inventaris-aset-ppm` (private) |

---

## 1. Background

Direktorat PPM holds a mixed asset base: laboratory instruments, IT equipment, office
furniture, and general office tooling. Much of it is procured through research and community
service funding, and a meaningful share of it circulates — equipment is lent to researchers,
moved between rooms, and periodically sent out for repair.

Today the directorate has no single place that answers three questions reliably:

1. What do we own, and where is it right now?
2. What condition is it in, and who is currently responsible for it?
3. What did we acquire this year, from which funding source, and at what value?

Spreadsheet-based tracking answers these only as of the last time someone updated the file,
and it cannot be consulted while standing in front of the physical item.

This product attaches a durable QR label to every asset. Scanning that label with an ordinary
phone camera — no app install, no login — opens a page describing that exact item, with photos.
Staff who are signed in see the full record, including financial and custodian data.

## 2. Goals

- **G1** — Any person holding a phone can identify an asset in under five seconds by scanning it.
- **G2** — Asset records are complete enough to support an internal audit: identity, location,
  condition, acquisition year, funding source, value, and custodian.
- **G3** — Every change to an asset is attributable: who changed what, and when.
- **G4** — The directorate can produce a summary of its asset base — by category, location,
  condition, and acquisition year — without manual counting, and export it to Excel.
- **G5** — QR labels can be produced in bulk on standard label stock available in Indonesia.

## 3. Non-goals

Explicitly out of scope for this product, and out of scope for the prototype:

- Integration with any university-wide system (SIMAK-BMN, Direktorat Logistik inventory, ERP).
  The official asset number is stored as a plain searchable field, nothing more.
- Financial depreciation schedules and accounting-grade valuation.
- Procurement workflow, purchase requisition, or vendor management.
- Full stock-take / physical audit reconciliation mode.
- Mobile native applications. The product is a responsive web application.
- Offline operation. A scan requires network connectivity.

## 4. Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Admin** (directorate staff responsible for assets) | Owns the asset register. Manages master data and users. | Full CRUD, reporting, exports, label printing, user management |
| **Staff** (directorate operational staff) | Records assets, takes photos, records loans and returns. | Fast asset entry from a phone, photo capture, loan check-out/return |
| **Scanner** (anyone with the physical item — researcher, technician, auditor, visitor) | Not signed in. Has a phone and a labelled asset in front of them. | Identify the item, confirm it is the right unit, see its condition, location, and whether it is on loan |

## 5. Scope

### 5.1 In scope for the prototype

The prototype is a deployed, working application backed by a real database and real photo
storage. It is not a clickable mock. Its purpose is to be shown to Direktorat PPM as an accurate
representation of the intended production system.

- Email/password authentication with two roles (`admin`, `staff`)
- Asset register: create, read, update, soft-delete
- Editable master data: categories, buildings and rooms, funding sources
- Photo capture and upload, up to five photos per asset, one marked primary
- QR token generation, QR code rendering, and bulk label sheet printing
- Public scan page with a field-level visibility split
- Loan register: check-out, due date, return, overdue indication
- Activity log per asset, surfaced as a timeline
- Dashboard with summary cards and two charts
- Filterable asset table with XLSX export
- Bilingual interface: Indonesian (default) and English
- Seeded demo data: 60 assets, 15 of them with photos, 3 users, 5 loans including one overdue

### 5.2 Roadmap — deliberately deferred

Recorded here so the client sees the intended production trajectory, and so these are not
mistaken for oversights:

- Google SSO restricted to `telkomuniversity.ac.id` domains, replacing password login
- Financial depreciation schedule and book-value reporting
- Stock-take mode: scan-to-verify sweep of a room with a reconciliation report
- Loan approval workflow and automated overdue notification by email
- Printable PDF summary report
- Integration with the university asset system, if an API becomes available
- Asset transfer between directorates with a handover record

## 6. Functional requirements

### 6.1 Authentication and authorisation

- **FR-1.1** — Users sign in with email and password. There is no public self-registration;
  accounts are created by an admin.
- **FR-1.2** — Two roles exist: `admin` and `staff`. Role is stored on the user record.
- **FR-1.3** — `admin` may do everything `staff` may do, plus: manage master data, manage users,
  permanently view financial fields, and access the export function.
- **FR-1.4** — `staff` may create and edit assets, upload and remove photos, and record loans
  and returns. `staff` may not manage master data or users.
- **FR-1.5** — Every route other than the public scan page and the sign-in page requires a
  session. Authorisation is enforced server-side; hiding a UI control is not sufficient.
- **FR-1.6** — Sessions are cookie-based and readable in server components.

### 6.2 Asset register

- **FR-2.1** — Each asset receives a system-generated human-readable code in the form
  `PPM-<CATEGORY_CODE>-<YEAR>-<SEQUENCE>`, for example `PPM-LAB-2026-0001`. The sequence is
  per category and per acquisition year, zero-padded to four digits.
- **FR-2.2** — Each asset separately receives an opaque `qrToken`: a 12-character nanoid,
  unique, never derived from the asset code or the row ID. The token is stable across renumbering.
- **FR-2.3** — The official university asset number is stored in an optional, searchable
  `universityAssetCode` field. It is never used as a key.
- **FR-2.4** — Assets carry the fields listed in section 8.2, with the visibility classification
  given there.
- **FR-2.5** — Deletion is a soft delete. A deleted asset disappears from lists and reports; its
  scan page returns a "record withdrawn" state rather than a 404, so a scanned label is never a
  dead end.
- **FR-2.6** — The asset list supports free-text search over name, asset code, university asset
  code, brand, model, and serial number; and filters on category, room, status, condition,
  acquisition year, and funding source. It is paginated.

### 6.3 Master data

- **FR-3.1** — Categories, buildings, rooms, and funding sources are database records editable
  by an admin through the interface, not hardcoded values.
- **FR-3.2** — Each category carries a short uppercase code used in the asset code (`LAB`, `IT`,
  `FUR`, `OFC`, `OTH` at seed time).
- **FR-3.3** — Rooms belong to a building. An asset's location is a room.
- **FR-3.4** — Master data records referenced by at least one asset cannot be deleted; they can
  be deactivated.
- **FR-3.5** — `status` and `condition` are fixed enumerations, not editable master data, because
  application logic branches on them. Values: `status` ∈ {`active`, `in_repair`, `loaned`,
  `retired`, `lost`}; `condition` ∈ {`good`, `fair`, `poor`}.

### 6.4 Photos

- **FR-4.1** — Up to five photos per asset. Exactly one is marked primary; the primary photo is
  the one shown in lists, on the scan page header, and on the dashboard.
- **FR-4.2** — On a mobile device, the upload control offers direct camera capture as well as
  file selection.
- **FR-4.3** — Images are resized and re-encoded in the browser before upload. Target: longest
  edge 1600 px, approximately 400 KB, WebP. A second 400 px derivative is produced and stored as
  the thumbnail.
- **FR-4.4** — Files are uploaded from the browser directly to object storage using a
  server-issued signed upload URL. Image bytes never pass through a serverless function.
- **FR-4.5** — Storage is reached through a single interface at `src/lib/storage.ts` with two
  implementations: the local filesystem in development, Supabase Storage in deployment. Calling
  code is unaware of which is active.
- **FR-4.6** — The signed-URL endpoint enforces an allowlist of content types
  (`image/jpeg`, `image/png`, `image/webp`) and a maximum size of 1.5 MB, independently of any
  client-side compression.
- **FR-4.7** — Lists and dashboards render thumbnails. Full-size images are served only on the
  asset detail page and the scan page.
- **FR-4.8** — Unsupported formats, HEIC in particular, produce a clear localised error message,
  not a silent failure.

### 6.5 QR codes and labels

- **FR-5.1** — The QR code encodes the absolute URL `https://<host>/a/<qrToken>`.
- **FR-5.2** — QR codes are rendered server-side as SVG at error correction level M, so they stay
  crisp at any print size.
- **FR-5.3** — Every printed label shows the QR code, the asset code as human-readable text, a
  truncated asset name, and the text "Direktorat PPM". A damaged QR still leaves an identifiable
  label.
- **FR-5.4** — Bulk printing: the user selects assets from the list and opens a print view that
  lays them out on A4 at **63.5 × 38.1 mm, 3 columns × 7 rows**. Layout is driven by CSS
  `@page` rules and a single configuration constant, so an alternative label stock is a one-line
  change.
- **FR-5.5** — Single-label reprint is available from the asset detail page.

### 6.6 Public scan page

- **FR-6.1** — `GET /a/<qrToken>` is publicly accessible, requires no session, and is server-rendered.
- **FR-6.2** — It shows only the fields classified `PUBLIC` in section 8.2, plus current loan
  state if the asset is on loan ("currently with <name>, due <date>").
- **FR-6.3** — When a session is present, the same page additionally renders the `RESTRICTED`
  fields and links to the full asset detail page.
- **FR-6.4** — The page must be legible and fast on a mid-range Android phone over mobile data.
- **FR-6.5** — An unknown token returns a clear "asset not found" page, with no indication of
  whether the token ever existed.

### 6.7 Loans

- **FR-7.1** — A loan record captures: asset, borrower name, borrower email, borrower unit,
  checked-out timestamp, due date, returned timestamp, notes, and the staff member who handled it.
- **FR-7.2** — Checking out an asset sets its status to `loaned`. Recording a return clears it
  back to `active`.
- **FR-7.3** — An asset already `loaned` cannot be checked out again.
- **FR-7.4** — A loan past its due date with no return is shown as overdue in the interface and
  counted on the dashboard.

### 6.8 Activity log

- **FR-8.1** — Every mutation writes an activity row: asset, actor, event type, payload, timestamp.
  Event types: `created`, `updated`, `status_changed`, `photo_added`, `photo_removed`, `loaned`,
  `returned`, `deleted`.
- **FR-8.2** — The asset detail page renders these as a reverse-chronological timeline. The
  timeline is visible only to signed-in users.
- **FR-8.3** — Activity rows are append-only and are never edited or deleted by the application.

### 6.9 Dashboard and reporting

- **FR-9.1** — Summary cards: total assets; total acquisition value (`admin` only); count by
  status; count requiring attention, defined as `status = in_repair` OR `condition = poor` OR
  no photo attached.
- **FR-9.2** — Two charts: asset count per category, and acquisition count per year.
- **FR-9.3** — The filterable asset table (FR-2.6) can be exported to XLSX. The export reflects
  the filters currently applied.
- **FR-9.4** — Financial columns are omitted from the export for `staff` users.
- **FR-9.5** — The export library is selected only after checking its licence, maintenance status,
  and known CVEs, per the project coding standard.

### 6.10 Internationalisation

- **FR-10.1** — The interface is available in Indonesian and English. Indonesian is the default
  locale; the audience for this system reads Indonesian.
- **FR-10.2** — Every user-facing string routes through the i18n layer. Translation keys are
  written in English. No hardcoded display text is permitted anywhere in the codebase.
- **FR-10.3** — A locale switcher is available in the application shell and on the public scan page.
- **FR-10.4** — Dates, numbers, and currency are formatted per the active locale. Currency is IDR.

## 7. Non-functional requirements

### 7.1 Code quality

Binding for all code in this repository, prototype included:

- Zero SonarQube issues: no warnings, no vulnerabilities, no deprecated components.
- Maximum function length 40 lines; maximum file length 300 lines.
- Maximum nesting depth 3; early return preferred over nesting.
- No magic numbers; named constants only.
- Naming: `camelCase` for variables and functions, `PascalCase` for classes and React components,
  `SCREAMING_SNAKE_CASE` for constants. Component files `PascalCase.tsx`; utility and hook files
  `kebab-case.ts`.
- Boolean identifiers are prefixed `is`, `has`, or `should`.
- No empty catch blocks. Errors are logged with location, input, and message.
- No stack trace or internal error text reaches an end user.
- Lint and type errors are fixed before a task is considered complete, enforced by a pre-commit
  hook and by CI.

### 7.2 Testing

- Unit tests with Vitest cover business logic and utilities: asset code generation, QR token
  generation, field visibility rules, report aggregation, i18n formatting, XLSX shaping. Coverage
  gate applies to those directories.
- One Playwright smoke test covers the demo-critical path: sign in → create asset → upload photo →
  print label view → public scan URL renders. It includes a real sign-in, so a dependency bump
  that breaks authentication fails a pull request rather than the demo.
- Test files are co-located with their source.
- Tests assert behaviour, not implementation detail.

### 7.3 Security

- OWASP Top 10 practices apply.
- All input is validated server-side at every entry point: server actions, route handlers, URL
  parameters, and form submissions.
- The public scan page is keyed on an unguessable token specifically to prevent enumeration of
  the asset register.
- Authorisation is checked server-side on every mutation. The field visibility split is enforced
  at the data-fetch layer, not by conditional rendering.
- Passwords are hashed by the authentication library. The application never handles a raw password
  beyond the sign-in request.
- Personal data — custodian name and email, borrower name and email — is never exposed on the
  public scan page.
- No third-party script is loaded from a CDN at runtime; the image-compression web worker in
  particular is self-hosted.

### 7.4 Accessibility

- WCAG AA: minimum contrast ratio 4.5:1 in both light and dark themes.
- Every interactive element is keyboard-navigable, including the photo upload control and the
  asset table filters.
- All images carry descriptive alt text; asset photos use the asset name and category.
- Semantic HTML elements are used in preference to ARIA roles.

### 7.5 Performance

- The public scan page is the only performance-critical surface. Target: interactive in under
  2.5 s on a mid-range Android device over 4G.
- Asset photos are served with immutable cache headers.
- Thumbnails, not full images, are used in every list view.

### 7.6 Dependencies

- Bundle size, maintenance status, and licence are evaluated before any package is added.
- No package with a known unpatched CVE.
- No package unmaintained for two or more years without a written justification.
- Unused dependencies are removed before merge.

## 8. Data model

### 8.1 Tables

| Table | Purpose |
|---|---|
| `user`, `session`, `account`, `verification` | Authentication, generated by the auth library. `user` carries `role`. |
| `category` | Asset category with the short code used in asset numbering |
| `building`, `room` | Location hierarchy; an asset sits in a room |
| `funding_source` | Origin of the funds used to acquire the asset |
| `asset` | The register itself |
| `asset_photo` | Photo per asset: full URL, thumbnail URL, dimensions, size, primary flag, order |
| `loan` | Loan / return records |
| `asset_activity` | Append-only audit trail |

### 8.2 Asset fields and visibility

`PUBLIC` fields render on an anonymous scan. `RESTRICTED` fields require a session.

| Field | Visibility | Note |
|---|---|---|
| `assetCode` | PUBLIC | Human-readable identifier |
| `name` | PUBLIC | |
| `category` | PUBLIC | |
| `photos` | PUBLIC | |
| `condition` | PUBLIC | |
| `status` | PUBLIC | |
| `room` / `building` | PUBLIC | Where the item belongs |
| `brand` | PUBLIC | |
| `model` | PUBLIC | |
| `serialNumber` | PUBLIC | A scan is often used to confirm this is the right unit |
| `universityAssetCode` | PUBLIC | |
| `acquisitionYear` | PUBLIC | |
| `notes` | PUBLIC | Operational notes, not commercial |
| `qrToken` | PUBLIC | It is the URL |
| `purchasePrice` | RESTRICTED | Commercial |
| `fundingSource` | RESTRICTED | Commercial |
| `procurementDocNo` | RESTRICTED | Commercial |
| `vendor` | RESTRICTED | Commercial |
| `warrantyUntil` | RESTRICTED | Commercial |
| `custodian` (name, email) | RESTRICTED | Personal data on a named staff member |
| `createdBy`, timestamps | RESTRICTED | Internal |
| loan borrower details | RESTRICTED | Personal data. Only "on loan, due <date>" is public |

## 9. Technical architecture

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | The public scan page wants server rendering; one repository and one deployment suits the delivery model |
| ORM | Prisma 7 with the `prisma-client` generator, output to `src/generated/prisma`, `importFileExtension = ""` | Current generator; `prisma-client-js` is legacy and the coding standard forbids starting on a deprecated API |
| Configuration | `prisma.config.ts` via `defineConfig` | Prisma 7 moves the datasource URL out of `schema.prisma` |
| Database — development | Local PostgreSQL 17, database `inventaris_aset_ppm` | Already installed on the development machine. No cloud account, no connection cap, no cold start; seeding and iteration are faster than against any free-tier hosted database |
| Database — deployment | Supabase Postgres | Provides the database and the object store under one account. See ADR 0003 |
| Driver adapter | `@prisma/adapter-pg` for both environments | Local and Supabase are both plain Postgres over TCP, so one adapter covers both and no environment-branching driver configuration is needed |
| Connection strings | `DATABASE_URL` at runtime, `DIRECT_URL` for migrations. On Supabase: transaction pooler on port 6543 with `?pgbouncer=true&connection_limit=1` for the former, session mode on port 5432 for the latter | Prepared statements are unsupported in Supavisor transaction mode; migrations must not run through the transaction pooler |
| Auth | Better Auth — `emailAndPassword`, `admin()` plugin, `nextCookies()` | Self-hosted, so client data stays with the client; owns its tables in our own schema; the `admin()` plugin covers the two-role model without a hand-rolled RBAC layer. Supabase is used as Postgres and storage only, not as the auth provider |
| Photo storage | One interface at `src/lib/storage.ts`: local filesystem in development, Supabase Storage in deployment via `createSignedUploadUrl` / `uploadToSignedUrl` | Browser uploads directly to storage, so the serverless request body limit never applies to an image |
| Image processing | `browser-image-compression`, self-hosted worker script | Browser-side resize; the library's default worker URL points at a public CDN and is overridden |
| UI | Tailwind CSS v4 with shadcn/ui, light and dark themes | Components live in our repository, so the coding and accessibility standards apply to code we control |
| i18n | `next-intl`, default locale `id` | |
| QR rendering | Server-side SVG, error correction level M | |
| Migrations | `prisma migrate dev` locally, migrations committed, `prisma migrate deploy` on build | Migration history is what makes the schema auditable |
| Seeding | `prisma.config.ts` → `migrations.seed` → `tsx prisma/seed.ts`, idempotent | Re-running must not duplicate the demo data |
| Hosting | Vercel, preview deployment per pull request | Supabase does not host the Next.js application |
| CI | GitHub Actions: typecheck, lint, unit tests, build, on every pull request | |
| Package manager | npm | pnpm is not installed on the build machine |

## 10. Risks and mitigations

### R1 — Better Auth on the Prisma 7 generator is the least-proven seam in this stack

Better Auth's own documentation and demo application lean on the legacy `@prisma/client` import
path, while Prisma 7 emits a client to a custom output directory. The integration is expected to
work but has not been verified against this exact combination.

Mitigations:

1. A timeboxed spike is the first ticket, before any feature code. Its only pass condition is
   sign up, sign in, and read the session and role in a server component.
2. A documented escalation ladder, stopping at the first level that works, with the outcome
   recorded as an ADR:
   1. built-in `better-auth/adapters/prisma` with the generated client
   2. the standalone `@better-auth/prisma-adapter` package
   3. Prisma 7 for application tables, Better Auth's built-in Kysely/Postgres adapter for auth
      tables on the same database — costs Prisma types on the user table
   4. Prisma 6.19 with the legacy `prisma-client-js` generator — last resort, deprecated
3. All Prisma access is funnelled through `src/lib/db.ts` and all auth access through
   `src/lib/auth.ts`, so moving down the ladder touches two files.
4. `prisma`, `@prisma/client`, and `better-auth` are pinned to exact versions until after the
   client demonstration. Automated dependency updates stay off.
5. Auth tables are generated with `npx auth generate --adapter prisma` and applied with
   `prisma migrate dev`. They are never hand-written. Note that `npx auth migrate` does not
   support Prisma.
6. The Playwright smoke test performs a real sign-in, so a regression in this seam fails CI.

### R2 — Photo storage and egress on the free tier

The Supabase free tier provides 500 MB of database, 1 GB of file storage, and 5 GB of monthly
egress. The binding constraint is not storage volume: sixty unprocessed phone photos is roughly
300 MB, inside 1 GB. The real walls are the serverless request body limit — approximately 4.5 MB,
with Next.js server actions defaulting to 1 MB, which a raw phone photo simply exceeds — and the
egress allowance.

Mitigations:

1. Uploads go from the browser straight to storage using a server-issued signed upload URL, so the
   request body limit never applies to an image.
2. Browser-side resize to 1600 px / ~400 KB WebP, plus a 400 px thumbnail.
3. Thumbnails in every list and dashboard view; full images only on detail and scan pages.
4. Immutable cache headers on stored images.
5. A server-side content-type allowlist and a 1.5 MB hard cap on the signed-URL endpoint. Client
   compression is a usability measure; the server cap is the control.
6. Development uses the local filesystem, so iteration and repeated seeding consume no hosted
   storage or egress at all.

Expected footprint at prototype scale: approximately 7 MB of stored images, with egress well
outside reach of a demonstration workload.

### R4 — Free Supabase projects pause after a week of inactivity

A free-tier Supabase project receiving no API requests for one week is paused automatically. Data
is retained, but the project must be resumed manually. With no demonstration date fixed, the
realistic failure is: deploy, wait two or three weeks, then arrive at the demonstration to a paused
database and a scan page erroring in front of the client.

Mitigations:

1. Do not create the Supabase project until the deployment cutover ticket is actually started. An
   unused project is exactly the thing that pauses.
2. Once deployed, keep a scheduled request against a cheap health endpoint so the project stays
   awake.
3. Confirm the deployment is awake and responding the day before any demonstration. This belongs on
   a demonstration checklist, not in someone's memory.
4. If the demonstration slips repeatedly, the paid tier removes the behaviour. That is a cost
   question for the client conversation, not an engineering problem.

### R5 — The Supabase path is unverified until an account exists

Development runs against local Postgres, so the wave 0 spike can only prove the local path. Prisma
against the Supabase transaction pooler has known sharp edges — prepared statements are unsupported,
which is why `pgbouncer=true` is required — and driver adapters change which layer issues those
statements. The photo pipeline is likewise exercised locally against the filesystem implementation
rather than the Supabase Storage one.

Mitigation: a dedicated deployment cutover ticket carries this explicitly rather than assuming the
wave 0 spike covers it. That ticket creates the Supabase project, verifies both connection modes,
runs migrations through the session-mode connection, exercises a real signed upload against
Supabase Storage, and confirms the public scan page works from a phone on the deployed URL. Until
it closes, no claim is made that the application runs on Supabase.

### R3 — No fixed demonstration date

The client demonstration is not yet scheduled, so scope is being built in full. The mitigation is
ordering: waves are sequenced so that the demonstration-critical path — authentication, asset
records, photos, QR codes, the scan page, labels, dashboard — completes before loans, the audit
timeline, and the export are attempted. If a date lands mid-build, everything from wave 4 onward
can be cut without leaving a partial feature on screen.

## 11. Delivery plan

Work is decomposed into 17 tickets, filed as GitHub issues, grouped into six waves. A wave is
released for work only when the preceding wave has closed. Within a wave, at most three tickets
proceed concurrently.

| Wave | Contents | Concurrency |
|---|---|---|
| **W0** | Project scaffold and tooling; authentication spike against local Postgres | Serial — both tickets gate everything |
| **W1** | Prisma schema and migrations; authentication UI and route guards; i18n setup; master data screens | Parallel |
| **W2** | Asset CRUD and code generation; asset list with filters; photo pipeline; asset detail page and timeline | Parallel |
| **W3** | QR token, rendering, and public scan page; label sheet printing | Parallel |
| **W4** | Dashboard and charts; XLSX export; loan module; seed data | Parallel |
| **W5** | Supabase deployment cutover: project creation, both connection modes, Supabase Storage, deployed phone scan | Serial — single ticket |

Everything through wave 4 runs against local PostgreSQL and local filesystem storage. Wave 5 is
where the application first runs on hosted infrastructure; see risk R5.

Each ticket is one pull request against `main`. A wave closes only when every pull request in it is
CI-green, has passed a review pass, and — from wave 5 onward, once a deployment exists — the
deployed preview has been inspected.

### 11.1 Execution model

Tickets are implemented by delegated executors under a single orchestrator. Assignment follows one
rule: work where a wrong decision propagates outward goes to the more capable model; work with a
fixed, fully specified target goes to the faster one.

- **Orchestrator** — Opus. Never implements. Decomposes, dispatches, reviews, gates waves.
- **Opus executor** — schema and migrations, authentication and authorisation boundaries, asset
  code and QR token generation, the photo pipeline, field visibility enforcement, report
  aggregation, export shaping, and every review pass.
- **Sonnet executor** — CRUD screens and forms, list and filter interfaces, i18n extraction, print
  CSS, dashboard presentation, seed script, and tests written against an existing specification.

Ticket labels carry this routing: `wave:0`–`wave:5` and `exec:opus` / `exec:sonnet`.

## 12. Acceptance criteria for the client demonstration

The prototype is ready to show when all of the following hold **on the deployed Supabase-backed
environment**, not merely locally. Criteria 1 to 9 are verifiable locally during waves 0 to 4;
criterion 10 is what wave 5 exists to establish.

1. An admin and a staff account can each sign in, and each sees only what their role permits.
2. An asset can be created on a phone, photographed with the device camera, and saved.
3. A label sheet prints on A4 at the specified dimensions and the printed QR code scans on the
   first attempt with a stock phone camera application.
4. Scanning a label opens the public page, showing photos and public fields, with no session, and
   showing no price, custodian, or borrower information.
5. Signing in and scanning the same label additionally shows the restricted fields.
6. An asset can be checked out and returned, and the scan page reflects the loan state.
7. The dashboard reports accurate counts against the seeded data set, and the asset table exports
   to XLSX with the applied filters respected.
8. The interface switches between Indonesian and English with no untranslated string.
9. CI is green: typecheck, lint, unit tests, build, and the end-to-end smoke test.
10. All of the above hold against the deployed application backed by Supabase Postgres and Supabase
    Storage, reached over HTTPS from a phone on mobile data, with the project confirmed awake.

## 13. Open items

| Item | Owner | Note |
|---|---|---|
| Client demonstration date | Jefry | Drives whether wave 4 stays in scope |
| Label stock actually available to the directorate | Jefry | Layout defaults to 63.5 × 38.1 mm, 3 × 7 on A4; switching stock is a one-constant change |
| Real (non-confidential) asset list for seeding | Jefry | Seed uses realistic synthetic data until provided |
| Which escalation level R1 lands on | Orchestrator | Recorded as an ADR at the end of wave 0 |
| Supabase account and project | Jefry | Deliberately not created until wave 5 starts, per risk R4 |
| Whether to run Supabase locally via its CLI instead of plain local Postgres | Jefry | Would make development and production identical; needs Docker, which is not installed. Revisit before wave 5 |
| Printed QR codes encode `NEXT_PUBLIC_APP_URL` | Orchestrator | No label may be printed for real use until the production URL is final, or the labels become dead |
