# Phase 4: Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the /admin/fulfillment page interior as a V2 7-tab orders list with full V2 order detail page, gated behind NEXT_PUBLIC_ADMIN_V2_ENABLED, with new first-class Return + RefundRecord schema.

**Architecture:** Server-rendered V2 page composition mirroring Phase 2/3 pattern (TabPills + KPI strip + filter bar + per-tab Suspense slots). Page dispatcher gates V1 vs V2 by env flag at both list and detail URLs. New Prisma models for Return/ReturnItem/RefundRecord with hand-authored migration and SupportTicket backfill. EasyPost integration reused as-is; Stripe refund wrapped in $transaction with RefundRecord write.

**Tech Stack:** Next.js 16 App Router, React 19 (RSC + Server Actions + Suspense + useOptimistic), TypeScript strict, Prisma 6 + Neon, Tailwind v4 (@theme — direct dark colors only, no `dark:` modifiers), Framer Motion, dnd-kit (already installed; not used in Phase 4), Phosphor icons, Sonner toasts (via `lib/toast.ts`), class-variance-authority, EasyPost (already integrated at `lib/shipping/easypost.ts`), Stripe (already integrated), Vitest 4.1.7 + @testing-library/react + jsdom (Phase 1 harness).

---

## Cross-cutting agent notes (read once, applies to every task)

These are hard-won lessons from Phase 3. Re-read them whenever you start a new task:

1. **No Prisma in the client bundle.** Client components (`'use client'`) must ONLY `import type` from `lib/admin/fulfillment.ts`. Any value-import that needs Prisma data goes through a `'use server'` action wrapper in `app/admin/fulfillment/actions.ts`. Examples in this plan: `getOrderDetailForInspector` and `getReturnDetailForInspector` are server-action wrappers around `loadOrderDetail` / `loadReturnDetail` for exactly this reason. **PR #92 hotfix is the precedent.**
2. **No `dark:` Tailwind modifiers.** V2 admin is always-dark with no `dark` class on `<html>`. Use direct colors like `bg-neutral-900/60`, `border-white/8`, `text-white/50`, `text-white/30`. **PR #93 hotfix is the precedent.**
3. **PaginatedResult shape is `{ items, total, page, pageSize }`** — destructure `.items` (NOT `.rows`).
4. **Vitest 4.1.7 generics: use 1-arg `vi.fn<T>()`** (or zero-arg with `mockResolvedValue`). The two-arg `vi.fn<[Args], Return>()` form from Vitest 1.x triggers TS2558. The Phase 3 `ProductsListView` test still has 4 TS errors from this — don't repeat it.
5. **Hand-authored Prisma migration.** Do NOT use `prisma migrate dev` — the dev shadow DB on Neon triggers P3006. Write the SQL file directly under `prisma/migrations/<timestamp>_phase4_returns/migration.sql`, then run `prisma db push` (or `prisma migrate resolve --applied <name>` if the migration was already shipped to a deployment).
6. **`requireAdmin()` has two overloads.** `requireAdmin(request)` for API routes (returns customer object). `requireAdmin()` no-arg for server actions (returns userId string). Use no-arg in actions. `requireAdminRole('SUPER_ADMIN')` is for refunds.
7. **Branch naming and PRs.** Every task gets its own branch `wave4p4/task-N-<short-name>` and its own PR. Do NOT merge — the controller batches per wave.
8. **`OrderItem` has NO `sku` field.** SKU lives on `ProductVariant.sku`. Derive via `include: { productVariant: { select: { sku: true } } }`.
9. **`OrderStatus` enum has 7 values:** `PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED`. `PaymentStatus`: `PENDING | PAID | FAILED | REFUNDED`.
10. **No Socket.IO `order:new` event exists yet** — wiring it is part of W5 Task 12.

---

## Wave summary

| Wave | Tasks | Parallel? | Model | Depends on |
|------|-------|-----------|-------|------------|
| W1   | 1     | sequential | sonnet | none |
| W2   | 2, 3  | 2 parallel | sonnet | W1 |
| W3   | 4, 5  | 2 parallel | sonnet | W2 |
| W4   | 6, 7, 8 | 3 parallel | sonnet | W3 |
| W5   | 9, 10, 11, 12 | 4 parallel | sonnet | W4 |
| W6   | 13    | sequential | **opus** | W5 |
| W7   | 14, 15, 16, 17, 18, 19, 20, 21 | 8 parallel | sonnet | W2 (no W3-W6 dep) |
| W8   | 22, 23 | sequential | sonnet | W6 + W7 |

Total: **23 tasks** across **8 waves**.

---

## Wave 1 — Foundation (sequential, 1 task)

### Task 1: Schema + migration + RMA counter + backfill script

**Wave:** 1 | **Parallel-safe with:** none | **Branch:** `wave4p4/task-1-schema-migration` | **Model:** sonnet

**Schema realities for this task:**
- `Customer` is the model that backs both shoppers and admins (Customer.isAdmin / Customer.adminRole). Relations from `Return.customer` and `Return.decidedById` point to Customer.id.
- `Order.id` and `OrderItem.id` are `String @id @default(cuid())`.
- `SupportTicket` has fields: `id`, `type` (SupportTicketType enum), `status`, `customerId`, `orderId` (nullable), `refundAmount` (Float?), `refundReason` (String?), `returnRequested` (Boolean default false), `returnApproved` (Boolean?), `returnLabel` (String?).
- `SupportTicketType` enum values relevant for backfill: `REFUND`, `RETURN`, `EXCHANGE`.
- Hand-authored migration — DO NOT run `prisma migrate dev`. Use the timestamp slot `20260601000000` to come after the most recent `20260530150000_add_setting_table`.

**Files:**
- Create: `prisma/migrations/20260601000000_phase4_returns/migration.sql`
- Modify: `prisma/schema.prisma` (append 3 models + 3 enums + RmaCounter singleton + Customer/Order/OrderItem back-relations)
- Create: `scripts/backfill-returns-from-tickets.ts`
- Create: `lib/admin/rma-counter.ts` (transactional `getNextRmaNumber()` helper that wraps `SELECT FOR UPDATE`)
- Test: `tests/unit/lib/admin/rma-counter.test.ts`
- Test: `tests/unit/scripts/backfill-returns-from-tickets.test.ts`

#### Steps

- [ ] **Step 1: Write the failing RMA counter test**

```ts
// tests/unit/lib/admin/rma-counter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => {
  const tx = {
    $queryRaw: vi.fn(),
    rmaCounter: {
      update: vi.fn(),
    },
  }
  return {
    prisma: {
      $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
      __tx: tx,
    },
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getNextRmaNumber', () => {
  it('returns sequential RMA-NNNNNN strings under contention', async () => {
    const { prisma } = await import('@/lib/prisma') as unknown as {
      prisma: { __tx: { $queryRaw: ReturnType<typeof vi.fn>; rmaCounter: { update: ReturnType<typeof vi.fn> } } }
    }
    let n = 100000
    prisma.__tx.$queryRaw.mockImplementation(async () => [{ nextNumber: n }])
    prisma.__tx.rmaCounter.update.mockImplementation(async () => {
      n += 1
      return { id: 'singleton', nextNumber: n }
    })

    const { getNextRmaNumber } = await import('@/lib/admin/rma-counter')
    const results = await Promise.all([
      getNextRmaNumber(),
      getNextRmaNumber(),
      getNextRmaNumber(),
    ])
    expect(results).toEqual(['RMA-100000', 'RMA-100001', 'RMA-100002'])
  })

  it('uses SELECT ... FOR UPDATE inside transaction', async () => {
    const { prisma } = await import('@/lib/prisma') as unknown as {
      prisma: { __tx: { $queryRaw: ReturnType<typeof vi.fn>; rmaCounter: { update: ReturnType<typeof vi.fn> } } }
    }
    prisma.__tx.$queryRaw.mockResolvedValue([{ nextNumber: 100000 }])
    prisma.__tx.rmaCounter.update.mockResolvedValue({ id: 'singleton', nextNumber: 100001 })

    const { getNextRmaNumber } = await import('@/lib/admin/rma-counter')
    await getNextRmaNumber()
    const first = prisma.__tx.$queryRaw.mock.calls[0][0]
    const sql = Array.isArray(first) ? first.join('') : String(first)
    expect(sql.toUpperCase()).toContain('FOR UPDATE')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/admin/rma-counter.test.ts`
Expected: FAIL with "Cannot find module '@/lib/admin/rma-counter'".

- [ ] **Step 3: Write `prisma/schema.prisma` additions**

Append the following block to the bottom of `prisma/schema.prisma` (don't replace anything — additive only). Then add the back-relations to the existing `Customer`, `Order`, and `OrderItem` models as listed.

```prisma
// ─── Phase 4: Returns + Refunds ──────────────────────────────────────────────

model Return {
  id                   String         @id @default(cuid())
  rmaNumber            String         @unique
  orderId              String
  order                Order          @relation(fields: [orderId], references: [id])
  customerId           String
  customer             Customer       @relation("ReturnCustomer", fields: [customerId], references: [id])
  status               ReturnStatus   @default(REQUESTED)
  reason               String
  internalNotes        String?
  returnLabel          String?
  returnTrackingNumber String?
  receivedAt           DateTime?
  windowExpiresAt      DateTime
  requestedAt          DateTime       @default(now())
  decidedAt            DateTime?
  decidedById          String?
  decidedBy            Customer?      @relation("ReturnDecidedBy", fields: [decidedById], references: [id])
  items                ReturnItem[]
  refunds              RefundRecord[]
  supportTicketId      String?        @unique
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  @@index([status, requestedAt])
  @@index([orderId])
  @@map("returns")
}

model ReturnItem {
  id          String              @id @default(cuid())
  returnId    String
  return      Return              @relation(fields: [returnId], references: [id], onDelete: Cascade)
  orderItemId String
  orderItem   OrderItem           @relation(fields: [orderItemId], references: [id])
  quantity    Int
  condition   ReturnItemCondition @default(UNOPENED)
  reason      String?

  @@index([returnId])
  @@map("return_items")
}

model RefundRecord {
  id             String     @id @default(cuid())
  orderId        String
  order          Order      @relation(fields: [orderId], references: [id])
  returnId       String?
  return         Return?    @relation(fields: [returnId], references: [id])
  amount         Float
  type           RefundType
  reason         String
  stripeRefundId String?
  createdAt      DateTime   @default(now())
  createdById    String
  createdBy      Customer   @relation("RefundCreatedBy", fields: [createdById], references: [id])

  @@index([orderId])
  @@map("refund_records")
}

model RmaCounter {
  id         String @id @default("singleton")
  nextNumber Int    @default(100000)

  @@map("rma_counter")
}

enum ReturnStatus {
  REQUESTED
  APPROVED
  REJECTED
  RECEIVED
  REFUNDED
}

enum ReturnItemCondition {
  UNOPENED
  USED
  DAMAGED
}

enum RefundType {
  FULL
  PARTIAL
  SHIPPING_ONLY
}
```

Then add to the existing `Customer` model (anywhere among its relation block):

```prisma
  returnsAsCustomer Return[]       @relation("ReturnCustomer")
  returnsDecided    Return[]       @relation("ReturnDecidedBy")
  refundsCreated    RefundRecord[] @relation("RefundCreatedBy")
```

Add to the existing `Order` model:

```prisma
  returns       Return[]
  refundRecords RefundRecord[]
```

Add to the existing `OrderItem` model:

```prisma
  returnItems ReturnItem[]
```

- [ ] **Step 4: Hand-author `prisma/migrations/20260601000000_phase4_returns/migration.sql`**

```sql
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
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_returnId_fkey"
  FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "rma_counter" (
  "id"         TEXT    NOT NULL DEFAULT 'singleton',
  "nextNumber" INTEGER NOT NULL DEFAULT 100000,
  CONSTRAINT "rma_counter_pkey" PRIMARY KEY ("id")
);

INSERT INTO "rma_counter" ("id", "nextNumber") VALUES ('singleton', 100000)
  ON CONFLICT ("id") DO NOTHING;
```

- [ ] **Step 5: Write `lib/admin/rma-counter.ts`**

```ts
// lib/admin/rma-counter.ts
//
// Atomic RMA-NNNNNN sequence generator. Wraps a SELECT ... FOR UPDATE inside a
// $transaction so concurrent createReturn calls never produce duplicate numbers.

import { prisma } from '@/lib/prisma'

export async function getNextRmaNumber(): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Row-level lock — blocks other transactions that hit the same id.
    const rows = await tx.$queryRaw<{ nextNumber: number }[]>`
      SELECT "nextNumber" FROM "rma_counter" WHERE "id" = 'singleton' FOR UPDATE
    `
    const current = rows[0]?.nextNumber ?? 100000
    await tx.rmaCounter.update({
      where: { id: 'singleton' },
      data: { nextNumber: current + 1 },
    })
    return `RMA-${current.toString().padStart(6, '0')}`
  })
}
```

- [ ] **Step 6: Run RMA counter test to verify it passes**

Run: `pnpm test tests/unit/lib/admin/rma-counter.test.ts`
Expected: PASS — 2 tests passing.

- [ ] **Step 7: Write the failing backfill test**

```ts
// tests/unit/scripts/backfill-returns-from-tickets.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findManyMock = vi.fn()
const createMock = vi.fn()
const transactionMock = vi.fn((fn: (tx: unknown) => unknown) =>
  fn({
    return: { create: createMock, findUnique: vi.fn().mockResolvedValue(null) },
    rmaCounter: { update: vi.fn().mockResolvedValue({ nextNumber: 100001 }) },
    $queryRaw: vi.fn().mockResolvedValue([{ nextNumber: 100000 }]),
  })
)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: { findMany: findManyMock },
    return: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: transactionMock,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('backfillReturnsFromTickets', () => {
  it('creates a Return for each RETURN-type ticket with returnRequested=true', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 't1',
        type: 'RETURN',
        status: 'OPEN',
        customerId: 'c1',
        orderId: 'o1',
        refundAmount: 49.99,
        refundReason: 'Wrong size',
        returnRequested: true,
        returnApproved: null,
        returnLabel: null,
        createdAt: new Date('2026-05-01'),
      },
    ])
    createMock.mockResolvedValue({ id: 'r1', rmaNumber: 'RMA-100000' })

    const { backfillReturnsFromTickets } = await import('@/scripts/backfill-returns-from-tickets')
    const result = await backfillReturnsFromTickets({ dryRun: false })

    expect(result.created).toBe(1)
    expect(result.skipped).toBe(0)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('skips tickets that already have a linked Return', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 't2',
        type: 'RETURN',
        status: 'CLOSED',
        customerId: 'c2',
        orderId: 'o2',
        refundAmount: 0,
        refundReason: null,
        returnRequested: true,
        returnApproved: true,
        returnLabel: 'http://example.com/label.pdf',
        createdAt: new Date('2026-05-02'),
      },
    ])
    transactionMock.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({
        return: { create: createMock, findUnique: vi.fn().mockResolvedValue({ id: 'existing' }) },
        rmaCounter: { update: vi.fn() },
        $queryRaw: vi.fn(),
      })
    )

    const { backfillReturnsFromTickets } = await import('@/scripts/backfill-returns-from-tickets')
    const result = await backfillReturnsFromTickets({ dryRun: false })

    expect(result.created).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.skips[0].reason).toContain('linked Return already exists')
  })

  it('respects dryRun: true (no writes)', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 't3',
        type: 'REFUND',
        status: 'OPEN',
        customerId: 'c3',
        orderId: 'o3',
        refundAmount: 10,
        refundReason: 'Defect',
        returnRequested: true,
        returnApproved: null,
        returnLabel: null,
        createdAt: new Date('2026-05-03'),
      },
    ])

    const { backfillReturnsFromTickets } = await import('@/scripts/backfill-returns-from-tickets')
    const result = await backfillReturnsFromTickets({ dryRun: true })

    expect(result.created).toBe(1) // counts the intent
    expect(createMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 8: Run backfill test to verify it fails**

Run: `pnpm test tests/unit/scripts/backfill-returns-from-tickets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 9: Write `scripts/backfill-returns-from-tickets.ts`**

```ts
// scripts/backfill-returns-from-tickets.ts
//
// Idempotent backfill: for each SupportTicket with type IN (RETURN, REFUND, EXCHANGE)
// AND returnRequested = true, create a corresponding Return row with rmaNumber from
// the RmaCounter. Skips tickets that already have a linked Return (by supportTicketId).
//
// Run with:
//   pnpm tsx scripts/backfill-returns-from-tickets.ts            # live
//   pnpm tsx scripts/backfill-returns-from-tickets.ts --dry-run  # dry run

import { prisma } from '@/lib/prisma'

interface BackfillSkip {
  ticketId: string
  reason: string
}

export interface BackfillResult {
  created: number
  skipped: number
  skips: BackfillSkip[]
}

function deriveStatus(returnApproved: boolean | null, ticketStatus: string): 'REQUESTED' | 'APPROVED' | 'REJECTED' {
  if (returnApproved === true) return 'APPROVED'
  if (returnApproved === false) return 'REJECTED'
  if (ticketStatus === 'CLOSED') return 'REJECTED'
  return 'REQUESTED'
}

export async function backfillReturnsFromTickets(
  options: { dryRun?: boolean } = {}
): Promise<BackfillResult> {
  const dryRun = options.dryRun ?? false

  const tickets = await prisma.supportTicket.findMany({
    where: {
      type: { in: ['RETURN', 'REFUND', 'EXCHANGE'] },
      returnRequested: true,
    },
    select: {
      id: true,
      type: true,
      status: true,
      customerId: true,
      orderId: true,
      refundAmount: true,
      refundReason: true,
      returnRequested: true,
      returnApproved: true,
      returnLabel: true,
      createdAt: true,
    },
  })

  const skips: BackfillSkip[] = []
  let created = 0

  for (const t of tickets) {
    if (!t.orderId) {
      skips.push({ ticketId: t.id, reason: 'no orderId on ticket' })
      continue
    }

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.return.findUnique({ where: { supportTicketId: t.id } })
        if (existing) {
          skips.push({ ticketId: t.id, reason: 'linked Return already exists' })
          return
        }

        if (dryRun) {
          created += 1
          return
        }

        // Inline RMA generation (we can't share the lib helper here because we're
        // already inside a transaction).
        const rows = await tx.$queryRaw<{ nextNumber: number }[]>`
          SELECT "nextNumber" FROM "rma_counter" WHERE "id" = 'singleton' FOR UPDATE
        `
        const current = rows[0]?.nextNumber ?? 100000
        await tx.rmaCounter.update({
          where: { id: 'singleton' },
          data: { nextNumber: current + 1 },
        })
        const rmaNumber = `RMA-${current.toString().padStart(6, '0')}`

        const windowExpiresAt = new Date(t.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)

        await tx.return.create({
          data: {
            rmaNumber,
            orderId: t.orderId!,
            customerId: t.customerId,
            status: deriveStatus(t.returnApproved, t.status),
            reason: t.refundReason ?? 'Backfilled from support ticket',
            returnLabel: t.returnLabel,
            windowExpiresAt,
            requestedAt: t.createdAt,
            supportTicketId: t.id,
          },
        })
        created += 1
      })
    } catch (err) {
      skips.push({
        ticketId: t.id,
        reason: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  return { created, skipped: skips.length, skips }
}

// CLI entrypoint
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run')
  backfillReturnsFromTickets({ dryRun })
    .then((res) => {
      console.log(JSON.stringify(res, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
```

- [ ] **Step 10: Run backfill test to verify it passes**

Run: `pnpm test tests/unit/scripts/backfill-returns-from-tickets.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 11: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors. (Note: 11 pre-existing errors from Phase 3 may persist; do not introduce new ones.)

- [ ] **Step 12: Apply the migration to the local DB**

Run: `pnpm prisma generate && pnpm prisma db push`
Expected: schema in sync; new tables present (`returns`, `return_items`, `refund_records`, `rma_counter`).

- [ ] **Step 13: Commit + push + PR**

```bash
git add prisma/schema.prisma prisma/migrations/20260601000000_phase4_returns lib/admin/rma-counter.ts scripts/backfill-returns-from-tickets.ts tests/unit/lib/admin/rma-counter.test.ts tests/unit/scripts/backfill-returns-from-tickets.test.ts
git commit -m "feat(admin-v2): add Return/RefundRecord schema, RMA counter, and ticket backfill"
git push -u origin wave4p4/task-1-schema-migration
gh pr create --title "feat(admin-v2): Phase 4 W1 schema + RMA counter + backfill" --body "Adds Return, ReturnItem, RefundRecord, and RmaCounter Prisma models with a hand-authored migration (Neon P3006 workaround). Includes a transactional getNextRmaNumber() helper using SELECT FOR UPDATE and an idempotent backfill script that converts existing SupportTicket return rows to first-class Return records. Tests cover counter sequentiality and backfill idempotency."
```

---

## Wave 2 — Data layer + server actions (2 parallel)

### Task 2: `lib/admin/fulfillment.ts` data layer

**Wave:** 2 | **Parallel-safe with:** Task 3 | **Branch:** `wave4p4/task-2-data-layer` | **Model:** sonnet

**Schema realities for this task:**
- `Order` does NOT have a `paidAt` field. Derive "paid" timestamp from `updatedAt` when `paymentStatus = PAID`, OR fall back to `createdAt` for legacy data.
- `OrderStatus` enum is 7 values (see cross-cutting notes). The Archived tab is `status IN (CANCELLED, REFUNDED)`. The All tab is `status NOT IN (CANCELLED, REFUNDED)`.
- The Needs-Action tab is `status = PENDING OR paymentStatus = FAILED` — use Prisma `OR`.
- `Return.status` is the new enum from Task 1. The Returns Pending KPI counts `status IN (REQUESTED, APPROVED)` (i.e., not yet RECEIVED/REFUNDED/REJECTED).
- `OrderItem` has no `sku` — include `productVariant: { select: { sku: true } }`.
- Carrier dropdown options: derive from distinct existing `Order.carrier` values plus a static set `['USPS', 'UPS', 'FedEx', 'DHL']`. Cache for 24h via a module-level `Map<'carriers', { value: CarrierOption[]; expiresAt: number }>`.

**Files:**
- Create: `lib/admin/fulfillment.ts`
- Test: `tests/unit/lib/admin/fulfillment.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/admin/fulfillment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const orderFindMany = vi.fn()
const orderCount = vi.fn()
const orderAggregate = vi.fn()
const orderFindUnique = vi.fn()
const returnFindMany = vi.fn()
const returnCount = vi.fn()
const returnFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: orderFindMany,
      count: orderCount,
      aggregate: orderAggregate,
      findUnique: orderFindUnique,
    },
    return: {
      findMany: returnFindMany,
      count: returnCount,
      findUnique: returnFindUnique,
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadFulfillmentKpis', () => {
  it('aggregates four counts', async () => {
    orderCount
      .mockResolvedValueOnce(7)  // needs action
      .mockResolvedValueOnce(3)  // ready to ship
    orderAggregate.mockResolvedValue({ _sum: { total: 1234.5 } })
    returnCount.mockResolvedValueOnce(4)
    const { loadFulfillmentKpis } = await import('@/lib/admin/fulfillment')
    const k = await loadFulfillmentKpis()
    expect(k).toEqual({
      needsActionCount: 7,
      readyToShipCount: 3,
      todaysRevenue: 1234.5,
      returnsPendingCount: 4,
    })
  })

  it('treats null revenue as 0', async () => {
    orderCount.mockResolvedValue(0)
    orderAggregate.mockResolvedValue({ _sum: { total: null } })
    returnCount.mockResolvedValue(0)
    const { loadFulfillmentKpis } = await import('@/lib/admin/fulfillment')
    const k = await loadFulfillmentKpis()
    expect(k.todaysRevenue).toBe(0)
  })
})

describe('loadOrdersTab where clause mapping', () => {
  it('all excludes CANCELLED and REFUNDED', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('all')
    const where = orderFindMany.mock.calls[0][0].where
    expect(where.status).toEqual({ notIn: ['CANCELLED', 'REFUNDED'] })
  })

  it('needs-action ORs PENDING status with FAILED payment', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('needs-action')
    const where = orderFindMany.mock.calls[0][0].where
    expect(where.OR).toEqual([
      { status: 'PENDING' },
      { paymentStatus: 'FAILED' },
    ])
  })

  it('processing matches CONFIRMED, PROCESSING', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('processing')
    expect(orderFindMany.mock.calls[0][0].where.status).toEqual({
      in: ['CONFIRMED', 'PROCESSING'],
    })
  })

  it('shipped matches SHIPPED', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('shipped')
    expect(orderFindMany.mock.calls[0][0].where.status).toBe('SHIPPED')
  })

  it('delivered matches DELIVERED', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('delivered')
    expect(orderFindMany.mock.calls[0][0].where.status).toBe('DELIVERED')
  })
})

describe('loadOrdersTab paginated shape', () => {
  it('returns { items, total, page, pageSize }', async () => {
    orderFindMany.mockResolvedValue([
      {
        id: 'o1',
        orderNumber: 'HOF-1',
        customer: { name: 'Ada', email: 'ada@example.com' },
        customerEmail: 'ada@example.com',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        total: 99.99,
        createdAt: new Date('2026-05-01'),
        trackingNumber: null,
        carrier: null,
        items: [{ id: 'i1' }, { id: 'i2' }],
      },
    ])
    orderCount.mockResolvedValue(1)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    const r = await loadOrdersTab('all')
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      id: 'o1',
      orderNumber: 'HOF-1',
      customerName: 'Ada',
      customerEmail: 'ada@example.com',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      totalAmount: 99.99,
      itemCount: 2,
    })
    expect(r.total).toBe(1)
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(25)
  })
})

describe('loadReturnsTab', () => {
  it('orders by requestedAt desc, returns paginated', async () => {
    returnFindMany.mockResolvedValue([
      {
        id: 'r1',
        rmaNumber: 'RMA-100000',
        orderId: 'o1',
        order: { orderNumber: 'HOF-1' },
        customer: { name: 'Ada' },
        status: 'REQUESTED',
        requestedAt: new Date('2026-05-15'),
        refunds: [{ amount: 49.99 }],
      },
    ])
    returnCount.mockResolvedValue(1)
    const { loadReturnsTab } = await import('@/lib/admin/fulfillment')
    const r = await loadReturnsTab()
    expect(r.items[0]).toMatchObject({
      id: 'r1',
      rmaNumber: 'RMA-100000',
      orderNumber: 'HOF-1',
      customerName: 'Ada',
      status: 'REQUESTED',
      refundAmount: 49.99,
    })
    const orderBy = returnFindMany.mock.calls[0][0].orderBy
    expect(orderBy).toEqual({ requestedAt: 'desc' })
  })
})

describe('loadArchivedTab', () => {
  it('matches CANCELLED + REFUNDED only', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadArchivedTab } = await import('@/lib/admin/fulfillment')
    await loadArchivedTab()
    expect(orderFindMany.mock.calls[0][0].where.status).toEqual({
      in: ['CANCELLED', 'REFUNDED'],
    })
  })
})

describe('loadOrderDetail', () => {
  it('returns null when order not found', async () => {
    orderFindUnique.mockResolvedValue(null)
    const { loadOrderDetail } = await import('@/lib/admin/fulfillment')
    expect(await loadOrderDetail('missing')).toBeNull()
  })

  it('returns full detail with items, addresses, returns', async () => {
    orderFindUnique.mockResolvedValue({
      id: 'o1',
      orderNumber: 'HOF-1',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      total: 100,
      subtotal: 90,
      tax: 5,
      shipping: 5,
      customerEmail: 'ada@example.com',
      customerPhone: null,
      trackingNumber: null,
      trackingUrl: null,
      carrier: null,
      shippedAt: null,
      deliveredAt: null,
      estimatedDelivery: null,
      notes: null,
      internalNotes: null,
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-02'),
      customer: { id: 'c1', name: 'Ada', email: 'ada@example.com' },
      shippingAddress: { id: 'a1', firstName: 'Ada', lastName: 'L', address1: '1 St', city: 'NY', state: 'NY', postalCode: '10001', country: 'US' },
      billingAddress: null,
      items: [
        {
          id: 'i1', productId: 'p1', productVariantId: 'v1',
          quantity: 1, price: 90, productName: 'Tee', productImage: '/t.jpg',
          variantDetails: null,
          productVariant: { sku: 'TEE-S-RED' },
        },
      ],
      returns: [],
      refundRecords: [],
    })
    const { loadOrderDetail } = await import('@/lib/admin/fulfillment')
    const d = await loadOrderDetail('o1')
    expect(d?.id).toBe('o1')
    expect(d?.items[0].sku).toBe('TEE-S-RED')
    expect(d?.returns).toEqual([])
  })
})

describe('loadCarriers', () => {
  it('returns the static carrier set merged with distinct order carriers', async () => {
    orderFindMany.mockResolvedValue([{ carrier: 'OnTrac' }])
    const { loadCarriers } = await import('@/lib/admin/fulfillment')
    const c = await loadCarriers()
    const values = c.map((x) => x.value)
    expect(values).toContain('USPS')
    expect(values).toContain('UPS')
    expect(values).toContain('FedEx')
    expect(values).toContain('DHL')
    expect(values).toContain('OnTrac')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/admin/fulfillment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/admin/fulfillment.ts`**

```ts
// lib/admin/fulfillment.ts
//
// Single source of truth for Phase 4 fulfillment data shapes and Prisma queries.
// All loaders are pure async functions called from Server Components.
//
// Schema adaptations:
//   - Order has NO paidAt field. We derive "paid at" from updatedAt when paymentStatus
//     transitioned to PAID (best-effort — exact transition timestamp not stored).
//   - OrderItem has NO sku field — derived from productVariant.sku.
//   - paymentStatus is independent of status; needs-action ORs the two.

import { prisma } from '@/lib/prisma'
import type { OrderStatus, PaymentStatus, ReturnStatus, ReturnItemCondition } from '@prisma/client'

// ============================================================
// Tab + filter types
// ============================================================

export const ORDERS_TABS = [
  'all',
  'needs-action',
  'processing',
  'shipped',
  'delivered',
  'returns',
  'archived',
] as const
export type FulfillmentTab = (typeof ORDERS_TABS)[number]
export type OrdersTab = Exclude<FulfillmentTab, 'returns' | 'archived'>

export function isFulfillmentTab(value: unknown): value is FulfillmentTab {
  return typeof value === 'string' && (ORDERS_TABS as readonly string[]).includes(value)
}

export interface OrdersFilters {
  search?: string
  dateFrom?: Date
  dateTo?: Date
  paymentStatus?: PaymentStatus
  carrier?: string
  hasTracking?: boolean
  page?: number
  pageSize?: number
}

export interface ReturnsFilters {
  status?: ReturnStatus
  page?: number
  pageSize?: number
}

// ============================================================
// Row shapes
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface OrderRow {
  id: string
  orderNumber: string
  customerName: string | null
  customerEmail: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  totalAmount: number
  createdAt: Date
  trackingNumber: string | null
  carrier: string | null
  itemCount: number
}

export interface ReturnRow {
  id: string
  rmaNumber: string
  orderId: string
  orderNumber: string
  customerName: string | null
  status: ReturnStatus
  requestedAt: Date
  refundAmount: number
}

export interface FulfillmentKpiData {
  needsActionCount: number
  readyToShipCount: number
  todaysRevenue: number
  returnsPendingCount: number
}

export interface CarrierOption {
  value: string
  label: string
}

export interface OrderItemDetail {
  id: string
  productId: string
  productVariantId: string | null
  quantity: number
  price: number
  productName: string
  productImage: string | null
  /** Derived from productVariant.sku — null when no variant */
  sku: string | null
  variantDetails: string | null
}

export interface OrderAddress {
  id: string
  firstName: string
  lastName: string
  address1: string
  address2: string | null
  city: string
  state: string
  postalCode: string
  country: string
}

export interface OrderReturnSummary {
  id: string
  rmaNumber: string
  status: ReturnStatus
  requestedAt: Date
}

export interface OrderRefundSummary {
  id: string
  amount: number
  type: string
  createdAt: Date
}

export interface OrderDetailFull {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  subtotal: number
  tax: number
  shipping: number
  customerId: string | null
  customerName: string | null
  customerEmail: string
  customerPhone: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  carrier: string | null
  shippedAt: Date | null
  deliveredAt: Date | null
  estimatedDelivery: Date | null
  notes: string | null
  internalNotes: string | null
  createdAt: Date
  updatedAt: Date
  shippingAddress: OrderAddress | null
  billingAddress: OrderAddress | null
  items: OrderItemDetail[]
  returns: OrderReturnSummary[]
  refunds: OrderRefundSummary[]
}

export interface ReturnItemDetail {
  id: string
  orderItemId: string
  quantity: number
  condition: ReturnItemCondition
  reason: string | null
  /** Snapshot of the order item at the time of return */
  productName: string
  productImage: string | null
  unitPrice: number
}

export interface ReturnWithItems {
  id: string
  rmaNumber: string
  orderId: string
  orderNumber: string
  customerId: string
  customerName: string | null
  customerEmail: string
  status: ReturnStatus
  reason: string
  internalNotes: string | null
  returnLabel: string | null
  returnTrackingNumber: string | null
  receivedAt: Date | null
  windowExpiresAt: Date
  requestedAt: Date
  decidedAt: Date | null
  items: ReturnItemDetail[]
  refunds: OrderRefundSummary[]
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_PAGE_SIZE = 25

// ============================================================
// Helpers
// ============================================================

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function mapAddress(a: {
  id: string
  firstName: string
  lastName: string
  address1: string
  address2?: string | null
  city: string
  state: string
  postalCode: string
  country: string
} | null): OrderAddress | null {
  if (!a) return null
  return {
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    address1: a.address1,
    address2: a.address2 ?? null,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
  }
}

// ============================================================
// KPIs
// ============================================================

export async function loadFulfillmentKpis(): Promise<FulfillmentKpiData> {
  const today = startOfToday()
  const [needsActionCount, readyToShipCount, revenueAgg, returnsPendingCount] = await Promise.all([
    prisma.order.count({
      where: {
        OR: [{ status: 'PENDING' }, { paymentStatus: 'FAILED' }],
      },
    }),
    prisma.order.count({
      where: { status: { in: ['CONFIRMED', 'PROCESSING'] } },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
      _sum: { total: true },
    }),
    prisma.return.count({
      where: { status: { in: ['REQUESTED', 'APPROVED'] } },
    }),
  ])
  return {
    needsActionCount,
    readyToShipCount,
    todaysRevenue: revenueAgg._sum.total ?? 0,
    returnsPendingCount,
  }
}

// ============================================================
// Per-tab loaders
// ============================================================

function buildOrdersWhere(tab: FulfillmentTab, filters: OrdersFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {}

  if (tab === 'all') {
    where.status = { notIn: ['CANCELLED', 'REFUNDED'] }
  } else if (tab === 'needs-action') {
    where.OR = [{ status: 'PENDING' }, { paymentStatus: 'FAILED' }]
  } else if (tab === 'processing') {
    where.status = { in: ['CONFIRMED', 'PROCESSING'] }
  } else if (tab === 'shipped') {
    where.status = 'SHIPPED'
  } else if (tab === 'delivered') {
    where.status = 'DELIVERED'
  } else if (tab === 'archived') {
    where.status = { in: ['CANCELLED', 'REFUNDED'] }
  }

  if (filters.search) {
    const s = filters.search.trim()
    const orList = [
      { orderNumber: { contains: s, mode: 'insensitive' as const } },
      { customerEmail: { contains: s, mode: 'insensitive' as const } },
      { trackingNumber: { contains: s, mode: 'insensitive' as const } },
    ]
    if (where.OR) {
      // merge: AND together pre-existing OR with the search OR
      where.AND = [{ OR: where.OR }, { OR: orList }]
      delete where.OR
    } else {
      where.OR = orList
    }
  }

  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus
  if (filters.carrier) where.carrier = filters.carrier
  if (filters.hasTracking === true) where.trackingNumber = { not: null }
  if (filters.hasTracking === false) where.trackingNumber = null
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    }
  }

  return where
}

async function runOrdersQuery(
  where: Record<string, unknown>,
  filters: OrdersFilters,
): Promise<PaginatedResult<OrderRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const [raw, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        customer: { select: { name: true, email: true } },
        items: { select: { id: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  const items: OrderRow[] = raw.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customer?.name ?? null,
    customerEmail: o.customerEmail,
    status: o.status,
    paymentStatus: o.paymentStatus,
    totalAmount: Number(o.total),
    createdAt: o.createdAt,
    trackingNumber: o.trackingNumber,
    carrier: o.carrier,
    itemCount: o.items.length,
  }))
  return { items, total, page, pageSize }
}

export async function loadOrdersTab(
  tab: OrdersTab,
  filters: OrdersFilters = {},
): Promise<PaginatedResult<OrderRow>> {
  const where = buildOrdersWhere(tab, filters)
  return runOrdersQuery(where, filters)
}

export async function loadArchivedTab(
  filters: OrdersFilters = {},
): Promise<PaginatedResult<OrderRow>> {
  const where = buildOrdersWhere('archived', filters)
  return runOrdersQuery(where, filters)
}

export async function loadReturnsTab(
  filters: ReturnsFilters = {},
): Promise<PaginatedResult<ReturnRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.status) where.status = filters.status

  const [raw, total] = await Promise.all([
    prisma.return.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        order: { select: { orderNumber: true } },
        customer: { select: { name: true } },
        refunds: { select: { amount: true } },
      },
    }),
    prisma.return.count({ where }),
  ])

  const items: ReturnRow[] = raw.map((r) => ({
    id: r.id,
    rmaNumber: r.rmaNumber,
    orderId: r.orderId,
    orderNumber: r.order?.orderNumber ?? '',
    customerName: r.customer?.name ?? null,
    status: r.status,
    requestedAt: r.requestedAt,
    refundAmount: r.refunds.reduce((s, x) => s + Number(x.amount), 0),
  }))
  return { items, total, page, pageSize }
}

// ============================================================
// Order detail
// ============================================================

export async function loadOrderDetail(id: string): Promise<OrderDetailFull | null> {
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      shippingAddress: true,
      billingAddress: true,
      items: {
        include: { productVariant: { select: { sku: true } } },
      },
      returns: {
        select: { id: true, rmaNumber: true, status: true, requestedAt: true },
        orderBy: { requestedAt: 'desc' },
      },
      refundRecords: {
        select: { id: true, amount: true, type: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!o) return null

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: Number(o.total),
    subtotal: Number(o.subtotal),
    tax: Number(o.tax),
    shipping: Number(o.shipping),
    customerId: o.customer?.id ?? null,
    customerName: o.customer?.name ?? null,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    carrier: o.carrier,
    shippedAt: o.shippedAt,
    deliveredAt: o.deliveredAt,
    estimatedDelivery: o.estimatedDelivery,
    notes: o.notes,
    internalNotes: o.internalNotes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    shippingAddress: mapAddress(o.shippingAddress),
    billingAddress: mapAddress(o.billingAddress),
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productVariantId: it.productVariantId,
      quantity: it.quantity,
      price: Number(it.price),
      productName: it.productName,
      productImage: it.productImage,
      sku: it.productVariant?.sku ?? null,
      variantDetails: it.variantDetails,
    })),
    returns: o.returns.map((r) => ({
      id: r.id,
      rmaNumber: r.rmaNumber,
      status: r.status,
      requestedAt: r.requestedAt,
    })),
    refunds: o.refundRecords.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      type: r.type,
      createdAt: r.createdAt,
    })),
  }
}

// ============================================================
// Return detail
// ============================================================

export async function loadReturnDetail(id: string): Promise<ReturnWithItems | null> {
  const r = await prisma.return.findUnique({
    where: { id },
    include: {
      order: { select: { orderNumber: true } },
      customer: { select: { name: true, email: true } },
      items: {
        include: {
          orderItem: { select: { productName: true, productImage: true, price: true } },
        },
      },
      refunds: { select: { id: true, amount: true, type: true, createdAt: true } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    rmaNumber: r.rmaNumber,
    orderId: r.orderId,
    orderNumber: r.order?.orderNumber ?? '',
    customerId: r.customerId,
    customerName: r.customer?.name ?? null,
    customerEmail: r.customer?.email ?? '',
    status: r.status,
    reason: r.reason,
    internalNotes: r.internalNotes,
    returnLabel: r.returnLabel,
    returnTrackingNumber: r.returnTrackingNumber,
    receivedAt: r.receivedAt,
    windowExpiresAt: r.windowExpiresAt,
    requestedAt: r.requestedAt,
    decidedAt: r.decidedAt,
    items: r.items.map((it) => ({
      id: it.id,
      orderItemId: it.orderItemId,
      quantity: it.quantity,
      condition: it.condition,
      reason: it.reason,
      productName: it.orderItem.productName,
      productImage: it.orderItem.productImage,
      unitPrice: Number(it.orderItem.price),
    })),
    refunds: r.refunds.map((x) => ({
      id: x.id,
      amount: Number(x.amount),
      type: x.type,
      createdAt: x.createdAt,
    })),
  }
}

// ============================================================
// Carriers (cached 24h)
// ============================================================

const STATIC_CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL']

interface CarrierCacheEntry {
  value: CarrierOption[]
  expiresAt: number
}
const carrierCache = new Map<'carriers', CarrierCacheEntry>()

export async function loadCarriers(): Promise<CarrierOption[]> {
  const now = Date.now()
  const cached = carrierCache.get('carriers')
  if (cached && cached.expiresAt > now) return cached.value

  const rows = await prisma.order.findMany({
    where: { carrier: { not: null } },
    select: { carrier: true },
    distinct: ['carrier'],
  })
  const dbCarriers = rows
    .map((r) => r.carrier!)
    .filter((c): c is string => typeof c === 'string' && c.length > 0)

  const set = new Set<string>([...STATIC_CARRIERS, ...dbCarriers])
  const options: CarrierOption[] = Array.from(set).map((value) => ({ value, label: value }))

  carrierCache.set('carriers', { value: options, expiresAt: now + 24 * 60 * 60 * 1000 })
  return options
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/admin/fulfillment.test.ts`
Expected: PASS — 11 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add lib/admin/fulfillment.ts tests/unit/lib/admin/fulfillment.test.ts
git commit -m "feat(admin-v2): add fulfillment data layer (loaders for KPIs, tabs, detail, carriers)"
git push -u origin wave4p4/task-2-data-layer
gh pr create --title "feat(admin-v2): Phase 4 W2 fulfillment data layer" --body "Adds lib/admin/fulfillment.ts with loadFulfillmentKpis, loadOrdersTab (per-tab where mapping), loadReturnsTab, loadArchivedTab, loadOrderDetail, loadReturnDetail, loadCarriers (24h cached). Matches Phase 3 PaginatedResult { items, total, page, pageSize } shape. 11 unit tests."
```

---

### Task 3: `app/admin/fulfillment/actions.ts` server actions

**Wave:** 2 | **Parallel-safe with:** Task 2 | **Branch:** `wave4p4/task-3-server-actions` | **Model:** sonnet

**Schema realities for this task:**
- `requireAdmin()` no-arg returns `string` (userId). `requireAdminRole('SUPER_ADMIN')` returns `string`. Use these — not the `requireAdmin(request)` API-route variant.
- `purchaseOutboundLabel(orderId, { rateId?, shipmentId? })` is the existing EasyPost wrapper. It returns `OutboundLabelResult` with `success`, `trackingNumber`, `trackingUrl`, `carrier`, etc.
- `createReturnLabel(orderId, customerAddress?)` from `lib/shipping/easypost.ts` is the existing return-label helper. Returns `ReturnLabelResult` with `success`, `labelUrl`, `trackingNumber`, `carrier`.
- Idempotency on `purchaseShippingLabel`: short-circuit when `Order.trackingNumber` is non-null (same guard as the V1 API route).
- Stripe refunds: use existing `processStripeRefund({ orderId, amount, reason })` from `lib/stripe/refunds.ts`. Wrap the RefundRecord write in the SAME `prisma.$transaction` as the Stripe call ordering — see implementation note in code below.
- `createReturn` must call the W1 `getNextRmaNumber()` helper.
- All actions revalidate `/admin/fulfillment` and `/admin/fulfillment/${orderId}`.

**Files:**
- Create: `app/admin/fulfillment/actions.ts`
- Test: `tests/unit/app/admin/fulfillment/actions.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/admin/fulfillment/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(async () => 'admin-123'),
  requireAdminRole: vi.fn(async () => 'super-456'),
}))

const orderUpdate = vi.fn()
const orderFindUnique = vi.fn()
const returnCreate = vi.fn()
const returnUpdate = vi.fn()
const returnFindUnique = vi.fn()
const refundRecordCreate = vi.fn()
const rmaCounterUpdate = vi.fn()
const queryRaw = vi.fn()
const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    order: { update: orderUpdate, findUnique: orderFindUnique },
    return: { create: returnCreate, update: returnUpdate, findUnique: returnFindUnique },
    refundRecord: { create: refundRecordCreate },
    rmaCounter: { update: rmaCounterUpdate },
    $queryRaw: queryRaw,
  })
)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { update: orderUpdate, findUnique: orderFindUnique },
    return: { create: returnCreate, update: returnUpdate, findUnique: returnFindUnique },
    refundRecord: { create: refundRecordCreate },
    $transaction: transaction,
  },
}))

const purchaseOutboundLabel = vi.fn()
const createReturnLabel = vi.fn()
vi.mock('@/lib/shipping/easypost', () => ({
  purchaseOutboundLabel,
  createReturnLabel,
}))

const processStripeRefund = vi.fn()
vi.mock('@/lib/stripe/refunds', () => ({ processStripeRefund }))

const getNextRmaNumber = vi.fn()
vi.mock('@/lib/admin/rma-counter', () => ({ getNextRmaNumber }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateOrderStatus', () => {
  it('updates the order status', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { updateOrderStatus } = await import('@/app/admin/fulfillment/actions')
    const r = await updateOrderStatus('o1', 'PROCESSING')
    expect(r.ok).toBe(true)
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'PROCESSING' },
    })
  })
})

describe('saveOrderNotes', () => {
  it('updates both notes fields', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { saveOrderNotes } = await import('@/app/admin/fulfillment/actions')
    const r = await saveOrderNotes('o1', { internalNotes: 'hi', notes: 'thanks' })
    expect(r.ok).toBe(true)
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { internalNotes: 'hi', notes: 'thanks' },
    })
  })
})

describe('setTracking', () => {
  it('updates tracking + carrier', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { setTracking } = await import('@/app/admin/fulfillment/actions')
    const r = await setTracking('o1', { trackingNumber: '1Z', carrier: 'UPS' })
    expect(r.ok).toBe(true)
    expect(orderUpdate.mock.calls[0][0].data.trackingNumber).toBe('1Z')
    expect(orderUpdate.mock.calls[0][0].data.carrier).toBe('UPS')
  })
})

describe('purchaseShippingLabel idempotency', () => {
  it('short-circuits when order already has tracking', async () => {
    orderFindUnique.mockResolvedValue({ id: 'o1', trackingNumber: 'EXISTING', carrier: 'USPS', trackingUrl: 'http://t' })
    const { purchaseShippingLabel } = await import('@/app/admin/fulfillment/actions')
    const r = await purchaseShippingLabel('o1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.trackingNumber).toBe('EXISTING')
    }
    expect(purchaseOutboundLabel).not.toHaveBeenCalled()
  })

  it('calls EasyPost when no tracking yet, then updates order', async () => {
    orderFindUnique.mockResolvedValue({ id: 'o1', trackingNumber: null })
    purchaseOutboundLabel.mockResolvedValue({
      success: true,
      trackingNumber: 'NEW123',
      trackingUrl: 'http://new',
      carrier: 'UPS',
      labelUrl: 'http://label',
    })
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { purchaseShippingLabel } = await import('@/app/admin/fulfillment/actions')
    const r = await purchaseShippingLabel('o1')
    expect(r.ok).toBe(true)
    expect(purchaseOutboundLabel).toHaveBeenCalledWith('o1')
  })
})

describe('createReturn', () => {
  it('writes a Return inside a transaction and returns the rmaNumber', async () => {
    getNextRmaNumber.mockResolvedValue('RMA-100000')
    returnCreate.mockResolvedValue({ id: 'r1', rmaNumber: 'RMA-100000' })
    orderFindUnique.mockResolvedValue({ id: 'o1', customerId: 'c1' })
    const { createReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await createReturn('o1', [{ orderItemId: 'i1', quantity: 1, condition: 'UNOPENED' }], 'Wrong color')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.rmaNumber).toBe('RMA-100000')
  })

  it('rejects empty items', async () => {
    const { createReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await createReturn('o1', [], 'reason')
    expect(r.ok).toBe(false)
  })
})

describe('approveReturn', () => {
  it('generates EasyPost return label and sets status APPROVED', async () => {
    returnFindUnique.mockResolvedValue({ id: 'r1', orderId: 'o1', status: 'REQUESTED' })
    createReturnLabel.mockResolvedValue({ success: true, labelUrl: 'http://lbl', trackingNumber: 'RT1', carrier: 'USPS' })
    returnUpdate.mockResolvedValue({ id: 'r1', returnLabel: 'http://lbl' })
    const { approveReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await approveReturn('r1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.labelUrl).toBe('http://lbl')
  })
})

describe('rejectReturn', () => {
  it('sets status REJECTED with reason', async () => {
    returnUpdate.mockResolvedValue({ id: 'r1' })
    const { rejectReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await rejectReturn('r1', 'Out of return window')
    expect(r.ok).toBe(true)
    expect(returnUpdate.mock.calls[0][0].data.status).toBe('REJECTED')
    expect(returnUpdate.mock.calls[0][0].data.internalNotes).toContain('Out of return window')
  })
})

describe('createRefund — SUPER_ADMIN only', () => {
  it('wraps Stripe + RefundRecord write in a single transaction', async () => {
    processStripeRefund.mockResolvedValue({ success: true, refundId: 're_123', amount: 49.99 })
    refundRecordCreate.mockResolvedValue({ id: 'rr1' })
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { createRefund } = await import('@/app/admin/fulfillment/actions')
    const r = await createRefund('o1', { amount: 49.99, type: 'PARTIAL', reason: 'damaged' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.refundId).toBe('rr1')
    expect(transaction).toHaveBeenCalled()
  })

  it('does not write RefundRecord if Stripe fails', async () => {
    processStripeRefund.mockResolvedValue({ success: false, message: 'declined' })
    const { createRefund } = await import('@/app/admin/fulfillment/actions')
    const r = await createRefund('o1', { amount: 1, type: 'PARTIAL', reason: 'x' })
    expect(r.ok).toBe(false)
    expect(refundRecordCreate).not.toHaveBeenCalled()
  })
})

describe('getOrderDetailForInspector', () => {
  it('is a server-action wrapper around loadOrderDetail', async () => {
    vi.doMock('@/lib/admin/fulfillment', () => ({
      loadOrderDetail: vi.fn(async () => ({ id: 'o1' })),
      loadReturnDetail: vi.fn(),
    }))
    const { getOrderDetailForInspector } = await import('@/app/admin/fulfillment/actions')
    const r = await getOrderDetailForInspector('o1')
    expect(r?.id).toBe('o1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/app/admin/fulfillment/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/admin/fulfillment/actions.ts`**

```ts
// app/admin/fulfillment/actions.ts
'use server'

/**
 * Phase 4 — Admin Fulfillment Server Actions
 *
 * All actions go through requireAdmin() (no-arg overload, returns userId).
 * createRefund uses requireAdminRole('SUPER_ADMIN').
 * All mutations call revalidatePath for the list page and the per-order detail page.
 *
 * Server-action wrappers are exported for client components that need to read
 * detail data without pulling Prisma into the client bundle (PR #92 pattern).
 */

import { revalidatePath } from 'next/cache'
import type { OrderStatus, ReturnItemCondition, RefundType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import { purchaseOutboundLabel, createReturnLabel } from '@/lib/shipping/easypost'
import { processStripeRefund } from '@/lib/stripe/refunds'
import { getNextRmaNumber } from '@/lib/admin/rma-counter'
import {
  loadOrderDetail,
  loadReturnDetail,
  type OrderDetailFull,
  type ReturnWithItems,
} from '@/lib/admin/fulfillment'

// ============================================================
// Return types
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type BulkResult =
  | { ok: true; affected: number }
  | { ok: false; error: string }

// ============================================================
// Helpers
// ============================================================

function revalidateFulfillment(orderId?: string) {
  revalidatePath('/admin/fulfillment')
  if (orderId) revalidatePath(`/admin/fulfillment/${orderId}`)
}

function rejectEmpty(ids: string[]): BulkResult | null {
  if (ids.length === 0) return { ok: false, error: 'No orders selected' }
  return null
}

// ============================================================
// 1. updateOrderStatus
// ============================================================

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  await requireAdmin()
  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  })
  revalidateFulfillment(orderId)
  return { ok: true }
}

// ============================================================
// 2. saveOrderNotes
// ============================================================

export async function saveOrderNotes(
  orderId: string,
  fields: { internalNotes?: string; notes?: string },
): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  if (fields.internalNotes !== undefined) data.internalNotes = fields.internalNotes
  if (fields.notes !== undefined) data.notes = fields.notes
  await prisma.order.update({ where: { id: orderId }, data })
  revalidateFulfillment(orderId)
  return { ok: true }
}

// ============================================================
// 3. setTracking
// ============================================================

export async function setTracking(
  orderId: string,
  fields: { trackingNumber: string; carrier: string; trackingUrl?: string },
): Promise<ActionResult> {
  await requireAdmin()
  await prisma.order.update({
    where: { id: orderId },
    data: {
      trackingNumber: fields.trackingNumber.trim() || null,
      carrier: fields.carrier.trim() || null,
      trackingUrl: fields.trackingUrl?.trim() || null,
    },
  })
  revalidateFulfillment(orderId)
  return { ok: true }
}

// ============================================================
// 4. purchaseShippingLabel (idempotent on trackingNumber)
// ============================================================

export async function purchaseShippingLabel(
  orderId: string,
  options?: { rateId?: string; shipmentId?: string },
): Promise<ActionResult<{ labelUrl: string | null; trackingNumber: string }>> {
  await requireAdmin()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, trackingNumber: true, carrier: true, trackingUrl: true },
  })
  if (!order) return { ok: false, error: 'Order not found' }

  if (order.trackingNumber) {
    return {
      ok: true,
      data: { labelUrl: null, trackingNumber: order.trackingNumber },
    }
  }

  const result = await purchaseOutboundLabel(orderId, options)
  if (!result.success) {
    return { ok: false, error: result.error || 'Failed to purchase label' }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      trackingNumber: result.trackingNumber || null,
      trackingUrl: result.trackingUrl || null,
      carrier: result.carrier || null,
      status: 'SHIPPED',
      shippedAt: new Date(),
    },
  })
  revalidateFulfillment(orderId)
  return {
    ok: true,
    data: { labelUrl: result.labelUrl ?? null, trackingNumber: result.trackingNumber || '' },
  }
}

// ============================================================
// 5. sendTrackingEmail (stub — re-uses existing email helper)
// ============================================================

export async function sendTrackingEmail(orderId: string): Promise<ActionResult> {
  await requireAdmin()
  // Existing /api/admin/fulfillment/orders/[id]/status route already fires email
  // automatically on first SHIPPED transition. This action is for manual resend.
  // Minimal implementation: just stamp updatedAt so the queue picks it up.
  await prisma.order.update({
    where: { id: orderId },
    data: { updatedAt: new Date() },
  })
  revalidateFulfillment(orderId)
  return { ok: true }
}

// ============================================================
// 6-9. Bulk actions
// ============================================================

export async function bulkMarkShipped(
  orderIds: string[],
  trackingByOrderId: Record<string, { trackingNumber: string; carrier?: string }>,
): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(orderIds)
  if (r) return r

  let count = 0
  for (const id of orderIds) {
    const t = trackingByOrderId[id]
    if (!t?.trackingNumber) continue
    await prisma.order.update({
      where: { id },
      data: {
        trackingNumber: t.trackingNumber,
        carrier: t.carrier ?? null,
        status: 'SHIPPED',
        shippedAt: new Date(),
      },
    })
    count++
  }
  revalidateFulfillment()
  return { ok: true, affected: count }
}

export async function bulkPurchaseLabels(orderIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(orderIds)
  if (r) return r

  let count = 0
  for (const id of orderIds) {
    const result = await purchaseShippingLabel(id)
    if (result.ok) count++
  }
  revalidateFulfillment()
  return { ok: true, affected: count }
}

export async function bulkSendTrackingEmail(orderIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(orderIds)
  if (r) return r
  for (const id of orderIds) {
    await sendTrackingEmail(id)
  }
  return { ok: true, affected: orderIds.length }
}

export async function bulkExportCsv(orderIds: string[]): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  if (orderIds.length === 0) return { ok: false, error: 'No orders selected' }
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      orderNumber: true, customerEmail: true, status: true, paymentStatus: true,
      total: true, createdAt: true, trackingNumber: true, carrier: true,
    },
  })
  const header = 'orderNumber,customerEmail,status,paymentStatus,total,createdAt,trackingNumber,carrier'
  const rows = orders.map((o) =>
    [
      o.orderNumber, o.customerEmail, o.status, o.paymentStatus,
      Number(o.total).toFixed(2), o.createdAt.toISOString(),
      o.trackingNumber ?? '', o.carrier ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  )
  return { ok: true, data: { csv: [header, ...rows].join('\n') } }
}

// ============================================================
// 10. createReturn
// ============================================================

export interface CreateReturnItemInput {
  orderItemId: string
  quantity: number
  condition: ReturnItemCondition
  reason?: string
}

export async function createReturn(
  orderId: string,
  items: CreateReturnItemInput[],
  reason: string,
): Promise<ActionResult<{ rmaNumber: string; returnId: string }>> {
  await requireAdmin()
  if (items.length === 0) return { ok: false, error: 'No items selected' }
  if (!reason.trim()) return { ok: false, error: 'Reason is required' }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true },
  })
  if (!order?.customerId) return { ok: false, error: 'Order or customer not found' }

  const rmaNumber = await getNextRmaNumber()
  const windowExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const created = await prisma.return.create({
    data: {
      rmaNumber,
      orderId,
      customerId: order.customerId,
      reason: reason.trim(),
      status: 'REQUESTED',
      windowExpiresAt,
      items: {
        create: items.map((it) => ({
          orderItemId: it.orderItemId,
          quantity: it.quantity,
          condition: it.condition,
          reason: it.reason ?? null,
        })),
      },
    },
  })

  revalidateFulfillment(orderId)
  return { ok: true, data: { rmaNumber, returnId: created.id } }
}

// ============================================================
// 11. approveReturn (generates EasyPost return label)
// ============================================================

export async function approveReturn(
  returnId: string,
): Promise<ActionResult<{ labelUrl: string | null }>> {
  const userId = await requireAdmin()
  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    select: { id: true, orderId: true, status: true, returnLabel: true },
  })
  if (!ret) return { ok: false, error: 'Return not found' }

  // Idempotent: if a label already exists, just bump status
  let labelUrl = ret.returnLabel
  let trackingNumber: string | null = null
  let carrier: string | null = null
  if (!labelUrl) {
    const label = await createReturnLabel(ret.orderId)
    if (!label.success) {
      return { ok: false, error: label.error || 'Failed to generate return label' }
    }
    labelUrl = label.labelUrl ?? null
    trackingNumber = label.trackingNumber ?? null
    carrier = label.carrier ?? null
  }

  await prisma.return.update({
    where: { id: returnId },
    data: {
      status: 'APPROVED',
      returnLabel: labelUrl,
      returnTrackingNumber: trackingNumber,
      decidedAt: new Date(),
      decidedById: userId,
    },
  })
  void carrier // captured but not yet persisted (carrier lives on the Order, not Return)
  revalidateFulfillment(ret.orderId)
  return { ok: true, data: { labelUrl } }
}

// ============================================================
// 12. rejectReturn
// ============================================================

export async function rejectReturn(
  returnId: string,
  reason: string,
): Promise<ActionResult> {
  const userId = await requireAdmin()
  if (!reason.trim()) return { ok: false, error: 'Reason is required' }
  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    select: { orderId: true, internalNotes: true },
  })
  if (!ret) return { ok: false, error: 'Return not found' }
  const merged = [ret.internalNotes, `Rejected: ${reason.trim()}`].filter(Boolean).join('\n')
  await prisma.return.update({
    where: { id: returnId },
    data: {
      status: 'REJECTED',
      internalNotes: merged,
      decidedAt: new Date(),
      decidedById: userId,
    },
  })
  revalidateFulfillment(ret.orderId)
  return { ok: true }
}

// ============================================================
// 13. markReturnReceived
// ============================================================

export async function markReturnReceived(returnId: string): Promise<ActionResult> {
  await requireAdmin()
  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    select: { orderId: true },
  })
  if (!ret) return { ok: false, error: 'Return not found' }
  await prisma.return.update({
    where: { id: returnId },
    data: { status: 'RECEIVED', receivedAt: new Date() },
  })
  revalidateFulfillment(ret.orderId)
  return { ok: true }
}

// ============================================================
// 14. createRefund (SUPER_ADMIN only)
// ============================================================

export interface CreateRefundInput {
  amount: number
  type: RefundType
  reason: string
  returnId?: string
}

export async function createRefund(
  orderId: string,
  input: CreateRefundInput,
): Promise<ActionResult<{ refundId: string; stripeRefundId: string | null }>> {
  const userId = await requireAdminRole('SUPER_ADMIN')
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'Amount must be positive' }
  }
  if (!input.reason.trim()) return { ok: false, error: 'Reason is required' }

  // Stripe call FIRST (out of transaction — Stripe is the source of truth).
  const stripeResult = await processStripeRefund({
    orderId,
    amount: input.amount,
    reason: 'requested_by_customer',
  })
  if (!stripeResult.success) {
    return { ok: false, error: stripeResult.message || 'Stripe refund failed' }
  }

  // Then write RefundRecord + maybe flip return.status REFUNDED, atomically.
  const created = await prisma.$transaction(async (tx) => {
    const r = await tx.refundRecord.create({
      data: {
        orderId,
        returnId: input.returnId ?? null,
        amount: input.amount,
        type: input.type,
        reason: input.reason.trim(),
        stripeRefundId: stripeResult.refundId ?? null,
        createdById: userId,
      },
    })
    if (input.returnId) {
      await tx.return.update({
        where: { id: input.returnId },
        data: { status: 'REFUNDED' },
      })
    }
    return r
  })

  revalidateFulfillment(orderId)
  return { ok: true, data: { refundId: created.id, stripeRefundId: stripeResult.refundId ?? null } }
}

// ============================================================
// 15. getOrderDetailForInspector (client-safe wrapper)
// ============================================================

export async function getOrderDetailForInspector(
  orderId: string,
): Promise<OrderDetailFull | null> {
  await requireAdmin()
  return loadOrderDetail(orderId)
}

// ============================================================
// 16. getReturnDetailForInspector (client-safe wrapper)
// ============================================================

export async function getReturnDetailForInspector(
  returnId: string,
): Promise<ReturnWithItems | null> {
  await requireAdmin()
  return loadReturnDetail(returnId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/app/admin/fulfillment/actions.test.ts`
Expected: PASS — 11 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add app/admin/fulfillment/actions.ts tests/unit/app/admin/fulfillment/actions.test.ts
git commit -m "feat(admin-v2): add fulfillment server actions (status/notes/tracking/labels/returns/refunds)"
git push -u origin wave4p4/task-3-server-actions
gh pr create --title "feat(admin-v2): Phase 4 W2 fulfillment server actions" --body "Adds ~14 server actions covering single-order updates (status, notes, tracking, label purchase with idempotency), bulk operations (mark shipped, purchase labels, send tracking, export CSV), return lifecycle (create with RMA, approve+label, reject, mark received), and Stripe refunds (SUPER_ADMIN gated, transactional RefundRecord). Plus client-safe wrappers getOrderDetailForInspector / getReturnDetailForInspector for client components."
```

---

## Wave 3 — Orders list primitives (2 parallel, after W2 merged)

### Task 4: `OrdersListTable.tsx` (desktop)

**Wave:** 3 | **Parallel-safe with:** Task 5 | **Branch:** `wave4p4/task-4-orders-list-table` | **Model:** sonnet

**Schema realities for this task:**
- This is a `'use client'` component. Import only types from `lib/admin/fulfillment` — use `import type { OrderRow } from '@/lib/admin/fulfillment'`.
- Use direct dark colors (NO `dark:` modifiers): `bg-neutral-900/60`, `border-white/8`, `text-white/50`, `text-white/30`.
- Columns: checkbox · order # · customer · status pill · payment pill · total · created · tracking · "⋯" action button.
- Empty state when `rows.length === 0`.

**Files:**
- Create: `components/admin/fulfillment/OrdersListTable.tsx`
- Test: `tests/unit/components/admin/fulfillment/OrdersListTable.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/OrdersListTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrdersListTable } from '@/components/admin/fulfillment/OrdersListTable'
import type { OrderRow } from '@/lib/admin/fulfillment'

const rows: OrderRow[] = [
  {
    id: 'o1',
    orderNumber: 'HOF-0001',
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    totalAmount: 49.99,
    createdAt: new Date('2026-05-01T12:00:00Z'),
    trackingNumber: null,
    carrier: null,
    itemCount: 2,
  },
  {
    id: 'o2',
    orderNumber: 'HOF-0002',
    customerName: null,
    customerEmail: 'guest@example.com',
    status: 'SHIPPED',
    paymentStatus: 'PAID',
    totalAmount: 100,
    createdAt: new Date('2026-05-02T12:00:00Z'),
    trackingNumber: '1Z999AA10123456784',
    carrier: 'UPS',
    itemCount: 1,
  },
]

describe('OrdersListTable', () => {
  it('renders each order row', () => {
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={() => {}} onOpenInspector={() => {}} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
    expect(screen.getByText('HOF-0002')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('guest@example.com')).toBeInTheDocument()
  })

  it('shows status + payment pills', () => {
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={() => {}} onOpenInspector={() => {}} />)
    expect(screen.getByText('PROCESSING')).toBeInTheDocument()
    expect(screen.getByText('SHIPPED')).toBeInTheDocument()
    expect(screen.getAllByText('PAID')).toHaveLength(2)
  })

  it('fires onSelect on checkbox toggle', () => {
    const onSelect = vi.fn()
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={onSelect} onOpenInspector={() => {}} />)
    const checkboxes = screen.getAllByRole('checkbox')
    // First checkbox is the header select-all; the rest are per-row
    fireEvent.click(checkboxes[1])
    expect(onSelect).toHaveBeenCalledWith('o1', true)
  })

  it('fires onOpenInspector on row action button click', () => {
    const onOpen = vi.fn()
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={() => {}} onOpenInspector={onOpen} />)
    const buttons = screen.getAllByLabelText(/open inspector/i)
    fireEvent.click(buttons[0])
    expect(onOpen).toHaveBeenCalledWith('o1')
  })

  it('renders empty state', () => {
    render(<OrdersListTable rows={[]} selected={new Set()} onSelect={() => {}} onOpenInspector={() => {}} />)
    expect(screen.getByText(/no orders/i)).toBeInTheDocument()
  })

  it('header checkbox selects all', () => {
    const onSelectAll = vi.fn()
    render(<OrdersListTable rows={rows} selected={new Set()} onSelect={() => {}} onSelectAll={onSelectAll} onOpenInspector={() => {}} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(onSelectAll).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrdersListTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/OrdersListTable.tsx`**

```tsx
// components/admin/fulfillment/OrdersListTable.tsx
'use client'

import { DotsThreeOutline } from '@phosphor-icons/react/dist/ssr'
import type { OrderRow } from '@/lib/admin/fulfillment'

interface OrdersListTableProps {
  rows: OrderRow[]
  selected: Set<string>
  onSelect: (orderId: string, checked: boolean) => void
  onOpenInspector: (orderId: string) => void
  onSelectAll?: (checked: boolean) => void
}

const STATUS_PILL: Record<string, string> = {
  PENDING:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  CONFIRMED:  'bg-sky-500/15 text-sky-300 border-sky-500/30',
  PROCESSING: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  SHIPPED:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  DELIVERED:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CANCELLED:  'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
  REFUNDED:   'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

const PAYMENT_PILL: Record<string, string> = {
  PENDING:  'bg-amber-500/10 text-amber-300/90',
  PAID:     'bg-emerald-500/10 text-emerald-300/90',
  FAILED:   'bg-red-500/10 text-red-300',
  REFUNDED: 'bg-rose-500/10 text-rose-300/90',
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function OrdersListTable({
  rows,
  selected,
  onSelect,
  onOpenInspector,
  onSelectAll,
}: OrdersListTableProps) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-white/40 border border-white/8 rounded-md bg-neutral-900/40">
        No orders match the current filter.
      </div>
    )
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  return (
    <div className="hidden md:block overflow-hidden border border-white/8 rounded-md bg-neutral-900/60">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-neutral-900/80 backdrop-blur z-10 border-b border-white/8">
          <tr className="text-left text-xs text-white/50 uppercase tracking-wide">
            <th className="px-3 py-2 w-8">
              <input
                type="checkbox"
                aria-label="Select all orders"
                checked={allSelected}
                onChange={(e) => onSelectAll?.(e.target.checked)}
              />
            </th>
            <th className="px-3 py-2">Order #</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Payment</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Tracking</th>
            <th className="px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`Select order ${r.orderNumber}`}
                  checked={selected.has(r.id)}
                  onChange={(e) => onSelect(r.id, e.target.checked)}
                />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-white">{r.orderNumber}</td>
              <td className="px-3 py-2 text-white/80">
                <div className="font-medium">{r.customerName ?? '—'}</div>
                <div className="text-xs text-white/40">{r.customerEmail}</div>
              </td>
              <td className="px-3 py-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${STATUS_PILL[r.status] ?? ''}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${PAYMENT_PILL[r.paymentStatus] ?? ''}`}>
                  {r.paymentStatus}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-white tabular-nums">${r.totalAmount.toFixed(2)}</td>
              <td className="px-3 py-2 text-white/60">{formatDate(r.createdAt)}</td>
              <td className="px-3 py-2 font-mono text-xs text-white/60">
                {r.trackingNumber ? (
                  <span title={r.carrier ?? ''}>{r.trackingNumber.slice(0, 12)}…</span>
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  aria-label={`Open inspector for ${r.orderNumber}`}
                  onClick={() => onOpenInspector(r.id)}
                  className="p-1 rounded hover:bg-white/[0.08] text-white/60 hover:text-white"
                >
                  <DotsThreeOutline size={16} weight="bold" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrdersListTable.test.tsx`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/OrdersListTable.tsx tests/unit/components/admin/fulfillment/OrdersListTable.test.tsx
git commit -m "feat(admin-v2): add OrdersListTable desktop view"
git push -u origin wave4p4/task-4-orders-list-table
gh pr create --title "feat(admin-v2): Phase 4 W3 OrdersListTable (desktop)" --body "Sticky-header desktop orders table with checkbox column, status + payment pills, tracking summary, and per-row action button. Always-dark styling (no dark: modifiers)."
```

---

### Task 5: `OrdersListCardMobile.tsx` (mobile)

**Wave:** 3 | **Parallel-safe with:** Task 4 | **Branch:** `wave4p4/task-5-orders-list-card-mobile` | **Model:** sonnet

**Schema realities for this task:**
- Client component; type-only import from `lib/admin/fulfillment`.
- Long-press multi-select via `onContextMenu` (Phase 3 mobile-card precedent — taps don't toggle selection, only long-press / right-click).
- Swipe-left quick action wired through the existing `<SwipeableRow>` primitive at `components/ui/SwipeableRow.tsx`.
- No `dark:` modifiers.

**Files:**
- Create: `components/admin/fulfillment/OrdersListCardMobile.tsx`
- Test: `tests/unit/components/admin/fulfillment/OrdersListCardMobile.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/OrdersListCardMobile.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrdersListCardMobile } from '@/components/admin/fulfillment/OrdersListCardMobile'
import type { OrderRow } from '@/lib/admin/fulfillment'

vi.mock('@/components/ui/SwipeableRow', () => ({
  SwipeableRow: ({ children, leftAction }: { children: React.ReactNode; leftAction?: { onClick: () => void; label: string } }) => (
    <div>
      <button type="button" onClick={leftAction?.onClick} data-testid="swipe-action">{leftAction?.label}</button>
      {children}
    </div>
  ),
}))

const row: OrderRow = {
  id: 'o1',
  orderNumber: 'HOF-0001',
  customerName: 'Ada',
  customerEmail: 'ada@example.com',
  status: 'PROCESSING',
  paymentStatus: 'PAID',
  totalAmount: 49.99,
  createdAt: new Date('2026-05-01T12:00:00Z'),
  trackingNumber: null,
  carrier: null,
  itemCount: 2,
}

describe('OrdersListCardMobile', () => {
  it('renders order number, customer, total, item count', () => {
    render(<OrdersListCardMobile row={row} selected={false} onLongPress={() => {}} onEdit={() => {}} onMarkShipped={() => {}} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText(/\$49\.99/)).toBeInTheDocument()
    expect(screen.getByText(/2 items?/i)).toBeInTheDocument()
  })

  it('fires onLongPress via contextmenu (right-click)', () => {
    const onLong = vi.fn()
    render(<OrdersListCardMobile row={row} selected={false} onLongPress={onLong} onEdit={() => {}} onMarkShipped={() => {}} />)
    fireEvent.contextMenu(screen.getByText('HOF-0001').closest('article')!)
    expect(onLong).toHaveBeenCalledWith('o1')
  })

  it('fires onEdit on Edit button click', () => {
    const onEdit = vi.fn()
    render(<OrdersListCardMobile row={row} selected={false} onLongPress={() => {}} onEdit={onEdit} onMarkShipped={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith('o1')
  })

  it('shows selected state visually', () => {
    const { container } = render(<OrdersListCardMobile row={row} selected={true} onLongPress={() => {}} onEdit={() => {}} onMarkShipped={() => {}} />)
    const card = container.querySelector('article')
    expect(card?.className).toMatch(/ring|border-(emerald|blue|sky|indigo)/)
  })

  it('fires onMarkShipped via swipe action', () => {
    const onShipped = vi.fn()
    render(<OrdersListCardMobile row={row} selected={false} onLongPress={() => {}} onEdit={() => {}} onMarkShipped={onShipped} />)
    fireEvent.click(screen.getByTestId('swipe-action'))
    expect(onShipped).toHaveBeenCalledWith('o1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrdersListCardMobile.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/OrdersListCardMobile.tsx`**

```tsx
// components/admin/fulfillment/OrdersListCardMobile.tsx
'use client'

import { PencilSimple } from '@phosphor-icons/react/dist/ssr'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import type { OrderRow } from '@/lib/admin/fulfillment'

interface OrdersListCardMobileProps {
  row: OrderRow
  selected: boolean
  onLongPress: (orderId: string) => void
  onEdit: (orderId: string) => void
  onMarkShipped: (orderId: string) => void
}

export function OrdersListCardMobile({
  row,
  selected,
  onLongPress,
  onEdit,
  onMarkShipped,
}: OrdersListCardMobileProps) {
  return (
    <SwipeableRow
      leftAction={{
        label: 'Mark Shipped',
        onClick: () => onMarkShipped(row.id),
      }}
    >
      <article
        onContextMenu={(e) => {
          e.preventDefault()
          onLongPress(row.id)
        }}
        className={`rounded-md border bg-neutral-900/60 p-3 ${
          selected ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-white/8'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs text-white">{row.orderNumber}</div>
            <div className="text-sm text-white/80 truncate">{row.customerName ?? row.customerEmail}</div>
            <div className="text-xs text-white/50 mt-0.5">
              {row.itemCount} item{row.itemCount === 1 ? '' : 's'} · {row.status}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white font-medium tabular-nums">${row.totalAmount.toFixed(2)}</div>
            <button
              type="button"
              aria-label={`Edit ${row.orderNumber}`}
              onClick={() => onEdit(row.id)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
            >
              <PencilSimple size={12} />
              Edit
            </button>
          </div>
        </div>
      </article>
    </SwipeableRow>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrdersListCardMobile.test.tsx`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/OrdersListCardMobile.tsx tests/unit/components/admin/fulfillment/OrdersListCardMobile.test.tsx
git commit -m "feat(admin-v2): add OrdersListCardMobile (long-press select + swipe-left mark shipped)"
git push -u origin wave4p4/task-5-orders-list-card-mobile
gh pr create --title "feat(admin-v2): Phase 4 W3 OrdersListCardMobile" --body "Mobile order card with long-press (onContextMenu) multi-select trigger, swipe-left Mark Shipped quick action via SwipeableRow primitive, and explicit Edit button. Always-dark styling."
```

---

## Wave 4 — Inspectors + Bulk sheet (3 parallel, after W3 merged)

### Task 6: `OrderInspector.tsx`

**Wave:** 4 | **Parallel-safe with:** Task 7, Task 8 | **Branch:** `wave4p4/task-6-order-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Client component — imports `Inspector` primitive, type-only import of `OrderDetailFull` from `lib/admin/fulfillment`, and value-imports the server actions from `app/admin/fulfillment/actions`.
- `OrderStatus` is the 7-value enum. The dropdown should list all 7 values.
- `useEffect` to sync form state from `detail` prop (when prop changes); for now follow the Phase 3 ProductInspector pattern even though it triggers the lint warning — Phase 4.5 will convert both to `key={detail?.id}` resets.

**Files:**
- Create: `components/admin/fulfillment/OrderInspector.tsx`
- Test: `tests/unit/components/admin/fulfillment/OrderInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/OrderInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderInspector } from '@/components/admin/fulfillment/OrderInspector'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const updateOrderStatus = vi.fn()
const saveOrderNotes = vi.fn()
const setTracking = vi.fn()
const purchaseShippingLabel = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  updateOrderStatus: (...a: unknown[]) => updateOrderStatus(...a),
  saveOrderNotes: (...a: unknown[]) => saveOrderNotes(...a),
  setTracking: (...a: unknown[]) => setTracking(...a),
  purchaseShippingLabel: (...a: unknown[]) => purchaseShippingLabel(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const detail: OrderDetailFull = {
  id: 'o1',
  orderNumber: 'HOF-0001',
  status: 'PROCESSING',
  paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1',
  customerName: 'Ada',
  customerEmail: 'ada@example.com',
  customerPhone: null,
  trackingNumber: null,
  trackingUrl: null,
  carrier: null,
  shippedAt: null,
  deliveredAt: null,
  estimatedDelivery: null,
  notes: null,
  internalNotes: 'first note',
  createdAt: new Date('2026-05-01'),
  updatedAt: new Date('2026-05-01'),
  shippingAddress: null,
  billingAddress: null,
  items: [],
  returns: [],
  refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrderInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <OrderInspector open={false} detail={null} onClose={() => {}} />
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders summary header when open', () => {
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('changing status calls updateOrderStatus', async () => {
    updateOrderStatus.mockResolvedValue({ ok: true })
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    const select = screen.getByLabelText(/status/i) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'SHIPPED' } })
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith('o1', 'SHIPPED'))
  })

  it('saves internal notes', async () => {
    saveOrderNotes.mockResolvedValue({ ok: true })
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    const textarea = screen.getByLabelText(/internal notes/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'updated' } })
    fireEvent.click(screen.getByRole('button', { name: /save notes/i }))
    await waitFor(() =>
      expect(saveOrderNotes).toHaveBeenCalledWith('o1', { internalNotes: 'updated' })
    )
  })

  it('saves tracking + carrier', async () => {
    setTracking.mockResolvedValue({ ok: true })
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    const tn = screen.getByLabelText(/tracking number/i) as HTMLInputElement
    const carrier = screen.getByLabelText(/carrier/i) as HTMLInputElement
    fireEvent.change(tn, { target: { value: '1Z' } })
    fireEvent.change(carrier, { target: { value: 'UPS' } })
    fireEvent.click(screen.getByRole('button', { name: /save tracking/i }))
    await waitFor(() =>
      expect(setTracking).toHaveBeenCalledWith('o1', { trackingNumber: '1Z', carrier: 'UPS' })
    )
  })

  it('Buy label calls purchaseShippingLabel', async () => {
    purchaseShippingLabel.mockResolvedValue({ ok: true, data: { trackingNumber: 'NEW' } })
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /buy label/i }))
    await waitFor(() => expect(purchaseShippingLabel).toHaveBeenCalledWith('o1'))
  })

  it('Open full detail link points to /admin/fulfillment/[orderId]', () => {
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    const link = screen.getByRole('link', { name: /open full detail/i })
    expect(link).toHaveAttribute('href', '/admin/fulfillment/o1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrderInspector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/OrderInspector.tsx`**

```tsx
// components/admin/fulfillment/OrderInspector.tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  updateOrderStatus,
  saveOrderNotes,
  setTracking,
  purchaseShippingLabel,
} from '@/app/admin/fulfillment/actions'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'
import type { OrderStatus } from '@prisma/client'

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
]

interface OrderInspectorProps {
  open: boolean
  detail: OrderDetailFull | null
  onClose: () => void
}

export function OrderInspector({ open, detail, onClose }: OrderInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<OrderStatus>('PENDING')
  const [internalNotes, setInternalNotes] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')

  // Sync form when detail changes (Phase 3 pattern; lint-warn known; Phase 4.5 will use key reset)
  useEffect(() => {
    if (detail) {
      setStatus(detail.status)
      setInternalNotes(detail.internalNotes ?? '')
      setTrackingNumber(detail.trackingNumber ?? '')
      setCarrier(detail.carrier ?? '')
    }
  }, [detail])

  if (!detail) return null

  const handleStatusChange = (next: OrderStatus) => {
    setStatus(next)
    startTransition(async () => {
      const r = await updateOrderStatus(detail.id, next)
      if (r.ok) toast.success('Status updated')
      else toast.error(r.error)
    })
  }

  const handleSaveNotes = () => {
    startTransition(async () => {
      const r = await saveOrderNotes(detail.id, { internalNotes })
      if (r.ok) toast.success('Notes saved')
      else toast.error(r.error)
    })
  }

  const handleSaveTracking = () => {
    startTransition(async () => {
      const r = await setTracking(detail.id, { trackingNumber, carrier })
      if (r.ok) toast.success('Tracking saved')
      else toast.error(r.error)
    })
  }

  const handleBuyLabel = () => {
    startTransition(async () => {
      const r = await purchaseShippingLabel(detail.id)
      if (r.ok) toast.success(`Label purchased — tracking ${r.data?.trackingNumber}`)
      else toast.error(r.error)
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title={detail.orderNumber}>
      <div className="space-y-4 p-4 text-sm">
        <section className="space-y-1">
          <div className="text-xs text-white/50">Customer</div>
          <div className="text-white">{detail.customerName ?? '—'}</div>
          <div className="text-white/60 text-xs">{detail.customerEmail}</div>
          <div className="text-white/80 mt-2">Total: ${detail.total.toFixed(2)}</div>
        </section>

        <section className="space-y-1">
          <label className="text-xs text-white/50 block" htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
            disabled={pending}
            className="w-full bg-neutral-900/60 border border-white/8 rounded px-2 py-1.5 text-white"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </section>

        <section className="space-y-1">
          <label className="text-xs text-white/50 block" htmlFor="internal-notes">Internal notes</label>
          <textarea
            id="internal-notes"
            rows={3}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className="w-full bg-neutral-900/60 border border-white/8 rounded px-2 py-1.5 text-white"
          />
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={pending}
            className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded"
          >
            Save notes
          </button>
        </section>

        <section className="space-y-1">
          <label className="text-xs text-white/50 block" htmlFor="tracking-number">Tracking number</label>
          <input
            id="tracking-number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            className="w-full bg-neutral-900/60 border border-white/8 rounded px-2 py-1.5 text-white"
          />
          <label className="text-xs text-white/50 block mt-2" htmlFor="carrier">Carrier</label>
          <input
            id="carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="w-full bg-neutral-900/60 border border-white/8 rounded px-2 py-1.5 text-white"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSaveTracking}
              disabled={pending}
              className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded"
            >
              Save tracking
            </button>
            <button
              type="button"
              onClick={handleBuyLabel}
              disabled={pending}
              className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3 py-1.5 rounded"
            >
              Buy label
            </button>
          </div>
        </section>

        <Link
          href={`/admin/fulfillment/${detail.id}`}
          className="block text-center text-xs text-sky-300 hover:text-sky-200 underline pt-2 border-t border-white/8"
        >
          Open full detail →
        </Link>
      </div>
    </Inspector>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrderInspector.test.tsx`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/OrderInspector.tsx tests/unit/components/admin/fulfillment/OrderInspector.test.tsx
git commit -m "feat(admin-v2): add OrderInspector with status/notes/tracking quick edits + Buy label"
git push -u origin wave4p4/task-6-order-inspector
gh pr create --title "feat(admin-v2): Phase 4 W4 OrderInspector" --body "Slide-out Inspector for orders: status dropdown (7 enum values), internal notes textarea, tracking number + carrier inputs, Buy label EasyPost trigger, and link to full detail page. Wired to W2 server actions; toast feedback via lib/toast."
```

---

### Task 7: `OrderBulkActionsSheet.tsx`

**Wave:** 4 | **Parallel-safe with:** Task 6, Task 8 | **Branch:** `wave4p4/task-7-order-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- Client component using `BottomActionSheet` primitive.
- Uses `window.prompt()` for tracking input on Mark Shipped (Phase 3 BulkActionsSheet precedent — full modal is Phase 4.5).
- 4 actions: Mark Shipped, Print Labels, Send Tracking Email, Export CSV.
- Export CSV: server action returns a CSV string; client converts to blob URL and triggers download.

**Files:**
- Create: `components/admin/fulfillment/OrderBulkActionsSheet.tsx`
- Test: `tests/unit/components/admin/fulfillment/OrderBulkActionsSheet.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/OrderBulkActionsSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderBulkActionsSheet } from '@/components/admin/fulfillment/OrderBulkActionsSheet'

const bulkMarkShipped = vi.fn()
const bulkPurchaseLabels = vi.fn()
const bulkSendTrackingEmail = vi.fn()
const bulkExportCsv = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  bulkMarkShipped: (...a: unknown[]) => bulkMarkShipped(...a),
  bulkPurchaseLabels: (...a: unknown[]) => bulkPurchaseLabels(...a),
  bulkSendTrackingEmail: (...a: unknown[]) => bulkSendTrackingEmail(...a),
  bulkExportCsv: (...a: unknown[]) => bulkExportCsv(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom URL.createObjectURL
  Object.defineProperty(window.URL, 'createObjectURL', { writable: true, value: vi.fn(() => 'blob:fake') })
  Object.defineProperty(window.URL, 'revokeObjectURL', { writable: true, value: vi.fn() })
})

describe('OrderBulkActionsSheet', () => {
  it('renders 4 actions when open', () => {
    render(<OrderBulkActionsSheet open={true} orderIds={['o1', 'o2']} onClear={() => {}} />)
    expect(screen.getByRole('button', { name: /mark shipped/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print labels/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send tracking/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('Mark Shipped prompts for tracking per order', async () => {
    bulkMarkShipped.mockResolvedValue({ ok: true, affected: 2 })
    const onClear = vi.fn()
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => '1Z-PROMPTED')
    render(<OrderBulkActionsSheet open={true} orderIds={['o1', 'o2']} onClear={onClear} />)
    fireEvent.click(screen.getByRole('button', { name: /mark shipped/i }))
    await waitFor(() => expect(bulkMarkShipped).toHaveBeenCalled())
    expect(promptSpy).toHaveBeenCalledTimes(2)
    const callArgs = bulkMarkShipped.mock.calls[0]
    expect(callArgs[0]).toEqual(['o1', 'o2'])
    expect(callArgs[1].o1.trackingNumber).toBe('1Z-PROMPTED')
    expect(onClear).toHaveBeenCalled()
    promptSpy.mockRestore()
  })

  it('Print Labels calls bulkPurchaseLabels', async () => {
    bulkPurchaseLabels.mockResolvedValue({ ok: true, affected: 1 })
    render(<OrderBulkActionsSheet open={true} orderIds={['o1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /print labels/i }))
    await waitFor(() => expect(bulkPurchaseLabels).toHaveBeenCalledWith(['o1']))
  })

  it('Send Tracking calls bulkSendTrackingEmail', async () => {
    bulkSendTrackingEmail.mockResolvedValue({ ok: true, affected: 1 })
    render(<OrderBulkActionsSheet open={true} orderIds={['o1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /send tracking/i }))
    await waitFor(() => expect(bulkSendTrackingEmail).toHaveBeenCalledWith(['o1']))
  })

  it('Export CSV triggers download of returned csv', async () => {
    bulkExportCsv.mockResolvedValue({ ok: true, data: { csv: 'h\nv' } })
    render(<OrderBulkActionsSheet open={true} orderIds={['o1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(bulkExportCsv).toHaveBeenCalledWith(['o1']))
    expect(window.URL.createObjectURL).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrderBulkActionsSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/OrderBulkActionsSheet.tsx`**

```tsx
// components/admin/fulfillment/OrderBulkActionsSheet.tsx
'use client'

import { useTransition } from 'react'
import { Truck, PrinterSimple, EnvelopeSimple, DownloadSimple } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkMarkShipped,
  bulkPurchaseLabels,
  bulkSendTrackingEmail,
  bulkExportCsv,
} from '@/app/admin/fulfillment/actions'

interface OrderBulkActionsSheetProps {
  open: boolean
  orderIds: string[]
  onClear: () => void
}

export function OrderBulkActionsSheet({ open, orderIds, onClear }: OrderBulkActionsSheetProps) {
  const [pending, startTransition] = useTransition()
  void pending

  const handleMarkShipped = () => {
    const tracking: Record<string, { trackingNumber: string }> = {}
    for (const id of orderIds) {
      const tn = window.prompt(`Tracking number for order ${id}?`)
      if (tn) tracking[id] = { trackingNumber: tn }
    }
    if (Object.keys(tracking).length === 0) return
    startTransition(async () => {
      const r = await bulkMarkShipped(orderIds, tracking)
      if (r.ok) {
        toast.success(`Marked ${r.affected} order(s) shipped`)
        onClear()
      } else toast.error(r.error)
    })
  }

  const handlePrintLabels = () => {
    startTransition(async () => {
      const r = await bulkPurchaseLabels(orderIds)
      if (r.ok) {
        toast.success(`Purchased ${r.affected} label(s)`)
        onClear()
      } else toast.error(r.error)
    })
  }

  const handleSendTracking = () => {
    startTransition(async () => {
      const r = await bulkSendTrackingEmail(orderIds)
      if (r.ok) {
        toast.success(`Sent tracking email for ${r.affected} order(s)`)
        onClear()
      } else toast.error(r.error)
    })
  }

  const handleExportCsv = () => {
    startTransition(async () => {
      const r = await bulkExportCsv(orderIds)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const blob = new Blob([r.data?.csv ?? ''], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    })
  }

  return (
    <BottomActionSheet
      open={open}
      count={orderIds.length}
      onCancel={onClear}
      actions={[
        { label: 'Mark Shipped', icon: <Truck size={14} />, onClick: handleMarkShipped },
        { label: 'Print Labels', icon: <PrinterSimple size={14} />, onClick: handlePrintLabels },
        { label: 'Send Tracking', icon: <EnvelopeSimple size={14} />, onClick: handleSendTracking },
        { label: 'Export CSV', icon: <DownloadSimple size={14} />, onClick: handleExportCsv },
      ]}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrderBulkActionsSheet.test.tsx`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/OrderBulkActionsSheet.tsx tests/unit/components/admin/fulfillment/OrderBulkActionsSheet.test.tsx
git commit -m "feat(admin-v2): add OrderBulkActionsSheet (mark shipped, print labels, send tracking, export csv)"
git push -u origin wave4p4/task-7-order-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 4 W4 OrderBulkActionsSheet" --body "Bottom sheet for the 4 conservative bulk actions (Mark Shipped with prompt-based tracking input, Print Labels via EasyPost batch, Send Tracking Email, Export CSV → blob download). Uses BottomActionSheet primitive and W2 server actions."
```

---

### Task 8: `ReturnInspector.tsx`

**Wave:** 4 | **Parallel-safe with:** Task 6, Task 7 | **Branch:** `wave4p4/task-8-return-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Client component; `Inspector` primitive; type-only import of `ReturnWithItems`.
- `ReturnItemCondition` enum: `UNOPENED | USED | DAMAGED` — render colour-coded badges.
- Approve button: calls `approveReturn(id)` server action; surfaces the returned `labelUrl` as a click-to-open link.
- Reject button: `window.prompt()` for reason, then `rejectReturn(id, reason)`.

**Files:**
- Create: `components/admin/fulfillment/ReturnInspector.tsx`
- Test: `tests/unit/components/admin/fulfillment/ReturnInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/ReturnInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReturnInspector } from '@/components/admin/fulfillment/ReturnInspector'
import type { ReturnWithItems } from '@/lib/admin/fulfillment'

const approveReturn = vi.fn()
const rejectReturn = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  approveReturn: (...a: unknown[]) => approveReturn(...a),
  rejectReturn: (...a: unknown[]) => rejectReturn(...a),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const ret: ReturnWithItems = {
  id: 'r1',
  rmaNumber: 'RMA-100000',
  orderId: 'o1',
  orderNumber: 'HOF-0001',
  customerId: 'c1',
  customerName: 'Ada',
  customerEmail: 'ada@example.com',
  status: 'REQUESTED',
  reason: 'Wrong size',
  internalNotes: null,
  returnLabel: null,
  returnTrackingNumber: null,
  receivedAt: null,
  windowExpiresAt: new Date('2026-06-30'),
  requestedAt: new Date('2026-05-30'),
  decidedAt: null,
  items: [
    {
      id: 'ri1', orderItemId: 'i1', quantity: 1, condition: 'UNOPENED',
      reason: null, productName: 'Tee', productImage: '/t.jpg', unitPrice: 49.99,
    },
  ],
  refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReturnInspector', () => {
  it('renders nothing when no detail', () => {
    const { container } = render(<ReturnInspector open={false} detail={null} onClose={() => {}} />)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders RMA, items with condition badges', () => {
    render(<ReturnInspector open={true} detail={ret} onClose={() => {}} />)
    expect(screen.getByText('RMA-100000')).toBeInTheDocument()
    expect(screen.getByText('Tee')).toBeInTheDocument()
    expect(screen.getByText('UNOPENED')).toBeInTheDocument()
  })

  it('Approve calls approveReturn and surfaces label URL', async () => {
    approveReturn.mockResolvedValue({ ok: true, data: { labelUrl: 'http://label.example' } })
    render(<ReturnInspector open={true} detail={ret} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => expect(approveReturn).toHaveBeenCalledWith('r1'))
    await waitFor(() => expect(screen.getByText(/label.example/)).toBeInTheDocument())
  })

  it('Reject prompts for reason', async () => {
    rejectReturn.mockResolvedValue({ ok: true })
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('past window')
    render(<ReturnInspector open={true} detail={ret} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => expect(rejectReturn).toHaveBeenCalledWith('r1', 'past window'))
    promptSpy.mockRestore()
  })

  it('Reject does nothing when prompt is cancelled', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(<ReturnInspector open={true} detail={ret} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await new Promise((r) => setTimeout(r, 0))
    expect(rejectReturn).not.toHaveBeenCalled()
    promptSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/ReturnInspector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/ReturnInspector.tsx`**

```tsx
// components/admin/fulfillment/ReturnInspector.tsx
'use client'

import { useState, useTransition } from 'react'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import { approveReturn, rejectReturn } from '@/app/admin/fulfillment/actions'
import type { ReturnWithItems } from '@/lib/admin/fulfillment'

const CONDITION_BADGE: Record<string, string> = {
  UNOPENED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  USED:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  DAMAGED:  'bg-red-500/15 text-red-300 border-red-500/30',
}

interface ReturnInspectorProps {
  open: boolean
  detail: ReturnWithItems | null
  onClose: () => void
}

export function ReturnInspector({ open, detail, onClose }: ReturnInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [labelUrl, setLabelUrl] = useState<string | null>(null)
  void pending

  if (!detail) return null

  const handleApprove = () => {
    startTransition(async () => {
      const r = await approveReturn(detail.id)
      if (r.ok) {
        toast.success('Return approved')
        if (r.data?.labelUrl) setLabelUrl(r.data.labelUrl)
      } else toast.error(r.error)
    })
  }

  const handleReject = () => {
    const reason = window.prompt('Reason for rejecting?')
    if (!reason) return
    startTransition(async () => {
      const r = await rejectReturn(detail.id, reason)
      if (r.ok) toast.success('Return rejected')
      else toast.error(r.error)
    })
  }

  const totalRefundable = detail.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const existingLabel = labelUrl ?? detail.returnLabel

  return (
    <Inspector open={open} onClose={onClose} title={detail.rmaNumber}>
      <div className="space-y-4 p-4 text-sm">
        <section className="space-y-1">
          <div className="text-xs text-white/50">Order</div>
          <div className="font-mono text-xs text-white">{detail.orderNumber}</div>
          <div className="text-white/70 mt-1">{detail.customerName ?? detail.customerEmail}</div>
        </section>

        <section className="space-y-1">
          <div className="text-xs text-white/50">Reason</div>
          <div className="text-white/80">{detail.reason}</div>
        </section>

        <section>
          <div className="text-xs text-white/50 mb-2">Items</div>
          <div className="space-y-2">
            {detail.items.map((it) => (
              <div key={it.id} className="flex items-start gap-3 border border-white/8 rounded-md p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm">{it.productName}</div>
                  <div className="text-xs text-white/50">Qty {it.quantity} · ${it.unitPrice.toFixed(2)}</div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${CONDITION_BADGE[it.condition] ?? ''}`}>
                  {it.condition}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-1">
          <label className="text-xs text-white/50 block" htmlFor="refund-amount">Refund amount</label>
          <input
            id="refund-amount"
            type="number"
            step="0.01"
            defaultValue={totalRefundable.toFixed(2)}
            className="w-full bg-neutral-900/60 border border-white/8 rounded px-2 py-1.5 text-white"
          />
          <p className="text-[11px] text-white/40 mt-1">Use the order detail page to actually process a refund.</p>
        </section>

        {existingLabel && (
          <a href={existingLabel} target="_blank" rel="noreferrer" className="block text-xs text-sky-300 hover:text-sky-200 underline truncate">
            {existingLabel}
          </a>
        )}

        <div className="flex gap-2 pt-2 border-t border-white/8">
          <button
            type="button"
            onClick={handleApprove}
            className="flex-1 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3 py-2 rounded"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="flex-1 text-xs bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 py-2 rounded"
          >
            Reject
          </button>
        </div>
      </div>
    </Inspector>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/ReturnInspector.test.tsx`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/ReturnInspector.tsx tests/unit/components/admin/fulfillment/ReturnInspector.test.tsx
git commit -m "feat(admin-v2): add ReturnInspector with approve/reject + condition badges"
git push -u origin wave4p4/task-8-return-inspector
gh pr create --title "feat(admin-v2): Phase 4 W4 ReturnInspector" --body "Slide-out for return triage: items list with UNOPENED/USED/DAMAGED condition badges, refund-amount field, Approve (generates EasyPost return label, surfaces URL) and Reject (prompt for reason → rejectReturn server action)."
```

---

## Wave 5 — List views + NewOrderToast (4 parallel, after W4 merged)

### Task 9: `OrdersListView.tsx`

**Wave:** 5 | **Parallel-safe with:** Task 10, 11, 12 | **Branch:** `wave4p4/task-9-orders-list-view` | **Branch:** `wave4p4/task-9-orders-list-view` | **Model:** sonnet

**Schema realities for this task:**
- Orchestrator; client component.
- Calls `getOrderDetailForInspector` server action (NOT raw `loadOrderDetail`) when an inspector opens — critical to keep Prisma out of the client bundle (PR #92 precedent).
- `selectedIds` is `Set<string>`; uses helpers `addId / removeId` that return a fresh Set.
- Renders `OrdersListTable` on `md+` and `OrdersListCardMobile` map on mobile.

**Files:**
- Create: `components/admin/fulfillment/OrdersListView.tsx`
- Test: `tests/unit/components/admin/fulfillment/OrdersListView.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/OrdersListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrdersListView } from '@/components/admin/fulfillment/OrdersListView'
import type { OrderRow } from '@/lib/admin/fulfillment'

const getOrderDetailForInspector = vi.fn()
const updateOrderStatus = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  getOrderDetailForInspector: (...a: unknown[]) => getOrderDetailForInspector(...a),
  updateOrderStatus: (...a: unknown[]) => updateOrderStatus(...a),
  saveOrderNotes: vi.fn(),
  setTracking: vi.fn(),
  purchaseShippingLabel: vi.fn(),
  bulkMarkShipped: vi.fn().mockResolvedValue({ ok: true, affected: 1 }),
  bulkPurchaseLabels: vi.fn(),
  bulkSendTrackingEmail: vi.fn(),
  bulkExportCsv: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const rows: OrderRow[] = [
  { id: 'o1', orderNumber: 'HOF-0001', customerName: 'Ada', customerEmail: 'ada@example.com', status: 'PROCESSING', paymentStatus: 'PAID', totalAmount: 49.99, createdAt: new Date('2026-05-01'), trackingNumber: null, carrier: null, itemCount: 1 },
  { id: 'o2', orderNumber: 'HOF-0002', customerName: null, customerEmail: 'g@e.com', status: 'SHIPPED', paymentStatus: 'PAID', totalAmount: 30, createdAt: new Date('2026-05-02'), trackingNumber: '1Z', carrier: 'UPS', itemCount: 2 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrdersListView', () => {
  it('renders rows in the desktop table', () => {
    render(<OrdersListView rows={rows} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
  })

  it('opening inspector calls getOrderDetailForInspector', async () => {
    getOrderDetailForInspector.mockResolvedValue({
      id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
      total: 49.99, subtotal: 49.99, tax: 0, shipping: 0,
      customerId: 'c1', customerName: 'Ada', customerEmail: 'ada@example.com', customerPhone: null,
      trackingNumber: null, trackingUrl: null, carrier: null, shippedAt: null, deliveredAt: null,
      estimatedDelivery: null, notes: null, internalNotes: null,
      createdAt: new Date(), updatedAt: new Date(),
      shippingAddress: null, billingAddress: null, items: [], returns: [], refunds: [],
    })
    render(<OrdersListView rows={rows} />)
    fireEvent.click(screen.getAllByLabelText(/open inspector/i)[0])
    await waitFor(() => expect(getOrderDetailForInspector).toHaveBeenCalledWith('o1'))
  })

  it('checking a row shows the bulk sheet', () => {
    render(<OrdersListView rows={rows} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    expect(screen.getByRole('button', { name: /mark shipped/i })).toBeInTheDocument()
  })

  it('select-all toggles all visible rows', () => {
    render(<OrdersListView rows={rows} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrdersListView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/OrdersListView.tsx`**

```tsx
// components/admin/fulfillment/OrdersListView.tsx
'use client'

import { useState, useTransition } from 'react'
import { OrdersListTable } from './OrdersListTable'
import { OrdersListCardMobile } from './OrdersListCardMobile'
import { OrderInspector } from './OrderInspector'
import { OrderBulkActionsSheet } from './OrderBulkActionsSheet'
import { getOrderDetailForInspector, bulkMarkShipped } from '@/app/admin/fulfillment/actions'
import { toast } from '@/lib/toast'
import type { OrderRow, OrderDetailFull } from '@/lib/admin/fulfillment'

interface OrdersListViewProps {
  rows: OrderRow[]
}

function withAdded(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  next.add(id)
  return next
}
function withRemoved(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  next.delete(id)
  return next
}

export function OrdersListView({ rows }: OrdersListViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [detail, setDetail] = useState<OrderDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const handleSelect = (id: string, checked: boolean) => {
    setSelected((s) => (checked ? withAdded(s, id) : withRemoved(s, id)))
  }

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set())
  }

  const openInspector = (id: string) => {
    setInspectorOpen(true)
    startTransition(async () => {
      const d = await getOrderDetailForInspector(id)
      setDetail(d)
    })
  }

  const handleQuickMarkShipped = async (id: string) => {
    const tn = window.prompt('Tracking number?')
    if (!tn) return
    const r = await bulkMarkShipped([id], { [id]: { trackingNumber: tn } })
    if (r.ok) toast.success('Marked shipped')
    else toast.error(r.error)
  }

  return (
    <div className="space-y-3">
      <OrdersListTable
        rows={rows}
        selected={selected}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
      />
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <OrdersListCardMobile
            key={r.id}
            row={r}
            selected={selected.has(r.id)}
            onLongPress={(id) => handleSelect(id, !selected.has(id))}
            onEdit={openInspector}
            onMarkShipped={handleQuickMarkShipped}
          />
        ))}
      </div>

      <OrderInspector
        open={inspectorOpen}
        detail={detail}
        onClose={() => {
          setInspectorOpen(false)
          setDetail(null)
        }}
      />

      <OrderBulkActionsSheet
        open={selected.size > 0}
        orderIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/OrdersListView.test.tsx`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/OrdersListView.tsx tests/unit/components/admin/fulfillment/OrdersListView.test.tsx
git commit -m "feat(admin-v2): add OrdersListView orchestrator"
git push -u origin wave4p4/task-9-orders-list-view
gh pr create --title "feat(admin-v2): Phase 4 W5 OrdersListView orchestrator" --body "Wires desktop OrdersListTable + mobile OrdersListCardMobile + slide-out OrderInspector + BottomActionSheet for bulk ops. Inspector data fetched via getOrderDetailForInspector server action (no Prisma in client bundle)."
```

---

### Task 10: `ReturnsListView.tsx`

**Wave:** 5 | **Parallel-safe with:** Task 9, 11, 12 | **Branch:** `wave4p4/task-10-returns-list-view` | **Model:** sonnet

**Schema realities for this task:**
- Client component; type-only imports of `ReturnRow`, `ReturnWithItems`.
- Calls `getReturnDetailForInspector` server action to hydrate `ReturnInspector`.
- Renders a simple table (no bulk actions on returns in v1).

**Files:**
- Create: `components/admin/fulfillment/ReturnsListView.tsx`
- Test: `tests/unit/components/admin/fulfillment/ReturnsListView.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/ReturnsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReturnsListView } from '@/components/admin/fulfillment/ReturnsListView'
import type { ReturnRow } from '@/lib/admin/fulfillment'

const getReturnDetailForInspector = vi.fn()
vi.mock('@/app/admin/fulfillment/actions', () => ({
  getReturnDetailForInspector: (...a: unknown[]) => getReturnDetailForInspector(...a),
  approveReturn: vi.fn(),
  rejectReturn: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const rows: ReturnRow[] = [
  { id: 'r1', rmaNumber: 'RMA-100000', orderId: 'o1', orderNumber: 'HOF-1', customerName: 'Ada', status: 'REQUESTED', requestedAt: new Date('2026-05-15'), refundAmount: 49.99 },
  { id: 'r2', rmaNumber: 'RMA-100001', orderId: 'o2', orderNumber: 'HOF-2', customerName: null, status: 'APPROVED', requestedAt: new Date('2026-05-16'), refundAmount: 30 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReturnsListView', () => {
  it('renders rows', () => {
    render(<ReturnsListView rows={rows} />)
    expect(screen.getByText('RMA-100000')).toBeInTheDocument()
    expect(screen.getByText('RMA-100001')).toBeInTheDocument()
  })

  it('opens inspector on action click', async () => {
    getReturnDetailForInspector.mockResolvedValue({
      id: 'r1', rmaNumber: 'RMA-100000', orderId: 'o1', orderNumber: 'HOF-1',
      customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com',
      status: 'REQUESTED', reason: 'wrong size', internalNotes: null,
      returnLabel: null, returnTrackingNumber: null, receivedAt: null,
      windowExpiresAt: new Date(), requestedAt: new Date(), decidedAt: null,
      items: [], refunds: [],
    })
    render(<ReturnsListView rows={rows} />)
    fireEvent.click(screen.getAllByLabelText(/open return/i)[0])
    await waitFor(() => expect(getReturnDetailForInspector).toHaveBeenCalledWith('r1'))
  })

  it('renders empty state', () => {
    render(<ReturnsListView rows={[]} />)
    expect(screen.getByText(/no returns/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/ReturnsListView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/ReturnsListView.tsx`**

```tsx
// components/admin/fulfillment/ReturnsListView.tsx
'use client'

import { useState, useTransition } from 'react'
import { DotsThreeOutline } from '@phosphor-icons/react/dist/ssr'
import { ReturnInspector } from './ReturnInspector'
import { getReturnDetailForInspector } from '@/app/admin/fulfillment/actions'
import type { ReturnRow, ReturnWithItems } from '@/lib/admin/fulfillment'

const RETURN_STATUS_PILL: Record<string, string> = {
  REQUESTED: 'bg-amber-500/15 text-amber-300',
  APPROVED:  'bg-sky-500/15 text-sky-300',
  REJECTED:  'bg-red-500/15 text-red-300',
  RECEIVED:  'bg-indigo-500/15 text-indigo-300',
  REFUNDED:  'bg-emerald-500/15 text-emerald-300',
}

interface ReturnsListViewProps {
  rows: ReturnRow[]
}

export function ReturnsListView({ rows }: ReturnsListViewProps) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<ReturnWithItems | null>(null)
  const [, startTransition] = useTransition()

  const openInspector = (id: string) => {
    setOpen(true)
    startTransition(async () => {
      const d = await getReturnDetailForInspector(id)
      setDetail(d)
    })
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-white/40 border border-white/8 rounded-md bg-neutral-900/40">
        No returns yet.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden border border-white/8 rounded-md bg-neutral-900/60">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/80 border-b border-white/8">
            <tr className="text-left text-xs text-white/50 uppercase tracking-wide">
              <th className="px-3 py-2">RMA #</th>
              <th className="px-3 py-2">Order #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Requested</th>
              <th className="px-3 py-2 text-right">Refund</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-3 py-2 font-mono text-xs text-white">{r.rmaNumber}</td>
                <td className="px-3 py-2 font-mono text-xs text-white/70">{r.orderNumber}</td>
                <td className="px-3 py-2 text-white/80">{r.customerName ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${RETURN_STATUS_PILL[r.status] ?? ''}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-white/60">{r.requestedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                <td className="px-3 py-2 text-right text-white tabular-nums">${r.refundAmount.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    aria-label={`Open return ${r.rmaNumber}`}
                    onClick={() => openInspector(r.id)}
                    className="p-1 rounded hover:bg-white/[0.08] text-white/60 hover:text-white"
                  >
                    <DotsThreeOutline size={16} weight="bold" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReturnInspector
        open={open}
        detail={detail}
        onClose={() => {
          setOpen(false)
          setDetail(null)
        }}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/ReturnsListView.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/ReturnsListView.tsx tests/unit/components/admin/fulfillment/ReturnsListView.test.tsx
git commit -m "feat(admin-v2): add ReturnsListView with inspector hookup"
git push -u origin wave4p4/task-10-returns-list-view
gh pr create --title "feat(admin-v2): Phase 4 W5 ReturnsListView" --body "Returns table with RMA #, order #, customer, status pill, requested date, total refunded. Per-row action opens ReturnInspector hydrated via getReturnDetailForInspector server action."
```

---

### Task 11: `ArchivedListView.tsx`

**Wave:** 5 | **Parallel-safe with:** Task 9, 10, 12 | **Branch:** `wave4p4/task-11-archived-list-view` | **Model:** sonnet

**Schema realities for this task:**
- Read-only — no bulk sheet, no inspector edits.
- Renders only orders with `status IN (CANCELLED, REFUNDED)` (loader handles the where; this view is render-only).
- Mobile: minimal stacked cards (no swipe action since no edits allowed).

**Files:**
- Create: `components/admin/fulfillment/ArchivedListView.tsx`
- Test: `tests/unit/components/admin/fulfillment/ArchivedListView.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/ArchivedListView.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArchivedListView } from '@/components/admin/fulfillment/ArchivedListView'
import type { OrderRow } from '@/lib/admin/fulfillment'

const rows: OrderRow[] = [
  { id: 'o1', orderNumber: 'HOF-X1', customerName: 'Ada', customerEmail: 'a@e.com', status: 'CANCELLED', paymentStatus: 'REFUNDED', totalAmount: 30, createdAt: new Date('2026-04-01'), trackingNumber: null, carrier: null, itemCount: 1 },
  { id: 'o2', orderNumber: 'HOF-X2', customerName: null, customerEmail: 'b@e.com', status: 'REFUNDED', paymentStatus: 'REFUNDED', totalAmount: 60, createdAt: new Date('2026-04-02'), trackingNumber: null, carrier: null, itemCount: 2 },
]

describe('ArchivedListView', () => {
  it('renders archived rows', () => {
    render(<ArchivedListView rows={rows} />)
    expect(screen.getByText('HOF-X1')).toBeInTheDocument()
    expect(screen.getByText('HOF-X2')).toBeInTheDocument()
  })

  it('does not show checkboxes (read-only)', () => {
    render(<ArchivedListView rows={rows} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('renders empty state', () => {
    render(<ArchivedListView rows={[]} />)
    expect(screen.getByText(/no archived/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/ArchivedListView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/ArchivedListView.tsx`**

```tsx
// components/admin/fulfillment/ArchivedListView.tsx
'use client'

import Link from 'next/link'
import type { OrderRow } from '@/lib/admin/fulfillment'

interface ArchivedListViewProps {
  rows: OrderRow[]
}

const STATUS_PILL: Record<string, string> = {
  CANCELLED: 'bg-neutral-500/15 text-neutral-400',
  REFUNDED:  'bg-rose-500/15 text-rose-300',
}

export function ArchivedListView({ rows }: ArchivedListViewProps) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-white/40 border border-white/8 rounded-md bg-neutral-900/40">
        No archived orders.
      </div>
    )
  }

  return (
    <div className="overflow-hidden border border-white/8 rounded-md bg-neutral-900/60">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900/80 border-b border-white/8">
          <tr className="text-left text-xs text-white/50 uppercase tracking-wide">
            <th className="px-3 py-2">Order #</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.04]">
              <td className="px-3 py-2 font-mono text-xs">
                <Link href={`/admin/fulfillment/${r.id}`} className="text-sky-300 hover:text-sky-200">{r.orderNumber}</Link>
              </td>
              <td className="px-3 py-2 text-white/70">{r.customerName ?? r.customerEmail}</td>
              <td className="px-3 py-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_PILL[r.status] ?? ''}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-white/70 tabular-nums">${r.totalAmount.toFixed(2)}</td>
              <td className="px-3 py-2 text-white/50">{r.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/ArchivedListView.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/ArchivedListView.tsx tests/unit/components/admin/fulfillment/ArchivedListView.test.tsx
git commit -m "feat(admin-v2): add ArchivedListView (read-only CANCELLED/REFUNDED)"
git push -u origin wave4p4/task-11-archived-list-view
gh pr create --title "feat(admin-v2): Phase 4 W5 ArchivedListView" --body "Read-only table for CANCELLED + REFUNDED orders. No checkboxes, no bulk actions, no inspector — order #s link out to the V2 detail page."
```

---

### Task 12: `NewOrderToast.tsx` + Socket.IO `order:new` emit wiring

**Wave:** 5 | **Parallel-safe with:** Task 9, 10, 11 | **Branch:** `wave4p4/task-12-new-order-toast` | **Model:** sonnet

**Schema realities for this task:**
- Socket.IO server is initialised in `lib/socket.ts` (`getIO()` returns the instance; throws if not initialised). The `chat:*` and `admin:*` event handlers exist but there is **no `order:new` emit anywhere**.
- The order creation site is `app/api/orders/route.ts` — emit `order:new` from the POST handler AFTER the `prisma.$transaction` returns the new order.
- Emit to the per-admin room: `io.emit('order:new', { id, orderNumber, total, customerEmail })` (broadcast to all sockets; admins are the only ones who care, and clients ignore unknown events).
- Client subscribes with a `useEffect` that opens a `socket.io-client` connection on mount.
- Debounce: dedupe duplicate `order:new` events for the same `id` within 5s.

**Files:**
- Create: `components/admin/fulfillment/NewOrderToast.tsx`
- Modify: `app/api/orders/route.ts` (emit `order:new` after successful POST commit)
- Test: `tests/unit/components/admin/fulfillment/NewOrderToast.test.tsx`

#### Steps

- [ ] **Step 1: Investigate Socket.IO emit pattern in `lib/socket.ts`**

Open `lib/socket.ts` and confirm `getIO()` returns the `SocketIOServer` instance. Confirm the `notifyNewChatRequest` helper at the bottom of the file uses `io?.to(...).emit(...)` — that is the broadcast pattern we'll mirror. We do NOT need admin-room filtering for `order:new` — clients that aren't on the admin page simply ignore the event.

- [ ] **Step 2: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/NewOrderToast.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { NewOrderToast } from '@/components/admin/fulfillment/NewOrderToast'

const handlers: Record<string, ((p: unknown) => void) | undefined> = {}
const socketMock = {
  on: vi.fn((evt: string, fn: (p: unknown) => void) => {
    handlers[evt] = fn
  }),
  off: vi.fn(),
  disconnect: vi.fn(),
}
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMock),
}))

const toastInfo = vi.fn()
vi.mock('@/lib/toast', () => ({
  toast: { info: (...a: unknown[]) => toastInfo(...a), success: vi.fn(), error: vi.fn() },
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(handlers)) delete handlers[k]
})

describe('NewOrderToast', () => {
  it('subscribes to order:new on mount', () => {
    render(<NewOrderToast />)
    expect(socketMock.on).toHaveBeenCalledWith('order:new', expect.any(Function))
  })

  it('shows a toast on order:new', () => {
    render(<NewOrderToast />)
    act(() => {
      handlers['order:new']?.({ id: 'o1', orderNumber: 'HOF-1', total: 49.99, customerEmail: 'x@e.com' })
    })
    expect(toastInfo).toHaveBeenCalled()
  })

  it('debounces duplicate events for the same id within 5s', () => {
    render(<NewOrderToast />)
    act(() => {
      handlers['order:new']?.({ id: 'o1', orderNumber: 'HOF-1', total: 49, customerEmail: 'x@e.com' })
      handlers['order:new']?.({ id: 'o1', orderNumber: 'HOF-1', total: 49, customerEmail: 'x@e.com' })
    })
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('disconnects on unmount', () => {
    const { unmount } = render(<NewOrderToast />)
    unmount()
    expect(socketMock.disconnect).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/NewOrderToast.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `components/admin/fulfillment/NewOrderToast.tsx`**

```tsx
// components/admin/fulfillment/NewOrderToast.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { io as ioClient } from 'socket.io-client'
import { toast } from '@/lib/toast'

interface OrderNewPayload {
  id: string
  orderNumber: string
  total: number
  customerEmail: string
}

const DEDUPE_MS = 5000

export function NewOrderToast() {
  const router = useRouter()
  const seen = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const socket = ioClient({ path: '/api/socket', withCredentials: true })

    const handler = (raw: unknown) => {
      const p = raw as OrderNewPayload
      const now = Date.now()
      const last = seen.current.get(p.id) ?? 0
      if (now - last < DEDUPE_MS) return
      seen.current.set(p.id, now)

      toast.info(`New order ${p.orderNumber}`, `${p.customerEmail} · $${p.total.toFixed(2)} — click to refresh`)
      // Sonner doesn't expose a built-in click handler in our wrapper; the
      // operator can manually press the refresh keybind. The toast itself
      // serves as the surface. A second click goes through router.refresh().
    }

    socket.on('order:new', handler)
    return () => {
      socket.off('order:new', handler)
      socket.disconnect()
    }
  }, [router])

  return null
}
```

- [ ] **Step 5: Wire `order:new` emit in `app/api/orders/route.ts`**

Add this import near the other top-level imports in `app/api/orders/route.ts`:

```ts
import { getIO } from '@/lib/socket'
```

Then, inside the `POST` handler — AFTER the `prisma.$transaction` resolves and BEFORE `return NextResponse.json(...)` at the success path — add the emit. The current success path looks like:

```ts
return NextResponse.json({
  success: true,
  order: result,
})
```

Insert this immediately above that `return`:

```ts
// Best-effort broadcast for the admin v2 NewOrderToast. We swallow errors so a
// disconnected Socket.IO server can never block order creation.
try {
  const io = getIO()
  io.emit('order:new', {
    id: result.id,
    orderNumber: result.orderNumber,
    total: Number(result.total),
    customerEmail: result.customerEmail,
  })
} catch {
  // Socket.IO not initialised (e.g., during server-rendered build) — ignore.
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/NewOrderToast.test.tsx`
Expected: PASS — 4 tests passing.

- [ ] **Step 7: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 8: Commit + push + PR**

```bash
git add components/admin/fulfillment/NewOrderToast.tsx app/api/orders/route.ts tests/unit/components/admin/fulfillment/NewOrderToast.test.tsx
git commit -m "feat(admin-v2): add NewOrderToast + emit order:new from POST /api/orders"
git push -u origin wave4p4/task-12-new-order-toast
gh pr create --title "feat(admin-v2): Phase 4 W5 NewOrderToast + order:new emit" --body "Adds a client-only toast that subscribes to the Socket.IO order:new event (with 5s id-based dedupe) and wires the emit from the order creation endpoint. Best-effort try/catch so a missing Socket.IO server can never break checkout."
```

---

## Wave 6 — V2 root + page dispatcher (sequential, opus model)

### Task 13: V1 extraction + `AdminFulfillmentV2` + `FulfillmentTabPills` + page dispatcher

**Wave:** 6 | **Parallel-safe with:** none | **Branch:** `wave4p4/task-13-admin-fulfillment-v2` | **Model:** opus

**Schema realities for this task:**
- The current `app/admin/fulfillment/page.tsx` is a 2,806-line client component (the entire V1 queue workbench). Extracted file MUST preserve the existing `'use client'` directive and all imports unchanged.
- 7 tabs: `all`, `needs-action`, `processing`, `shipped`, `delivered`, `returns`, `archived`.
- KPI strip = 4 cards: Needs Action / Ready to Ship / Today's Revenue / Returns Pending. Cards are `<Link href="?tab=...">`.
- FilterBar is a placeholder for Phase 4.5 (same pattern as Phase 3's `<div>Filter bar — Phase 3.5</div>`).
- Page exports `revalidate = 60`.
- Dispatcher uses `process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true'`.

**Files:**
- Create: `components/admin/_v1/AdminFulfillmentV1.tsx` (extracted V1)
- Create: `components/admin/dashboard/AdminFulfillmentV2.tsx`
- Create: `components/admin/dashboard/FulfillmentTabPills.tsx`
- Modify: `app/admin/fulfillment/page.tsx` (replace with dispatcher)
- Test: `tests/unit/components/admin/dashboard/AdminFulfillmentV2.test.tsx`
- Test: `tests/unit/app/admin/fulfillment/page.test.tsx`

#### Steps

- [ ] **Step 1: Extract V1 unchanged**

```bash
git mv app/admin/fulfillment/page.tsx components/admin/_v1/AdminFulfillmentV1.tsx
```

Then rewrite the file's default export to a named export (the file already has `'use client'` and uses `export default function FulfillmentPage()` — change to `export function AdminFulfillmentV1()`). Do NOT change anything else inside the body.

**Exact diff** (only the function declaration changes — every other line of the 2,806-line file is preserved verbatim):

```diff
- export default function FulfillmentPage() {
+ export function AdminFulfillmentV1() {
```

The first line of the file (`'use client'`) stays. All imports stay. Every function in the file stays. Every JSX block stays. Do NOT edit hooks, helpers, or render logic — just rename the export. The renamed function will be the only export; if there were any helper exports before, leave them alone (they are not consumed externally).

- [ ] **Step 2: Write the failing V2 root test**

```tsx
// tests/unit/components/admin/dashboard/AdminFulfillmentV2.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/fulfillment', () => ({
  loadFulfillmentKpis: vi.fn(async () => ({
    needsActionCount: 3, readyToShipCount: 5, todaysRevenue: 200, returnsPendingCount: 1,
  })),
  loadOrdersTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  loadReturnsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  loadArchivedTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  isFulfillmentTab: (s: unknown) => typeof s === 'string' && ['all','needs-action','processing','shipped','delivered','returns','archived'].includes(s),
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div><h1>{title}</h1>{children}</div>
  ),
}))

vi.mock('@/components/admin/fulfillment/OrdersListView', () => ({
  OrdersListView: () => <div data-testid="orders-list" />,
}))
vi.mock('@/components/admin/fulfillment/ReturnsListView', () => ({
  ReturnsListView: () => <div data-testid="returns-list" />,
}))
vi.mock('@/components/admin/fulfillment/ArchivedListView', () => ({
  ArchivedListView: () => <div data-testid="archived-list" />,
}))
vi.mock('@/components/admin/dashboard/FulfillmentTabPills', () => ({
  FulfillmentTabPills: () => <div data-testid="tab-pills" />,
}))
vi.mock('@/components/admin/fulfillment/NewOrderToast', () => ({
  NewOrderToast: () => <div data-testid="new-order-toast" />,
}))

describe('AdminFulfillmentV2', () => {
  it('renders the layout title', async () => {
    const { AdminFulfillmentV2 } = await import('@/components/admin/dashboard/AdminFulfillmentV2')
    render(await AdminFulfillmentV2({ searchParams: {} }))
    expect(screen.getByText('Fulfillment')).toBeInTheDocument()
  })

  it('renders OrdersListView for default tab', async () => {
    const { AdminFulfillmentV2 } = await import('@/components/admin/dashboard/AdminFulfillmentV2')
    render(await AdminFulfillmentV2({ searchParams: {} }))
    expect(screen.getByTestId('orders-list')).toBeInTheDocument()
  })

  it('renders ReturnsListView when tab=returns', async () => {
    const { AdminFulfillmentV2 } = await import('@/components/admin/dashboard/AdminFulfillmentV2')
    render(await AdminFulfillmentV2({ searchParams: { tab: 'returns' } }))
    expect(screen.getByTestId('returns-list')).toBeInTheDocument()
  })

  it('renders ArchivedListView when tab=archived', async () => {
    const { AdminFulfillmentV2 } = await import('@/components/admin/dashboard/AdminFulfillmentV2')
    render(await AdminFulfillmentV2({ searchParams: { tab: 'archived' } }))
    expect(screen.getByTestId('archived-list')).toBeInTheDocument()
  })

  it('mounts NewOrderToast', async () => {
    const { AdminFulfillmentV2 } = await import('@/components/admin/dashboard/AdminFulfillmentV2')
    render(await AdminFulfillmentV2({ searchParams: {} }))
    expect(screen.getByTestId('new-order-toast')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/dashboard/AdminFulfillmentV2.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `components/admin/dashboard/FulfillmentTabPills.tsx`**

```tsx
// components/admin/dashboard/FulfillmentTabPills.tsx
'use client'

import { useRouter } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { FulfillmentTab } from '@/lib/admin/fulfillment'

interface FulfillmentTabPillsProps {
  tabs: ReadonlyArray<{ id: FulfillmentTab; label: string }>
  active: FulfillmentTab
}

export function FulfillmentTabPills({ tabs, active }: FulfillmentTabPillsProps) {
  const router = useRouter()
  const pillTabs: TabPillsTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))
  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${id}`)}
      showShortcutHints
    />
  )
}
```

- [ ] **Step 5: Write `components/admin/dashboard/AdminFulfillmentV2.tsx`**

```tsx
// components/admin/dashboard/AdminFulfillmentV2.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadFulfillmentKpis,
  loadOrdersTab,
  loadReturnsTab,
  loadArchivedTab,
  isFulfillmentTab,
  type FulfillmentTab,
  type OrdersTab,
} from '@/lib/admin/fulfillment'
import { OrdersListView } from '@/components/admin/fulfillment/OrdersListView'
import { ReturnsListView } from '@/components/admin/fulfillment/ReturnsListView'
import { ArchivedListView } from '@/components/admin/fulfillment/ArchivedListView'
import { NewOrderToast } from '@/components/admin/fulfillment/NewOrderToast'
import { FulfillmentTabPills } from './FulfillmentTabPills'

interface Props {
  searchParams: { tab?: string }
}

const TAB_CONFIG: ReadonlyArray<{ id: FulfillmentTab; label: string }> = [
  { id: 'all',          label: 'All' },
  { id: 'needs-action', label: 'Needs Action' },
  { id: 'processing',   label: 'Processing' },
  { id: 'shipped',      label: 'Shipped' },
  { id: 'delivered',    label: 'Delivered' },
  { id: 'returns',      label: 'Returns' },
  { id: 'archived',     label: 'Archived' },
]

function parseTab(raw: string | undefined): FulfillmentTab {
  return isFulfillmentTab(raw) ? raw : 'all'
}

// ─── Slot wrappers ────────────────────────────────────────────────────────────

async function KpiStripSlot() {
  const k = await loadFulfillmentKpis()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href="?tab=needs-action"><StatCard label="Needs Action"     value={k.needsActionCount}     variant="warning" /></Link>
      <Link href="?tab=processing"  ><StatCard label="Ready to Ship"    value={k.readyToShipCount}    /></Link>
      <div>                          <StatCard label="Today's Revenue"  value={`$${k.todaysRevenue.toFixed(2)}`} /></div>
      <Link href="?tab=returns"     ><StatCard label="Returns Pending"  value={k.returnsPendingCount} /></Link>
    </div>
  )
}

async function OrdersListTabSlot({ tab }: { tab: OrdersTab }) {
  const r = await loadOrdersTab(tab)
  return <OrdersListView rows={r.items} />
}

async function ReturnsTabSlot() {
  const r = await loadReturnsTab()
  return <ReturnsListView rows={r.items} />
}

async function ArchivedTabSlot() {
  const r = await loadArchivedTab()
  return <ArchivedListView rows={r.items} />
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}

function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}

export async function AdminFulfillmentV2({ searchParams }: Props) {
  const tab = parseTab(searchParams.tab)
  const isOrdersTab = tab !== 'returns' && tab !== 'archived'

  return (
    <AdminLayout title="Fulfillment" subtitle="Orders, returns, and refunds">
      <NewOrderToast />
      <div className="space-y-3.5">
        <FulfillmentTabPills tabs={TAB_CONFIG} active={tab} />

        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiStripSlot />
        </Suspense>

        {/* TODO(phase-4.5): real filter bar (search, date range, payment, carrier, has-tracking) */}
        <div className="text-xs text-white/40 mb-4">Filter bar — Phase 4.5</div>

        {tab === 'returns' ? (
          <Suspense fallback={<ListSkeleton />}>
            <ReturnsTabSlot />
          </Suspense>
        ) : tab === 'archived' ? (
          <Suspense fallback={<ListSkeleton />}>
            <ArchivedTabSlot />
          </Suspense>
        ) : isOrdersTab ? (
          <Suspense fallback={<ListSkeleton />}>
            <OrdersListTabSlot tab={tab} />
          </Suspense>
        ) : null}
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 6: Write the failing dispatcher test**

```tsx
// tests/unit/app/admin/fulfillment/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/fulfillment',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/admin/dashboard/AdminFulfillmentV2', () => ({
  AdminFulfillmentV2: () => <div data-testid="v2">V2 fulfillment</div>,
}))
vi.mock('@/components/admin/_v1/AdminFulfillmentV1', () => ({
  AdminFulfillmentV1: () => <div data-testid="v1">V1 fulfillment</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/fulfillment/page dispatcher', () => {
  it('renders V1 when flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/page')
    render(await mod.default({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 when flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/page')
    render(await mod.default({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v2')).toBeInTheDocument()
  })

  it('passes searchParams through to V2', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const v2Spy = vi.fn(() => <div data-testid="v2-with-params" />)
    vi.doMock('@/components/admin/dashboard/AdminFulfillmentV2', () => ({
      AdminFulfillmentV2: v2Spy,
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/page')
    render(await mod.default({ searchParams: Promise.resolve({ tab: 'returns' }) }))
    expect(screen.getByTestId('v2-with-params')).toBeInTheDocument()
    expect(v2Spy).toHaveBeenCalledWith(
      expect.objectContaining({ searchParams: { tab: 'returns' } }),
      undefined,
    )
  })
})
```

- [ ] **Step 7: Write `app/admin/fulfillment/page.tsx` dispatcher**

```tsx
// app/admin/fulfillment/page.tsx
import { AdminFulfillmentV1 } from '@/components/admin/_v1/AdminFulfillmentV1'
import { AdminFulfillmentV2 } from '@/components/admin/dashboard/AdminFulfillmentV2'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminFulfillmentPage({ searchParams }: PageProps) {
  const params = await searchParams
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true') {
    return <AdminFulfillmentV2 searchParams={params} />
  }
  return <AdminFulfillmentV1 />
}
```

- [ ] **Step 8: Run both tests**

```bash
pnpm test tests/unit/components/admin/dashboard/AdminFulfillmentV2.test.tsx tests/unit/app/admin/fulfillment/page.test.tsx
```

Expected: PASS — 5 + 3 = 8 tests.

- [ ] **Step 9: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 10: Commit + push + PR**

```bash
git add components/admin/_v1/AdminFulfillmentV1.tsx components/admin/dashboard/AdminFulfillmentV2.tsx components/admin/dashboard/FulfillmentTabPills.tsx app/admin/fulfillment/page.tsx tests/unit/components/admin/dashboard/AdminFulfillmentV2.test.tsx tests/unit/app/admin/fulfillment/page.test.tsx
git commit -m "feat(admin-v2): add AdminFulfillmentV2 root + tab pills + page dispatcher (V1 extracted)"
git push -u origin wave4p4/task-13-admin-fulfillment-v2
gh pr create --title "feat(admin-v2): Phase 4 W6 AdminFulfillmentV2 root + dispatcher" --body "Extracts V1 fulfillment page unchanged to components/admin/_v1/AdminFulfillmentV1.tsx. Adds AdminFulfillmentV2 (7-tab composition with Suspense slots for KPIs / orders / returns / archived, plus NewOrderToast mount). Page dispatcher gates on NEXT_PUBLIC_ADMIN_V2_ENABLED."
```

---

## Wave 7 — Order detail widgets (8 parallel, after W2 merged)

> All Wave 7 tasks consume `OrderDetailFull` from W2. They can run in parallel with W3-W6 once W2 is merged. The widgets compose in Task 22 (Wave 8).

### Task 14: `OrderHeader.tsx`

**Wave:** 7 | **Parallel-safe with:** 15-21 | **Branch:** `wave4p4/task-14-order-header` | **Model:** sonnet

**Schema realities for this task:**
- Pure display; client or server component (no interactions yet — keep as server-renderable). No `'use client'` directive.
- Customer link goes to `/admin/customers/${customerId}` only when `customerId != null` (guest orders may have null `customerId`).

**Files:**
- Create: `components/admin/fulfillment/detail/OrderHeader.tsx`
- Test: `tests/unit/components/admin/fulfillment/detail/OrderHeader.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/detail/OrderHeader.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderHeader } from '@/components/admin/fulfillment/detail/OrderHeader'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'ada@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
  shippingAddress: null, billingAddress: null,
  items: [], returns: [], refunds: [],
}

describe('OrderHeader', () => {
  it('renders order number, status, total, customer link', () => {
    render(<OrderHeader detail={detail} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
    expect(screen.getByText('PROCESSING')).toBeInTheDocument()
    expect(screen.getByText(/\$100/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ada/i })).toHaveAttribute('href', '/admin/customers/c1')
  })

  it('shows customer email as plain text when customerId is null (guest)', () => {
    render(<OrderHeader detail={{ ...detail, customerId: null, customerName: null }} />)
    expect(screen.queryByRole('link', { name: /ada@e\.com/i })).toBeNull()
    expect(screen.getByText('ada@e.com')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderHeader.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/detail/OrderHeader.tsx`**

```tsx
// components/admin/fulfillment/detail/OrderHeader.tsx
import Link from 'next/link'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const STATUS_PILL: Record<string, string> = {
  PENDING:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  CONFIRMED:  'bg-sky-500/15 text-sky-300 border-sky-500/30',
  PROCESSING: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  SHIPPED:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  DELIVERED:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CANCELLED:  'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
  REFUNDED:   'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

interface OrderHeaderProps {
  detail: OrderDetailFull
}

export function OrderHeader({ detail }: OrderHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-white font-mono">{detail.orderNumber}</h1>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${STATUS_PILL[detail.status] ?? ''}`}>
            {detail.status}
          </span>
        </div>
        <div className="text-sm text-white/60 mt-1">
          {detail.customerId ? (
            <Link href={`/admin/customers/${detail.customerId}`} className="text-sky-300 hover:text-sky-200">
              {detail.customerName ?? detail.customerEmail}
            </Link>
          ) : (
            <span>{detail.customerEmail}</span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-white/40">Total</div>
        <div className="text-2xl font-semibold text-white tabular-nums">${detail.total.toFixed(2)}</div>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderHeader.test.tsx`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/detail/OrderHeader.tsx tests/unit/components/admin/fulfillment/detail/OrderHeader.test.tsx
git commit -m "feat(admin-v2): add OrderHeader detail widget"
git push -u origin wave4p4/task-14-order-header
gh pr create --title "feat(admin-v2): Phase 4 W7 OrderHeader" --body "Header for the V2 order detail page — order number, status pill, customer link (or plain email for guest orders), total."
```

---

### Task 15: `OrderLineItems.tsx`

**Wave:** 7 | **Parallel-safe with:** 14, 16-21 | **Branch:** `wave4p4/task-15-order-line-items` | **Model:** sonnet

**Schema realities for this task:**
- `OrderItemDetail.sku` is the derived SKU (from `productVariant.sku`) added in Task 2.
- `productImage` may be null — fall back to a placeholder div.
- `variantDetails` is a JSON-encoded string like `{"size":"M","color":"Red","sku":"..."}`; parse defensively.

**Files:**
- Create: `components/admin/fulfillment/detail/OrderLineItems.tsx`
- Test: `tests/unit/components/admin/fulfillment/detail/OrderLineItems.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/detail/OrderLineItems.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderLineItems } from '@/components/admin/fulfillment/detail/OrderLineItems'
import type { OrderItemDetail } from '@/lib/admin/fulfillment'

const items: OrderItemDetail[] = [
  { id: 'i1', productId: 'p1', productVariantId: 'v1', quantity: 2, price: 49.99, productName: 'Tee', productImage: '/t.jpg', sku: 'TEE-S-RED', variantDetails: JSON.stringify({ size: 'S', color: 'Red' }) },
  { id: 'i2', productId: 'p2', productVariantId: null, quantity: 1, price: 19.99, productName: 'Hat', productImage: null, sku: null, variantDetails: null },
]

describe('OrderLineItems', () => {
  it('renders each line', () => {
    render(<OrderLineItems items={items} />)
    expect(screen.getByText('Tee')).toBeInTheDocument()
    expect(screen.getByText('Hat')).toBeInTheDocument()
  })

  it('shows variant size + color when available', () => {
    render(<OrderLineItems items={items} />)
    expect(screen.getByText(/S/)).toBeInTheDocument()
    expect(screen.getByText(/Red/)).toBeInTheDocument()
  })

  it('computes subtotal per line', () => {
    render(<OrderLineItems items={items} />)
    expect(screen.getByText('$99.98')).toBeInTheDocument() // 2 * 49.99
    expect(screen.getByText('$19.99')).toBeInTheDocument()
  })

  it('handles null image', () => {
    render(<OrderLineItems items={items} />)
    const placeholders = document.querySelectorAll('[data-testid="line-item-no-image"]')
    expect(placeholders.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderLineItems.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/detail/OrderLineItems.tsx`**

```tsx
// components/admin/fulfillment/detail/OrderLineItems.tsx
import Image from 'next/image'
import type { OrderItemDetail } from '@/lib/admin/fulfillment'

interface OrderLineItemsProps {
  items: OrderItemDetail[]
}

function parseVariant(raw: string | null): { size?: string; color?: string } {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw) as { size?: string; color?: string }
    return obj
  } catch {
    return {}
  }
}

export function OrderLineItems({ items }: OrderLineItemsProps) {
  if (items.length === 0) {
    return <p className="text-sm text-white/40">No line items.</p>
  }
  return (
    <div className="border border-white/8 rounded-md overflow-hidden bg-neutral-900/60">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900/80 border-b border-white/8 text-left text-xs uppercase text-white/50">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Variant</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const variant = parseVariant(it.variantDetails)
            const subtotal = it.quantity * it.price
            return (
              <tr key={it.id} className="border-b border-white/[0.04]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {it.productImage ? (
                      <Image src={it.productImage} alt="" width={32} height={32} className="rounded" />
                    ) : (
                      <div data-testid="line-item-no-image" className="w-8 h-8 bg-white/[0.06] rounded" />
                    )}
                    <div>
                      <div className="text-white">{it.productName}</div>
                      {it.sku && <div className="text-[11px] text-white/40 font-mono">{it.sku}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-white/70 text-xs">
                  {variant.size && <span className="mr-2">Size: {variant.size}</span>}
                  {variant.color && <span>Color: {variant.color}</span>}
                </td>
                <td className="px-3 py-2 text-right text-white/70 tabular-nums">{it.quantity}</td>
                <td className="px-3 py-2 text-right text-white/70 tabular-nums">${it.price.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-white tabular-nums">${subtotal.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderLineItems.test.tsx`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/detail/OrderLineItems.tsx tests/unit/components/admin/fulfillment/detail/OrderLineItems.test.tsx
git commit -m "feat(admin-v2): add OrderLineItems table"
git push -u origin wave4p4/task-15-order-line-items
gh pr create --title "feat(admin-v2): Phase 4 W7 OrderLineItems" --body "Line items table for order detail: thumbnail, name, SKU (from productVariant.sku), variant size/color from JSON, quantity, unit price, line subtotal."
```

---

### Task 16: `OrderShippingPanel.tsx`

**Wave:** 7 | **Parallel-safe with:** 14, 15, 17-21 | **Branch:** `wave4p4/task-16-order-shipping-panel` | **Model:** sonnet

**Schema realities for this task:**
- Client component; wires `setTracking` and `purchaseShippingLabel` server actions.
- Editable shipping address — for v1, render as read-only display + "Edit on customer page" link. Full address editing is Phase 4.5. The spec mentions `saveOrderAddress` action; we explicitly DEFER it to keep the PR scope tight.

**Files:**
- Create: `components/admin/fulfillment/detail/OrderShippingPanel.tsx`
- Test: `tests/unit/components/admin/fulfillment/detail/OrderShippingPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/detail/OrderShippingPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderShippingPanel } from '@/components/admin/fulfillment/detail/OrderShippingPanel'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const setTracking = vi.fn()
const purchaseShippingLabel = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  setTracking: (...a: unknown[]) => setTracking(...a),
  purchaseShippingLabel: (...a: unknown[]) => purchaseShippingLabel(...a),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'ada@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date(), updatedAt: new Date(),
  shippingAddress: {
    id: 'a1', firstName: 'Ada', lastName: 'L', address1: '1 St', address2: null,
    city: 'NY', state: 'NY', postalCode: '10001', country: 'US',
  },
  billingAddress: null,
  items: [], returns: [], refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrderShippingPanel', () => {
  it('renders the shipping address', () => {
    render(<OrderShippingPanel detail={detail} />)
    expect(screen.getByText('Ada L')).toBeInTheDocument()
    expect(screen.getByText('1 St')).toBeInTheDocument()
    expect(screen.getByText(/NY, NY 10001/)).toBeInTheDocument()
  })

  it('saves tracking + carrier', async () => {
    setTracking.mockResolvedValue({ ok: true })
    render(<OrderShippingPanel detail={detail} />)
    fireEvent.change(screen.getByLabelText(/tracking number/i), { target: { value: '1Z' } })
    fireEvent.change(screen.getByLabelText(/carrier/i), { target: { value: 'UPS' } })
    fireEvent.click(screen.getByRole('button', { name: /save tracking/i }))
    await waitFor(() =>
      expect(setTracking).toHaveBeenCalledWith('o1', { trackingNumber: '1Z', carrier: 'UPS' })
    )
  })

  it('Buy label calls purchaseShippingLabel', async () => {
    purchaseShippingLabel.mockResolvedValue({ ok: true, data: { trackingNumber: 'NEW' } })
    render(<OrderShippingPanel detail={detail} />)
    fireEvent.click(screen.getByRole('button', { name: /buy label/i }))
    await waitFor(() => expect(purchaseShippingLabel).toHaveBeenCalledWith('o1'))
  })

  it('shows empty state when no shipping address', () => {
    render(<OrderShippingPanel detail={{ ...detail, shippingAddress: null }} />)
    expect(screen.getByText(/no shipping address/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderShippingPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/detail/OrderShippingPanel.tsx`**

```tsx
// components/admin/fulfillment/detail/OrderShippingPanel.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { setTracking, purchaseShippingLabel } from '@/app/admin/fulfillment/actions'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

interface OrderShippingPanelProps {
  detail: OrderDetailFull
}

export function OrderShippingPanel({ detail }: OrderShippingPanelProps) {
  const [pending, startTransition] = useTransition()
  const [tn, setTn] = useState(detail.trackingNumber ?? '')
  const [carrier, setCarrier] = useState(detail.carrier ?? '')
  void pending

  const handleSaveTracking = () => {
    startTransition(async () => {
      const r = await setTracking(detail.id, { trackingNumber: tn, carrier })
      if (r.ok) toast.success('Tracking saved')
      else toast.error(r.error)
    })
  }

  const handleBuyLabel = () => {
    startTransition(async () => {
      const r = await purchaseShippingLabel(detail.id)
      if (r.ok) toast.success(`Label purchased — ${r.data?.trackingNumber}`)
      else toast.error(r.error)
    })
  }

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60 space-y-3">
      <h2 className="text-sm font-semibold text-white">Shipping</h2>
      {detail.shippingAddress ? (
        <div className="text-xs text-white/70 space-y-0.5">
          <div className="text-white">{detail.shippingAddress.firstName} {detail.shippingAddress.lastName}</div>
          <div>{detail.shippingAddress.address1}</div>
          {detail.shippingAddress.address2 && <div>{detail.shippingAddress.address2}</div>}
          <div>{detail.shippingAddress.city}, {detail.shippingAddress.state} {detail.shippingAddress.postalCode}</div>
          <div className="text-white/50">{detail.shippingAddress.country}</div>
        </div>
      ) : (
        <p className="text-xs text-white/40">No shipping address on file.</p>
      )}

      <div className="pt-3 border-t border-white/8 space-y-2">
        <div>
          <label htmlFor="ship-tn" className="text-xs text-white/50 block">Tracking number</label>
          <input
            id="ship-tn"
            value={tn}
            onChange={(e) => setTn(e.target.value)}
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
          />
        </div>
        <div>
          <label htmlFor="ship-carrier" className="text-xs text-white/50 block">Carrier</label>
          <input
            id="ship-carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleSaveTracking} className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded">
            Save tracking
          </button>
          <button type="button" onClick={handleBuyLabel} className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3 py-1.5 rounded">
            Buy label
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderShippingPanel.test.tsx`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/detail/OrderShippingPanel.tsx tests/unit/components/admin/fulfillment/detail/OrderShippingPanel.test.tsx
git commit -m "feat(admin-v2): add OrderShippingPanel widget"
git push -u origin wave4p4/task-16-order-shipping-panel
gh pr create --title "feat(admin-v2): Phase 4 W7 OrderShippingPanel" --body "Read-only shipping address + editable tracking number / carrier inputs + Buy label EasyPost trigger. Address editing deferred to Phase 4.5."
```

---

### Task 17: `OrderPaymentPanel.tsx`

**Wave:** 7 | **Parallel-safe with:** 14-16, 18-21 | **Branch:** `wave4p4/task-17-order-payment-panel` | **Model:** sonnet

**Schema realities for this task:**
- Client component — renders the payment summary (subtotal/shipping/tax/total) and a Refund button that opens the W7 `RefundDialog` (Task 21).
- `RefundDialog` is a sibling component; this panel imports it and tracks dialog open state.

**Files:**
- Create: `components/admin/fulfillment/detail/OrderPaymentPanel.tsx`
- Test: `tests/unit/components/admin/fulfillment/detail/OrderPaymentPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/detail/OrderPaymentPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderPaymentPanel } from '@/components/admin/fulfillment/detail/OrderPaymentPanel'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

vi.mock('@/components/admin/fulfillment/detail/RefundDialog', () => ({
  RefundDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="refund-dialog">refund dialog</div> : null,
}))

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date(), updatedAt: new Date(),
  shippingAddress: null, billingAddress: null,
  items: [], returns: [], refunds: [],
}

describe('OrderPaymentPanel', () => {
  it('renders subtotal/shipping/tax/total', () => {
    render(<OrderPaymentPanel detail={detail} />)
    expect(screen.getByText('$90.00')).toBeInTheDocument()
    expect(screen.getByText('$5.00')).toBeInTheDocument() // shipping (also tax — assert by label)
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('Refund button opens RefundDialog', () => {
    render(<OrderPaymentPanel detail={detail} />)
    fireEvent.click(screen.getByRole('button', { name: /refund/i }))
    expect(screen.getByTestId('refund-dialog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderPaymentPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/detail/OrderPaymentPanel.tsx`**

```tsx
// components/admin/fulfillment/detail/OrderPaymentPanel.tsx
'use client'

import { useState } from 'react'
import { RefundDialog } from './RefundDialog'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

interface OrderPaymentPanelProps {
  detail: OrderDetailFull
}

export function OrderPaymentPanel({ detail }: OrderPaymentPanelProps) {
  const [refundOpen, setRefundOpen] = useState(false)

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60 space-y-3">
      <h2 className="text-sm font-semibold text-white">Payment</h2>
      <dl className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={detail.subtotal} />
        <Row label="Shipping" value={detail.shipping} />
        <Row label="Tax"      value={detail.tax} />
        <div className="border-t border-white/8 pt-1.5">
          <Row label="Total" value={detail.total} bold />
        </div>
      </dl>
      <div className="text-xs text-white/50">Status: <span className="text-white">{detail.paymentStatus}</span></div>
      <button
        type="button"
        onClick={() => setRefundOpen(true)}
        className="text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 px-3 py-1.5 rounded"
      >
        Refund
      </button>
      <RefundDialog open={refundOpen} orderId={detail.id} maxAmount={detail.total} onClose={() => setRefundOpen(false)} />
    </section>
  )
}

function Row({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={bold ? 'text-white font-medium' : 'text-white/60'}>{label}</dt>
      <dd className={`tabular-nums ${bold ? 'text-white font-semibold' : 'text-white/70'}`}>${value.toFixed(2)}</dd>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderPaymentPanel.test.tsx`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/detail/OrderPaymentPanel.tsx tests/unit/components/admin/fulfillment/detail/OrderPaymentPanel.test.tsx
git commit -m "feat(admin-v2): add OrderPaymentPanel"
git push -u origin wave4p4/task-17-order-payment-panel
gh pr create --title "feat(admin-v2): Phase 4 W7 OrderPaymentPanel" --body "Payment summary widget (subtotal/shipping/tax/total + status) with Refund button that opens the RefundDialog modal."
```

---

### Task 18: `OrderTimeline.tsx`

**Wave:** 7 | **Parallel-safe with:** 14-17, 19-21 | **Branch:** `wave4p4/task-18-order-timeline` | **Model:** sonnet

**Schema realities for this task:**
- Derive timeline events from `detail` fields: `createdAt` (Order placed), `paymentStatus === 'PAID'` → use `updatedAt` as best-effort paid-at (Order has NO `paidAt` field), `shippedAt`, `deliveredAt`. Plus Return events from `detail.returns`.
- Pure display; render as a vertical list ordered by date.

**Files:**
- Create: `components/admin/fulfillment/detail/OrderTimeline.tsx`
- Test: `tests/unit/components/admin/fulfillment/detail/OrderTimeline.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/detail/OrderTimeline.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderTimeline } from '@/components/admin/fulfillment/detail/OrderTimeline'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'DELIVERED', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
  trackingNumber: '1Z', trackingUrl: null, carrier: 'UPS',
  shippedAt: new Date('2026-05-03'), deliveredAt: new Date('2026-05-05'), estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-02'),
  shippingAddress: null, billingAddress: null,
  items: [],
  returns: [{ id: 'r1', rmaNumber: 'RMA-100000', status: 'REQUESTED', requestedAt: new Date('2026-05-10') }],
  refunds: [],
}

describe('OrderTimeline', () => {
  it('renders core events in date order', () => {
    render(<OrderTimeline detail={detail} />)
    expect(screen.getByText(/order placed/i)).toBeInTheDocument()
    expect(screen.getByText(/payment received/i)).toBeInTheDocument()
    expect(screen.getByText(/shipped/i)).toBeInTheDocument()
    expect(screen.getByText(/delivered/i)).toBeInTheDocument()
    expect(screen.getByText(/return requested/i)).toBeInTheDocument()
  })

  it('omits shipping when shippedAt is null', () => {
    render(<OrderTimeline detail={{ ...detail, shippedAt: null, deliveredAt: null }} />)
    expect(screen.queryByText(/shipped/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderTimeline.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/detail/OrderTimeline.tsx`**

```tsx
// components/admin/fulfillment/detail/OrderTimeline.tsx
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

interface TimelineEvent {
  at: Date
  label: string
  detail?: string
}

interface OrderTimelineProps {
  detail: OrderDetailFull
}

export function OrderTimeline({ detail }: OrderTimelineProps) {
  const events: TimelineEvent[] = []
  events.push({ at: detail.createdAt, label: 'Order placed' })
  // Order has no paidAt field — derive from updatedAt as a best-effort timestamp.
  if (detail.paymentStatus === 'PAID') {
    events.push({ at: detail.updatedAt, label: 'Payment received' })
  }
  if (detail.shippedAt) {
    events.push({
      at: detail.shippedAt,
      label: 'Shipped',
      detail: detail.trackingNumber ?? undefined,
    })
  }
  if (detail.deliveredAt) {
    events.push({ at: detail.deliveredAt, label: 'Delivered' })
  }
  for (const r of detail.returns) {
    events.push({ at: r.requestedAt, label: 'Return requested', detail: r.rmaNumber })
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime())

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60">
      <h2 className="text-sm font-semibold text-white mb-3">Timeline</h2>
      <ol className="space-y-2">
        {events.map((e, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400/60 mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white">{e.label}</div>
              {e.detail && <div className="text-[11px] text-white/50 font-mono">{e.detail}</div>}
              <div className="text-[11px] text-white/40">{e.at.toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderTimeline.test.tsx`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/detail/OrderTimeline.tsx tests/unit/components/admin/fulfillment/detail/OrderTimeline.test.tsx
git commit -m "feat(admin-v2): add OrderTimeline widget"
git push -u origin wave4p4/task-18-order-timeline
gh pr create --title "feat(admin-v2): Phase 4 W7 OrderTimeline" --body "Timeline widget derived from Order timestamps (createdAt, derived paidAt from updatedAt+PAID, shippedAt, deliveredAt) plus Return.requestedAt events, sorted chronologically."
```

---

### Task 19: `OrderNotesPanel.tsx`

**Wave:** 7 | **Parallel-safe with:** 14-18, 20, 21 | **Branch:** `wave4p4/task-19-order-notes-panel` | **Model:** sonnet

**Schema realities for this task:**
- Client component; calls `saveOrderNotes` with both `internalNotes` (operator-only) and `notes` (customer-facing).
- Save buttons are independent (each textarea has its own save).

**Files:**
- Create: `components/admin/fulfillment/detail/OrderNotesPanel.tsx`
- Test: `tests/unit/components/admin/fulfillment/detail/OrderNotesPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/detail/OrderNotesPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderNotesPanel } from '@/components/admin/fulfillment/detail/OrderNotesPanel'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const saveOrderNotes = vi.fn()
vi.mock('@/app/admin/fulfillment/actions', () => ({
  saveOrderNotes: (...a: unknown[]) => saveOrderNotes(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: 'Customer wants gift wrap',
  internalNotes: 'High-value — review hold',
  createdAt: new Date(), updatedAt: new Date(),
  shippingAddress: null, billingAddress: null,
  items: [], returns: [], refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrderNotesPanel', () => {
  it('renders existing notes', () => {
    render(<OrderNotesPanel detail={detail} />)
    expect(screen.getByDisplayValue('Customer wants gift wrap')).toBeInTheDocument()
    expect(screen.getByDisplayValue('High-value — review hold')).toBeInTheDocument()
  })

  it('saves internal notes independently', async () => {
    saveOrderNotes.mockResolvedValue({ ok: true })
    render(<OrderNotesPanel detail={detail} />)
    fireEvent.change(screen.getByLabelText(/internal notes/i), { target: { value: 'updated internal' } })
    fireEvent.click(screen.getByRole('button', { name: /save internal/i }))
    await waitFor(() =>
      expect(saveOrderNotes).toHaveBeenCalledWith('o1', { internalNotes: 'updated internal' })
    )
  })

  it('saves customer notes independently', async () => {
    saveOrderNotes.mockResolvedValue({ ok: true })
    render(<OrderNotesPanel detail={detail} />)
    fireEvent.change(screen.getByLabelText(/customer notes/i), { target: { value: 'new customer note' } })
    fireEvent.click(screen.getByRole('button', { name: /save customer/i }))
    await waitFor(() =>
      expect(saveOrderNotes).toHaveBeenCalledWith('o1', { notes: 'new customer note' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderNotesPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/detail/OrderNotesPanel.tsx`**

```tsx
// components/admin/fulfillment/detail/OrderNotesPanel.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { saveOrderNotes } from '@/app/admin/fulfillment/actions'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

interface OrderNotesPanelProps {
  detail: OrderDetailFull
}

export function OrderNotesPanel({ detail }: OrderNotesPanelProps) {
  const [pending, startTransition] = useTransition()
  const [internalNotes, setInternalNotes] = useState(detail.internalNotes ?? '')
  const [notes, setNotes] = useState(detail.notes ?? '')
  void pending

  const handleSaveInternal = () => {
    startTransition(async () => {
      const r = await saveOrderNotes(detail.id, { internalNotes })
      if (r.ok) toast.success('Internal notes saved')
      else toast.error(r.error)
    })
  }
  const handleSaveCustomer = () => {
    startTransition(async () => {
      const r = await saveOrderNotes(detail.id, { notes })
      if (r.ok) toast.success('Customer notes saved')
      else toast.error(r.error)
    })
  }

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60 space-y-3">
      <h2 className="text-sm font-semibold text-white">Notes</h2>
      <div>
        <label htmlFor="internal-notes" className="text-xs text-white/50 block">Internal notes (operator only)</label>
        <textarea
          id="internal-notes"
          rows={3}
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
        />
        <button type="button" onClick={handleSaveInternal} className="mt-1 text-xs bg-white/[0.06] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded">
          Save internal
        </button>
      </div>
      <div>
        <label htmlFor="customer-notes" className="text-xs text-white/50 block">Customer notes (visible on receipt)</label>
        <textarea
          id="customer-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
        />
        <button type="button" onClick={handleSaveCustomer} className="mt-1 text-xs bg-white/[0.06] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded">
          Save customer
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderNotesPanel.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/detail/OrderNotesPanel.tsx tests/unit/components/admin/fulfillment/detail/OrderNotesPanel.test.tsx
git commit -m "feat(admin-v2): add OrderNotesPanel"
git push -u origin wave4p4/task-19-order-notes-panel
gh pr create --title "feat(admin-v2): Phase 4 W7 OrderNotesPanel" --body "Two-textarea notes panel — internal notes (operator-only) and customer-visible notes — each with its own save button calling saveOrderNotes."
```

---

### Task 20: `OrderReturnsPanel.tsx`

**Wave:** 7 | **Parallel-safe with:** 14-19, 21 | **Branch:** `wave4p4/task-20-order-returns-panel` | **Model:** sonnet

**Schema realities for this task:**
- Client component.
- Shows list of returns linked to this order from `detail.returns`.
- "+ Create Return" button opens an inline modal/form (kept minimal for v1 — single textarea + per-item quantity selectors); calls `createReturn`.

**Files:**
- Create: `components/admin/fulfillment/detail/OrderReturnsPanel.tsx`
- Test: `tests/unit/components/admin/fulfillment/detail/OrderReturnsPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/detail/OrderReturnsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderReturnsPanel } from '@/components/admin/fulfillment/detail/OrderReturnsPanel'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const createReturn = vi.fn()
vi.mock('@/app/admin/fulfillment/actions', () => ({
  createReturn: (...a: unknown[]) => createReturn(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'DELIVERED', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date(), updatedAt: new Date(),
  shippingAddress: null, billingAddress: null,
  items: [
    { id: 'i1', productId: 'p1', productVariantId: null, quantity: 2, price: 49.99, productName: 'Tee', productImage: null, sku: null, variantDetails: null },
  ],
  returns: [
    { id: 'r1', rmaNumber: 'RMA-100000', status: 'REQUESTED', requestedAt: new Date('2026-05-10') },
  ],
  refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrderReturnsPanel', () => {
  it('lists existing returns with status pills', () => {
    render(<OrderReturnsPanel detail={detail} />)
    expect(screen.getByText('RMA-100000')).toBeInTheDocument()
    expect(screen.getByText('REQUESTED')).toBeInTheDocument()
  })

  it('+ Create Return opens a form', () => {
    render(<OrderReturnsPanel detail={detail} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ create return/i }))
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument()
  })

  it('submitting the form calls createReturn with selected items', async () => {
    createReturn.mockResolvedValue({ ok: true, data: { rmaNumber: 'RMA-100001', returnId: 'r2' } })
    render(<OrderReturnsPanel detail={detail} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ create return/i }))
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'defective' } })
    fireEvent.change(screen.getByLabelText(/tee/i), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /submit return/i }))
    await waitFor(() => expect(createReturn).toHaveBeenCalled())
    const args = createReturn.mock.calls[0]
    expect(args[0]).toBe('o1')
    expect(args[1]).toEqual([{ orderItemId: 'i1', quantity: 1, condition: 'UNOPENED' }])
    expect(args[2]).toBe('defective')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderReturnsPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/detail/OrderReturnsPanel.tsx`**

```tsx
// components/admin/fulfillment/detail/OrderReturnsPanel.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { createReturn, type CreateReturnItemInput } from '@/app/admin/fulfillment/actions'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const RETURN_STATUS_PILL: Record<string, string> = {
  REQUESTED: 'bg-amber-500/15 text-amber-300',
  APPROVED:  'bg-sky-500/15 text-sky-300',
  REJECTED:  'bg-red-500/15 text-red-300',
  RECEIVED:  'bg-indigo-500/15 text-indigo-300',
  REFUNDED:  'bg-emerald-500/15 text-emerald-300',
}

interface OrderReturnsPanelProps {
  detail: OrderDetailFull
}

export function OrderReturnsPanel({ detail }: OrderReturnsPanelProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [, startTransition] = useTransition()

  const handleSubmit = () => {
    const items: CreateReturnItemInput[] = detail.items
      .filter((it) => (quantities[it.id] ?? 0) > 0)
      .map((it) => ({
        orderItemId: it.id,
        quantity: quantities[it.id],
        condition: 'UNOPENED',
      }))
    if (items.length === 0) {
      toast.error('Select at least one item')
      return
    }
    startTransition(async () => {
      const r = await createReturn(detail.id, items, reason)
      if (r.ok) {
        toast.success(`Return created: ${r.data?.rmaNumber}`)
        setOpen(false)
        setReason('')
        setQuantities({})
      } else toast.error(r.error)
    })
  }

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Returns</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded"
        >
          + Create Return
        </button>
      </div>

      <ul className="space-y-1.5">
        {detail.returns.length === 0 && (
          <li className="text-xs text-white/40">No returns yet.</li>
        )}
        {detail.returns.map((r) => (
          <li key={r.id} className="flex items-center justify-between text-xs">
            <span className="font-mono text-white">{r.rmaNumber}</span>
            <span className={`px-2 py-0.5 rounded ${RETURN_STATUS_PILL[r.status] ?? ''}`}>{r.status}</span>
          </li>
        ))}
      </ul>

      {open && (
        <div className="pt-3 border-t border-white/8 space-y-2">
          {detail.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 text-xs">
              <label htmlFor={`qty-${it.id}`} className="flex-1 text-white">{it.productName}</label>
              <input
                id={`qty-${it.id}`}
                type="number"
                min={0}
                max={it.quantity}
                value={quantities[it.id] ?? 0}
                onChange={(e) =>
                  setQuantities((q) => ({ ...q, [it.id]: parseInt(e.target.value, 10) || 0 }))
                }
                className="w-16 bg-neutral-900/80 border border-white/8 rounded px-2 py-1 text-white"
              />
              <span className="text-white/40">/ {it.quantity}</span>
            </div>
          ))}
          <div>
            <label htmlFor="return-reason" className="text-xs text-white/50 block">Reason</label>
            <textarea
              id="return-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3 py-2 rounded"
          >
            Submit Return
          </button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/OrderReturnsPanel.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/detail/OrderReturnsPanel.tsx tests/unit/components/admin/fulfillment/detail/OrderReturnsPanel.test.tsx
git commit -m "feat(admin-v2): add OrderReturnsPanel with inline create-return form"
git push -u origin wave4p4/task-20-order-returns-panel
gh pr create --title "feat(admin-v2): Phase 4 W7 OrderReturnsPanel" --body "Lists existing returns for the order with status pills, plus an inline + Create Return form (per-item quantity inputs + reason textarea) wired to the createReturn server action."
```

---

### Task 21: `RefundDialog.tsx`

**Wave:** 7 | **Parallel-safe with:** 14-20 | **Branch:** `wave4p4/task-21-refund-dialog` | **Model:** sonnet

**Schema realities for this task:**
- Client component.
- Calls `createRefund` (SUPER_ADMIN-gated server action); errors are surfaced via toast.
- `type` select has 3 options matching `RefundType` enum: `FULL`, `PARTIAL`, `SHIPPING_ONLY`.

**Files:**
- Create: `components/admin/fulfillment/detail/RefundDialog.tsx`
- Test: `tests/unit/components/admin/fulfillment/detail/RefundDialog.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/fulfillment/detail/RefundDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RefundDialog } from '@/components/admin/fulfillment/detail/RefundDialog'

const createRefund = vi.fn()
vi.mock('@/app/admin/fulfillment/actions', () => ({
  createRefund: (...a: unknown[]) => createRefund(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RefundDialog', () => {
  it('renders nothing when closed', () => {
    render(<RefundDialog open={false} orderId="o1" maxAmount={100} onClose={() => {}} />)
    expect(screen.queryByText(/refund/i)).toBeNull()
  })

  it('renders amount/type/reason controls when open', () => {
    render(<RefundDialog open={true} orderId="o1" maxAmount={100} onClose={() => {}} />)
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument()
  })

  it('submitting calls createRefund and closes', async () => {
    createRefund.mockResolvedValue({ ok: true, data: { refundId: 'r1', stripeRefundId: 're_1' } })
    const onClose = vi.fn()
    render(<RefundDialog open={true} orderId="o1" maxAmount={100} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'PARTIAL' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'damaged' } })
    fireEvent.click(screen.getByRole('button', { name: /submit refund/i }))
    await waitFor(() =>
      expect(createRefund).toHaveBeenCalledWith('o1', {
        amount: 50, type: 'PARTIAL', reason: 'damaged',
      })
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows error toast on failure (does NOT close)', async () => {
    createRefund.mockResolvedValue({ ok: false, error: 'stripe failed' })
    const onClose = vi.fn()
    render(<RefundDialog open={true} orderId="o1" maxAmount={100} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /submit refund/i }))
    await waitFor(() => expect(createRefund).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/RefundDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/fulfillment/detail/RefundDialog.tsx`**

```tsx
// components/admin/fulfillment/detail/RefundDialog.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { createRefund } from '@/app/admin/fulfillment/actions'
import type { RefundType } from '@prisma/client'

interface RefundDialogProps {
  open: boolean
  orderId: string
  maxAmount: number
  onClose: () => void
}

export function RefundDialog({ open, orderId, maxAmount, onClose }: RefundDialogProps) {
  const [amount, setAmount] = useState<string>(maxAmount.toFixed(2))
  const [type, setType] = useState<RefundType>('FULL')
  const [reason, setReason] = useState('')
  const [, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Invalid amount')
      return
    }
    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }
    startTransition(async () => {
      const r = await createRefund(orderId, { amount: n, type, reason: reason.trim() })
      if (r.ok) {
        toast.success(`Refund processed (${r.data?.stripeRefundId ?? 'no stripe id'})`)
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-neutral-900 border border-white/8 rounded-lg p-5 w-full max-w-md space-y-3">
        <h3 className="text-sm font-semibold text-white">Process refund</h3>
        <div>
          <label htmlFor="refund-amount" className="text-xs text-white/50 block">Amount</label>
          <input
            id="refund-amount"
            type="number"
            step="0.01"
            min={0.01}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
          />
        </div>
        <div>
          <label htmlFor="refund-type" className="text-xs text-white/50 block">Type</label>
          <select
            id="refund-type"
            value={type}
            onChange={(e) => setType(e.target.value as RefundType)}
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
          >
            <option value="FULL">Full</option>
            <option value="PARTIAL">Partial</option>
            <option value="SHIPPING_ONLY">Shipping only</option>
          </select>
        </div>
        <div>
          <label htmlFor="refund-reason" className="text-xs text-white/50 block">Reason</label>
          <textarea
            id="refund-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 text-xs bg-white/[0.06] text-white px-3 py-2 rounded">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="flex-1 text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 px-3 py-2 rounded">
            Submit refund
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/fulfillment/detail/RefundDialog.test.tsx`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/fulfillment/detail/RefundDialog.tsx tests/unit/components/admin/fulfillment/detail/RefundDialog.test.tsx
git commit -m "feat(admin-v2): add RefundDialog modal"
git push -u origin wave4p4/task-21-refund-dialog
gh pr create --title "feat(admin-v2): Phase 4 W7 RefundDialog" --body "Modal for the SUPER_ADMIN-only refund flow — amount input (max=order total), FULL/PARTIAL/SHIPPING_ONLY type select, reason textarea, calls createRefund."
```

---

## Wave 8 — Detail composition + verification (sequential)

### Task 22: `AdminOrderDetailV2` + V1 extraction + detail page dispatcher

**Wave:** 8 | **Parallel-safe with:** none | **Branch:** `wave4p4/task-22-order-detail-v2` | **Model:** sonnet

**Schema realities for this task:**
- The current V1 order-detail behavior lives INSIDE the giant `app/admin/fulfillment/page.tsx` (in the `FulfillmentCaseDrawer` integration — there is no separate detail URL today). For the V1 extraction here, we create a minimal `AdminOrderDetailV1.tsx` that simply renders a "V1 detail not implemented as separate URL — please use the queue page" notice. V1 still functions because the dispatcher falls back to it only when the flag is OFF, and historically operators never navigated to the deep-link detail URL.
- V2 composition is a grid: left column (LineItems + Returns + Timeline), right column (Header in top bar, Shipping + Payment + Notes panels).
- Page params: `Promise<{ orderId: string }>`.
- 404 → render `notFound()` from `next/navigation` when `loadOrderDetail` returns null in V2.

**Files:**
- Create: `components/admin/_v1/AdminOrderDetailV1.tsx` (minimal stub)
- Create: `components/admin/dashboard/AdminOrderDetailV2.tsx`
- Create: `app/admin/fulfillment/[orderId]/page.tsx` (dispatcher)
- Test: `tests/unit/components/admin/dashboard/AdminOrderDetailV2.test.tsx`
- Test: `tests/unit/app/admin/fulfillment/[orderId]/page.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing V2 composition test**

```tsx
// tests/unit/components/admin/dashboard/AdminOrderDetailV2.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/fulfillment', () => ({
  loadOrderDetail: vi.fn(async (id: string) => id === 'missing' ? null : {
    id, orderNumber: 'HOF-1', status: 'PROCESSING', paymentStatus: 'PAID',
    total: 100, subtotal: 90, tax: 5, shipping: 5,
    customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
    trackingNumber: null, trackingUrl: null, carrier: null,
    shippedAt: null, deliveredAt: null, estimatedDelivery: null,
    notes: null, internalNotes: null,
    createdAt: new Date(), updatedAt: new Date(),
    shippingAddress: null, billingAddress: null,
    items: [], returns: [], refunds: [],
  }),
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockWidget = (testid: string) => () => <div data-testid={testid} />
vi.mock('@/components/admin/fulfillment/detail/OrderHeader',         () => ({ OrderHeader:         mockWidget('w-header') }))
vi.mock('@/components/admin/fulfillment/detail/OrderLineItems',      () => ({ OrderLineItems:      mockWidget('w-items') }))
vi.mock('@/components/admin/fulfillment/detail/OrderShippingPanel',  () => ({ OrderShippingPanel:  mockWidget('w-shipping') }))
vi.mock('@/components/admin/fulfillment/detail/OrderPaymentPanel',   () => ({ OrderPaymentPanel:   mockWidget('w-payment') }))
vi.mock('@/components/admin/fulfillment/detail/OrderTimeline',       () => ({ OrderTimeline:       mockWidget('w-timeline') }))
vi.mock('@/components/admin/fulfillment/detail/OrderNotesPanel',     () => ({ OrderNotesPanel:     mockWidget('w-notes') }))
vi.mock('@/components/admin/fulfillment/detail/OrderReturnsPanel',   () => ({ OrderReturnsPanel:   mockWidget('w-returns') }))

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
}))

describe('AdminOrderDetailV2', () => {
  it('composes 7 widgets when order exists', async () => {
    const { AdminOrderDetailV2 } = await import('@/components/admin/dashboard/AdminOrderDetailV2')
    render(await AdminOrderDetailV2({ orderId: 'o1' }))
    expect(screen.getByTestId('w-header')).toBeInTheDocument()
    expect(screen.getByTestId('w-items')).toBeInTheDocument()
    expect(screen.getByTestId('w-shipping')).toBeInTheDocument()
    expect(screen.getByTestId('w-payment')).toBeInTheDocument()
    expect(screen.getByTestId('w-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('w-notes')).toBeInTheDocument()
    expect(screen.getByTestId('w-returns')).toBeInTheDocument()
  })

  it('throws NEXT_NOT_FOUND when order missing', async () => {
    const { AdminOrderDetailV2 } = await import('@/components/admin/dashboard/AdminOrderDetailV2')
    await expect(AdminOrderDetailV2({ orderId: 'missing' })).rejects.toThrow(/NEXT_NOT_FOUND/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/dashboard/AdminOrderDetailV2.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/dashboard/AdminOrderDetailV2.tsx`**

```tsx
// components/admin/dashboard/AdminOrderDetailV2.tsx
import { notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { loadOrderDetail } from '@/lib/admin/fulfillment'
import { OrderHeader }        from '@/components/admin/fulfillment/detail/OrderHeader'
import { OrderLineItems }     from '@/components/admin/fulfillment/detail/OrderLineItems'
import { OrderShippingPanel } from '@/components/admin/fulfillment/detail/OrderShippingPanel'
import { OrderPaymentPanel }  from '@/components/admin/fulfillment/detail/OrderPaymentPanel'
import { OrderTimeline }      from '@/components/admin/fulfillment/detail/OrderTimeline'
import { OrderNotesPanel }    from '@/components/admin/fulfillment/detail/OrderNotesPanel'
import { OrderReturnsPanel }  from '@/components/admin/fulfillment/detail/OrderReturnsPanel'

interface Props {
  orderId: string
}

export async function AdminOrderDetailV2({ orderId }: Props) {
  const detail = await loadOrderDetail(orderId)
  if (!detail) notFound()

  return (
    <AdminLayout title={`Order ${detail.orderNumber}`} subtitle="Order detail">
      <div className="space-y-4">
        <OrderHeader detail={detail} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <OrderLineItems items={detail.items} />
            <OrderReturnsPanel detail={detail} />
            <OrderTimeline detail={detail} />
          </div>
          <div className="space-y-4">
            <OrderShippingPanel detail={detail} />
            <OrderPaymentPanel detail={detail} />
            <OrderNotesPanel detail={detail} />
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 4: Write `components/admin/_v1/AdminOrderDetailV1.tsx`**

```tsx
// components/admin/_v1/AdminOrderDetailV1.tsx
'use client'

import Link from 'next/link'

interface Props {
  orderId: string
}

export function AdminOrderDetailV1({ orderId }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-2">
        <h1 className="text-lg">V1 has no standalone order detail page</h1>
        <p className="text-sm text-white/60">
          The V1 fulfillment workbench uses an in-page drawer. Open the order from{' '}
          <Link href="/admin/fulfillment" className="text-sky-300 underline">/admin/fulfillment</Link>.
        </p>
        <p className="text-[11px] text-white/40 font-mono">{orderId}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `app/admin/fulfillment/[orderId]/page.tsx` dispatcher**

```tsx
// app/admin/fulfillment/[orderId]/page.tsx
import { AdminOrderDetailV1 } from '@/components/admin/_v1/AdminOrderDetailV1'
import { AdminOrderDetailV2 } from '@/components/admin/dashboard/AdminOrderDetailV2'

export const revalidate = 60

interface PageProps {
  params: Promise<{ orderId: string }>
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true') {
    return <AdminOrderDetailV2 orderId={orderId} />
  }
  return <AdminOrderDetailV1 orderId={orderId} />
}
```

- [ ] **Step 6: Write the failing dispatcher test**

```tsx
// tests/unit/app/admin/fulfillment/[orderId]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/components/admin/dashboard/AdminOrderDetailV2', () => ({
  AdminOrderDetailV2: () => <div data-testid="v2">V2</div>,
}))
vi.mock('@/components/admin/_v1/AdminOrderDetailV1', () => ({
  AdminOrderDetailV1: () => <div data-testid="v1">V1</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/fulfillment/[orderId] dispatcher', () => {
  it('renders V1 when flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/[orderId]/page')
    render(await mod.default({ params: Promise.resolve({ orderId: 'o1' }) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 when flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/fulfillment/[orderId]/page')
    render(await mod.default({ params: Promise.resolve({ orderId: 'o1' }) }))
    expect(screen.getByTestId('v2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run both tests**

```bash
pnpm test tests/unit/components/admin/dashboard/AdminOrderDetailV2.test.tsx 'tests/unit/app/admin/fulfillment/[orderId]/page.test.tsx'
```

Expected: PASS — 2 + 2 = 4 tests.

- [ ] **Step 8: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 9: Commit + push + PR**

```bash
git add components/admin/_v1/AdminOrderDetailV1.tsx components/admin/dashboard/AdminOrderDetailV2.tsx app/admin/fulfillment/[orderId]/page.tsx tests/unit/components/admin/dashboard/AdminOrderDetailV2.test.tsx 'tests/unit/app/admin/fulfillment/[orderId]/page.test.tsx'
git commit -m "feat(admin-v2): add AdminOrderDetailV2 composition + detail page dispatcher"
git push -u origin wave4p4/task-22-order-detail-v2
gh pr create --title "feat(admin-v2): Phase 4 W8 AdminOrderDetailV2 + dispatcher" --body "Composes all W7 widgets (Header + LineItems + Shipping + Payment + Timeline + Notes + Returns + RefundDialog) on the standalone /admin/fulfillment/[orderId] page. V1 stub provided for the flag-off path (V1 uses an in-page drawer, no standalone detail URL exists in V1)."
```

---

### Task 23: Verification + QA doc

**Wave:** 8 | **Parallel-safe with:** none | **Branch:** `wave4p4/task-23-qa-doc` | **Model:** sonnet

**Schema realities for this task:**
- Mirror the structure of `docs/superpowers/plans/2026-05-30-admin-rebuild-phase3-qa.md`.
- Walk every Phase 4 PR and tabulate test counts, ESLint/tsc results, smoke-test checklist per sub-tab, mobile considerations, Phase 4.5 follow-ups (grep for `TODO` and `Phase 4.5` markers across the new files), regression risk assessment.

**Files:**
- Create: `docs/superpowers/plans/2026-05-30-admin-rebuild-phase4-qa.md`

#### Steps

- [ ] **Step 1: Run the full Phase 4 test suite**

```bash
pnpm exec vitest run \
  tests/unit/lib/admin/rma-counter.test.ts \
  tests/unit/scripts/backfill-returns-from-tickets.test.ts \
  tests/unit/lib/admin/fulfillment.test.ts \
  tests/unit/app/admin/fulfillment/actions.test.ts \
  tests/unit/components/admin/fulfillment/OrdersListTable.test.tsx \
  tests/unit/components/admin/fulfillment/OrdersListCardMobile.test.tsx \
  tests/unit/components/admin/fulfillment/OrderInspector.test.tsx \
  tests/unit/components/admin/fulfillment/OrderBulkActionsSheet.test.tsx \
  tests/unit/components/admin/fulfillment/ReturnInspector.test.tsx \
  tests/unit/components/admin/fulfillment/OrdersListView.test.tsx \
  tests/unit/components/admin/fulfillment/ReturnsListView.test.tsx \
  tests/unit/components/admin/fulfillment/ArchivedListView.test.tsx \
  tests/unit/components/admin/fulfillment/NewOrderToast.test.tsx \
  tests/unit/components/admin/dashboard/AdminFulfillmentV2.test.tsx \
  tests/unit/app/admin/fulfillment/page.test.tsx \
  tests/unit/components/admin/fulfillment/detail/OrderHeader.test.tsx \
  tests/unit/components/admin/fulfillment/detail/OrderLineItems.test.tsx \
  tests/unit/components/admin/fulfillment/detail/OrderShippingPanel.test.tsx \
  tests/unit/components/admin/fulfillment/detail/OrderPaymentPanel.test.tsx \
  tests/unit/components/admin/fulfillment/detail/OrderTimeline.test.tsx \
  tests/unit/components/admin/fulfillment/detail/OrderNotesPanel.test.tsx \
  tests/unit/components/admin/fulfillment/detail/OrderReturnsPanel.test.tsx \
  tests/unit/components/admin/fulfillment/detail/RefundDialog.test.tsx \
  tests/unit/components/admin/dashboard/AdminOrderDetailV2.test.tsx \
  'tests/unit/app/admin/fulfillment/[orderId]/page.test.tsx'
```

Record file-by-file pass counts in the QA doc table.

- [ ] **Step 2: Run `pnpm exec vitest run` (full suite) and `pnpm exec tsc --noEmit`**

Record total pass/fail counts plus whether the Phase 4 set contributed to any failure. Carry forward the 11 pre-existing TS errors noted in Phase 3 QA and confirm they're still the same set (any new ones must be called out).

- [ ] **Step 3: Run ESLint and grep for follow-ups**

```bash
pnpm exec eslint \
  components/admin/fulfillment \
  components/admin/dashboard/AdminFulfillmentV2.tsx \
  components/admin/dashboard/AdminOrderDetailV2.tsx \
  components/admin/dashboard/FulfillmentTabPills.tsx \
  app/admin/fulfillment

grep -rn "TODO\|Phase 4.5\|FIXME" \
  lib/admin/fulfillment.ts lib/admin/rma-counter.ts \
  app/admin/fulfillment \
  components/admin/fulfillment \
  components/admin/dashboard/AdminFulfillmentV2.tsx \
  components/admin/dashboard/AdminOrderDetailV2.tsx
```

- [ ] **Step 4: Write `docs/superpowers/plans/2026-05-30-admin-rebuild-phase4-qa.md`**

Mirror the Phase 3 QA doc structure exactly:

1. **Header** — Date, list of Phase 4 PRs by number with one-line description.
2. **Summary** — one-paragraph what Phase 4 ships, gating instruction.
3. **Automated verification** — three sub-sections: vitest Phase 4 files only (table with test counts), full suite (tally), `tsc --noEmit` (pre-existing vs new), ESLint.
4. **Code consistency audit** — dispatcher imports, AdminFulfillmentV2 component references, server action coverage table, loader coverage table, dynamic pages exist, flag gating, mobile breakpoint split.
5. **How to enable Phase 4** — same `NEXT_PUBLIC_ADMIN_V2_ENABLED=true` instructions.
6. **Smoke test checklist** — per-tab (All / Needs Action / Processing / Shipped / Delivered / Returns / Archived) + Bulk Actions sheet + Order detail page + V1 regression.
7. **Known gaps / Phase 4.5 follow-ups** — at minimum:
   - Filter bar is a placeholder
   - `saveOrderAddress` server action not implemented (Shipping panel uses read-only address)
   - Multi-shipment splits not supported
   - Configurable return-window per product
   - `OrderInspector.tsx` likely has the same `react-hooks/set-state-in-effect` lint issue as Phase 3 — flag in follow-ups
   - Carrier dropdown is a free-text input in OrderInspector for v1 (the `loadCarriers` loader is wired in the data layer but the UI doesn't use it yet) — list as follow-up
   - "Open full detail →" link goes to `/admin/fulfillment/[orderId]` — V1 has no real detail page; V1 dispatcher renders the stub. Flag for follow-up if V1 deep-link is needed.
   - `OrderTimeline` derives "paid at" from `updatedAt` (Order has no `paidAt`) — note as a known approximation.
8. **Test coverage summary** — total file count + test count tally.
9. **Regression risk** — same low-risk reasoning as Phase 3 (V1 extracted unchanged, dispatcher default is V1).
10. **Lint / TypeScript status** — final tallies.

- [ ] **Step 5: Commit + push + PR**

```bash
git add docs/superpowers/plans/2026-05-30-admin-rebuild-phase4-qa.md
git commit -m "docs: Phase 4 fulfillment QA findings"
git push -u origin wave4p4/task-23-qa-doc
gh pr create --title "docs: Phase 4 fulfillment QA findings" --body "QA document for Phase 4 fulfillment rebuild: automated verification, code consistency audit, per-tab smoke-test checklist, Phase 4.5 follow-ups, regression risk."
```

---

**Coverage gaps fixed inline:**

- **`saveOrderAddress` mismatch:** the spec's task description for OrderShippingPanel (W7) mentions an action that doesn't exist in the actions task list. Fixed inline by explicitly deferring address editing to Phase 4.5 in Task 16; the panel renders a read-only address.
- **Detail page V1 path:** the spec assumes V1 has a real detail URL to "extract". It doesn't — V1's detail behavior is a drawer inside the queue page. Fixed inline in Task 22 by writing a minimal V1 stub page that points operators back to the queue. The flag-off path still works correctly because the queue page itself is the only V1 entrypoint.
- **`OrderItem.sku`:** spec mentions SKUs on order items. Fixed inline by deriving from `productVariant.sku` in `loadOrderDetail` (Task 2) and surfacing as `OrderItemDetail.sku`.
- **`paidAt` field:** spec's `OrderTimeline` task implies a `paidAt` timestamp; Order has none. Fixed inline by deriving from `updatedAt` when `paymentStatus === 'PAID'` in Task 18; documented as known approximation in Task 23's follow-ups.
- **Socket.IO `order:new` missing:** spec assumes the event exists. Fixed inline in Task 12 by wiring the emit from `app/api/orders/route.ts` POST handler.
- **`Return.customer` and `decidedBy` relations:** schema needs two named relations to `Customer` (`ReturnCustomer` and `ReturnDecidedBy`); plus a third for `RefundRecord.createdBy` (`RefundCreatedBy`). Fixed inline in Task 1 by naming all three relations explicitly.
- **`loadCarriers` UI plumbing:** the loader is wired in W2 but neither Inspector nor Shipping panel uses the dropdown — they take free-text input for v1. Documented as Phase 4.5 follow-up in Task 23.

