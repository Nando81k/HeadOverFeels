-- Composite index for common Order queries (customer + status + date range)
CREATE INDEX IF NOT EXISTS "Order_customerId_status_createdAt_idx" ON "orders"("customerId", "status", "createdAt");

-- FK index for category lookups
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "products"("categoryId");

-- Preserve audit trail when admin user is deleted (was: CASCADE → SET NULL)
ALTER TABLE "admin_audit_logs"
  DROP CONSTRAINT IF EXISTS "admin_audit_logs_adminId_fkey",
  ALTER COLUMN "adminId" DROP NOT NULL,
  ADD CONSTRAINT "admin_audit_logs_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
