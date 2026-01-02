-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_avatars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "configuration" TEXT NOT NULL,
    "skinTone" TEXT NOT NULL DEFAULT '#FFE0BD',
    "bodyType" TEXT NOT NULL DEFAULT 'default',
    "gender" TEXT NOT NULL DEFAULT 'male',
    "faceFeatures" TEXT NOT NULL DEFAULT '{"eyeShape":"round","noseShape":"medium","mouthShape":"smile","eyebrowShape":"normal"}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_avatars_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_avatars" ("bodyType", "configuration", "createdAt", "customerId", "id", "skinTone", "updatedAt") SELECT "bodyType", "configuration", "createdAt", "customerId", "id", "skinTone", "updatedAt" FROM "user_avatars";
DROP TABLE "user_avatars";
ALTER TABLE "new_user_avatars" RENAME TO "user_avatars";
CREATE UNIQUE INDEX "user_avatars_customerId_key" ON "user_avatars"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
