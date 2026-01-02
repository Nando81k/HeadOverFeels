-- CreateTable
CREATE TABLE "abandoned_carts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "items" TEXT NOT NULL,
    "totalValue" REAL NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "recoveryEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "recoveryEmailSentAt" DATETIME,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveredAt" DATETIME,
    "recoveryOrderId" TEXT,
    "abandonedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "discountCode" TEXT,
    "discountAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "abandoned_carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "abandoned_carts_recoveryOrderId_fkey" FOREIGN KEY ("recoveryOrderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "abandoned_carts_recoveryOrderId_key" ON "abandoned_carts"("recoveryOrderId");

-- CreateIndex
CREATE INDEX "abandoned_carts_customerId_idx" ON "abandoned_carts"("customerId");

-- CreateIndex
CREATE INDEX "abandoned_carts_customerEmail_idx" ON "abandoned_carts"("customerEmail");

-- CreateIndex
CREATE INDEX "abandoned_carts_abandonedAt_idx" ON "abandoned_carts"("abandonedAt");
