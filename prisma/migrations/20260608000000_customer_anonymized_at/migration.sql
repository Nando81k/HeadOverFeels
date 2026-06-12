-- Phase 8: GDPR right-to-erasure column on Customer.
-- Null = active; non-null = anonymized at that timestamp.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "customers_anonymizedAt_idx" ON "customers"("anonymizedAt");
