/*
  Warnings:

  - You are about to drop the column `adultPrice` on the `listings` table. All the data in the column will be lost.
  - You are about to drop the column `childPrice` on the `listings` table. All the data in the column will be lost.
  - You are about to drop the column `avatar` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userEmail,listingId]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bathrooms` to the `listings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `beds` to the `listings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `petFriendly` to the `listings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pricePerNight` to the `listings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyType` to the `listings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rooms` to the `listings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userEmail` to the `listings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."bookings_listingId_key";

-- AlterTable
ALTER TABLE "listings" DROP COLUMN "adultPrice",
DROP COLUMN "childPrice",
ADD COLUMN     "bathrooms" INTEGER NOT NULL,
ADD COLUMN     "beds" INTEGER NOT NULL,
ADD COLUMN     "petFriendly" BOOLEAN NOT NULL,
ADD COLUMN     "pricePerNight" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "propertyType" TEXT NOT NULL,
ADD COLUMN     "rooms" INTEGER NOT NULL,
ADD COLUMN     "userEmail" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatar",
DROP COLUMN "firstName",
DROP COLUMN "lastName",
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "phoneNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reviews_userEmail_listingId_key" ON "reviews"("userEmail", "listingId");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
