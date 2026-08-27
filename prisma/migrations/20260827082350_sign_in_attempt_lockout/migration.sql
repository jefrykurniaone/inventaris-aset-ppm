-- CreateEnum
CREATE TYPE "sign_in_attempt_outcome" AS ENUM ('succeeded', 'failed', 'blocked');

-- CreateTable
CREATE TABLE "sign_in_attempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "outcome" "sign_in_attempt_outcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sign_in_attempt_email_createdAt_idx" ON "sign_in_attempt"("email", "createdAt");
