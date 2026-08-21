-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('active', 'in_repair', 'loaned', 'retired', 'lost');

-- CreateEnum
CREATE TYPE "asset_condition" AS ENUM ('good', 'fair', 'poor');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('created', 'updated', 'status_changed', 'photo_added', 'photo_removed', 'loaned', 'returned', 'deleted');

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "funding_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "condition" "asset_condition" NOT NULL,
    "status" "asset_status" NOT NULL DEFAULT 'active',
    "roomId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "universityAssetCode" TEXT,
    "acquisitionYear" INTEGER NOT NULL,
    "notes" TEXT,
    "qrToken" TEXT NOT NULL,
    "purchasePrice" DECIMAL(14,2),
    "fundingSourceId" TEXT,
    "procurementDocNo" TEXT,
    "vendor" TEXT,
    "warrantyUntil" TIMESTAMP(3),
    "custodianName" TEXT,
    "custodianEmail" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_photo" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "borrowerEmail" TEXT NOT NULL,
    "borrowerUnit" TEXT NOT NULL,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "handledById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_activity" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "activity_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_code_key" ON "category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "building_code_key" ON "building"("code");

-- CreateIndex
CREATE UNIQUE INDEX "room_buildingId_code_key" ON "room"("buildingId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "funding_source_name_key" ON "funding_source"("name");

-- CreateIndex
CREATE UNIQUE INDEX "asset_assetCode_key" ON "asset"("assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "asset_qrToken_key" ON "asset"("qrToken");

-- CreateIndex
CREATE INDEX "asset_categoryId_idx" ON "asset"("categoryId");

-- CreateIndex
CREATE INDEX "asset_roomId_idx" ON "asset"("roomId");

-- CreateIndex
CREATE INDEX "asset_status_idx" ON "asset"("status");

-- CreateIndex
CREATE INDEX "asset_condition_idx" ON "asset"("condition");

-- CreateIndex
CREATE INDEX "asset_acquisitionYear_idx" ON "asset"("acquisitionYear");

-- CreateIndex
CREATE INDEX "asset_fundingSourceId_idx" ON "asset"("fundingSourceId");

-- CreateIndex
CREATE INDEX "asset_deletedAt_idx" ON "asset"("deletedAt");

-- CreateIndex
CREATE INDEX "asset_createdById_idx" ON "asset"("createdById");

-- CreateIndex
CREATE INDEX "asset_photo_assetId_sortOrder_idx" ON "asset_photo"("assetId", "sortOrder");

-- CreateIndex
CREATE INDEX "asset_photo_uploadedById_idx" ON "asset_photo"("uploadedById");

-- CreateIndex
CREATE INDEX "loan_assetId_idx" ON "loan"("assetId");

-- CreateIndex
CREATE INDEX "loan_handledById_idx" ON "loan"("handledById");

-- CreateIndex
CREATE INDEX "loan_dueAt_idx" ON "loan"("dueAt");

-- CreateIndex
CREATE INDEX "asset_activity_assetId_createdAt_idx" ON "asset_activity"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "asset_activity_actorId_idx" ON "asset_activity"("actorId");

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "funding_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_photo" ADD CONSTRAINT "asset_photo_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_photo" ADD CONSTRAINT "asset_photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_activity" ADD CONSTRAINT "asset_activity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_activity" ADD CONSTRAINT "asset_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
-- Hand-written, not generated. FR-4.1 allows at most one primary photo per
-- asset, and that has to hold in the database rather than only in application
-- code: two concurrent "make this the primary photo" requests would both pass
-- an application-level check. A partial unique index is the constraint that
-- expresses it — uniqueness of "assetId" over the rows where "isPrimary" is
-- true, with no restriction at all on the rows where it is false.
--
-- Prisma's schema language can express this only behind the `partialIndexes`
-- preview feature, which this project does not enable, so the statement lives
-- here. `prisma migrate diff` ignores index predicates it cannot model, so the
-- index does not read as schema drift and later migrations leave it alone.
CREATE UNIQUE INDEX "asset_photo_primary_uidx" ON "asset_photo"("assetId") WHERE "isPrimary";
