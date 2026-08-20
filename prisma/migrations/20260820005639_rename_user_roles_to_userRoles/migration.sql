-- RenameTable
ALTER TABLE "user_roles" RENAME TO "userRoles";

-- RenameConstraint (align names with the renamed table)
ALTER TABLE "userRoles" RENAME CONSTRAINT "user_roles_pkey" TO "userRoles_pkey";
ALTER TABLE "userRoles" RENAME CONSTRAINT "user_roles_userEmail_fkey" TO "userRoles_userEmail_fkey";
