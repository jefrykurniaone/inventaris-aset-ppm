# Product Requirements Document — Sistem Inventaris Aset Direktorat PPM

> **Revision note, 2026-10-23.** Photos are now stored in and served from PostgreSQL, and the
> Supabase project and the Vercel deployment that this document was written around no longer
> exist; there is no deployment target. The decision is
> [ADR 0009](adr/0009-photos-stored-in-postgresql.md) and the spec is issue #161
> ([`spec-postgres-photos-v1.md`](spec-postgres-photos-v1.md)). Amended in place:
>
> - **FR-4.4, FR-4.5, FR-4.6, FR-4.9 and FR-4.10** are rewritten to the new design.
> - **The hosting and storage rows of the §9 table**, and the `asset_photo` row of §8.1, describe what
>   is true now.
> - **Risks R2, R4 and R5** are marked closed, each with a dated reason. Their text is kept, and
>   still cites `docs/deployment.md` and `vercel.json`, which were deleted in the same change and
>   remain in git history.
> - **§11, §12 and §13 are the original delivery plan.** The Supabase parts of it, wave 0's Supabase
>   project, the wave 5 cutover and acceptance criterion 10, are marked retired in place: nothing is
>   deployed, so nothing is cut over.

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

The prototype is a working application backed by a real database that also holds the photos. It
is not a clickable mock. Its purpose is to be shown to Direktorat PPM as an accurate
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
- **FR-4.4** — Each photo is uploaded from the browser to one route handler,
  `POST /api/assets/[id]/photos`, as a single multipart request carrying the full image, the
  thumbnail and the dimensions the browser reports. The browser sends it over XHR, so upload
  progress and cancellation work. Image bytes pass through the application; there is no object
  store and no signed upload URL. See ADR 0009.
- **FR-4.5** — Photo bytes are stored in PostgreSQL, in a side table with one row per photo that
  holds the full image and the thumbnail, each with its content type. Both are required, and the row
  cascades from the photo row. Storage is reached through a single interface at
  `src/lib/storage.ts`, which is the only module that touches photo bytes. It has two operations:
  write a photo's content inside a transaction the caller supplies, and read one variant of one
  photo, which returns nothing when the photo does not exist or its asset is withdrawn. It has no
  delete operation, because deleting the photo row cascades. There is one implementation and no
  environment switch; the interface exists so that tests can inject an in-memory fake.
- **FR-4.6** — The upload handler enforces its limits independently of any client-side
  compression. In order, it:
  1. requires a session;
  2. refuses a request whose `Origin` is not the application's own;
  3. refuses a body over a named cap of about 3.2 MB with 413, before reading it whole;
  4. determines each derivative's type from its leading bytes, accepts only `image/jpeg`,
     `image/png` and `image/webp`, refuses a declared type that disagrees, and refuses a
     derivative over 1.5 MB;
  5. locks the live asset, enforces the five-photo limit, and writes the photo row, its content
     and the activity row in one transaction.
- **FR-4.7** — Lists and dashboards render thumbnails. Full-size images are served only on the
  asset detail page and the scan page.
- **FR-4.8** — Unsupported formats, HEIC in particular, produce a clear localised error message,
  not a silent failure.
- **FR-4.9** — The photo row keeps only metadata: dimensions, size, primary flag, order and
  uploader. It stores no path and no URL; every surface builds the photo's address,
  `/api/photos/<photoId>/<variant>` with `full` or `thumb`, from the photo id alone. A photo row and
  its content are written in one transaction and removed by one cascade, so a photo without its
  bytes, or bytes without their photo, cannot exist.
- **FR-4.10** — Photos are served by a public route handler on the application's own origin,
  `GET /api/photos/<photoId>/<variant>`. It answers 404, for everyone and without consulting a
  session, when the photo does not exist or its asset is withdrawn; no page shows a withdrawn
  asset's photos to anyone. Otherwise it returns the stored bytes with the stored content type,
  `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` and
  `Content-Security-Policy: default-src 'none'; sandbox`, because the application's origin now
  serves content that users supplied. A browser that cached a photo before its asset was withdrawn
  keeps that copy. Writing is authorised by the upload handler's session check (FR-4.6), not by a
  storage policy.

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

- **FR-9.1** — The dashboard presents its figures in two groups.

  A grid of summary cards holds: total assets; total acquisition value (`admin` only); count by
  status; and count of assets with no photo attached ("Missing photo" in English, "Belum ada foto"
  in Indonesian). Each is a compact card — a label and the figure — and the whole card links to
  the asset list with the matching filter applied; the missing-photo card links to the list
  filtered to assets without a photo. The grid is shown as a unit only while the register holds at
  least one asset, so an empty register shows a single empty-state message instead of a row of
  zeros.

  Below it, a "needs action" row pairs the overdue-loans count (FR-7.4) with a count of assets
  requiring attention, defined as `status = in_repair` OR `status = lost` OR `condition = poor`.
  Both are cards of the same shape — heading, the count, a sentence describing what the count
  means, and a link to the matching pre-filtered list — laid out in two columns that stack on a
  narrow viewport. This row is rendered whatever the register holds, because a zero here reports
  that nothing needs action rather than that nothing has been recorded.

  Every card except the total acquisition value is visible to `admin` and `staff` alike.
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
| `asset_photo` | Photo per asset: dimensions, size, primary flag, order, uploader |
| `asset_photo_content` | The photo's bytes: full image and thumbnail, each with its content type. One row per photo, cascading from `asset_photo` |
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
| Database | Local PostgreSQL 17, database `inventaris_aset_ppm` | Already installed on the development machine. No cloud account, no connection cap, no cold start. There is no hosted database; see ADR 0009 |
| Driver adapter | `@prisma/adapter-pg` | Plain Postgres over TCP, so one adapter covers it and no environment-branching driver configuration is needed |
| Connection strings | `DATABASE_URL` at runtime, `DIRECT_URL` for migrations | `src/lib/db.ts` reads the former and `prisma.config.ts` the latter. Both hold the same local string |
| Auth | Better Auth — `emailAndPassword`, `admin()` plugin, `nextCookies()` | Self-hosted, so client data stays with the client; owns its tables in our own schema; the `admin()` plugin covers the two-role model without a hand-rolled RBAC layer |
| Photo storage | PostgreSQL, in a side table with one row per photo (full image and thumbnail, each with its content type), reached through one interface at `src/lib/storage.ts` | One store holds metadata and bytes, so a photo row and its content commit and cascade together and a database dump is a complete backup. The side table keeps image bytes out of every list, detail and scan query. See ADR 0009 |
| Photo upload and serving | One route handler uploads (`POST /api/assets/[id]/photos`); one public route handler serves (`GET /api/photos/[photoId]/[variant]`) | The application's origin now serves user-supplied content, so the serving route sets the stored content type, `nosniff` and a sandboxing Content Security Policy, and the upload handler decides each type from the bytes. Authorisation is the upload handler's session check |
| Image processing | `browser-image-compression`, self-hosted worker script | Browser-side resize; the library's default worker URL points at a public CDN and is overridden |
| UI | Tailwind CSS v4 with shadcn/ui, light and dark themes | Components live in our repository, so the coding and accessibility standards apply to code we control |
| i18n | `next-intl`, default locale `id` | |
| QR rendering | Server-side SVG, error correction level M | |
| Migrations | `prisma migrate dev` locally, migrations committed, `prisma migrate deploy` against the CI database service | Migration history is what makes the schema auditable |
| Seeding | `prisma.config.ts` → `migrations.seed` → `tsx prisma/seed.ts`, idempotent | Re-running must not duplicate the demo data |
| Hosting | None. There is no deployment target | The Supabase project and the Vercel deployment were retired on 2026-10-23. Choosing a host later needs its own ADR; see ADR 0009 |
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

> **Closed 2026-10-23.** The Supabase project and its free-tier allowances no longer exist. Photos
> are stored in the local PostgreSQL database (ADR 0009), so there is no storage quota or egress
> allowance left to exhaust; at the five-photo limit the worst case is about 2.5 MB per asset. The
> request-body wall does not apply without a serverless host, and the upload cap of about 3.2 MB
> stays under the 4.5 MB limit, so a later move to such a host is not foreclosed. The text below is
> the original analysis, kept as written.

The Supabase free tier provides 500 MB of database per project, 1 GB of file storage, and 5 GB of
monthly egress, with the storage and egress allowances counted across the whole organisation rather
than per project. Since ADR 0005 development also uploads to Supabase, so both buckets draw on that
one allowance. The binding constraint is still not storage volume: sixty unprocessed phone photos is
roughly 300 MB, inside 1 GB, and development traffic at this scale is a rounding error beside it.
The real walls are the serverless request body limit — approximately 4.5 MB, with Next.js server
actions defaulting to 1 MB, which a raw phone photo simply exceeds — and the egress allowance.

Mitigations:

1. Uploads go from the browser straight to storage using a server-issued signed upload URL, so the
   request body limit never applies to an image.
2. Browser-side resize to 1600 px / ~400 KB WebP, plus a 400 px thumbnail.
3. Thumbnails in every list and dashboard view; full images only on detail and scan pages.
4. Immutable cache headers on stored images.
5. A server-side content-type allowlist and a 1.5 MB hard cap on the signed-URL endpoint. Client
   compression is a usability measure; the server cap is the control.
6. Development uploads go to a separate `asset-photos-dev` bucket. It draws on the same
   organisation-wide allowance as production — the previous arrangement, where development consumed
   nothing, ended with ADR 0005 — so an npm script empties it, and emptying it is safe precisely
   because it is a separate bucket.

Expected footprint at prototype scale: approximately 7 MB of stored images, with egress well
outside reach of a demonstration workload.

### R4 — Free Supabase projects pause after a week of inactivity

> **Closed 2026-10-23.** The Supabase project was switched off and the deployment retired, so
> nothing remains that can pause. The daily cron in `vercel.json` was deleted; `GET /api/health`
> stays as a liveness probe that runs `SELECT 1` against the local database. The text below is the
> original analysis, kept as written.

A free-tier Supabase project receiving no API requests for one week is paused automatically. Data
is retained, but the project must be resumed manually. With no demonstration date fixed, the
realistic failure is: deploy, wait two or three weeks, then arrive at the demonstration to a paused
database and a scan page erroring in front of the client.

ADR 0005 shrinks this risk rather than enlarging it. The project is now created at wave 0 instead of
wave 5, which sounds worse, but every development photo upload from wave 2 onward is an API request
against that project. The thing that pauses is an unused project, and this one stops being unused
the moment the photo pipeline is built.

Mitigations:

1. Development traffic keeps the project awake through waves 2 to 4. The exposure is the quiet
   stretch between the last commit and the demonstration, not the build itself.
2. A scheduled request against a cheap health endpoint, so the project stays awake once development
   stops. **Both halves are in the repository as of issue #17**: `src/app/api/health/route.ts`
   answers `GET /api/health` by running `SELECT 1` through the `src/lib/db.ts` seam — the query is
   the point, because the thing that pauses is the Supabase project and an endpoint returning `200`
   out of Vercel without touching the database would keep the scheduler happy while the database
   slept — and `vercel.json` schedules one daily cron against it. Vercel cron rather than a GitHub
   Actions schedule because GitHub disables scheduled workflows in a quiet repository after 60 days,
   which is precisely this risk's scenario; `docs/deployment.md` §8 carries the full comparison.
   **Observed 2026-08-26:** the first Vercel cron invocation of `GET /api/health` returned HTTP
   `200` in the expected window (schedule `0 3 * * *` UTC, fired 10:55 WIB — Vercel Hobby honours
   the hour, not the minute). This also answers the question Vercel's own documentation left open:
   cron invocations are **not** blocked by Deployment Protection. The request reached the function
   and returned `200`, so no bypass secret and no protection change were needed.
3. Confirm the deployment is awake and responding the day before any demonstration. This belongs on
   a demonstration checklist, not in someone's memory — it is now the three-step *Before a
   demonstration* section in `README.md`.
4. If the demonstration slips repeatedly, the paid tier removes the behaviour. That is a cost
   question for the client conversation, not an engineering problem.

### R5 — The Supabase **database** path is unverified until the cutover

> **Closed 2026-10-23.** The Supabase database was switched off and the deployment retired (ADR
> 0009). The only database now is the local PostgreSQL the application ran against from the start,
> so no hosted path is left to verify. The text below is the original analysis and its observations,
> kept as written.

Development runs against local Postgres, so the wave 0 spike can only prove the local path. Prisma
against the Supabase transaction pooler has known sharp edges — prepared statements are unsupported,
which is why `pgbouncer=true` is required — and driver adapters change which layer issues those
statements.

This risk used to cover photos as well. ADR 0005 removes that half: Supabase Storage is now the only
storage implementation, so the signed-upload path is exercised for real from wave 2 onward and the
cutover inherits a proven photo pipeline. What remains unverified is the database, and only the
database.

Mitigation: a dedicated deployment cutover ticket carries this explicitly rather than assuming the
wave 0 spike covers it. That ticket verifies both connection modes against the Supabase project
created in wave 0, runs migrations through the session-mode connection, points the deployment at
the `asset-photos` bucket, and confirms the public scan page works from a phone on the deployed URL.
Until it closes, no claim is made that the application's **database** runs on Supabase.

**Narrowed on paper by issue #17, and confirmed by observation on 2026-08-23.** The sharp edge turns
out to be sharper than described above, and in an unexpected direction: with a Prisma
**driver adapter**, `?pgbouncer=true` and `connection_limit=1` are both inert. They were Prisma
*engine* URL flags, and Prisma 7 hands the connection string to `@prisma/adapter-pg` and then to
`pg`, which drops unrecognised query parameters without an error or a warning. What actually makes
transaction mode safe here is the adapter's default: it supplies a statement `name` to node-postgres
only when given a `statementNameGenerator`, and `src/lib/db.ts` gives it none, so every query is an
unnamed extended-protocol query — which Supavisor transaction mode supports. The consequence of the
second inert parameter is real but small at this scale: the pool is `pg`'s, defaulting to ten
connections per warm instance rather than one. `docs/deployment.md` §7 records the verification, the
sources, the error shapes to expect (`42P05`, `26000`) and the one-line fix if pool exhaustion ever
appears. The inert-flags finding stands unchanged by observation — it was read off the installed
packages before the cutover, and the cutover did not contradict it.

**Observed clean on 2026-08-23.** The first application query ever to cross the Supavisor
transaction pooler was `GET /api/health`'s `SELECT 1`, which succeeded with no prepared-statement
error. The full demonstration seed then ran through the same pooler under sustained write load — 60
assets through the real `createAsset` mutation with its advisory lock, 20 photo records, 5 loans, and
their activity rows — with zero pooler errors.

### R3 — No fixed demonstration date

The client demonstration is not yet scheduled, so scope is being built in full. The mitigation is
ordering: waves are sequenced so that the demonstration-critical path — authentication, asset
records, photos, QR codes, the scan page, labels, dashboard — completes before loans, the audit
timeline, and the export are attempted. If a date lands mid-build, everything from wave 4 onward
can be cut without leaving a partial feature on screen.

## 11. Delivery plan

Work is filed as GitHub issues in three kinds. This document is the grilling output, mirrored as
the `spec:` issue; the `map:` issue holds the execution plan and carries every ticket as a
sub-issue; each ticket is titled with a conventional-commit prefix (`feat:`, `fix:`, `chore:`,
`test:`, `refactor:`) and is one pull request.

Nineteen tickets are grouped into six waves. A wave is released for work only when the preceding
wave has closed. Within a wave, at most three tickets proceed concurrently. Blocking edges are
recorded as GitHub issue dependencies rather than as prose, so the frontier is whichever open
ticket reports zero open blockers.

| Wave | Contents | Concurrency |
|---|---|---|
| **W0** | Project scaffold and tooling; authentication spike against local Postgres; Supabase project, both buckets, and service-role key *(retired 2026-10-23, ADR 0009)* | Serial — all three tickets gate everything |
| **W1** | Prisma schema and migrations; authentication UI and route guards; i18n setup; master data screens | Parallel |
| **W2** | Asset CRUD and code generation; asset list with filters; photo pipeline; asset detail page and timeline | Parallel |
| **W3** | QR token, rendering, and public scan page; label sheet printing | Parallel |
| **W4** | Dashboard and charts; XLSX export; loan module; seed data | Parallel |
| **W5** | Supabase deployment cutover: both connection modes, migrations through session mode, production bucket, deployed phone scan *(retired 2026-10-23, ADR 0009)* | Serial — single ticket |

Everything through wave 4 ran against local PostgreSQL for data and Supabase Storage for photos.
Wave 5 was where the **database** first ran on hosted infrastructure; see risk R5. Photos were on
hosted infrastructure from wave 2, which is why the wave 0 ticket that created the Supabase project
blocked the photo pipeline. Since 2026-10-23 photos are in PostgreSQL and nothing is hosted.

Each ticket is one pull request against `main`. A wave closes only when every pull request in it is
CI-green, has passed a review pass, and — in the waves where a deployment existed — the deployed
preview has been inspected.

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

Ticket labels carry this routing: `wave:0`–`wave:5`, `executor:opus` / `executor:sonnet`,
`ready-for-agent` once the ticket is fully specified, and `spec:asset-inventory` tying it back to
its spec.

## 12. Acceptance criteria for the client demonstration

The prototype is ready to show when criteria 1 to 9 hold against a local environment, with
PostgreSQL holding the photos as well as the data. The original plan also required them on a
deployed environment, which was criterion 10; that criterion is retired (see below).

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
10. *Retired 2026-10-23.* This required all of the above against the deployed application backed by
    Supabase Postgres and Supabase Storage, reached over HTTPS from a phone on mobile data. There is
    no deployment target, so it no longer applies.

## 13. Open items

| Item | Owner | Note |
|---|---|---|
| Client demonstration date | Jefry | Drives whether wave 4 stays in scope |
| Label stock actually available to the directorate | Jefry | Layout defaults to 63.5 × 38.1 mm, 3 × 7 on A4; switching stock is a one-constant change |
| Real (non-confidential) asset list for seeding | Jefry | Seed uses realistic synthetic data until provided |
| Which escalation level R1 lands on | Orchestrator | Recorded as an ADR at the end of wave 0 |
| Supabase account and project | Jefry | Closed 2026-10-23. It was created in wave 0, per ADR 0005, and has since been switched off; ADR 0009 retired it |
| Whether to run Supabase locally via its CLI instead of plain local Postgres | Jefry | Closed 2026-10-23. Moot: photos are stored in PostgreSQL (ADR 0009), so the database and the photo bytes already sit in one resettable place |
| Printed QR codes encode `NEXT_PUBLIC_APP_URL` | Orchestrator | No label may be printed for real use until the final URL is settled, or the labels become dead |
