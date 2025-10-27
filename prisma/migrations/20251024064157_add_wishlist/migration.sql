-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "sessionId" TEXT,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "wishlist_items_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wishlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wishlist_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "wishlist_items_customerId_idx" ON "wishlist_items"("customerId");

-- CreateIndex
CREATE INDEX "wishlist_items_sessionId_idx" ON "wishlist_items"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_customerId_productId_productVariantId_key" ON "wishlist_items"("customerId", "productId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_sessionId_productId_productVariantId_key" ON "wishlist_items"("sessionId", "productId", "productVariantId");
