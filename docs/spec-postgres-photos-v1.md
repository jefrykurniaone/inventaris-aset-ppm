# Spec v1 - Postgres photos: store photos in PostgreSQL and retire the deployment target

> Tracker: Spec [#161](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/161) · Execution map [#167](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/167) · Tickets [#163](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/163), [#164](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/164), [#165](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/165), [#166](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/166) · Run label `run:postgres-photos` · Problem issue [#155](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/155) · Folded-in issue [#148](https://github.com/jefrykurniaone/inventaris-aset-ppm/issues/148) · Decision record [ADR 0009](adr/0009-photos-stored-in-postgresql.md).
> Point-in-time copy of the spec item as of 2026-10-23, against `main` at `f630bad`. The spec item is the one written copy.

## Problem statement

As of 2026-10-23, the owner has switched off the Supabase project behind ADR 0005. It held both photo buckets (`asset-photos-dev` and `asset-photos`) and the deployment database, and its host now returns NXDOMAIN. The owner confirmed on 2026-10-23 that the Vercel production deployment is no longer in use.

For a staff member, every photo path is dead in every environment:

- **Adding a photo fails.** The server can no longer mint an upload target, so no asset can be created with a photo.
- **Recorded photos cannot be shown.** The list thumbnail, the detail gallery and the public scan page all point at objects nobody can fetch, and the scan page's hero image comes back as an error from the image optimiser.
- **The required smoke test no longer runs.** `CLAUDE.md` requires the end-to-end smoke test, but CI now skips it with a warning. Its Supabase secrets were deleted on 2026-10-23 so that it would stop failing for a reason no pull request could fix.

Separately, there is the problem #148 raised. As of 2026-10-23 the image optimiser accepts any image under `https://*.supabase.co/storage/v1/object/public/**`. That pattern matches the public bucket of **any** Supabase project, not only this one, which has two consequences:

- The class of advisory behind GHSA-2xp9-vwfh-vxw4 stays reachable. That advisory is remote code execution through crafted images in the Image Optimization API, and anyone who hosts an image in a Supabase project of their own can feed one to it.
- Anyone can use the application as an image proxy.

Finally, the repository's documents still describe a deployment that no longer exists. They include a Vercel-plus-Supabase cutover runbook, a storage provisioning guide and a keep-awake cron, and the PRD's requirements and risks are written around signed upload URLs.

## Solution

Photos are stored in the application's own PostgreSQL database, and the application serves them itself.

- **Adding photos works as before.** Staff choose a file or take a photo with the camera, see upload progress, and can cancel. The photo then appears in the gallery, in the list thumbnail and on the public scan page.
- **Scanning shows photos only for assets in the register.** Anyone who scans the label of an asset in the register sees its photos. Nobody sees the photos of an asset that has been withdrawn.
- **The optimiser serves only the application's own images.** No remote host is on its allow-list.
- **CI runs the smoke path on every pull request,** against the CI database, with no external service and no secret.
- **The documents say there is no deployment target.** The ones that describe the old deployment are removed.

## Goals and non-goals

Goals:

- The whole photo lifecycle works locally with nothing but PostgreSQL: add, show, set primary, reorder and delete.
- A photo's row and its image bytes are written together in one transaction and removed together, so a photo without its bytes, or bytes without their photo, cannot exist.
- The public/restricted split of PRD §8.2 still holds, enforced where data is fetched.
- No remote image host remains on the optimiser's allow-list (#148).
- The end-to-end smoke path runs in CI on every pull request, with no condition.
- Every document that describes the storage or deployment architecture agrees with the code.

Non-goals:

- Choosing a new deployment target or hosting provider. When one is needed, it gets its own ADR.
- Changing the compression the browser applies (1600 px full image, 400 px thumbnail, WebP) or the limit of five photos per asset.
- Recovering the photos that lived in the switched-off buckets.
- Re-encoding images or generating derivatives on the server.

## User stories

1. As a staff member, I want to add a photo to an asset from a file or from the camera, so that the record shows what the item looks like.
2. As a staff member, I want to see upload progress and be able to cancel an upload in flight, so that a slow connection does not leave me guessing.
3. As a staff member, I want a clear, localised message when a file is not a JPEG, PNG or WebP image, or is too large, so that I know what to fix.
4. As a staff member, I want a file to be refused when its contents are not an allowed image, even if its name or declared type says it is one, so that the application never stores something else and serves it as an image.
5. As a staff member, I want at most five photos per asset with exactly one primary, as before.
6. As a staff member, I want to delete, reorder and set the primary photo, and I want a deleted photo to stop being served immediately.
7. As a staff member creating an asset, I want to attach a photo in the same flow, as before.
8. As anyone scanning a label, I want the asset's photos to load quickly on mobile data, so that I can confirm I am looking at the right item.
9. As anyone scanning the label of a withdrawn asset, I want to see the withdrawn page with no photos, and I want the photo addresses of that asset to stop answering.
10. As a developer, I want photo upload to work against the local database alone, so that development needs no cloud account and no network.
11. As a developer, I want `db:seed` to restore the demo photos, so that a reset database looks like the demonstration again.
12. As a developer, I want the smoke path to run in CI on every pull request without secrets, so that a broken photo path fails the build.
13. As the owner, I want the documents to state that there is no deployment target, so that nobody follows a runbook for infrastructure that no longer exists.
14. As the owner, I want no remote host on the image optimiser's allow-list, so that the application cannot be used as an image proxy or attacked through images hosted in someone else's project.

## Implementation decisions

### ADR

- **ADR 0009, "Photos stored in PostgreSQL", supersedes ADR 0005 entirely.** It is merged with this spec's documentation pull request, before any code ticket starts. Its context records that the Supabase project and the Vercel deployment are gone and that there is no deployment target.
- **ADR 0003's status line is amended.** Its deployment half (Supabase Postgres and Vercel hosting) lapsed on 2026-10-23. Its local-database decision stands.
- **`CLAUDE.md`'s stack and seam sections are brought into line with the ADR** by a ticket of this run.
- **No separate ADR for "no deployment target".** Nothing was chosen between alternatives there; it is a state of affairs, not a decision.

### Storage shape

The image bytes live in a side table with one row per photo, never in the photo row itself. A trimmed sketch of the decision (field names are the ticket's to finalise):

```prisma
model AssetPhotoContent {
  photoId          String     @id
  photo            AssetPhoto @relation(fields: [photoId], references: [id], onDelete: Cascade)
  fullContentType  String
  fullBytes        Bytes
  thumbContentType String
  thumbBytes       Bytes

  @@map("asset_photo_content")
}
```

Why a side table:

- **No query can pull image bytes by accident.** The photo row is read on every list, detail and scan query, and the bytes are not in it.
- **The schema guarantees both derivatives.** Both byte columns are `NOT NULL`, so every photo has a full image and a thumbnail.
- **Reading the thumbnail does not read the full image,** because PostgreSQL stores large values out of line.

Alternatives rejected:

- **Large objects.** Prisma cannot address them, and they need their own cleanup of orphans.
- **One row per variant.** The schema could not guarantee that both variants exist.

The object-path columns on the photo row are dropped. The photo row keeps its metadata: dimensions, size, primary flag, order and uploader.

### Existing photo rows

- **The migration deletes every existing photo row.** Their objects can no longer be fetched. As of 2026-10-23 the local development database holds 20 such rows across 15 assets, and the deployment database is gone. *(Delivered as `TRUNCATE TABLE "asset_photo"` rather than a `DELETE`, because SonarQube Cloud fails an unbounded `DELETE` as a blocker bug. The 20 rows across 15 assets were removed when the migration was applied locally. See the delivery notes.)*
- **Those assets then count as "missing photo",** which is true.
- **The seed restores the demo photos.**
- **Activity is left alone.** Activity rows that recorded those photos are append-only and are not touched. New photo activity records the photo id only.

### Storage seam

The storage seam remains the only module that touches photo bytes. Its interface has two operations:

- **Write a photo's content inside a transaction the caller passes in,** so the photo row and its bytes commit or roll back together.
- **Read one variant (full or thumbnail) of one photo.** It returns the bytes and content type, or nothing when the photo does not exist **or its asset is withdrawn**. The visibility rule is therefore enforced where the data is fetched.

It has no delete operation: deleting the photo row cascades to its content. The in-memory fake used by tests stays, and no Supabase client remains in the repository.

### Upload transport

A route handler accepts one multipart request per photo, carrying the full image, the thumbnail and the dimensions the browser reports. The browser sends it with XHR, so progress and cancellation keep working. The handler does five things, in order:

1. It requires a signed-in user. *(Delivered with the same session rule the photo actions use, answering 401 instead of redirecting, because an XHR would follow the redirect and re-send the photo.)*
2. It refuses a request whose `Origin` is not the application's own, because a route handler gets none of the built-in CSRF protection a server action has. *(Delivered stricter than the server-action check: a missing, `null` or unparseable `Origin` is refused too.)*
3. It refuses a body over a named cap of about 3.2 MB with 413, before reading the whole body. The cap is two derivatives at the 1.5 MB ceiling plus multipart overhead, and it stays under the 4.5 MB request limit of serverless hosts, so moving to such a host later remains possible.
4. It determines each derivative's type from its leading bytes (JPEG, PNG or WebP), refuses anything else and any declared type that disagrees, and measures each size itself.
5. Inside one transaction, it locks the live asset, enforces the five-photo limit, creates the photo row, writes its content and records the activity.

This deliberately reverses ADR 0005's rule that "image bytes never pass through a serverless function". Delete, set-primary and reorder stay server actions.

Why a route handler and not a server action:

- Raising the server-action body limit would raise it for every action, not just this one.
- A server action gives the browser neither progress nor cancellation.

### Serving

A public route handler answers `GET` for one variant of one photo:

- **404 when the photo does not exist or its asset is withdrawn,** for everyone. No session is consulted, because no page shows a withdrawn asset's photos to anyone, staff included.
- **Otherwise, the stored bytes** with:
  - the stored content type;
  - `Cache-Control: public, max-age=31536000, immutable`, because a photo id's bytes never change and a replaced photo gets a new id;
  - `X-Content-Type-Options: nosniff`;
  - `Content-Security-Policy: default-src 'none'; sandbox`, because the application's origin now serves content that users supplied.
- **Copies cached earlier may persist.** A browser that cached a photo before its asset was withdrawn may keep showing it from its cache. This is accepted. *(The run found a second cache this rule does not cover. The image optimiser keeps its server-side copy of the scan hero for the upstream `max-age`, so after a withdrawal `/_next/image?url=/api/photos/…` still answered 200 while both photo addresses answered 404. Filed as #171 for the owner's decision. See the delivery notes.)*
- **The route sits under a path the request middleware does not process.**

### Rendering

- **Every surface that shows a photo uses the application's own photo address.**
- **The scan page's full-size hero is still optimised by `next/image`,** now reading from the local route. Every other surface stays unoptimised, as today.
- **The image configuration lists no remote pattern.** Whether the hero needs a local pattern declared is to be looked up in the Next.js 15 documentation, not assumed. *(The hero needs none, because every local path is allowed while `images.localPatterns` is unset. One was declared anyway to narrow the optimiser: `/api/photos/**` with no query string. Any other local path now answers 400 through `/_next/image`.)*
- **The Content Security Policy drops the Supabase host** from `img-src` and `connect-src`.
- **The source comment that says the origin serves no user-supplied content is corrected.**

### Limits

These are unchanged:

- JPEG, PNG and WebP only.
- 1.5 MB per derivative.
- Five photos per asset.
- At most one primary photo per asset, still enforced by the partial unique index.

### Removed

- The Supabase JavaScript client dependency.
- The signed-upload-URL code path, in both the browser and the server.
- The development-bucket purge script and its npm script.
- The storage verification script.
- Every `SUPABASE_*` variable: in code, in the example environment file, in CI and in the documents. *(Delivered for every variable that is read. Two literal names remain: a test fixture in `src/lib/seed-admin.test.ts`, tracked in #170, and a comment in an applied migration, which Prisma checksums.)*
- `vercel.json`, whose cron existed only to keep Supabase awake.
- The Vercel protection-bypass headers in the Playwright configuration.
- The deployment runbook and the storage provisioning guide.

The health route stays.

### CI

- **The end-to-end job loses its secret gate.** The CI database is thrown away after every run, so the seeded admin's credentials become throwaway literals in the workflow, as the auth secret already is.
- **The smoke spec checks the new photo path end to end:**
  - a photo's address is the application's own route and answers with an image;
  - the scan page's hero loads through the optimiser;
  - a deleted photo's address answers 404 at once. *(Removing the 90-second poll exposed a defect in the shared delete helper. While the confirm dialog was open, Radix's `aria-hidden` hid the card, so "card gone" passed before the delete was sent. The helper now waits for the server action's response and for the dialog to close.)*

### Documents

- **The PRD is amended in place under a dated revision note:**
  - FR-4.4, FR-4.5, FR-4.6, FR-4.9 and FR-4.10 are rewritten to this design.
  - The hosting and storage rows of the §9 architecture table are updated.
  - Risks R2, R4 and R5 are marked closed with the reason, and their text is kept.
- **`README.md`, `CLAUDE.md`, the example environment file and the SonarCloud notes** lose their Supabase and deployment content.
- **The glossary gains "Withdraw (asset)",** merged with this spec's documentation pull request.

## Testing decisions

A good test here drives the behaviour a caller sees: a request goes in, and a response or a stored row comes out. It never asserts on how the handler got there.

**Seam 1: the storage interface with its in-memory fake (Vitest).** The upload and serving route handlers are called with real `Request` objects, with the fake injected.

- Catches:
  - authentication and the `Origin` check;
  - the body cap;
  - type detection, and a declared type that disagrees with it;
  - the five-photo limit;
  - a withdrawn asset's photo answering 404;
  - an unknown photo answering 404;
  - the response headers.
- Misses: the real round trip of bytes through PostgreSQL, and multipart parsing in the running server.

**Seam 2: the Playwright smoke path in CI,** against the CI PostgreSQL service. It signs in, creates an asset with a photo, checks that the photo's address is the application's route and answers 200 with an image type, checks that the scan page's hero loads through the optimiser, deletes the photo, and checks that the address answers 404.

- Catches: the real path end to end, including the optimiser's local pattern and the database round trip.
- Misses: edge cases, which seam 1 owns.

**Pure unit tests** cover type detection and the arithmetic behind the body cap.

Prior art in the repository:

- The existing photo action tests inject the storage fake through the module seam.
- The visibility tests walk the anonymous select looking for restricted columns.
- The smoke helpers already create an asset with a one-pixel WebP.

## Success criteria

- **Photos work offline.** With only the local database and no network, a staff member can add, view, set primary, reorder and delete photos, and the scan page shows them. *(Adding, viewing, deleting and the scan page were walked on the dev server against the local database. Set primary and reorder are unchanged server actions, covered by unit tests and not walked.)*
- **The pipeline is green.**
  - The completion gate passes: typecheck, lint, unit tests and build.
  - The production-scope audit passes.
  - The end-to-end job runs and passes on the pull request, with no skip warning.
- **Supabase is gone from live code and configuration.**
  - No file in the repository imports a Supabase client.
  - No `SUPABASE_` name remains outside historical records: ADRs, delivered spec mirrors and evidence documents. *(Not fully met. The `SUPABASE_POOLER_URL` test fixture and stale code comments remain, outside every ticket's `writes:`. #170 tracks them. No `SUPABASE_*` environment variable is read anywhere.)*
- **The image configuration contains no remote pattern.**
- **The serving rule holds.**
  - A photo of a withdrawn asset answers 404. *(Met for both photo addresses. The optimiser's cached copy of the hero is #171.)*
  - A photo of a live asset answers 200 with an immutable cache header and a restrictive Content Security Policy.
- **A disguised file is refused.** A file renamed to `.webp` that is not WebP is refused with the localised unsupported-format message.
- **The seed restores the demo photos:** `db:seed` on a reset database recreates them. *(Met with 20 `asset_photo` rows and 20 `asset_photo_content` rows. Prisma 7.10.1's `migrate reset` does not seed by itself, so `db:seed` runs explicitly.)*
- **The records are updated.**
  - ADR 0009 exists and ADR 0005 is marked superseded.
  - ADR 0003's status reflects its lapsed deployment half.
  - The PRD carries the revision note.

## Out of scope

- A new deployment target, hosting provider or production database.
- Deleting the Vercel project and the local `.vercel` link. Those belong to the owner and sit outside the repository.
- Recovering photos from the switched-off buckets.
- Changing the compression, the dimensions or the photo limit.
- Making the end-to-end check a required status check in branch protection. The owner does that after the run closes.
- Editing historical records. This covers the ADRs other than the status lines named above, the delivered spec mirrors, `docs/performance-evidence.md` and the security review.

## Further notes

- **#148 is folded in.** It is closed as superseded when the ticket that empties the remote allow-list merges.
- **Some history mentions the switch-off and is left as it is.** As of 2026-10-23, ADR 0008 and the dependency-security spec mirror record the switch-off and the deleted CI secrets. They are history and are not edited.
- **Photo addresses stay unguessable in practice.** A photo id is a UUIDv7 with 74 random bits, which is the same exposure model the public bucket had.

## Delivery notes

Run `postgres-photos`, execution map #167, closed 2026-10-23.

### What landed

| Ticket | Pull request | Merge commit | What |
|---|---|---|---|
| — | #162 | `a65a61d` | The spec mirror, ADR 0009 (supersedes ADR 0005), the ADR 0003 status line and the glossary entry "Withdraw (asset)". |
| — | #168 | `1e521d7` | The mirror's header link to map #167 and its tickets. |
| #163 | #169 | `56d106d` | The `asset_photo_content` side table and migration `20261023004951_asset_photo_content`. The two-operation seam in `src/lib/storage.ts`. `POST /api/assets/[id]/photos` and `GET /api/photos/[photoId]/[variant]`. The one-request XHR upload. Read sites built from the photo id. The seed writing through the seam. `@supabase/supabase-js`, the purge and verification scripts and `storage:purge:dev` removed. |
| #164 | #173 | `d01a345` | No `images.remotePatterns`. `images.localPatterns` set to `/api/photos/**` with no query string. The Supabase host dropped from `img-src` and `connect-src`, with the comment corrected. Closes #148 as superseded. |
| #165 | #174 | `b114fa8` | The end-to-end job without its secret gate. Throwaway literal credentials, declared once. Specs that follow the new photo path. No Vercel bypass headers. |
| #166 | #175 | `9968c41` | `CLAUDE.md`, `README.md`, `.env.example`, the SonarCloud notes and the PRD, under a revision note dated 2026-10-23. `docs/deployment.md`, `docs/supabase-storage-provisioning.md` and `vercel.json` deleted. |

**Gates.** Both batches ran the whole main-tree gate on the local merge, and `main` received an identical tree through `gh pr merge --merge`. The gate covers:

- `@prisma/client` presence
- `check:encoding`
- `generate`
- `typecheck`
- `lint`
- `test -- --coverage`
- `build`
- `format`
- `npm audit --omit=dev`

The two runs:

- **Wave 1** on `9976fec`: 1267 tests, audit 0.
- **Wave 2** on `b39ae68`: 1268 tests, audit 0.

On every pull request, CI was green and SonarCloud showed 0 issues.

### Against the implementation decisions

- **Migration.** It was authored without a database, with `prisma migrate diff --from-schema … --to-schema prisma --script` plus a hand-written first statement. It was applied to the development database with `migrate deploy`. The partial unique index `asset_photo_primary_uidx` survived.
- **Upload route.** Steps run in this order, and each answers with a localised message and never internal error text:
  1. session check, or 401
  2. `Origin` check, or 403
  3. body cap of 3.2 MB, checked on `Content-Length` and again while reading, or 413
  4. Zod validation, or 400
  5. type detection from the leading bytes, or 415 / 413 / 400
  6. one transaction, or 409 at the limit

  Ids are validated as UUIDs before any database access. The browser now also checks a picked file's leading bytes with the same detector. Without that, a disguised file failed in compression with the generic message instead of `unsupportedFormat`.
- **Serving route.** It sends all five headers and is `force-dynamic`. A refusal answers `no-store`, so only bytes are ever cached.
- **Runtime walks.** Both ran on the local dev server, driven by Playwright MCP, and every criterion passed.
  - **#163:**
    - progress, then a card whose `src` is under `/api/photos/`
    - exact headers
    - every surface showed the photo
    - a disguised `x.webp` was refused in the UI and with a 415 from the server
    - 404 immediately after a delete and after a withdrawal
    - the seed gave 20 = 20
  - **#164:**
    - a remote URL through `/_next/image` answered 400
    - the hero answered 200
    - the CSP has no `supabase`
    - 0 console errors
- **CI end-to-end.** The `End-to-end smoke test` job runs Playwright on every pull request, 2 passed, with no "not run" warning.

### What the run reversed or changed

- **`DELETE` became `TRUNCATE`.** This was hand-back 1 on #163, from SonarQube Cloud's `plsql:DeleteOrUpdateWithoutWhereCheck` blocker. The development database was reset and seeded again, with the owner's consent, so that the applied checksum matches the final file.
- **Two ticket criteria were corrected.** Their premise reached files outside the ticket's `writes:`:
  - #163's "no `SUPABASE_` name remains" became "no `SUPABASE_` environment variable is read".
  - #166's grep criteria were scoped to its own surface and `docs/`.
- **Nothing was published by direct push.** The `Protect main` ruleset requires a pull request. With strict status checks, #174 and #175 were brought up to date with `main` and passed CI again before each merged.

### Follow-ups filed (outside this run)

- **#170:** stale Supabase, bucket and Vercel wording in code comments, the `scripts/measure-performance.ps1` default URL, and the seed-admin test fixture's wording.
- **#171:** the image optimiser's server-side cache keeps serving a withdrawn asset's or deleted photo's hero. The owner decides.
- **#172:** two xlsx compression tests time out under machine load. This is the previously unattributed flake, now captured.

### Steps handed to the owner

These are owned by jefrykurniaone, after the map closes:

1. Add `End-to-end smoke test` as a required status check on `main`.
2. Delete the Vercel project and the local `.vercel/` link.
3. Remove `SUPABASE_*` and `VERCEL_OIDC_TOKEN` from the local `.env.local`.
