-- CreateTable
CREATE TABLE "user_avatars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "configuration" TEXT NOT NULL,
    "skinTone" TEXT NOT NULL DEFAULT '#FFE0BD',
    "bodyType" TEXT NOT NULL DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_avatars_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "avatar_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slot" TEXT NOT NULL,
    "modelUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "productId" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "avatar_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_avatar_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "avatarItemId" TEXT NOT NULL,
    "unlockedVia" TEXT,
    "orderId" TEXT,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_avatar_items_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_avatar_items_avatarItemId_fkey" FOREIGN KEY ("avatarItemId") REFERENCES "avatar_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_avatars_customerId_key" ON "user_avatars"("customerId");

-- CreateIndex
CREATE INDEX "avatar_items_productId_idx" ON "avatar_items"("productId");

-- CreateIndex
CREATE INDEX "user_avatar_items_customerId_idx" ON "user_avatar_items"("customerId");

-- CreateIndex
CREATE INDEX "user_avatar_items_avatarItemId_idx" ON "user_avatar_items"("avatarItemId");

-- CreateIndex
CREATE UNIQUE INDEX "user_avatar_items_customerId_avatarItemId_key" ON "user_avatar_items"("customerId", "avatarItemId");
