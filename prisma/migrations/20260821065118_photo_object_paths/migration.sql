-- Rename `asset_photo."url"` to `"objectPath"` and `"thumbUrl"` to
-- `"thumbObjectPath"`.
--
-- Hand-written. `prisma migrate dev` cannot infer a rename from a schema diff,
-- so it generated `DROP COLUMN` plus `ADD COLUMN ... NOT NULL`, which discards
-- every value and fails outright on a non-empty table. `RENAME COLUMN` carries
-- the values across and is safe whether or not the table holds rows. The two
-- statements are equivalent only on an empty table, and a migration must not
-- depend on that.
--
-- The rename settles a conflict between `docs/prd.md` §8.1, which describes the
-- columns as "full URL, thumbnail URL", and FR-4.9, which requires the database
-- to store the object path only. FR-4.9 wins: the bucket differs per
-- environment (`asset-photos-dev` locally, `asset-photos` in deployment,
-- selected by `SUPABASE_STORAGE_BUCKET`), so a stored URL would pin every row
-- to the bucket it was uploaded to and force a data migration at the cutover.
-- An object path survives the bucket change untouched. The URL is built at
-- render time. See `docs/supabase-storage-provisioning.md`.

-- AlterTable
ALTER TABLE "asset_photo" RENAME COLUMN "url" TO "objectPath";
ALTER TABLE "asset_photo" RENAME COLUMN "thumbUrl" TO "thumbObjectPath";
