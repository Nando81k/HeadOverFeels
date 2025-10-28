-- CreateTable
CREATE TABLE "loyalty_tiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "minAnnualSpend" REAL NOT NULL DEFAULT 0,
    "isInviteOnly" BOOLEAN NOT NULL DEFAULT false,
    "pointMultiplier" REAL NOT NULL DEFAULT 1.0,
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "earlyDropAccess" BOOLEAN NOT NULL DEFAULT false,
    "perks" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "reviewId" TEXT,
    "redemptionId" TEXT,
    "referralId" TEXT,
    "expiresAt" DATETIME,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "points_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "points_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "points_transactions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "points_transactions_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "reward_redemptions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "rewardType" TEXT NOT NULL,
    "value" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxRedemptionsPerCustomer" INTEGER,
    "totalAvailable" INTEGER,
    "totalRedeemed" INTEGER NOT NULL DEFAULT 0,
    "minTierRequired" TEXT,
    "metadata" TEXT,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "couponCode" TEXT,
    "usedAt" DATETIME,
    "orderId" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reward_redemptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reward_redemptions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_codes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "birthday" DATETIME,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "totalSpent" REAL NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "lastOrderDate" DATETIME,
    "avgOrderValue" REAL NOT NULL DEFAULT 0,
    "loyaltyTierId" TEXT,
    "currentPoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "annualSpend" REAL NOT NULL DEFAULT 0,
    "tierStartDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "customers_loyaltyTierId_fkey" FOREIGN KEY ("loyaltyTierId") REFERENCES "loyalty_tiers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_customers" ("avgOrderValue", "birthday", "createdAt", "email", "id", "isAdmin", "lastOrderDate", "name", "newsletter", "password", "phone", "smsOptIn", "totalOrders", "totalSpent", "updatedAt") SELECT "avgOrderValue", "birthday", "createdAt", "email", "id", "isAdmin", "lastOrderDate", "name", "newsletter", "password", "phone", "smsOptIn", "totalOrders", "totalSpent", "updatedAt" FROM "customers";
DROP TABLE "customers";
ALTER TABLE "new_customers" RENAME TO "customers";
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tiers_name_key" ON "loyalty_tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tiers_slug_key" ON "loyalty_tiers"("slug");

-- CreateIndex
CREATE INDEX "points_transactions_customerId_idx" ON "points_transactions"("customerId");

-- CreateIndex
CREATE INDEX "points_transactions_orderId_idx" ON "points_transactions"("orderId");

-- CreateIndex
CREATE INDEX "points_transactions_type_idx" ON "points_transactions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_slug_key" ON "rewards"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_couponCode_key" ON "reward_redemptions"("couponCode");

-- CreateIndex
CREATE INDEX "reward_redemptions_customerId_idx" ON "reward_redemptions"("customerId");

-- CreateIndex
CREATE INDEX "reward_redemptions_rewardId_idx" ON "reward_redemptions"("rewardId");

-- CreateIndex
CREATE INDEX "reward_redemptions_couponCode_idx" ON "reward_redemptions"("couponCode");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_customerId_key" ON "referral_codes"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");
