-- Remove HOST from the Role enum (Postgres can't DROP VALUE from an enum,
-- and no row currently uses it, so this swap is safe).
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'USER');

ALTER TABLE "userRoles"
  ALTER COLUMN "role" TYPE "Role_new"
  USING ("role"::text::"Role_new");

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
