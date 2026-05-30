-- Extend the existing AdminRole enum with MERCHANDISER, SUPPORT, and FINANCE values
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'MERCHANDISER';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'FINANCE';

-- Add adminRole column to customers table (null = not admin; non-null = admin with this role)
ALTER TABLE "customers" ADD COLUMN "adminRole" "AdminRole";

-- Backfill existing isAdmin=true rows with ADMIN role
UPDATE "customers" SET "adminRole" = 'ADMIN' WHERE "isAdmin" = true;
