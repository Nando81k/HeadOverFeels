-- AlterTable: add idempotencyKey column to points_transactions
ALTER TABLE "points_transactions" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex: unique constraint so duplicate idempotency keys are rejected
CREATE UNIQUE INDEX "points_transactions_idempotencyKey_key" ON "points_transactions"("idempotencyKey");
