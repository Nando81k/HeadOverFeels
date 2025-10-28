-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "compareAtPrice" REAL,
    "categoryId" TEXT,
    "images" TEXT NOT NULL,
    "materials" TEXT,
    "careGuide" TEXT,
    "isLimitedEdition" BOOLEAN NOT NULL DEFAULT false,
    "releaseDate" DATETIME,
    "dropEndDate" DATETIME,
    "maxQuantity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isFeaturedNewArrival" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_products" ("careGuide", "categoryId", "compareAtPrice", "createdAt", "description", "dropEndDate", "id", "images", "isActive", "isFeatured", "isLimitedEdition", "materials", "maxQuantity", "name", "price", "releaseDate", "slug", "updatedAt") SELECT "careGuide", "categoryId", "compareAtPrice", "createdAt", "description", "dropEndDate", "id", "images", "isActive", "isFeatured", "isLimitedEdition", "materials", "maxQuantity", "name", "price", "releaseDate", "slug", "updatedAt" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
