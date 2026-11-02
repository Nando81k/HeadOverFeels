-- Storefront rebuild Phase 4 (accounts & loyalty): Shopify customer identity.
-- Additive only; safe to re-run (IF NOT EXISTS everywhere, as 20260608000000_customer_anonymized_at).

-- 1. Customer.shopifyCustomerId — the Shopify customer GID this row is linked to
--    (null for pre-cutover rows; email is the fallback key). The unique index doubles as the lookup index.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "shopifyCustomerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "customers_shopifyCustomerId_key" ON "customers"("shopifyCustomerId");

-- 2. RewardRedemption: the Shopify discount node minted for a redeemed reward and
--    when that single-use code stops working.
ALTER TABLE "reward_redemptions" ADD COLUMN IF NOT EXISTS "shopifyDiscountId" TEXT;
ALTER TABLE "reward_redemptions" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- 3. Shopify webhook deliveries, keyed by X-Shopify-Webhook-Id for idempotency.
CREATE TABLE IF NOT EXISTS "shopify_webhook_events" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'received',
    "error" TEXT,
    CONSTRAINT "shopify_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shopify_webhook_events_topic_idx" ON "shopify_webhook_events"("topic");
CREATE INDEX IF NOT EXISTS "shopify_webhook_events_receivedAt_idx" ON "shopify_webhook_events"("receivedAt");

-- 4. Storefront V2 wishlist for signed-in customers (Shopify variant GIDs).
CREATE TABLE IF NOT EXISTS "storefront_wishlist_items" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productHandle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "storefront_wishlist_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "storefront_wishlist_items_customerId_variantId_key" ON "storefront_wishlist_items"("customerId", "variantId");
CREATE INDEX IF NOT EXISTS "storefront_wishlist_items_customerId_idx" ON "storefront_wishlist_items"("customerId");

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS; guard the FK by name.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'storefront_wishlist_items_customerId_fkey'
    ) THEN
        ALTER TABLE "storefront_wishlist_items"
            ADD CONSTRAINT "storefront_wishlist_items_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
