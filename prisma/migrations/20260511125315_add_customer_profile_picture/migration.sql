-- AlterTable
-- Adds profile picture URL field to customers. Safe to re-apply against
-- environments that already have the column synced via `prisma db push`.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;
