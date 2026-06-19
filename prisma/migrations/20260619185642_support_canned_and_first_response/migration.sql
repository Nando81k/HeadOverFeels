-- Phase 9: Support rebuild — additive schema changes.

-- 1. New CannedResponse model (table "canned_responses").
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "canned_responses_isActive_idx" ON "canned_responses"("isActive");
CREATE INDEX "canned_responses_category_idx" ON "canned_responses"("category");

-- 2. SupportTicket.firstRespondedAt — set when the first PUBLIC admin message
--    is created for a ticket. Drives avg-first-response KPI + SLA/overdue badges.
ALTER TABLE "support_tickets" ADD COLUMN "firstRespondedAt" TIMESTAMP(3);
CREATE INDEX "support_tickets_firstRespondedAt_idx" ON "support_tickets"("firstRespondedAt");
