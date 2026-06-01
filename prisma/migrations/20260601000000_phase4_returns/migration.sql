-- Phase 4: Returns + Refunds + RMA Counter + SupportTicket backfill
-- Hand-authored to avoid Neon shadow-DB P3006 from `prisma migrate dev`.

-- ─── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE "ReturnStatus"        AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED');
CREATE TYPE "ReturnItemCondition" AS ENUM ('UNOPENED', 'USED', 'DAMAGED');
CREATE TYPE "RefundType"          AS ENUM ('FULL', 'PARTIAL', 'SHIPPING_ONLY');

-- ─── Tables ─────────────────────────────────────────────────────────────────
CREATE TABLE "returns" (
  "id"                   TEXT                NOT NULL,
  "rmaNumber"            TEXT                NOT NULL,
  "orderId"              TEXT                NOT NULL,
  "customerId"           TEXT                NOT NULL,
  "status"               "ReturnStatus"      NOT NULL DEFAULT 'REQUESTED',
  "reason"               TEXT                NOT NULL,
  "internalNotes"        TEXT,
  "returnLabel"          TEXT,
  "returnTrackingNumber" TEXT,
  "receivedAt"           TIMESTAMP(3),
  "windowExpiresAt"      TIMESTAMP(3)        NOT NULL,
  "requestedAt"          TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt"            TIMESTAMP(3),
  "decidedById"          TEXT,
  "supportTicketId"      TEXT,
  "createdAt"            TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)        NOT NULL,
  CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "returns_rmaNumber_key"       ON "returns"("rmaNumber");
CREATE UNIQUE INDEX "returns_supportTicketId_key" ON "returns"("supportTicketId");
CREATE INDEX        "returns_status_requestedAt_idx" ON "returns"("status", "requestedAt");
CREATE INDEX        "returns_orderId_idx"            ON "returns"("orderId");

ALTER TABLE "returns" ADD CONSTRAINT "returns_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "return_items" (
  "id"          TEXT                  NOT NULL,
  "returnId"    TEXT                  NOT NULL,
  "orderItemId" TEXT                  NOT NULL,
  "quantity"    INTEGER               NOT NULL,
  "condition"   "ReturnItemCondition" NOT NULL DEFAULT 'UNOPENED',
  "reason"      TEXT,
  CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "return_items_returnId_idx" ON "return_items"("returnId");

ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey"
  FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "refund_records" (
  "id"             TEXT         NOT NULL,
  "orderId"        TEXT         NOT NULL,
  "returnId"       TEXT,
  "amount"         DOUBLE PRECISION NOT NULL,
  "type"           "RefundType" NOT NULL,
  "reason"         TEXT         NOT NULL,
  "stripeRefundId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById"    TEXT         NOT NULL,
  CONSTRAINT "refund_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "refund_records_orderId_idx" ON "refund_records"("orderId");

ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_returnId_fkey"
  FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "rma_counter" (
  "id"         TEXT    NOT NULL DEFAULT 'singleton',
  "nextNumber" INTEGER NOT NULL DEFAULT 100000,
  CONSTRAINT "rma_counter_pkey" PRIMARY KEY ("id")
);

INSERT INTO "rma_counter" ("id", "nextNumber") VALUES ('singleton', 100000)
  ON CONFLICT ("id") DO NOTHING;
