-- `building`, `room` and `funding_source` gain the `createdAt` / `updatedAt`
-- pair that `category` has carried since the application schema was created.
-- FR-3.1 makes all four master-data tables administrator-editable, so
-- `updatedAt` carries real information on every one of them.
--
-- `updatedAt` is written by Prisma Client, not by the database, so its final
-- shape has to be `TIMESTAMP(3) NOT NULL` with no default — exactly as
-- `category."updatedAt"` was created. Prisma's own generated statement adds it
-- that way in one step, which cannot work on a table that already has rows.
-- The column is therefore added with a temporary default so existing rows are
-- backfilled, and the default is dropped immediately afterwards. The resulting
-- column definition is identical to `category`'s, so this leaves no drift.

-- AlterTable
ALTER TABLE "building" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "building" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "funding_source" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "funding_source" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "room" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "room" ALTER COLUMN "updatedAt" DROP DEFAULT;
