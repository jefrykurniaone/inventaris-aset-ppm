-- Photos are stored in PostgreSQL (ADR 0009, issue #163).
--
-- Everything below the hand-written block is the output of
-- `prisma migrate diff --from-schema <schema at main> --to-schema prisma --script`,
-- unchanged. There was no database to diff against, so the migration was
-- generated schema-to-schema rather than by `prisma migrate dev`.

-- DeleteRows
-- Hand-written, not generated, and deliberately the first statement.
--
-- Every existing photo row points at an object in a Supabase bucket that was
-- switched off on 2026-10-23 (ADR 0009). Those objects cannot be fetched or
-- backfilled, so the rows describe images that no longer exist anywhere. The
-- seed recreates the demonstration photos once this migration has run.
--
-- Why delete, and why before the columns are dropped:
--
-- * After this migration a photo row is only ever written in the same
--   transaction as its `asset_photo_content` row, and every surface reads the
--   bytes from that side table. A legacy row kept past this point would be a
--   photo with no bytes: the serving route would answer 404 for it while the
--   list, the gallery and the scan page still rendered it as a broken image,
--   and it would keep counting towards the five-photo limit.
-- * Deleting first is the order that is safe if the script stops part-way.
--   Stopping after this DELETE leaves an empty table with its old columns,
--   which the previous application code still reads without error, and a
--   rerun repeats nothing harmful. Dropping first and then failing to delete
--   would leave exactly the rows described above, with their paths already
--   gone.
-- * The DELETE touches nothing but `asset_photo`. Before this migration no
--   foreign key references "asset_photo" (it only references "asset" and
--   "user"), so nothing cascades from it, and it runs before
--   "asset_photo_content" is created, so it cannot cascade into that either.
--   Activity rows that recorded these photos hold the id in a JSON payload,
--   not a foreign key, and are left alone: the trail is append-only.
-- * The partial unique index "asset_photo_primary_uidx" is untouched. It
--   covers ("assetId") WHERE "isPrimary", so neither this DELETE nor the
--   DROP COLUMN below involves a column it uses, and PostgreSQL drops an
--   index along with a column only when the index references that column.
DELETE FROM "asset_photo";

-- AlterTable
ALTER TABLE "asset_photo" DROP COLUMN "objectPath",
DROP COLUMN "thumbObjectPath";

-- CreateTable
CREATE TABLE "asset_photo_content" (
    "photoId" TEXT NOT NULL,
    "fullContentType" TEXT NOT NULL,
    "fullBytes" BYTEA NOT NULL,
    "thumbContentType" TEXT NOT NULL,
    "thumbBytes" BYTEA NOT NULL,

    CONSTRAINT "asset_photo_content_pkey" PRIMARY KEY ("photoId")
);

-- AddForeignKey
ALTER TABLE "asset_photo_content" ADD CONSTRAINT "asset_photo_content_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "asset_photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
