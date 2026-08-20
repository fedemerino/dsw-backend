-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "emailVerificationTokens" (
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emailVerificationTokens_pkey" PRIMARY KEY ("token")
);

-- AddForeignKey
ALTER TABLE "emailVerificationTokens" ADD CONSTRAINT "emailVerificationTokens_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: accounts created before this feature are already in active use, don't lock them out
UPDATE "users" SET "emailVerified" = true;
