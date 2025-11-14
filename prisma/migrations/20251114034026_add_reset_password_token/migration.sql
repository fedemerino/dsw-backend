-- CreateTable
CREATE TABLE "resetPasswordTokens" (
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resetPasswordTokens_pkey" PRIMARY KEY ("token")
);

-- AddForeignKey
ALTER TABLE "resetPasswordTokens" ADD CONSTRAINT "resetPasswordTokens_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
