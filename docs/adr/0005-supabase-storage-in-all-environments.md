# 0005 — Supabase Storage in all environments

- **Status**: Accepted
- **Date**: 2026-08-21
- **Deciders**: Jefry Kurniawan
- **Supersedes**: the *Photo storage* section of
  [0003](0003-local-postgres-development-supabase-deployment.md). The database decision in 0003
  stands unchanged.

## Context

ADR 0003 put two implementations behind the `src/lib/storage.ts` interface: the local filesystem in
development, Supabase Storage in deployment. It recorded the cost of that honestly — "the photo
pipeline is exercised locally against a code path that is not the one used in production" — and
bet that a narrow interface would keep the risk small.

The bet does not hold. The two paths are not the same shape. The filesystem implementation is a
browser POST to a route handler that writes bytes to disk. The Supabase implementation is a
server-minted signed URL followed by a browser PUT straight to object storage, with the bytes never
touching the application. Those differ in the upload transport, in where authorisation is enforced,
in what the failure modes are, and in what the browser code has to do. A narrow interface hides the
*call*, not the *architecture* underneath it. Whatever the local path proves, it does not prove the
deployed one.

That leaves the entire photo pipeline — a wave 2 feature, and the single most demonstration-critical
thing in the product after the scan page — unverified until the wave 5 cutover ticket. Discovering
a signed-upload problem at that point means discovering it with nothing between it and the client
demonstration.

Two constraints bound the alternatives:

- **Docker is not installed** on the development machine, and neither is WSL. Running the Supabase
  CLI's local stack, which 0003 listed as the attractive-but-rejected option, would mean installing
  both. Still declined.
- No Supabase account existed when 0003 was written. That is what made "cloud in development"
  look like a signup dependency rather than a design choice.

## Decision

**Supabase Storage is the only storage implementation, in every environment.** The local filesystem
implementation is never built.

- `src/lib/storage.ts` remains the single module that touches object storage, but it holds **one**
  implementation rather than two. The interface survives so that tests can inject an in-memory fake
  — not as an environment switch. `STORAGE_DRIVER` and `LOCAL_STORAGE_DIR` are removed.
- **One Supabase project, two buckets.** `asset-photos-dev` in development, `asset-photos` in
  deployment, selected by `SUPABASE_STORAGE_BUCKET`. Two buckets rather than one shared bucket
  because every path segment available to name an object — the row ID, and `assetCode`, which is
  generated from a category code plus a sequence — is minted independently by two databases and
  therefore collides across environments. Separate buckets mean the development bucket can be
  emptied without touching demonstration photos.
- **The project, both buckets, and the service-role key are created before any storage code is
  written.** This moves from wave 5 to wave 0, as its own ticket, blocking the photo pipeline.
- **Buckets are public for read.** Postgres stores the object path only; the URL is built at render.
  The page embedding it — the QR scan page — is public by design, so a signed download URL would
  protect nothing while costing an API round trip on every scan and forfeiting CDN caching.
- **Writes are service-role only.** The bucket denies insert to both the anonymous and the
  authenticated role. A server action verifies the Better Auth session first, then mints a signed
  upload URL with the service-role key. This is forced, not preferred: authentication is Better
  Auth, so no Supabase JWT exists and Storage RLS cannot see the application's users. Supabase
  Storage policies are therefore not an authorisation layer here — the server action is.
- **Object path `assets/<assetId>/<nanoid>.<ext>`.** The object is deleted in the same server action
  that deletes its row. Orphans left behind by `prisma migrate reset` are accepted, and an npm
  script empties the development bucket.

**Unchanged from 0003.** The database. Local PostgreSQL 17 in development, Supabase Postgres in
deployment, one `@prisma/adapter-pg` for both, `DATABASE_URL` and `DIRECT_URL` as described there.
The development database stays local permanently; the Supabase project's Postgres is the deployment
database and only that. Two environments must never share one Postgres, because Prisma's migration
history is per-database and no amount of schema separation changes that — a `prisma migrate dev` on
a laptop would rewrite production's schema.

## Consequences

**Made easy.** The photo pipeline is exercised against the real signed-upload path from wave 2
onward, which is the whole point. The wave 5 cutover shrinks to database and hosting. One
implementation instead of two means less code, no environment-branching in the storage module, and
no dead driver rotting behind an unused flag. Development traffic keeps the free project awake, so
the pause risk in R4 largely dissolves.

**Made hard.**

- Photo work is blocked until the Supabase project exists. There is no local fallback any more —
  that was the point of removing it, but it is a real dependency, and it is why project creation
  moves to wave 0.
- **Photo upload no longer works offline.** The rest of the application still does, because the
  database is local. Accepted: the demonstration will have network.
- Development uploads consume the same organisation-wide storage and egress allowance as
  production. ADR 0003's arrangement made development free of that; this one does not. At prototype
  scale — sixty assets, ~7 MB of resized images — it is a rounding error against 5 GB, but the
  claim that development costs nothing is now false and has been removed from PRD risk R2.
- **Photo rows and photo objects reset independently.** Rows live in local Postgres, objects live in
  the cloud. `prisma migrate reset` wipes the rows and leaves the objects; emptying the bucket
  leaves rows pointing at nothing. The per-asset path convention and the dev-bucket purge script are
  the entire mitigation, and they are deliberate: a reconciliation job would be over-engineering at
  this scale.
- A public bucket means a photo URL, once known, works for anyone indefinitely. Acceptable here
  because the objects are photographs of institutional equipment. It would not be if they ever
  carried personal data, and that constraint should be re-examined before any such use.
- One project holds both buckets and therefore one service-role key, so the development environment
  holds a credential that can write the production bucket. Tolerable for a solo prototype;
  it would not be for a team, and the fix at that point is a second project.

**Foreclosed.** Nothing. Two buckets can become two projects later, and the storage module is still
the single seam if the provider ever changes.

## Alternatives considered

- **Keep 0003 as written** — local filesystem in development, Supabase Storage in deployment.
  Rejected: it is the source of the problem. It defers the only genuinely unproven part of the photo
  feature to the last wave, and pays for that deferral with a second implementation that exists
  solely to be thrown away.
- **Run the Supabase CLI stack locally.** Genuine parity, offline, free, resettable, and it would
  have solved the split-reset problem too by putting the database and objects in the same place.
  Rejected again, for the same reason as in 0003 and confirmed against the machine: neither Docker
  nor WSL is installed. Reopen this if Docker ever arrives for another reason.
- **One shared bucket for both environments.** Simpler on its face. Rejected on collisions: two
  independent databases mint the same `assetCode` and possibly the same row ID, so no
  database-derived path segment is safe. An environment prefix inside one bucket would fix that and
  was the fallback, but two buckets cost nothing and read more plainly.
- **Two Supabase projects, one per environment.** Cleaner isolation, and it would give the
  development environment its own service-role key. Rejected as premature: no deployment exists yet,
  the free plan allows exactly two projects in total, and each idle one pauses after a week. Revisit
  when a second developer appears.
- **Private buckets with signed download URLs.** Rejected: the scan page is public by design, so
  the signature guards a resource that is already meant to be readable by anyone with the link,
  while adding an API call per render and losing CDN caching on the one page that must be fast on
  mobile data.
- **Supabase Auth, so that Storage RLS could see the user.** Not adopted. ADR 0001's reasoning for
  Better Auth is unaffected by where files are stored, and swapping the authentication layer to suit
  a storage policy would discard the `admin()` role model already specified across the ticket set.
  Server-side authorisation in the server action covers the same ground.
