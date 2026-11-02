-- Storefront rebuild Phase 5 (drops, reviews & content): reviews re-keyed by Shopify handle.
-- Additive and idempotent (IF NOT EXISTS everywhere, as 20261011000000_shopify_customer_identity).

-- 1. Review.productHandle — the Shopify product handle (= legacy products.slug).
--    Storefront V2 reads and writes reviews by this key; the legacy productId FK stays
--    for the admin pages until Phase 6 and becomes nullable so a review can exist for a
--    product that was created in Shopify only.
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "productHandle" TEXT;
CREATE INDEX IF NOT EXISTS "reviews_productHandle_status_idx" ON "reviews"("productHandle", "status");

-- 2. Backfill the handle for every existing review from the legacy product row.
UPDATE "reviews" r
SET "productHandle" = p."slug"
FROM "products" p
WHERE r."productId" = p."id" AND r."productHandle" IS NULL;

-- 3. productId becomes optional.
ALTER TABLE "reviews" ALTER COLUMN "productId" DROP NOT NULL;
