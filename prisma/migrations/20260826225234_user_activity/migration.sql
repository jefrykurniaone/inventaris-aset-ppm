-- CreateEnum
CREATE TYPE "user_activity_type" AS ENUM ('deactivated', 'reactivated');

-- CreateTable
CREATE TABLE "user_activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "user_activity_type" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_activity_userId_createdAt_idx" ON "user_activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_activity_actorId_idx" ON "user_activity"("actorId");

-- AddForeignKey
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
