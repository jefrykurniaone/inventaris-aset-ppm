# Supabase Storage provisioning

How the object storage this project runs on was created, and how to recreate it. Issue #27 provisioned
it; [ADR 0005](adr/0005-supabase-storage-in-all-environments.md) is why it exists in every environment
rather than only in deployment.

Supabase here is Postgres and object storage only. Supabase Auth is not enabled and never will be —
authentication is Better Auth on our own tables ([ADR 0002](adr/0002-auth-persistence-layer.md)).
The Supabase Postgres instance stays untouched until the deployment cutover; development runs against
local PostgreSQL 17 ([ADR 0003](adr/0003-local-postgres-development-supabase-deployment.md)).

## The project

- Plan: free.
- Region: Southeast Asia (Singapore), `ap-southeast-1` — chosen for proximity to the client rather
  than to the developer.
- One project holds both buckets. Do not create a second project: the free plan allows two in total
  and each idle one pauses, so the second is reserved for the day a second developer needs an
  isolated environment.

The project reference and the region belong in the pull request that provisioned them. Keys do not —
see below.

## The two buckets

| Bucket | Used by | Created |
|---|---|---|
| `asset-photos-dev` | local development | issue #27 |
| `asset-photos` | the deployment | issue #27, unused until the cutover |

Two buckets rather than one shared bucket because the local and hosted databases mint `assetCode`
values and row IDs independently, so any object path derived from the database would collide across
environments. Separate buckets also mean the development bucket can be emptied without touching
demonstration photos.

Only the bucket name differs between environments. It is selected by `SUPABASE_STORAGE_BUCKET`, and
there is no other environment branch anywhere in `src/lib/storage.ts` — one implementation, everywhere.

## Configuration applied to both buckets, identically

- **Public: on.** Anyone may read an object by its URL, with no credentials.
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`. Anything else is rejected at the
  bucket with `mime type <type> is not supported`.
- **File size limit:** 10 MiB (10485760 bytes).

### Access policies, in words

- **Read is public.** The QR scan page is public by design, so a signed download URL would protect
  nothing while costing an API round trip per scan and forfeiting CDN caching.
- **No write policy for the `anon` role. No write policy for the `authenticated` role.** Neither may
  insert, update or delete. Writes happen only through an upload URL minted server-side with the
  service-role key, after the application's own Better Auth session check has passed.
- There is deliberately **no policy written against `auth.uid()`**. Better Auth issues no Supabase JWT,
  so Storage row-level security cannot see application users at all; such a policy would be decoration.

With no write policy in place, an `anon`-key upload fails with `new row violates row-level security
policy`, and an `anon`-key delete removes nothing.

## Environment variables

All three are required in development as well as in deployment. Photo upload does not work without
them, and does not work offline. `.env.example` documents them.

| Variable | Development | Deployment |
|---|---|---|
| `SUPABASE_URL` | the project URL | the same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the project's service-role key | the same key |
| `SUPABASE_STORAGE_BUCKET` | `asset-photos-dev` | `asset-photos` |

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It is server-side only, is never prefixed
`NEXT_PUBLIC_`, is never committed, and is never pasted into an issue or a pull request body. If it
leaks, rotate it in the dashboard. The anon/publishable key is not secret, but the application has no
use for it either, so it is not in `.env.local`.

## Two things worth knowing before you debug them

- **The bucket's 10 MiB limit is a backstop, not the product's control.** `docs/prd.md` requires a
  1.5 MB hard cap enforced server-side at the signed-URL endpoint, independently of any client-side
  compression, and a content-type allowlist there as well. Client compression is usability; the server
  cap is the control. The bucket limit only catches what gets past both.
- **A deleted object still answers `200` on its cached public URL for a short while.** That is the CDN,
  not a failed delete. A request with a unique query string is a cache miss and shows the real state —
  `400` once the object is gone.

## Verifying a bucket after provisioning it

The acceptance proof for issue #27 walked these, in order, and all passed:

1. Both buckets exist in one project and both report `public=true`.
2. The service-role key mints a signed upload URL, and an upload through that URL succeeds.
3. The object reads back over its public URL with no credentials, byte-identical.
4. An upload attempted with the anon key is refused, and a delete attempted with the anon key removes
   nothing.
5. The service-role key deletes the object, and the object no longer reads back.

The script that did it was a throwaway outside the repository, using `createSignedUploadUrl` and
`uploadToSignedUrl` — the same pair `src/lib/storage.ts` is built on. It is not committed because
`@supabase/supabase-js` arrives with the photo pipeline, which owns that dependency.
