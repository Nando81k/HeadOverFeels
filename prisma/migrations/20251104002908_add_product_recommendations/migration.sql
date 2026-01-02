/*
  Warnings:

  - You are about to drop the `expenses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "expenses";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "product_views" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "source" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    CONSTRAINT "product_views_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_views_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_recommendations_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_recommendations_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "product_views_productId_idx" ON "product_views"("productId");

-- CreateIndex
CREATE INDEX "product_views_customerId_idx" ON "product_views"("customerId");

-- CreateIndex
CREATE INDEX "product_views_sessionId_idx" ON "product_views"("sessionId");

-- CreateIndex
CREATE INDEX "product_views_viewedAt_idx" ON "product_views"("viewedAt");

-- CreateIndex
CREATE INDEX "product_recommendations_sourceProductId_type_idx" ON "product_recommendations"("sourceProductId", "type");

-- CreateIndex
CREATE INDEX "product_recommendations_score_idx" ON "product_recommendations"("score");

-- CreateIndex
CREATE UNIQUE INDEX "product_recommendations_sourceProductId_targetProductId_type_key" ON "product_recommendations"("sourceProductId", "targetProductId", "type");
