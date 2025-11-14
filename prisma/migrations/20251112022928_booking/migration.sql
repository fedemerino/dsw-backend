/*
  Warnings:

  - You are about to drop the column `adultAmount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `childAmount` on the `bookings` table. All the data in the column will be lost.
  - Added the required column `guests` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "adultAmount",
DROP COLUMN "childAmount",
ADD COLUMN     "guests" INTEGER NOT NULL;
