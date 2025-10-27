-- CreateTable
CREATE TABLE "drop_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" DATETIME,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drop_notifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cart_reservations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cart_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cart_reservations_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "drop_notifications_productId_notified_idx" ON "drop_notifications"("productId", "notified");

-- CreateIndex
CREATE UNIQUE INDEX "drop_notifications_email_productId_key" ON "drop_notifications"("email", "productId");

-- CreateIndex
CREATE INDEX "cart_reservations_productVariantId_isActive_expiresAt_idx" ON "cart_reservations"("productVariantId", "isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "cart_reservations_sessionId_idx" ON "cart_reservations"("sessionId");
