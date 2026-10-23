# 0009 — Photos stored in PostgreSQL

- **Status**: Accepted
- **Date**: 2026-10-23
- **Deciders**: Jefry Kurniawan
- **Supersedes**: [0005](0005-supabase-storage-in-all-environments.md) in full. The deployment half
  of [0003](0003-local-postgres-development-supabase-deployment.md), Supabase Postgres and Vercel
  hosting, lapses with it. The local-database decision in 0003 stands.

## Context

On 2026-10-23 the owner switched off the Supabase project that ADR 0005 built on. It held both
photo buckets, `asset-photos-dev` and `asset-photos`, and it held the deployment database. Its host
now returns NXDOMAIN. The owner also confirmed that the Vercel production deployment is no longer in
use. Since then there has been no deployment target. Nothing replaced the old one; this is the
state the project is in, not a hosting choice made between alternatives.

That left every photo path dead in every environment:

- **Uploads fail.** Minting a signed upload URL fails, so no asset can be created with a photo.
- **Stored photos are unreachable.** Existing rows point at objects nobody can fetch.
- **The smoke test was switched off.** The CI end-to-end job lost its secrets and now skips, so the
  smoke path that `CLAUDE.md` requires no longer runs.

Issue #148 had already raised a second problem. The image optimiser's remote allow-list, a wildcard
over every `*.supabase.co` public bucket, kept an unauthenticated image-processing attack surface
reachable through any Supabase project, not only this one.

The owner set the direction for issue #155: photos go into the application's PostgreSQL database.
The bytes now pass through the application, and that reverses the central rule of ADRs 0001, 0003
and 0005 that image bytes never pass through a serverless function. The rule existed for a
serverless host with a 4.5 MB request limit and a one-megabyte server-action default. With no host,
the constraint it protected has gone, and keeping it would mean keeping a second vendor for nothing.

## Decision

**Photo bytes are stored in PostgreSQL, in a side table with one row per photo.** The row holds the
full image and the thumbnail, each with its content type. Both are `NOT NULL`, and the row cascades
from the photo row. The photo row keeps only metadata: dimensions, size, primary flag, order and
uploader. Its object-path columns are dropped.

- **Why a side table.** The photo row is read on every list, detail and scan query, so keeping the
  bytes out of it means no query pulls megabytes by accident. PostgreSQL stores large values out of
  line, so reading the thumbnail never reads the full image.
- **Atomic writes.** A photo row and its content are written in one transaction and removed by one
  cascade. ADR 0005's "rows and objects reset independently" consequence, and the purge script
  that mitigated it, disappear.

**`src/lib/storage.ts` remains the only module that touches photo bytes.** Its interface has two
operations, and it keeps an in-memory fake for tests:

- **Write.** Writes a photo's content inside a transaction the caller supplies.
- **Read.** Reads one variant of one photo. It returns nothing when the photo does not exist or its
  asset is withdrawn, so the visibility rule is enforced where the data is fetched.

There is no delete operation, because the cascade is the delete. No Supabase client remains in the
repository.

**Uploads go through one route handler**, not a server action, because:

- raising the server-action body limit would raise it for every action;
- a server action gives the browser neither progress nor cancellation.

The browser sends one multipart request per photo over XHR. In order, the handler:

1. requires a session;
2. refuses a foreign `Origin`;
3. refuses a body over a named cap of about 3.2 MB with 413, before reading it whole;
4. determines each derivative's type from its leading bytes and refuses a declared type that
   disagrees;
5. locks the live asset, enforces the five-photo limit and writes the row, the content and the
   activity in one transaction.

The cap stays under the 4.5 MB limit of serverless hosts, so this decision does not by itself
foreclose one.

**Photos are served by a public route handler on the application's own origin.** It answers 404 when
the photo does not exist or its asset is withdrawn, for everyone. No page shows a withdrawn asset's
photos to anyone, so no session is consulted. Otherwise it returns the stored bytes with:

- the stored content type;
- `Cache-Control: public, max-age=31536000, immutable`;
- `X-Content-Type-Options: nosniff`;
- `Content-Security-Policy: default-src 'none'; sandbox`.

**The image optimiser has no remote allow-list.** The scan page's hero is optimised from the local
route; every other surface renders the stored derivative unoptimised. The Content Security Policy
drops the Supabase host.

**Limits are unchanged:** JPEG, PNG and WebP; 1.5 MB per derivative; five photos per asset; one
primary, enforced by the existing partial unique index.

**Existing photo rows are deleted by the migration.** Their objects are unreachable and cannot be
backfilled. The seed recreates the demonstration photos.

## Consequences

**Made easy.**

- **Photos work offline**, with nothing but the local database, which ADR 0005 had given up.
- **One backup covers everything.** One store holds both the metadata and the bytes, so a database
  dump is a complete backup and a reset leaves nothing behind.
- **The type check reads the real bytes.** The server reads every byte it accepts, so the check is
  made against the file itself rather than against a header the browser chose.
- **The CI smoke path runs again,** against the CI database service, with no secret.
- **No outside image source.** The image optimiser can no longer be reached through someone else's
  bucket, which closes #148.

**Made hard.**

- **Image bytes now pass through the application**, both on upload and on every photo request, and
  the application's origin now serves content that users supplied. The serving route's `nosniff`,
  sandboxing CSP and server-determined content type are what keep that safe. Do not weaken them.
- **The database grows with the photos.** At the five-photo limit with the current compression, the
  worst case is about 0.5 MB per photo, about 2.5 MB per asset. That is negligible at prototype
  scale, but it is the database's size now, not a bucket's.
- **Caching has no CDN.** The immutable cache header covers browsers only.
- **Withdrawing an asset does not reach browser caches.** A browser that cached a photo before its
  asset was withdrawn keeps that copy.
- **Withdrawing an asset, or deleting a photo, does not reach the image optimiser's copy of the scan
  hero** (recorded 2026-10-23, #171). The optimiser keeps its optimised copy in `.next/cache/images`
  on the server, and still answers `/_next/image?url=/api/photos/<id>/full&...` with 200 to anyone
  who requests it, with no time bound. In `next@15.5.28` an expired entry is served stale at once
  and revalidated in the background; the revalidation fails because the upstream now answers 404,
  and a failed revalidation writes the previous entry back with a `revalidate` of 3 to 30 seconds,
  so it stays. A shorter `max-age` on the `full` variant would therefore not bound it. The remedy is
  to clear `.next/cache/images` while the server is stopped. This is accepted because the photo was
  public on the scan page while the asset was live, and the URL embeds a random photo id that only
  that page exposed.
- **Hosting is undecided.** There is no deployment target, and choosing one later needs its own ADR.
  A serverless host would bring the 4.5 MB request limit back into play, which the upload cap
  already respects. It would also bring database size quotas, which this decision does not address.

**Foreclosed.** Nothing permanent. The seam is still one module, so object storage could return
behind it without touching a caller.

## Alternatives considered

- **A new Supabase project.** Rejected: the owner chose to leave Supabase. A new project would also
  bring back the free tier's one-week pause, the egress allowance and a second vendor, all for a
  prototype that has no deployment.
- **The local filesystem.** This is what ADR 0003 originally had. Rejected: the files would sit
  outside the database's backups and transactions, so the split-reset problem of ADR 0005 would
  remain, and any future serverless host would have no durable disk.
- **Bytes on the photo row itself.** Rejected: a list or scan query that omitted an explicit
  `select` would pull every image.
- **One content row per variant.** Rejected: the schema could not guarantee that both a full image
  and a thumbnail exist.
- **PostgreSQL large objects.** Rejected: Prisma cannot address them, and they need their own orphan
  cleanup (`vacuumlo` or a trigger).
- **Uploading through a server action.** Rejected: the body limit is global to every action, and a
  server action offers neither progress nor cancellation.
- **Serving every photo unoptimised, including the scan hero.** Rejected: on mobile data the hero
  would grow from an optimised image about 640 px wide to the 1600 px derivative, on the page that
  most needs to load fast.
- **Serving a withdrawn asset's photos to signed-in staff.** Rejected: no page shows them to
  anyone, so the branch would serve images that nothing references, at the cost of a session lookup.
