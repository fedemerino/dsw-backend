-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;
