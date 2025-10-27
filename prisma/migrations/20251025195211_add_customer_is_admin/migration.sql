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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_customers" ("birthday", "createdAt", "email", "id", "name", "newsletter", "password", "phone", "smsOptIn", "updatedAt") SELECT "birthday", "createdAt", "email", "id", "name", "newsletter", "password", "phone", "smsOptIn", "updatedAt" FROM "customers";
DROP TABLE "customers";
ALTER TABLE "new_customers" RENAME TO "customers";
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
