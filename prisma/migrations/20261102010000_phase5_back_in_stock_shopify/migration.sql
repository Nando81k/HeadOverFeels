-- Phase 5 (storefront-v2): back-in-stock alerts keyed by Shopify product handle
-- and variant gid, beside the legacy Prisma product/variant keys.
ALTER TABLE "back_in_stock_notifications" ADD COLUMN IF NOT EXISTS "productHandle" TEXT;
ALTER TABLE "back_in_stock_notifications" ADD COLUMN IF NOT EXISTS "shopifyVariantId" TEXT;
ALTER TABLE "back_in_stock_notifications" ALTER COLUMN "productId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_notifications_shopifyVariantId_email_key"
  ON "back_in_stock_notifications"("shopifyVariantId", "email");
CREATE INDEX IF NOT EXISTS "back_in_stock_notifications_shopifyVariantId_status_idx"
  ON "back_in_stock_notifications"("shopifyVariantId", "status");
