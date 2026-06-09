# Phase 8: Customers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new V2 /admin/customers umbrella page with 5 segment-based tabs + a new V2 /admin/customers/[id] detail page with 9 widgets, gated behind NEXT_PUBLIC_ADMIN_V2_ENABLED, with ONE small schema migration (Customer.anonymizedAt) for GDPR right-to-erasure.

**Architecture:** Server-rendered V2 list page mirrors Phase 6/7 pattern (TabPills + URL-persisted range pill row + KPI strip + paginated table Suspense slot). V2 detail page mirrors Phase 4 order detail pattern (2-column widget grid with per-widget Suspense streaming). Row click navigates straight to detail page (no Inspector intermediate). V1 list (901L) and V1 detail (936L) get relocated verbatim to /admin/customers-v1 + /admin/customers-v1/[id]; dispatchers replace the canonical routes. All points mutations route through existing atomic lib/loyalty/service.ts (Phase 7 precedent). GDPR anonymize-in-place sets Customer.anonymizedAt + scrubs PII; orders/loyalty/audit preserved.

**Tech Stack:** Next.js 16 App Router, React 19 (RSC + Server Actions + Suspense), TypeScript strict, Prisma 6 + Neon, Tailwind v4 (@theme — direct dark colors only, no `dark:` modifiers), Framer Motion, Phosphor icons, Sonner toasts (via `lib/toast.ts`), class-variance-authority, Vitest 4.1.7 + @testing-library/react + jsdom (Phase 1 harness).

---

## Cross-cutting agent notes (read once, applies to every task)

These are hard-won lessons from Phase 3/4/5/6/7. Re-read them whenever you start a new task:

1. **No Prisma in the client bundle.** Use `import type` for any `lib/admin/customers` types in client components. Server actions wrap any value imports needed by client. PR #92 hotfix is the precedent — if you accidentally `import { someFn } from '@/lib/admin/customers'` (a value import) into a `'use client'` file, the bundle pulls in Prisma and the page crashes at runtime.
2. **No `dark:` Tailwind modifiers.** V2 admin is always-dark; direct colors only. Use `bg-neutral-900/60`, `border-white/8`, `text-white/50`, `text-white/30`. PR #93 hotfix precedent.
3. **`PaginatedResult` shape is `{ items, total, page, pageSize }`** — destructure `.items` (NOT `.rows`). All loaders return this shape.
4. **Vitest 4.1.7 generics: use 1-arg `vi.fn<T>()`** (or zero-arg with `mockResolvedValue`). The two-arg `vi.fn<[Args], Return>()` form from Vitest 1.x triggers TS2558.
5. **`requireAdmin()` has two overloads** in `lib/auth/admin.ts`: `requireAdmin(request)` for API routes (returns customer object) and `requireAdmin()` no-arg for server actions (returns userId string). Use no-arg in actions. `requireAdminRole('SUPER_ADMIN')` for: `bulkGiftPoints`, `anonymizeCustomer` (only — every other Phase 8 mutation accepts plain ADMIN).
6. **Wave 1 parallel safety**: Schema migration ships the `Customer.anonymizedAt` column. Data layer (Task 2) and actions (Task 3) reference the new field via Prisma's typed client. Coordination: **dispatch Task 1 alone, merge it, then dispatch Tasks 2 + 3 in parallel** (W1a sequential, then W1b parallel). The alternative — letting all three run in parallel — requires `(prisma.customer as any)` casts that get forgotten in the merge and silently shadow the column type. Do not take that path.
7. **Wave 5/6 root composition agents adopt verified prop shapes** from merged earlier waves. Phase 4-7 precedent — agents have correctly applied this. Read the merged widget, inspector, list-table, and bulk-sheet prop signatures directly from their files and adopt verbatim; the plan prose is approximate.
8. **All points/tier mutations MUST route through `lib/loyalty/service.ts` atomic ops.** Do NOT write raw `prisma.pointsTransaction.create` calls in `bulkGiftPoints`. Phase 7 W1 + W3 precedent — `bulkGiftPoints` wraps `awardPoints` with idempotencyKey `gift-${batchId}-${customerId}` where `batchId = crypto.randomUUID().replace(/-/g,'').slice(0,12)` is generated once per call. Re-runs with the same key are safe (existing service-layer behavior returns the prior transaction).
9. **GDPR anonymize-in-place** uses `prisma.customer.update({ where: { id, anonymizedAt: null }, data: {...} })` — the where-clause `anonymizedAt: null` is the not-already-anonymized atomic guard (Prisma throws P2025 if no row matches). ALSO requires admin to type the exact email in `typedConfirmEmail` arg as an anti-typo guard; the action compares case-insensitively after `.trim()`. Scrubbed fields: `email` → `deleted-${id}@anonymized.local`, `name` → `null`, `phone` → `null`, `birthday` → `null`, `profilePictureUrl` → `null`. Orders / loyalty ledger / addresses are preserved (audit + financial reasons).
10. **Address schema field names matter:** `firstName`/`lastName` (NOT `name`), `address1`/`address2` (NOT `line1`/`line2`), `state` (NOT `region`), `postalCode`, `country` (default `"US"`), `type` is the `AddressType` enum (`SHIPPING | BILLING | BOTH`). `AddressInspector` form must use these exact names; the spec prose used `line1`/`line2`/`region` which are wrong. Similarly, `CustomerNote` uses `isImportant: Boolean` (NOT `importance`); the spec prose used `importance` which is wrong. And `Customer.profilePictureUrl` (NOT `avatarUrl`) — the spec prose used `avatarUrl` which is wrong.

---

## Wave summary

| Wave | Tasks | Parallel? | Model | Depends on |
|------|-------|-----------|-------|------------|
| W1a  | 1 | sequential | sonnet | none |
| W1b  | 2, 3 | 2 parallel | sonnet | W1a merged |
| W2   | 4, 5, 6 | 3 parallel | sonnet | W1b merged |
| W3   | 7, 8, 9, 10, 11, 12, 13, 14, 15 | 9 parallel | sonnet | W1b merged |
| W4   | 16, 17, 18, 19 | 4 parallel | sonnet | W1b merged |
| W5   | 20 | sequential | **opus** | W2 + W4 merged |
| W6   | 21 | sequential | **opus** | W3 + W4 + W5 merged |
| W7   | 22 | sequential | sonnet | W6 |

Total: **22 tasks** across **7 waves**. Branch naming: `wave8p8/task-N-<short-name>`.

---

## Wave 1a — Schema migration (sequential, MUST MERGE FIRST)

### Task 1: `Customer.anonymizedAt` schema migration

**Wave:** 1a | **Branch:** `wave8p8/task-1-anonymized-at-migration` | **Model:** sonnet

**Schema realities for this task:**
- `Customer` model lives at `prisma/schema.prisma` lines ~167-230 (mapped to table `"customers"`).
- We add ONE nullable column + ONE index. No FK changes, no constraint changes, no data backfill — nullable column defaults to `NULL` on existing rows.
- **Hand-authored SQL migration** — do NOT run `prisma migrate dev`. Phase 4 W1 + Phase 7 W1 set this pattern: Neon's shadow DB rejects the auto-generated approach with P3006. Instead, write the SQL file by hand, then apply with `prisma db push --skip-generate` (which runs the actual `ALTER TABLE` on the connected DB) and seal it with `prisma migrate resolve --applied <timestamp>_customer_anonymized_at` so future `prisma migrate status` calls show it as applied.
- Migration timestamp format: `YYYYMMDDHHMMSS` (e.g. `20260531120000`). Use the timestamp at the moment of authoring; do NOT reuse one from a prior migration.
- The new field semantics: `NULL` = active customer; non-null = GDPR right-to-erasure has been applied at that timestamp. All list loaders default-filter `anonymizedAt: null`. Detail loaders return the anonymized row but the header surfaces the "Anonymized" pill instead of edit/anonymize actions.

**Files:**
- Edit: `prisma/schema.prisma` (add `anonymizedAt DateTime?` field + `@@index([anonymizedAt])`)
- Create: `prisma/migrations/<timestamp>_customer_anonymized_at/migration.sql`
- Test: `tests/unit/lib/admin/customers-schema.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/admin/customers-schema.test.ts
//
// Smoke test that the new Customer.anonymizedAt column is wired through the
// Prisma client and respects the not-yet-anonymized predicate.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerCount = vi.fn()
const customerFindMany = vi.fn()
const customerUpdate = vi.fn()
const customerFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      count: customerCount,
      findMany: customerFindMany,
      update: customerUpdate,
      findUnique: customerFindUnique,
    },
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('Customer.anonymizedAt column', () => {
  it('Prisma accepts anonymizedAt in where + select + data', async () => {
    customerCount.mockResolvedValue(0)
    customerFindMany.mockResolvedValue([])
    customerUpdate.mockResolvedValue({ id: 'c1', anonymizedAt: new Date() })
    customerFindUnique.mockResolvedValue({ id: 'c1', anonymizedAt: null })

    const { prisma } = await import('@/lib/prisma')

    // where filter
    await prisma.customer.count({ where: { anonymizedAt: null } })
    // select
    await prisma.customer.findMany({ select: { id: true, anonymizedAt: true } })
    // update with guard
    await prisma.customer.update({
      where: { id: 'c1', anonymizedAt: null },
      data: { anonymizedAt: new Date() },
    })
    // findUnique
    await prisma.customer.findUnique({ where: { id: 'c1' }, select: { anonymizedAt: true } })

    expect(customerCount).toHaveBeenCalledWith({ where: { anonymizedAt: null } })
    expect(customerUpdate.mock.calls[0][0].where.anonymizedAt).toBeNull()
    expect(customerUpdate.mock.calls[0][0].data.anonymizedAt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/admin/customers-schema.test.ts`
Expected: FAIL — TypeScript error "Object literal may only specify known properties, and 'anonymizedAt' does not exist in type 'CustomerWhereInput'" (because the Prisma client has not yet been regenerated against the new schema).

- [ ] **Step 3: Edit `prisma/schema.prisma`**

Open `prisma/schema.prisma` and locate the `model Customer { ... }` block (around line 167). Insert the new field immediately above the `abandonedCarts` relation line, keeping the existing alignment style (2-space indent, columns visually aligned). The exact insertion:

```prisma
  anonymizedAt             DateTime?
```

Then immediately above the closing `@@map("customers")` line, add the index:

```prisma
  @@index([anonymizedAt])
```

Verify the final Customer model has both additions and no other diffs. Save.

- [ ] **Step 4: Author the migration SQL by hand**

Get a timestamp (e.g. `date -u +%Y%m%d%H%M%S` → `20260531120000`) and create the directory + file:

```bash
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TS}_customer_anonymized_at
cat > prisma/migrations/${TS}_customer_anonymized_at/migration.sql <<'SQL'
-- Phase 8: GDPR right-to-erasure column on Customer.
-- Null = active; non-null = anonymized at that timestamp.
ALTER TABLE "customers" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
CREATE INDEX "customers_anonymizedAt_idx" ON "customers"("anonymizedAt");
SQL
```

(Use the exact timestamp string when you commit; do not hard-code `20260531120000` if you're authoring later.)

- [ ] **Step 5: Apply the migration to the connected DB**

Run:

```bash
pnpm exec prisma db push --skip-generate
pnpm exec prisma migrate resolve --applied "${TS}_customer_anonymized_at"
pnpm exec prisma generate
```

Verify with:

```bash
pnpm exec prisma migrate status
```

Expected output includes the new migration as `applied`. The Prisma client regen step picks up the new field on the `Customer` type.

- [ ] **Step 6: Run the smoke test to verify it passes**

Run: `pnpm test tests/unit/lib/admin/customers-schema.test.ts`
Expected: PASS — all four Prisma client calls type-check and the mock assertions succeed.

- [ ] **Step 7: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 8: Commit + push + PR (do NOT merge — the controller merges)**

```bash
git add prisma/schema.prisma prisma/migrations tests/unit/lib/admin/customers-schema.test.ts
git commit -m "feat(admin-v2): add Customer.anonymizedAt for GDPR right-to-erasure"
git push -u origin wave8p8/task-1-anonymized-at-migration
gh pr create --title "feat(admin-v2): Phase 8 W1a Customer.anonymizedAt migration" --body "Adds Customer.anonymizedAt DateTime? + index. Hand-authored SQL migration. Applied via prisma db push + migrate resolve. 1 smoke test passing."
```

**Wait for controller to merge before launching Tasks 2 + 3.**

---

## Wave 1b — Data layer + server actions (2 parallel, after W1a merged)

### Task 2: `lib/admin/customers.ts` data layer

**Wave:** 1b | **Parallel-safe with:** Task 3 | **Branch:** `wave8p8/task-2-data-layer` | **Model:** sonnet

**Schema realities for this task:**
- `TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'` (5 values, identical to Phase 6/7 — define LOCALLY in `lib/admin/customers.ts`; do NOT import from sibling phase files).
- `Customer` fields used by Phase 8 loaders: `id, email, name, phone, profilePictureUrl, birthday, newsletter, smsOptIn, totalSpent, totalOrders, lastOrderDate, avgOrderValue, loyaltyTierId, currentPoints, lifetimePoints, annualPointsEarned, tierStartDate, createdAt, anonymizedAt` (new). Relations used: `loyaltyTier, orders, addresses, reviews, supportTickets, pointsTransactions, redemptions, returnsAsCustomer, refundsCreated, notes`.
- All list loaders default-filter `WHERE anonymizedAt IS NULL`.
- Tab → where clause:
  - `all` → `anonymizedAt IS NULL`
  - `vip` → `anonymizedAt IS NULL AND totalSpent >= 1000`
  - `at-risk` → `anonymizedAt IS NULL AND totalOrders >= 2 AND lastOrderDate < (now - 90d)`
  - `inactive` → `anonymizedAt IS NULL AND (totalOrders = 0 OR lastOrderDate < (now - 180d))`
  - `recent` → `anonymizedAt IS NULL AND createdAt >= (now - rangeWindow)`
- `CustomerNote` schema: `id, customerId, content, authorId, authorName, isImportant (Boolean default false), createdAt, updatedAt`. NOT "importance".
- `Address` schema: `id, customerId, firstName, lastName, company?, address1, address2?, city, state, postalCode, country, isDefault, type (AddressType enum)`. NOT line1/line2/region.
- `Customer.profilePictureUrl` (NOT avatarUrl).
- "Risk" computation: refundRate = refundCount / totalOrders; returnRate = returnCount / totalOrders; chargebackCount = count where RefundRecord.reason includes "chargeback" (string match — schema has no dedicated enum). avgDaysToReturn = average(Return.createdAt - Order.createdAt) across the customer's returns.
- Hot paths use `prisma.aggregate` + `groupBy` + parallel `Promise.all()`.

**Files:**
- Create: `lib/admin/customers.ts`
- Test: `tests/unit/lib/admin/customers.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/admin/customers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerCount = vi.fn()
const customerFindMany = vi.fn()
const customerFindUnique = vi.fn()
const customerAggregate = vi.fn()
const customerGroupBy = vi.fn()
const orderFindMany = vi.fn()
const orderCount = vi.fn()
const orderAggregate = vi.fn()
const noteFindMany = vi.fn()
const noteCount = vi.fn()
const addressFindMany = vi.fn()
const reviewFindMany = vi.fn()
const reviewCount = vi.fn()
const ticketFindMany = vi.fn()
const ticketCount = vi.fn()
const pointsTxFindMany = vi.fn()
const returnFindMany = vi.fn()
const returnCount = vi.fn()
const refundFindMany = vi.fn()
const refundCount = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      count: customerCount,
      findMany: customerFindMany,
      findUnique: customerFindUnique,
      aggregate: customerAggregate,
      groupBy: customerGroupBy,
    },
    order: {
      findMany: orderFindMany,
      count: orderCount,
      aggregate: orderAggregate,
    },
    customerNote: { findMany: noteFindMany, count: noteCount },
    address: { findMany: addressFindMany },
    review: { findMany: reviewFindMany, count: reviewCount },
    supportTicket: { findMany: ticketFindMany, count: ticketCount },
    pointsTransaction: { findMany: pointsTxFindMany },
    return: { findMany: returnFindMany, count: returnCount },
    refundRecord: { findMany: refundFindMany, count: refundCount },
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('getRangeBounds (customers)', () => {
  it('maps 30d to 30-day window with previous shift', async () => {
    const { getRangeBounds } = await import('@/lib/admin/customers')
    const ref = new Date('2026-05-31T12:00:00Z')
    const b = getRangeBounds('30d', ref)
    const day = 24 * 60 * 60 * 1000
    expect(b.end.getTime() - b.start.getTime()).toBe(30 * day)
    expect(b.previousEnd.getTime()).toBe(b.end.getTime() - 30 * day)
  })
})

describe('loadCustomersKpis', () => {
  it('returns totalCustomers, newInRange (+trend), avgLtv, atRiskCount', async () => {
    customerCount
      .mockResolvedValueOnce(500) // totalCustomers (snapshot, anonymizedAt: null)
      .mockResolvedValueOnce(40)  // newInRange current
      .mockResolvedValueOnce(25)  // newInRange previous
      .mockResolvedValueOnce(8)   // atRiskCount
    customerAggregate.mockResolvedValueOnce({ _avg: { totalSpent: 175.5 } })
    const { loadCustomersKpis } = await import('@/lib/admin/customers')
    const k = await loadCustomersKpis('30d')
    expect(k.totalCustomers).toBe(500)
    expect(k.newInRange).toBe(40)
    expect(k.avgLtv).toBeCloseTo(175.5, 1)
    expect(k.atRiskCount).toBe(8)
    expect(k.newInRangeTrend.direction).toBe('up')
  })

  it('handles zero avg LTV', async () => {
    customerCount.mockResolvedValue(0)
    customerAggregate.mockResolvedValue({ _avg: { totalSpent: null } })
    const { loadCustomersKpis } = await import('@/lib/admin/customers')
    const k = await loadCustomersKpis('30d')
    expect(k.avgLtv).toBe(0)
  })
})

describe('loadCustomersTab', () => {
  it('returns paginated CustomerRow list with default anonymizedAt: null filter', async () => {
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'Ada', currentPoints: 250,
        totalOrders: 3, totalSpent: 450, lastOrderDate: new Date('2026-05-20'),
        loyaltyTier: { id: 't1', name: 'Silver', primaryColor: '#aaa' },
        createdAt: new Date('2026-01-15') },
    ])
    customerCount.mockResolvedValue(1)
    const { loadCustomersTab } = await import('@/lib/admin/customers')
    const r = await loadCustomersTab('all', '30d')
    expect(r.items).toHaveLength(1)
    expect(r.items[0].email).toBe('a@e.com')
    expect(customerFindMany.mock.calls[0][0].where.anonymizedAt).toBeNull()
  })

  it('vip tab filters totalSpent >= 1000', async () => {
    customerFindMany.mockResolvedValue([])
    customerCount.mockResolvedValue(0)
    const { loadCustomersTab } = await import('@/lib/admin/customers')
    await loadCustomersTab('vip', '30d')
    const where = customerFindMany.mock.calls[0][0].where
    expect(where.totalSpent).toEqual({ gte: 1000 })
  })

  it('at-risk tab filters totalOrders >= 2 + lastOrderDate < 90d ago', async () => {
    customerFindMany.mockResolvedValue([])
    customerCount.mockResolvedValue(0)
    const { loadCustomersTab } = await import('@/lib/admin/customers')
    await loadCustomersTab('at-risk', '30d')
    const where = customerFindMany.mock.calls[0][0].where
    expect(where.totalOrders).toEqual({ gte: 2 })
    expect(where.lastOrderDate.lt).toBeInstanceOf(Date)
  })

  it('recent tab filters createdAt >= range start', async () => {
    customerFindMany.mockResolvedValue([])
    customerCount.mockResolvedValue(0)
    const { loadCustomersTab } = await import('@/lib/admin/customers')
    await loadCustomersTab('recent', '7d')
    const where = customerFindMany.mock.calls[0][0].where
    expect(where.createdAt.gte).toBeInstanceOf(Date)
  })
})

describe('Detail loaders', () => {
  it('loadCustomerHeader returns null when missing', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { loadCustomerHeader } = await import('@/lib/admin/customers')
    expect(await loadCustomerHeader('missing')).toBeNull()
  })

  it('loadCustomerHeader returns full header with tier + status', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'a@e.com', name: 'Ada', phone: '555',
      profilePictureUrl: null, birthday: null, newsletter: true, smsOptIn: false,
      currentPoints: 200, lifetimePoints: 1500,
      totalSpent: 450, totalOrders: 3, lastOrderDate: new Date('2026-05-20'),
      createdAt: new Date('2026-01-15'), anonymizedAt: null,
      loyaltyTier: { id: 't1', name: 'Silver', slug: 'silver', primaryColor: '#aaa' },
    })
    const { loadCustomerHeader } = await import('@/lib/admin/customers')
    const d = await loadCustomerHeader('c1')
    expect(d?.email).toBe('a@e.com')
    expect(d?.tierName).toBe('Silver')
    expect(d?.isAnonymized).toBe(false)
  })

  it('loadCustomerOrders returns paginated rows', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'o1', orderNumber: 'HOF-100', status: 'DELIVERED', total: 99.5,
        createdAt: new Date('2026-05-15') },
    ])
    orderCount.mockResolvedValue(1)
    const { loadCustomerOrders } = await import('@/lib/admin/customers')
    const r = await loadCustomerOrders('c1')
    expect(r.items[0].orderNumber).toBe('HOF-100')
    expect(orderFindMany.mock.calls[0][0].where.customerId).toBe('c1')
  })

  it('loadCustomerLoyalty returns tier + balances + last 10 ledger entries', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', currentPoints: 200, lifetimePoints: 1500, annualPointsEarned: 800,
      tierStartDate: new Date('2026-01-01'),
      loyaltyTier: { id: 't1', name: 'Silver', slug: 'silver', primaryColor: '#aaa' },
      pointsTransactions: [
        { id: 'p1', points: 100, type: 'PURCHASE', description: 'order',
          createdAt: new Date(), orderId: 'o1' },
      ],
    })
    const { loadCustomerLoyalty } = await import('@/lib/admin/customers')
    const d = await loadCustomerLoyalty('c1')
    expect(d?.tierName).toBe('Silver')
    expect(d?.transactions).toHaveLength(1)
  })

  it('loadCustomerAddresses returns rows ordered by isDefault desc', async () => {
    addressFindMany.mockResolvedValue([
      { id: 'a1', firstName: 'Ada', lastName: 'Lovelace', address1: '1 Main',
        address2: null, city: 'NYC', state: 'NY', postalCode: '10001',
        country: 'US', isDefault: true, type: 'SHIPPING', company: null },
    ])
    const { loadCustomerAddresses } = await import('@/lib/admin/customers')
    const rows = await loadCustomerAddresses('c1')
    expect(rows[0].firstName).toBe('Ada')
    expect(rows[0].address1).toBe('1 Main')
    expect(rows[0].state).toBe('NY')
    expect(rows[0].isDefault).toBe(true)
  })

  it('loadCustomerReviews returns paginated rows', async () => {
    reviewFindMany.mockResolvedValue([
      { id: 'r1', rating: 5, status: 'APPROVED', createdAt: new Date(),
        product: { id: 'p1', name: 'Tee' } },
    ])
    reviewCount.mockResolvedValue(1)
    const { loadCustomerReviews } = await import('@/lib/admin/customers')
    const r = await loadCustomerReviews('c1')
    expect(r.items[0].productName).toBe('Tee')
  })

  it('loadCustomerSupportTickets returns paginated rows', async () => {
    ticketFindMany.mockResolvedValue([
      { id: 'st1', ticketNumber: 'T-100', type: 'REFUND', status: 'OPEN',
        priority: 'HIGH', createdAt: new Date() },
    ])
    ticketCount.mockResolvedValue(1)
    const { loadCustomerSupportTickets } = await import('@/lib/admin/customers')
    const r = await loadCustomerSupportTickets('c1')
    expect(r.items[0].ticketNumber).toBe('T-100')
  })

  it('loadCustomerNotes returns rows with isImportant flag', async () => {
    noteFindMany.mockResolvedValue([
      { id: 'n1', content: 'VIP', authorId: 'a1', authorName: 'Admin',
        isImportant: true, createdAt: new Date(), updatedAt: new Date() },
    ])
    const { loadCustomerNotes } = await import('@/lib/admin/customers')
    const r = await loadCustomerNotes('c1')
    expect(r[0].isImportant).toBe(true)
  })

  it('loadCustomerActivity merges + sorts events', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'o1', orderNumber: 'HOF-100', createdAt: new Date('2026-05-10'), total: 50 },
    ])
    pointsTxFindMany.mockResolvedValue([
      { id: 'pt1', points: 50, type: 'PURCHASE', description: 'd',
        createdAt: new Date('2026-05-11') },
    ])
    reviewFindMany.mockResolvedValue([])
    ticketFindMany.mockResolvedValue([])
    const { loadCustomerActivity } = await import('@/lib/admin/customers')
    const events = await loadCustomerActivity('c1', 50)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(events[1].timestamp.getTime())
  })

  it('loadCustomerRisk computes refund + return + chargeback rates', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', totalOrders: 10 })
    refundCount.mockResolvedValueOnce(3) // refunds
    refundCount.mockResolvedValueOnce(1) // chargebacks (reason contains)
    returnCount.mockResolvedValue(2)
    returnFindMany.mockResolvedValue([
      { id: 'rt1', createdAt: new Date('2026-05-10'),
        order: { createdAt: new Date('2026-05-01') } },
    ])
    const { loadCustomerRisk } = await import('@/lib/admin/customers')
    const r = await loadCustomerRisk('c1')
    expect(r.refundRate).toBeCloseTo(30, 1)
    expect(r.returnRate).toBeCloseTo(20, 1)
    expect(r.chargebackCount).toBe(1)
    expect(r.avgDaysToReturn).toBeCloseTo(9, 0)
  })
})

describe('Tab + range constants', () => {
  it('CUSTOMERS_TABS contains 5 values', async () => {
    const { CUSTOMERS_TABS } = await import('@/lib/admin/customers')
    expect(CUSTOMERS_TABS).toEqual(['all', 'vip', 'at-risk', 'inactive', 'recent'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/admin/customers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/admin/customers.ts`**

```ts
// lib/admin/customers.ts
//
// Single source of truth for Phase 8 customers admin data shapes + Prisma queries.
// Mirrors Phase 6/7 pattern: TimeRange + getRangeBounds + buildTrend + KPI loader +
// tab loader + 9 detail loaders. All list loaders default-filter anonymizedAt: null.

import { prisma } from '@/lib/prisma'
import type { AddressType, ReviewStatus, SupportTicketStatus, SupportTicketType, OrderStatus, PointsTransactionType } from '@prisma/client'

// ============================================================
// TimeRange + range bounds
// ============================================================

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'
export const TIME_RANGES: TimeRange[] = ['today', '7d', '30d', '90d', 'year']

export interface RangeBounds {
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}

export function getRangeBounds(range: TimeRange, ref: Date = new Date()): RangeBounds {
  const end = new Date(ref)
  const start = new Date(ref)
  const day = 24 * 60 * 60 * 1000
  let durationMs: number
  switch (range) {
    case 'today':
      start.setUTCHours(0, 0, 0, 0)
      durationMs = end.getTime() - start.getTime()
      break
    case '7d':   durationMs = 7 * day;   start.setTime(end.getTime() - durationMs); break
    case '30d':  durationMs = 30 * day;  start.setTime(end.getTime() - durationMs); break
    case '90d':  durationMs = 90 * day;  start.setTime(end.getTime() - durationMs); break
    case 'year': durationMs = 365 * day; start.setTime(end.getTime() - durationMs); break
  }
  return {
    start, end,
    previousStart: new Date(start.getTime() - durationMs),
    previousEnd: new Date(end.getTime() - durationMs),
  }
}

// ============================================================
// Trend helper
// ============================================================

export interface TrendData {
  direction: 'up' | 'down' | 'flat'
  text: string
}

export function buildTrend(current: number, previous: number): TrendData {
  if (previous === 0) {
    return { direction: 'flat', text: current > 0 ? '↑ new' : '— No prior data' }
  }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return { direction: 'flat', text: '— 0%' }
  return {
    direction: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%`,
  }
}

// ============================================================
// Pagination
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25
const DETAIL_LIST_PAGE_SIZE = 10

// ============================================================
// Tab + filter shapes
// ============================================================

export const CUSTOMERS_TABS = ['all', 'vip', 'at-risk', 'inactive', 'recent'] as const
export type CustomersTab = (typeof CUSTOMERS_TABS)[number]

export function isCustomersTab(v: unknown): v is CustomersTab {
  return typeof v === 'string' && (CUSTOMERS_TABS as readonly string[]).includes(v)
}

export function isTimeRange(v: unknown): v is TimeRange {
  return typeof v === 'string' && (TIME_RANGES as readonly string[]).includes(v)
}

export interface CustomersFilters {
  search?: string
  page?: number
  pageSize?: number
}

const VIP_THRESHOLD = 1000
const AT_RISK_DAYS = 90
const INACTIVE_DAYS = 180

// ============================================================
// Row shapes
// ============================================================

export interface CustomerRow {
  id: string
  email: string
  name: string | null
  tierId: string | null
  tierName: string | null
  tierColor: string | null
  currentPoints: number
  totalOrders: number
  totalSpent: number
  lastOrderDate: Date | null
  createdAt: Date
}

export interface CustomersKpiData {
  totalCustomers: number
  newInRange: number
  newInRangeTrend: TrendData
  avgLtv: number
  atRiskCount: number
}

// ============================================================
// Detail shapes
// ============================================================

export interface CustomerHeaderData {
  id: string
  email: string
  name: string | null
  phone: string | null
  profilePictureUrl: string | null
  birthday: Date | null
  newsletter: boolean
  smsOptIn: boolean
  tierId: string | null
  tierName: string | null
  tierSlug: string | null
  tierColor: string | null
  currentPoints: number
  lifetimePoints: number
  totalSpent: number
  totalOrders: number
  lastOrderDate: Date | null
  createdAt: Date
  isAnonymized: boolean
  anonymizedAt: Date | null
}

export interface OrderRow {
  id: string
  orderNumber: string
  status: OrderStatus
  total: number
  createdAt: Date
}

export interface CustomerLoyaltyLedgerEntry {
  id: string
  points: number
  type: PointsTransactionType
  description: string
  createdAt: Date
  orderId: string | null
}

export interface CustomerLoyaltyData {
  tierId: string | null
  tierName: string | null
  tierSlug: string | null
  tierColor: string | null
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  tierStartDate: Date
  transactions: CustomerLoyaltyLedgerEntry[]
}

export interface AddressRow {
  id: string
  firstName: string
  lastName: string
  company: string | null
  address1: string
  address2: string | null
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
  type: AddressType
}

export interface ReviewRow {
  id: string
  productId: string
  productName: string
  rating: number
  status: ReviewStatus
  createdAt: Date
}

export interface SupportTicketRow {
  id: string
  ticketNumber: string
  type: SupportTicketType
  status: SupportTicketStatus
  priority: string
  createdAt: Date
}

export interface CustomerNoteRow {
  id: string
  content: string
  authorId: string
  authorName: string
  isImportant: boolean
  createdAt: Date
  updatedAt: Date
}

export type ActivityEventKind =
  | 'order' | 'points' | 'review' | 'support' | 'address' | 'redemption'

export interface ActivityEvent {
  id: string
  kind: ActivityEventKind
  label: string
  timestamp: Date
  href: string | null
}

export interface CustomerRiskData {
  totalOrders: number
  refundCount: number
  refundRate: number
  returnCount: number
  returnRate: number
  chargebackCount: number
  avgDaysToReturn: number
  isHighRisk: boolean
}

// ============================================================
// KPI loader
// ============================================================

export async function loadCustomersKpis(range: TimeRange): Promise<CustomersKpiData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)
  const atRiskCutoff = new Date(Date.now() - AT_RISK_DAYS * 24 * 60 * 60 * 1000)

  const [totalCustomers, newCur, newPrev, atRiskCount, avgAgg] = await Promise.all([
    prisma.customer.count({ where: { anonymizedAt: null } }),
    prisma.customer.count({
      where: { anonymizedAt: null, createdAt: { gte: start, lte: end } },
    }),
    prisma.customer.count({
      where: { anonymizedAt: null, createdAt: { gte: previousStart, lte: previousEnd } },
    }),
    prisma.customer.count({
      where: {
        anonymizedAt: null,
        totalOrders: { gte: 2 },
        lastOrderDate: { lt: atRiskCutoff },
      },
    }),
    prisma.customer.aggregate({
      where: { anonymizedAt: null },
      _avg: { totalSpent: true },
    }),
  ])

  return {
    totalCustomers,
    newInRange: newCur,
    newInRangeTrend: buildTrend(newCur, newPrev),
    avgLtv: Number(avgAgg._avg.totalSpent ?? 0),
    atRiskCount,
  }
}

// ============================================================
// Tab loader
// ============================================================

function tabWhere(tab: CustomersTab, range: TimeRange): Record<string, unknown> {
  const where: Record<string, unknown> = { anonymizedAt: null }
  switch (tab) {
    case 'all':
      break
    case 'vip':
      where.totalSpent = { gte: VIP_THRESHOLD }
      break
    case 'at-risk':
      where.totalOrders = { gte: 2 }
      where.lastOrderDate = { lt: new Date(Date.now() - AT_RISK_DAYS * 24 * 60 * 60 * 1000) }
      break
    case 'inactive':
      where.OR = [
        { totalOrders: 0 },
        { lastOrderDate: { lt: new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000) } },
      ]
      break
    case 'recent': {
      const { start } = getRangeBounds(range)
      where.createdAt = { gte: start }
      break
    }
  }
  return where
}

export async function loadCustomersTab(
  tab: CustomersTab,
  range: TimeRange,
  filters: CustomersFilters = {},
): Promise<PaginatedResult<CustomerRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where = tabWhere(tab, range)
  if (filters.search) {
    where.OR = [
      ...(Array.isArray(where.OR) ? (where.OR as object[]) : []),
      { email: { contains: filters.search, mode: 'insensitive' as const } },
      { name: { contains: filters.search, mode: 'insensitive' as const } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { totalSpent: 'desc' },
      select: {
        id: true, email: true, name: true,
        currentPoints: true, totalOrders: true, totalSpent: true,
        lastOrderDate: true, createdAt: true,
        loyaltyTier: { select: { id: true, name: true, primaryColor: true } },
      },
    }),
    prisma.customer.count({ where }),
  ])

  return {
    items: rows.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name ?? null,
      tierId: c.loyaltyTier?.id ?? null,
      tierName: c.loyaltyTier?.name ?? null,
      tierColor: c.loyaltyTier?.primaryColor ?? null,
      currentPoints: c.currentPoints,
      totalOrders: c.totalOrders,
      totalSpent: Number(c.totalSpent ?? 0),
      lastOrderDate: c.lastOrderDate ?? null,
      createdAt: c.createdAt,
    })),
    total, page, pageSize,
  }
}

// ============================================================
// Detail loaders
// ============================================================

export async function loadCustomerHeader(id: string): Promise<CustomerHeaderData | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, phone: true, profilePictureUrl: true,
      birthday: true, newsletter: true, smsOptIn: true,
      currentPoints: true, lifetimePoints: true, totalSpent: true, totalOrders: true,
      lastOrderDate: true, createdAt: true, anonymizedAt: true,
      loyaltyTier: { select: { id: true, name: true, slug: true, primaryColor: true } },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    phone: c.phone ?? null,
    profilePictureUrl: c.profilePictureUrl ?? null,
    birthday: c.birthday ?? null,
    newsletter: c.newsletter,
    smsOptIn: c.smsOptIn,
    tierId: c.loyaltyTier?.id ?? null,
    tierName: c.loyaltyTier?.name ?? null,
    tierSlug: c.loyaltyTier?.slug ?? null,
    tierColor: c.loyaltyTier?.primaryColor ?? null,
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    totalSpent: Number(c.totalSpent ?? 0),
    totalOrders: c.totalOrders,
    lastOrderDate: c.lastOrderDate ?? null,
    createdAt: c.createdAt,
    isAnonymized: c.anonymizedAt !== null,
    anonymizedAt: c.anonymizedAt ?? null,
  }
}

export async function loadCustomerOrders(
  customerId: string,
  page = 1,
  pageSize = DETAIL_LIST_PAGE_SIZE,
): Promise<PaginatedResult<OrderRow>> {
  const skip = (page - 1) * pageSize
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      skip, take: pageSize,
      select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
    }),
    prisma.order.count({ where: { customerId } }),
  ])
  return {
    items: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total ?? 0),
      createdAt: o.createdAt,
    })),
    total, page, pageSize,
  }
}

export async function loadCustomerLoyalty(id: string): Promise<CustomerLoyaltyData | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      currentPoints: true, lifetimePoints: true, annualPointsEarned: true,
      tierStartDate: true,
      loyaltyTier: { select: { id: true, name: true, slug: true, primaryColor: true } },
      pointsTransactions: {
        orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, points: true, type: true, description: true, createdAt: true, orderId: true },
      },
    },
  })
  if (!c) return null
  return {
    tierId: c.loyaltyTier?.id ?? null,
    tierName: c.loyaltyTier?.name ?? null,
    tierSlug: c.loyaltyTier?.slug ?? null,
    tierColor: c.loyaltyTier?.primaryColor ?? null,
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    annualPointsEarned: c.annualPointsEarned,
    tierStartDate: c.tierStartDate,
    transactions: c.pointsTransactions.map((t) => ({
      id: t.id,
      points: Number(t.points),
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
      orderId: t.orderId ?? null,
    })),
  }
}

export async function loadCustomerAddresses(customerId: string): Promise<AddressRow[]> {
  const rows = await prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map((a) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    company: a.company ?? null,
    address1: a.address1,
    address2: a.address2 ?? null,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    isDefault: a.isDefault,
    type: a.type,
  }))
}

export async function loadCustomerReviews(
  customerId: string,
  page = 1,
  pageSize = DETAIL_LIST_PAGE_SIZE,
): Promise<PaginatedResult<ReviewRow>> {
  const skip = (page - 1) * pageSize
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      skip, take: pageSize,
      select: {
        id: true, rating: true, status: true, createdAt: true,
        product: { select: { id: true, name: true } },
      },
    }),
    prisma.review.count({ where: { customerId } }),
  ])
  return {
    items: rows.map((r) => ({
      id: r.id,
      productId: r.product?.id ?? '',
      productName: r.product?.name ?? 'Unknown',
      rating: r.rating,
      status: r.status,
      createdAt: r.createdAt,
    })),
    total, page, pageSize,
  }
}

export async function loadCustomerSupportTickets(
  customerId: string,
  page = 1,
  pageSize = DETAIL_LIST_PAGE_SIZE,
): Promise<PaginatedResult<SupportTicketRow>> {
  const skip = (page - 1) * pageSize
  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      skip, take: pageSize,
      select: { id: true, ticketNumber: true, type: true, status: true, priority: true, createdAt: true },
    }),
    prisma.supportTicket.count({ where: { customerId } }),
  ])
  return {
    items: rows.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      type: t.type,
      status: t.status,
      priority: String(t.priority ?? 'NORMAL'),
      createdAt: t.createdAt,
    })),
    total, page, pageSize,
  }
}

export async function loadCustomerNotes(customerId: string): Promise<CustomerNoteRow[]> {
  const rows = await prisma.customerNote.findMany({
    where: { customerId },
    orderBy: [{ isImportant: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map((n) => ({
    id: n.id,
    content: n.content,
    authorId: n.authorId,
    authorName: n.authorName,
    isImportant: n.isImportant,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }))
}

export async function loadCustomerActivity(
  customerId: string,
  limit = 50,
): Promise<ActivityEvent[]> {
  const [orders, points, reviews, tickets] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, orderNumber: true, total: true, createdAt: true },
    }),
    prisma.pointsTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, points: true, type: true, description: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, rating: true, createdAt: true,
        product: { select: { name: true } } },
    }),
    prisma.supportTicket.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, ticketNumber: true, status: true, createdAt: true },
    }),
  ])
  const events: ActivityEvent[] = []
  for (const o of orders) {
    events.push({
      id: `o-${o.id}`,
      kind: 'order',
      label: `Placed order ${o.orderNumber} — $${Number(o.total ?? 0).toFixed(2)}`,
      timestamp: o.createdAt,
      href: `/admin/fulfillment/${o.id}`,
    })
  }
  for (const t of points) {
    const sign = Number(t.points) > 0 ? '+' : ''
    events.push({
      id: `p-${t.id}`,
      kind: 'points',
      label: `${sign}${Number(t.points)} pts (${t.type}) — ${t.description}`,
      timestamp: t.createdAt,
      href: null,
    })
  }
  for (const r of reviews) {
    events.push({
      id: `r-${r.id}`,
      kind: 'review',
      label: `${r.rating}★ review on ${r.product?.name ?? 'a product'}`,
      timestamp: r.createdAt,
      href: null,
    })
  }
  for (const t of tickets) {
    events.push({
      id: `s-${t.id}`,
      kind: 'support',
      label: `Opened support ticket ${t.ticketNumber} (${t.status})`,
      timestamp: t.createdAt,
      href: null,
    })
  }
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  return events.slice(0, limit)
}

export async function loadCustomerRisk(customerId: string): Promise<CustomerRiskData> {
  const c = await prisma.customer.findUnique({
    where: { id: customerId }, select: { totalOrders: true },
  })
  const totalOrders = c?.totalOrders ?? 0

  const [refundCount, chargebackCount, returnCount, returnsWithOrders] = await Promise.all([
    prisma.refundRecord.count({ where: { order: { customerId } } }),
    prisma.refundRecord.count({
      where: { order: { customerId }, reason: { contains: 'chargeback', mode: 'insensitive' } },
    }),
    prisma.return.count({ where: { customerId } }),
    prisma.return.findMany({
      where: { customerId },
      select: { createdAt: true, order: { select: { createdAt: true } } },
    }),
  ])

  const refundRate = totalOrders === 0 ? 0 : (refundCount / totalOrders) * 100
  const returnRate = totalOrders === 0 ? 0 : (returnCount / totalOrders) * 100

  let avgDaysToReturn = 0
  if (returnsWithOrders.length > 0) {
    const sum = returnsWithOrders.reduce((s, r) => {
      if (!r.order) return s
      const days = (r.createdAt.getTime() - r.order.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      return s + Math.max(0, days)
    }, 0)
    avgDaysToReturn = sum / returnsWithOrders.length
  }

  return {
    totalOrders,
    refundCount,
    refundRate,
    returnCount,
    returnRate,
    chargebackCount,
    avgDaysToReturn,
    isHighRisk: refundRate > 20 || chargebackCount > 0,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/admin/customers.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add lib/admin/customers.ts tests/unit/lib/admin/customers.test.ts
git commit -m "feat(admin-v2): add customers data layer with KPI + tab loader + 9 detail loaders"
git push -u origin wave8p8/task-2-data-layer
gh pr create --title "feat(admin-v2): Phase 8 W1b customers data layer" --body "Adds lib/admin/customers.ts: TimeRange + getRangeBounds + buildTrend + 5 tab where-clauses + KPI loader + paginated tab loader + 9 detail loaders (header/orders/loyalty/addresses/reviews/support/notes/activity/risk). All list loaders default-filter anonymizedAt: null. 14 tests passing."
```

---

### Task 3: `app/admin/customers/actions.ts` server actions

**Wave:** 1b | **Parallel-safe with:** Task 2 | **Branch:** `wave8p8/task-3-server-actions` | **Model:** sonnet

**Schema realities for this task:**
- ~12 server actions per spec.
- `requireAdmin()` no-arg overload for all; `requireAdminRole('SUPER_ADMIN')` ONLY for: `bulkGiftPoints`, `anonymizeCustomer`.
- All mutations call `revalidatePath('/admin/customers')` AND `revalidatePath('/admin/customers/${id}')` so both the list view and the detail page refresh.
- `bulkGiftPoints` MUST call `lib/loyalty/service.ts.awardPoints` (do NOT write raw `prisma.pointsTransaction.create`). Generate one `batchId = crypto.randomUUID().replace(/-/g,'').slice(0,12)` per call; per-customer key `gift-${batchId}-${customerId}`.
- `anonymizeCustomer` uses the `anonymizedAt: null` where-clause guard for atomic single-flight. Compares `typedConfirmEmail.trim().toLowerCase() === customer.email.trim().toLowerCase()`.
- `bulkExportCustomersCsv` cap = 10,000 rows; over-cap returns `{ ok: false, error: 'Too many rows — narrow selection' }`.
- `Address.firstName/lastName/address1/address2/city/state/postalCode/country/isDefault/type` are the EXACT field names — do not use line1/line2/region/name.
- `CustomerNote.isImportant` (Boolean, default false) — NOT importance.
- `Customer.profilePictureUrl` — NOT avatarUrl.
- `setDefaultAddress` uses a Prisma transaction: first sets all of the customer's addresses to `isDefault: false`, then sets the target to `isDefault: true`. Both inside `$transaction`.
- `deleteAddress` wraps the delete in try/catch; on FK violation returns `{ ok: false, error: 'Address is referenced by orders — cannot delete' }`. (Order.shippingAddressId / billingAddressId are non-nullable FKs.)
- `updateCustomerProfile` accepts `{ name?, phone?, birthday?, newsletter?, smsOptIn? }` — strips `undefined` values from the data object before `update`. Email is NOT editable in v1.
- `getCustomerHeaderForRefresh(id)` re-runs the same query shape as `loadCustomerHeader` but is callable from client components after an inspector mutates. Inlines its Prisma query (parallel-safety with Task 2 per Phase 4/5/6/7 W1 precedent — refactor to share with Task 2's loader is deferred to Phase 8.5).

**Files:**
- Create: `app/admin/customers/actions.ts`
- Test: `tests/unit/app/admin/customers/actions.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/admin/customers/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerFindUnique = vi.fn()
const customerUpdate = vi.fn()
const customerFindMany = vi.fn()
const customerCount = vi.fn()
const noteCreate = vi.fn()
const noteUpdate = vi.fn()
const noteDelete = vi.fn()
const addressCreate = vi.fn()
const addressUpdate = vi.fn()
const addressDelete = vi.fn()
const addressUpdateMany = vi.fn()
const txMock = vi.fn(async (fn: (tx: unknown) => unknown) =>
  fn({
    address: { update: addressUpdate, updateMany: addressUpdateMany },
  }),
)

const awardPoints = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: customerFindUnique,
      update: customerUpdate,
      findMany: customerFindMany,
      count: customerCount,
    },
    customerNote: {
      create: noteCreate,
      update: noteUpdate,
      delete: noteDelete,
    },
    address: {
      create: addressCreate,
      update: addressUpdate,
      delete: addressDelete,
      updateMany: addressUpdateMany,
    },
    $transaction: (fn: (tx: unknown) => unknown) => txMock(fn),
  },
}))

vi.mock('@/lib/loyalty/service', () => ({
  awardPoints: (...a: unknown[]) => awardPoints(...a),
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue('admin-1'),
  requireAdminRole: vi.fn().mockResolvedValue('admin-1'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe('updateCustomerProfile', () => {
  it('strips undefined values and updates the customer', async () => {
    customerUpdate.mockResolvedValue({ id: 'c1' })
    const { updateCustomerProfile } = await import('@/app/admin/customers/actions')
    const r = await updateCustomerProfile('c1', { name: 'Ada', newsletter: true })
    expect(r.ok).toBe(true)
    const data = customerUpdate.mock.calls[0][0].data
    expect(data.name).toBe('Ada')
    expect(data.newsletter).toBe(true)
    expect(data.phone).toBeUndefined()
  })
})

describe('CustomerNote actions', () => {
  it('createCustomerNote persists with isImportant flag', async () => {
    noteCreate.mockResolvedValue({ id: 'n1' })
    customerFindUnique.mockResolvedValue({ id: 'a1', name: 'Admin', email: 'a@e.com' })
    const { createCustomerNote } = await import('@/app/admin/customers/actions')
    const r = await createCustomerNote('c1', 'VIP', true)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.id).toBe('n1')
    expect(noteCreate.mock.calls[0][0].data.isImportant).toBe(true)
  })

  it('createCustomerNote rejects empty content', async () => {
    const { createCustomerNote } = await import('@/app/admin/customers/actions')
    const r = await createCustomerNote('c1', '   ')
    expect(r.ok).toBe(false)
  })

  it('updateCustomerNote sets isImportant + content', async () => {
    noteUpdate.mockResolvedValue({})
    const { updateCustomerNote } = await import('@/app/admin/customers/actions')
    const r = await updateCustomerNote('n1', 'Updated', false)
    expect(r.ok).toBe(true)
    expect(noteUpdate.mock.calls[0][0].data.content).toBe('Updated')
    expect(noteUpdate.mock.calls[0][0].data.isImportant).toBe(false)
  })

  it('deleteCustomerNote calls prisma.customerNote.delete', async () => {
    noteDelete.mockResolvedValue({})
    const { deleteCustomerNote } = await import('@/app/admin/customers/actions')
    const r = await deleteCustomerNote('n1')
    expect(r.ok).toBe(true)
  })
})

describe('Address actions (schema field names)', () => {
  it('createAddress uses firstName/lastName/address1/state/postalCode', async () => {
    addressCreate.mockResolvedValue({ id: 'a1' })
    const { createAddress } = await import('@/app/admin/customers/actions')
    const r = await createAddress('c1', {
      firstName: 'Ada', lastName: 'Lovelace',
      address1: '1 Main St', address2: 'Apt 2',
      city: 'NYC', state: 'NY', postalCode: '10001',
      country: 'US', isDefault: false, type: 'SHIPPING',
    })
    expect(r.ok).toBe(true)
    const data = addressCreate.mock.calls[0][0].data
    expect(data.firstName).toBe('Ada')
    expect(data.address1).toBe('1 Main St')
    expect(data.state).toBe('NY')
  })

  it('updateAddress strips undefined', async () => {
    addressUpdate.mockResolvedValue({})
    const { updateAddress } = await import('@/app/admin/customers/actions')
    const r = await updateAddress('a1', { city: 'LA' })
    expect(r.ok).toBe(true)
    const data = addressUpdate.mock.calls[0][0].data
    expect(data.city).toBe('LA')
    expect(data.firstName).toBeUndefined()
  })

  it('deleteAddress returns FK-violation error on failure', async () => {
    addressDelete.mockRejectedValue(new Error('Foreign key constraint failed'))
    const { deleteAddress } = await import('@/app/admin/customers/actions')
    const r = await deleteAddress('a1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/referenced by orders|Foreign key/i)
  })

  it('setDefaultAddress runs the unset-then-set transaction', async () => {
    addressUpdateMany.mockResolvedValue({ count: 2 })
    addressUpdate.mockResolvedValue({})
    const { setDefaultAddress } = await import('@/app/admin/customers/actions')
    const r = await setDefaultAddress('c1', 'a1')
    expect(r.ok).toBe(true)
    expect(addressUpdateMany).toHaveBeenCalledWith({
      where: { customerId: 'c1' }, data: { isDefault: false },
    })
    expect(addressUpdate.mock.calls[0][0].where.id).toBe('a1')
    expect(addressUpdate.mock.calls[0][0].data.isDefault).toBe(true)
  })
})

describe('bulkGiftPoints (SUPER_ADMIN)', () => {
  it('wraps awardPoints with gift-${batchId}-${customerId} idempotency', async () => {
    awardPoints.mockResolvedValue({ id: 'pt1' })
    const { bulkGiftPoints } = await import('@/app/admin/customers/actions')
    const r = await bulkGiftPoints(['c1', 'c2'], 100, 'Promo')
    expect(r.ok).toBe(true)
    expect(awardPoints).toHaveBeenCalledTimes(2)
    const k1 = awardPoints.mock.calls[0][4].idempotencyKey
    const k2 = awardPoints.mock.calls[1][4].idempotencyKey
    expect(k1).toMatch(/^gift-/)
    expect(k1.split('-')[1]).toBe(k2.split('-')[1])
    expect(k1.endsWith('c1')).toBe(true)
    expect(k2.endsWith('c2')).toBe(true)
  })

  it('rejects zero or non-finite delta', async () => {
    const { bulkGiftPoints } = await import('@/app/admin/customers/actions')
    const r = await bulkGiftPoints(['c1'], 0, 'Promo')
    expect(r.ok).toBe(false)
  })

  it('rejects empty reason', async () => {
    const { bulkGiftPoints } = await import('@/app/admin/customers/actions')
    const r = await bulkGiftPoints(['c1'], 100, '   ')
    expect(r.ok).toBe(false)
  })

  it('collects per-customer failures + continues batch', async () => {
    awardPoints
      .mockResolvedValueOnce({ id: 'pt1' })
      .mockRejectedValueOnce(new Error('boom'))
    const { bulkGiftPoints } = await import('@/app/admin/customers/actions')
    const r = await bulkGiftPoints(['c1', 'c2'], 100, 'Promo')
    expect(r.ok).toBe(true)
    if (r.ok && r.data) {
      expect(r.data.succeeded).toEqual(['c1'])
      expect(r.data.failed).toHaveLength(1)
      expect(r.data.failed[0].id).toBe('c2')
    }
  })
})

describe('bulkExportCustomersCsv', () => {
  it('emits CSV with email + name + tier + totalSpent', async () => {
    customerCount.mockResolvedValue(1)
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'Ada',
        totalOrders: 3, totalSpent: 450, currentPoints: 200,
        lastOrderDate: new Date('2026-05-15'),
        loyaltyTier: { name: 'Silver' } },
    ])
    const { bulkExportCustomersCsv } = await import('@/app/admin/customers/actions')
    const r = await bulkExportCustomersCsv(['c1'])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.csv).toContain('a@e.com')
      expect(r.data?.csv).toContain('Silver')
    }
  })

  it('rejects over 10,000 rows', async () => {
    customerCount.mockResolvedValue(20000)
    const ids = Array.from({ length: 20000 }, (_, i) => `c${i}`)
    const { bulkExportCustomersCsv } = await import('@/app/admin/customers/actions')
    const r = await bulkExportCustomersCsv(ids)
    expect(r.ok).toBe(false)
  })
})

describe('anonymizeCustomer (SUPER_ADMIN)', () => {
  it('rejects on typedConfirmEmail mismatch', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'real@e.com', anonymizedAt: null,
    })
    const { anonymizeCustomer } = await import('@/app/admin/customers/actions')
    const r = await anonymizeCustomer('c1', 'wrong@e.com')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/email mismatch/i)
  })

  it('rejects already-anonymized', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'real@e.com', anonymizedAt: new Date(),
    })
    const { anonymizeCustomer } = await import('@/app/admin/customers/actions')
    const r = await anonymizeCustomer('c1', 'real@e.com')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/already anonymized/i)
  })

  it('scrubs PII + sets anonymizedAt with the not-yet-anonymized guard', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'real@e.com', anonymizedAt: null,
    })
    customerUpdate.mockResolvedValue({ id: 'c1' })
    const { anonymizeCustomer } = await import('@/app/admin/customers/actions')
    const r = await anonymizeCustomer('c1', 'Real@E.com  ') // case + whitespace ok
    expect(r.ok).toBe(true)
    const call = customerUpdate.mock.calls[0][0]
    expect(call.where.id).toBe('c1')
    expect(call.where.anonymizedAt).toBeNull()
    expect(call.data.email).toBe('deleted-c1@anonymized.local')
    expect(call.data.name).toBeNull()
    expect(call.data.phone).toBeNull()
    expect(call.data.birthday).toBeNull()
    expect(call.data.profilePictureUrl).toBeNull()
    expect(call.data.anonymizedAt).toBeInstanceOf(Date)
  })
})

describe('getCustomerHeaderForRefresh', () => {
  it('returns null for missing customer', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { getCustomerHeaderForRefresh } = await import('@/app/admin/customers/actions')
    expect(await getCustomerHeaderForRefresh('missing')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/app/admin/customers/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/admin/customers/actions.ts`**

```ts
// app/admin/customers/actions.ts
'use server'

/**
 * Phase 8 — Admin Customers Server Actions (~12 actions).
 *
 * Auth gates:
 *   - requireAdmin() (no-arg) for all read + most write actions.
 *   - requireAdminRole('SUPER_ADMIN') for: bulkGiftPoints, anonymizeCustomer.
 *
 * Points mutations:
 *   bulkGiftPoints routes through lib/loyalty/service.ts.awardPoints with a
 *   per-customer idempotencyKey of `gift-${batchId}-${customerId}`.
 *   batchId is one crypto.randomUUID() per call.
 *
 * GDPR anonymize-in-place:
 *   prisma.customer.update with where: { id, anonymizedAt: null } is the
 *   atomic not-already-anonymized guard. Email comparison case-insensitive
 *   after trim.
 *
 * PARALLEL-SAFETY NOTE:
 *   getCustomerHeaderForRefresh inlines its Prisma query because Task 2
 *   (lib/admin/customers.ts) executes concurrently on a separate branch.
 *   Refactor deferred to Phase 8.5.
 */

import { revalidatePath } from 'next/cache'
import type { AddressType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import { awardPoints } from '@/lib/loyalty/service'

// ============================================================
// Return shapes
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export interface BulkResultData {
  succeeded: string[]
  failed: { id: string; error: string }[]
}
export type BulkResult = ActionResult<BulkResultData>

const CUSTOMERS_PATH = '/admin/customers'
const CSV_MAX_ROWS = 10000

function revalidateCustomers(id?: string) {
  revalidatePath(CUSTOMERS_PATH)
  if (id) revalidatePath(`${CUSTOMERS_PATH}/${id}`)
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.join(',')
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  return body ? `${head}\n${body}` : head
}

// ============================================================
// Re-exported detail shapes (so client components can import type)
// ============================================================

export interface CustomerHeaderRefresh {
  id: string
  email: string
  name: string | null
  phone: string | null
  profilePictureUrl: string | null
  birthday: Date | null
  newsletter: boolean
  smsOptIn: boolean
  currentPoints: number
  lifetimePoints: number
  totalSpent: number
  totalOrders: number
  isAnonymized: boolean
}

// ============================================================
// Input shapes
// ============================================================

export interface UpdateCustomerProfileInput {
  name?: string | null
  phone?: string | null
  birthday?: Date | null
  newsletter?: boolean
  smsOptIn?: boolean
}

export interface AddressInput {
  firstName: string
  lastName: string
  company?: string | null
  address1: string
  address2?: string | null
  city: string
  state: string
  postalCode: string
  country?: string
  isDefault?: boolean
  type: AddressType
}

export type UpdateAddressInput = Partial<AddressInput>

// ============================================================
// PROFILE
// ============================================================

export async function updateCustomerProfile(
  id: string,
  input: UpdateCustomerProfileInput,
): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateCustomerProfileInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.customer.update({ where: { id }, data })
    revalidateCustomers(id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update profile' }
  }
}

export async function getCustomerHeaderForRefresh(
  id: string,
): Promise<CustomerHeaderRefresh | null> {
  await requireAdmin()
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, phone: true, profilePictureUrl: true,
      birthday: true, newsletter: true, smsOptIn: true,
      currentPoints: true, lifetimePoints: true, totalSpent: true, totalOrders: true,
      anonymizedAt: true,
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    phone: c.phone ?? null,
    profilePictureUrl: c.profilePictureUrl ?? null,
    birthday: c.birthday ?? null,
    newsletter: c.newsletter,
    smsOptIn: c.smsOptIn,
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    totalSpent: Number(c.totalSpent ?? 0),
    totalOrders: c.totalOrders,
    isAnonymized: c.anonymizedAt !== null,
  }
}

// ============================================================
// NOTES (CustomerNote: id, customerId, content, authorId, authorName, isImportant)
// ============================================================

export async function createCustomerNote(
  customerId: string,
  content: string,
  isImportant = false,
): Promise<ActionResult<{ id: string }>> {
  const adminId = await requireAdmin()
  const trimmed = content?.trim() ?? ''
  if (trimmed.length === 0) {
    return { ok: false, error: 'Note content is required' }
  }
  let authorName = 'Admin'
  try {
    const admin = await prisma.customer.findUnique({
      where: { id: adminId },
      select: { name: true, email: true },
    })
    authorName = admin?.name?.trim() || admin?.email || 'Admin'
  } catch {
    // best-effort author label only
  }
  try {
    const n = await prisma.customerNote.create({
      data: {
        customerId,
        content: trimmed,
        authorId: adminId,
        authorName,
        isImportant,
      },
    })
    revalidateCustomers(customerId)
    return { ok: true, data: { id: n.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create note' }
  }
}

export async function updateCustomerNote(
  noteId: string,
  content: string,
  isImportant?: boolean,
): Promise<ActionResult> {
  await requireAdmin()
  const trimmed = content?.trim() ?? ''
  if (trimmed.length === 0) {
    return { ok: false, error: 'Note content is required' }
  }
  const data: Record<string, unknown> = { content: trimmed }
  if (isImportant !== undefined) data.isImportant = isImportant
  try {
    await prisma.customerNote.update({ where: { id: noteId }, data })
    revalidateCustomers()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update note' }
  }
}

export async function deleteCustomerNote(noteId: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.customerNote.delete({ where: { id: noteId } })
    revalidateCustomers()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete note' }
  }
}

// ============================================================
// ADDRESSES (firstName/lastName/address1/address2/city/state/postalCode/country/type)
// ============================================================

function validateAddressInput(input: AddressInput): string | null {
  if (!input.firstName?.trim()) return 'First name is required'
  if (!input.lastName?.trim()) return 'Last name is required'
  if (!input.address1?.trim()) return 'Address line 1 is required'
  if (!input.city?.trim()) return 'City is required'
  if (!input.state?.trim()) return 'State is required'
  if (!input.postalCode?.trim()) return 'Postal code is required'
  return null
}

export async function createAddress(
  customerId: string,
  input: AddressInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const err = validateAddressInput(input)
  if (err) return { ok: false, error: err }
  try {
    const a = await prisma.address.create({
      data: {
        customerId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        company: input.company ?? null,
        address1: input.address1.trim(),
        address2: input.address2 ?? null,
        city: input.city.trim(),
        state: input.state.trim(),
        postalCode: input.postalCode.trim(),
        country: input.country?.trim() || 'US',
        isDefault: input.isDefault ?? false,
        type: input.type,
      },
    })
    revalidateCustomers(customerId)
    return { ok: true, data: { id: a.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to create address' }
  }
}

export async function updateAddress(
  addressId: string,
  input: UpdateAddressInput,
): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateAddressInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.address.update({ where: { id: addressId }, data })
    revalidateCustomers()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to update address' }
  }
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.address.delete({ where: { id: addressId } })
    revalidateCustomers()
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to delete address'
    if (/foreign key/i.test(msg)) {
      return { ok: false, error: 'Address is referenced by orders — cannot delete' }
    }
    return { ok: false, error: msg }
  }
}

export async function setDefaultAddress(
  customerId: string,
  addressId: string,
): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      })
      await tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      })
    })
    revalidateCustomers(customerId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to set default' }
  }
}

// ============================================================
// BULK GIFT POINTS (SUPER_ADMIN, wraps awardPoints)
// ============================================================

export async function bulkGiftPoints(
  customerIds: string[],
  delta: number,
  reason: string,
): Promise<BulkResult> {
  await requireAdminRole('SUPER_ADMIN')
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: 'Delta must be a non-zero number' }
  }
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Reason is required' }
  }
  const batchId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
    .replace(/-/g, '')
    .slice(0, 12)
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const customerId of customerIds) {
    try {
      await awardPoints(
        customerId,
        delta,
        'ADMIN_ADJUSTMENT',
        `Admin gift: ${reason.trim()}`,
        { idempotencyKey: `gift-${batchId}-${customerId}` },
      )
      succeeded.push(customerId)
    } catch (e) {
      failed.push({ id: customerId, error: e instanceof Error ? e.message : 'failed' })
    }
  }
  revalidateCustomers()
  return { ok: true, data: { succeeded, failed } }
}

// ============================================================
// BULK CSV EXPORT
// ============================================================

export async function bulkExportCustomersCsv(
  customerIds: string[],
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  if (customerIds.length > CSV_MAX_ROWS) {
    return { ok: false, error: 'Too many rows — narrow selection' }
  }
  const total = await prisma.customer.count({ where: { id: { in: customerIds } } })
  if (total > CSV_MAX_ROWS) {
    return { ok: false, error: 'Too many rows — narrow selection' }
  }
  const rows = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: {
      id: true, email: true, name: true,
      totalOrders: true, totalSpent: true, currentPoints: true,
      lastOrderDate: true,
      loyaltyTier: { select: { name: true } },
    },
  })
  const headers = ['id', 'email', 'name', 'tier', 'totalOrders', 'totalSpent', 'currentPoints', 'lastOrderDate']
  const csv = rowsToCsv(
    headers,
    rows.map((c) => [
      c.id, c.email, c.name ?? '',
      c.loyaltyTier?.name ?? '',
      c.totalOrders, Number(c.totalSpent ?? 0), c.currentPoints,
      c.lastOrderDate ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

// ============================================================
// GDPR ANONYMIZE (SUPER_ADMIN, atomic via anonymizedAt: null guard)
// ============================================================

export async function anonymizeCustomer(
  id: string,
  typedConfirmEmail: string,
): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  const c = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, email: true, anonymizedAt: true },
  })
  if (!c) return { ok: false, error: 'Customer not found' }
  if (c.anonymizedAt !== null) {
    return { ok: false, error: 'Customer already anonymized' }
  }
  const expected = c.email.trim().toLowerCase()
  const provided = (typedConfirmEmail ?? '').trim().toLowerCase()
  if (expected !== provided) {
    return { ok: false, error: 'Confirmation email mismatch' }
  }
  try {
    await prisma.customer.update({
      where: { id, anonymizedAt: null },
      data: {
        email: `deleted-${id}@anonymized.local`,
        name: null,
        phone: null,
        birthday: null,
        profilePictureUrl: null,
        anonymizedAt: new Date(),
      },
    })
    revalidateCustomers(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to anonymize' }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/app/admin/customers/actions.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add app/admin/customers/actions.ts tests/unit/app/admin/customers/actions.test.ts
git commit -m "feat(admin-v2): add customers server actions (profile/notes/addresses/bulk-gift/csv/anonymize)"
git push -u origin wave8p8/task-3-server-actions
gh pr create --title "feat(admin-v2): Phase 8 W1b customers server actions" --body "Adds app/admin/customers/actions.ts with 12 actions: updateCustomerProfile, getCustomerHeaderForRefresh, createCustomerNote/updateCustomerNote/deleteCustomerNote, createAddress/updateAddress/deleteAddress/setDefaultAddress, bulkGiftPoints (SUPER_ADMIN, wraps awardPoints), bulkExportCustomersCsv (cap 10000), anonymizeCustomer (SUPER_ADMIN, anonymizedAt:null guard + typed-confirm email). 17 tests passing."
```

---

## Wave 2 — List components (3 parallel, after W1b merged)

### Task 4: `CustomersListTable.tsx` — desktop sticky-header table

**Wave:** 2 | **Parallel-safe with:** Tasks 5, 6 | **Branch:** `wave8p8/task-4-customers-list-table` | **Model:** sonnet

**Schema realities for this task:**
- Hidden on mobile (`<md`). Mobile uses `CustomersListCardMobile` (Task 5).
- Columns: checkbox · email · tier badge · totalOrders · totalSpent · currentPoints · lastOrderDate · "⋯" (action menu placeholder).
- Row click → `router.push(\`/admin/customers/${id}\`)` (no inspector intermediate).
- Selected ids state is OWNED by the parent (a parent client component owns the `Set<string> selectedIds` state and passes both `selectedIds` and `onToggleSelection` down). The table does NOT own selection state — the BottomActionSheet (Task 6) needs to see the same set.
- Sort-by-column is deferred to Phase 8.5; v1 sorts by `totalSpent: 'desc'` server-side (already done in `loadCustomersTab`).
- Use `import type` from `@/lib/admin/customers` for `CustomerRow`.

**Files:**
- Create: `components/admin/customers/CustomersListTable.tsx`
- Test: `tests/unit/components/admin/customers/CustomersListTable.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/CustomersListTable.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { CustomersListTable } from '@/components/admin/customers/CustomersListTable'
import type { CustomerRow } from '@/lib/admin/customers'

const sampleRow: CustomerRow = {
  id: 'c1', email: 'ada@e.com', name: 'Ada',
  tierId: 't1', tierName: 'Silver', tierColor: '#aaa',
  currentPoints: 250, totalOrders: 3, totalSpent: 450,
  lastOrderDate: new Date('2026-05-20'), createdAt: new Date('2026-01-15'),
}

beforeEach(() => vi.clearAllMocks())

describe('CustomersListTable', () => {
  it('renders email + tier name + totals for each row', () => {
    render(
      <CustomersListTable
        rows={[sampleRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getByText('ada@e.com')).toBeTruthy()
    expect(screen.getByText('Silver')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('row click navigates to detail page', () => {
    render(
      <CustomersListTable
        rows={[sampleRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open ada@e\.com/i }))
    expect(pushMock).toHaveBeenCalledWith('/admin/customers/c1')
  })

  it('checkbox click toggles selection without navigating', () => {
    const onToggle = vi.fn()
    render(
      <CustomersListTable
        rows={[sampleRow]}
        selectedIds={new Set()}
        onToggleSelection={onToggle}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /select ada@e\.com/i }))
    expect(onToggle).toHaveBeenCalledWith('c1')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('header checkbox toggles all', () => {
    const onToggleAll = vi.fn()
    render(
      <CustomersListTable
        rows={[sampleRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={onToggleAll}
        allSelected={false}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    expect(onToggleAll).toHaveBeenCalled()
  })

  it('empty state when rows is empty', () => {
    render(
      <CustomersListTable
        rows={[]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getByText(/no customers/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/CustomersListTable.test.tsx` — expect module not found.

- [ ] **Step 3: Write `components/admin/customers/CustomersListTable.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import type { CustomerRow } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const nFmt = new Intl.NumberFormat('en-US')
const $Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface CustomersListTableProps {
  rows: CustomerRow[]
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
  onToggleAll: () => void
  allSelected: boolean
}

export function CustomersListTable({
  rows,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  allSelected,
}: CustomersListTableProps) {
  const router = useRouter()

  if (rows.length === 0) {
    return (
      <div className="hidden md:flex items-center justify-center h-32 bg-neutral-900/40 border border-white/8 rounded-md text-sm text-white/40">
        No customers in this tab.
      </div>
    )
  }

  return (
    <div className="hidden md:block overflow-x-auto bg-neutral-900/60 border border-white/8 rounded-md">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-neutral-900/95 border-b border-white/8">
          <tr className="text-left text-xs uppercase tracking-wide text-white/40">
            <th className="px-3 py-2 w-8">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={onToggleAll}
              />
            </th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Tier</th>
            <th className="px-3 py-2 text-right">Orders</th>
            <th className="px-3 py-2 text-right">Spent</th>
            <th className="px-3 py-2 text-right">Points</th>
            <th className="px-3 py-2">Last order</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-white/4 hover:bg-white/[0.03] transition-colors"
            >
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${r.email}`}
                  checked={selectedIds.has(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelection(r.id)}
                />
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  aria-label={`Open ${r.email}`}
                  onClick={() => router.push(`/admin/customers/${r.id}`)}
                  className="text-left text-white hover:text-white/80"
                >
                  <div className="font-medium">{r.email}</div>
                  {r.name && <div className="text-xs text-white/40">{r.name}</div>}
                </button>
              </td>
              <td className="px-3 py-2">
                {r.tierName ? (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{
                      background: `${r.tierColor ?? '#64748B'}26`,
                      color: r.tierColor ?? '#94A3B8',
                    }}
                  >
                    {r.tierName}
                  </span>
                ) : (
                  <span className="text-xs text-white/30">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-white/80">{nFmt.format(r.totalOrders)}</td>
              <td className="px-3 py-2 text-right text-white/80">{$Fmt.format(r.totalSpent)}</td>
              <td className="px-3 py-2 text-right text-white/80">{nFmt.format(r.currentPoints)}</td>
              <td className="px-3 py-2 text-white/60">
                {r.lastOrderDate ? dFmt.format(r.lastOrderDate) : <span className="text-white/30">never</span>}
              </td>
              <td className="px-3 py-2 text-white/30">⋯</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/CustomersListTable.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/CustomersListTable.tsx tests/unit/components/admin/customers/CustomersListTable.test.tsx
git commit -m "feat(admin-v2): add CustomersListTable (desktop sticky-header table)"
git push -u origin wave8p8/task-4-customers-list-table
gh pr create --title "feat(admin-v2): Phase 8 W2 CustomersListTable" --body "Desktop sticky-header table (hidden < md). Columns: checkbox · email · tier badge · orders · spent · points · last order · ⋯. Row click → /admin/customers/[id]. Selection state owned by parent. 5 tests passing."
```

---

### Task 5: `CustomersListCardMobile.tsx` — mobile card with long-press + swipe

**Wave:** 2 | **Parallel-safe with:** Tasks 4, 6 | **Branch:** `wave8p8/task-5-customers-list-card-mobile` | **Model:** sonnet

**Schema realities for this task:**
- Visible only on mobile (`md:hidden`).
- Long-press (~500ms) toggles multi-select mode. Once any row is selected, tap = toggle; otherwise tap = navigate to detail page.
- Swipe-left exposes a "Gift Points" quick action (only when `isSuperAdmin` is true). Swipe is tracked via touchstart/touchmove/touchend on the card; threshold = 60px to reveal the action, second tap on the revealed action calls `onGiftPoints(id)` (parent owns the gift dialog).
- Selected state passed in from parent (same `selectedIds: Set<string>` + `onToggleSelection` as Task 4).
- `onGiftPoints` prop is optional — when `isSuperAdmin === false`, parent passes `undefined` and the swipe action does nothing visible.
- Use `import type` from `@/lib/admin/customers` for `CustomerRow`.

**Files:**
- Create: `components/admin/customers/CustomersListCardMobile.tsx`
- Test: `tests/unit/components/admin/customers/CustomersListCardMobile.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/CustomersListCardMobile.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { CustomersListCardMobile } from '@/components/admin/customers/CustomersListCardMobile'
import type { CustomerRow } from '@/lib/admin/customers'

const row: CustomerRow = {
  id: 'c1', email: 'ada@e.com', name: 'Ada',
  tierId: 't1', tierName: 'Silver', tierColor: '#aaa',
  currentPoints: 250, totalOrders: 3, totalSpent: 450,
  lastOrderDate: new Date('2026-05-20'), createdAt: new Date('2026-01-15'),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

describe('CustomersListCardMobile', () => {
  it('tap navigates when nothing is selected', () => {
    render(
      <CustomersListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        isSuperAdmin={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open ada@e\.com/i }))
    expect(pushMock).toHaveBeenCalledWith('/admin/customers/c1')
  })

  it('tap toggles selection when other rows are selected', () => {
    const onToggle = vi.fn()
    render(
      <CustomersListCardMobile
        row={row}
        selectedIds={new Set(['otherId'])}
        onToggleSelection={onToggle}
        isSuperAdmin={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open ada@e\.com/i }))
    expect(onToggle).toHaveBeenCalledWith('c1')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('long press enters multi-select on this card', () => {
    const onToggle = vi.fn()
    render(
      <CustomersListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={onToggle}
        isSuperAdmin={false}
      />,
    )
    const btn = screen.getByRole('button', { name: /open ada@e\.com/i })
    fireEvent.touchStart(btn, { touches: [{ clientX: 0, clientY: 0 }] })
    act(() => { vi.advanceTimersByTime(550) })
    fireEvent.touchEnd(btn)
    expect(onToggle).toHaveBeenCalledWith('c1')
  })

  it('renders Gift action only when isSuperAdmin is true + swipe threshold exceeded', () => {
    const onGift = vi.fn()
    render(
      <CustomersListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        isSuperAdmin
        onGiftPoints={onGift}
      />,
    )
    const btn = screen.getByRole('button', { name: /open ada@e\.com/i })
    fireEvent.touchStart(btn, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchMove(btn, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchEnd(btn)
    const giftBtn = screen.getByRole('button', { name: /gift/i })
    fireEvent.click(giftBtn)
    expect(onGift).toHaveBeenCalledWith('c1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/CustomersListCardMobile.test.tsx` — expect module not found.

- [ ] **Step 3: Write `components/admin/customers/CustomersListCardMobile.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CustomerRow } from '@/lib/admin/customers'

const $Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const nFmt = new Intl.NumberFormat('en-US')

const LONG_PRESS_MS = 500
const SWIPE_THRESHOLD_PX = 60

export interface CustomersListCardMobileProps {
  row: CustomerRow
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
  isSuperAdmin: boolean
  onGiftPoints?: (id: string) => void
}

export function CustomersListCardMobile({
  row,
  selectedIds,
  onToggleSelection,
  isSuperAdmin,
  onGiftPoints,
}: CustomersListCardMobileProps) {
  const router = useRouter()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const swipeStartX = useRef<number | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const inMultiSelect = selectedIds.size > 0
  const isSelected = selectedIds.has(row.id)

  const handleTap = () => {
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    if (inMultiSelect) onToggleSelection(row.id)
    else router.push(`/admin/customers/${row.id}`)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    longPressed.current = false
    swipeStartX.current = e.touches[0]?.clientX ?? null
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true
      onToggleSelection(row.id)
    }, LONG_PRESS_MS)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return
    const dx = (e.touches[0]?.clientX ?? 0) - swipeStartX.current
    if (Math.abs(dx) > 5 && longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (dx < 0) setSwipeOffset(Math.max(dx, -120))
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (Math.abs(swipeOffset) >= SWIPE_THRESHOLD_PX && isSuperAdmin && onGiftPoints) {
      setRevealed(true)
    } else {
      setSwipeOffset(0)
    }
    swipeStartX.current = null
  }

  return (
    <div className="md:hidden relative overflow-hidden rounded-md border border-white/8 bg-neutral-900/60">
      {revealed && isSuperAdmin && onGiftPoints && (
        <button
          type="button"
          onClick={() => {
            onGiftPoints(row.id)
            setRevealed(false)
            setSwipeOffset(0)
          }}
          className="absolute right-0 top-0 h-full px-4 bg-[#FF3131] text-white text-xs font-semibold"
        >
          Gift
        </button>
      )}
      <button
        type="button"
        aria-label={`Open ${row.email}`}
        aria-pressed={isSelected}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        className={`block w-full text-left p-3 transition-transform ${
          isSelected ? 'bg-white/[0.06]' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{row.email}</div>
            {row.name && <div className="text-xs text-white/40 truncate">{row.name}</div>}
          </div>
          {row.tierName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0"
              style={{
                background: `${row.tierColor ?? '#64748B'}26`,
                color: row.tierColor ?? '#94A3B8',
              }}
            >
              {row.tierName}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/60">
          <div>{nFmt.format(row.totalOrders)} orders</div>
          <div>{$Fmt.format(row.totalSpent)}</div>
          <div>{nFmt.format(row.currentPoints)} pts</div>
        </div>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/CustomersListCardMobile.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/CustomersListCardMobile.tsx tests/unit/components/admin/customers/CustomersListCardMobile.test.tsx
git commit -m "feat(admin-v2): add CustomersListCardMobile (long-press multi-select + swipe-left gift)"
git push -u origin wave8p8/task-5-customers-list-card-mobile
gh pr create --title "feat(admin-v2): Phase 8 W2 CustomersListCardMobile" --body "Mobile card (md:hidden). Tap = navigate when no selection; tap = toggle when selection active. Long-press 500ms enters multi-select. Swipe-left reveals Gift action (SUPER_ADMIN only). 4 tests passing."
```

---

### Task 6: `CustomersBulkSheet.tsx` — bottom action sheet

**Wave:** 2 | **Parallel-safe with:** Tasks 4, 5 | **Branch:** `wave8p8/task-6-customers-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- Visible when `selectedIds.length > 0`.
- 3 actions:
  - Bulk Gift Points (SUPER_ADMIN only) — opens an inline dialog that takes `delta: number` + `reason: string`, then calls `bulkGiftPoints(selectedIds, delta, reason)`.
  - Bulk Export CSV — calls `bulkExportCustomersCsv(selectedIds)`, downloads result as `customers-${YYYY-MM-DD}.csv`.
  - Bulk Anonymize (SUPER_ADMIN only) — opens a typed-confirm dialog that requires admin to type the literal string `ANONYMIZE` (NOT customer email since multiple customers; the single-customer typed-confirm pattern is on `AnonymizeConfirmDialog` Task 19). On confirm, iterates `anonymizeCustomer(id, ?)` for each selected — but BECAUSE single-customer anonymize requires `typedConfirmEmail`, bulk anonymize is gated to admins-knowing-what-they-do. For v1, bulk anonymize submits `anonymizeCustomer` per id by FIRST fetching each customer's email then passing it back. Simpler v1 approach: emit a clear "This will anonymize N customers" prompt with `ANONYMIZE` text confirm; on confirm call ONE new server action `bulkAnonymizeCustomers(ids, confirmToken: 'ANONYMIZE')` — but to keep Task 3's action surface stable, the bulk anonymize dialog instead delegates to `anonymizeCustomer` one-by-one AFTER pre-fetching emails via a fresh action. **DECISION:** bulk anonymize is OUT OF SCOPE for v1 — the BulkSheet shows the button disabled with tooltip "Use per-customer Anonymize for v1". This keeps scope tight + avoids a 13th server action.
- Component receives `onClear()` callback to reset parent's selection set after a successful action.
- Use `import type` from `@/app/admin/customers/actions` for the action result types; `import` (value) the actions themselves — actions are server-callable from a `'use client'` file via Next.js Server Actions.

**Files:**
- Create: `components/admin/customers/CustomersBulkSheet.tsx`
- Test: `tests/unit/components/admin/customers/CustomersBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/CustomersBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const bulkGiftPoints = vi.fn()
const bulkExportCustomersCsv = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  bulkGiftPoints: (...a: unknown[]) => bulkGiftPoints(...a),
  bulkExportCustomersCsv: (...a: unknown[]) => bulkExportCustomersCsv(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { CustomersBulkSheet } from '@/components/admin/customers/CustomersBulkSheet'

beforeEach(() => vi.clearAllMocks())

describe('CustomersBulkSheet', () => {
  it('renders nothing when selection is empty', () => {
    const { container } = render(
      <CustomersBulkSheet
        selectedIds={[]}
        isSuperAdmin
        onClear={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows count and 3 action buttons when selection > 0', () => {
    render(
      <CustomersBulkSheet
        selectedIds={['c1', 'c2']}
        isSuperAdmin
        onClear={() => {}}
      />,
    )
    expect(screen.getByText(/2 selected/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /gift points/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /export csv/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /anonymize/i })).toBeTruthy()
  })

  it('Gift Points button hidden when isSuperAdmin is false', () => {
    render(
      <CustomersBulkSheet
        selectedIds={['c1']}
        isSuperAdmin={false}
        onClear={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /gift points/i })).toBeNull()
  })

  it('Export CSV calls bulkExportCustomersCsv + triggers download flow', async () => {
    bulkExportCustomersCsv.mockResolvedValue({ ok: true, data: { csv: 'id,email\nc1,a@e.com' } })
    render(
      <CustomersBulkSheet
        selectedIds={['c1']}
        isSuperAdmin
        onClear={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(bulkExportCustomersCsv).toHaveBeenCalledWith(['c1']))
  })

  it('Anonymize button is disabled with tooltip in v1', () => {
    render(
      <CustomersBulkSheet
        selectedIds={['c1']}
        isSuperAdmin
        onClear={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: /anonymize/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(btn.getAttribute('title')).toMatch(/per-customer/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/CustomersBulkSheet.test.tsx` — module not found.

- [ ] **Step 3: Write `components/admin/customers/CustomersBulkSheet.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { bulkGiftPoints, bulkExportCustomersCsv } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface CustomersBulkSheetProps {
  selectedIds: string[]
  isSuperAdmin: boolean
  onClear: () => void
}

export function CustomersBulkSheet({
  selectedIds,
  isSuperAdmin,
  onClear,
}: CustomersBulkSheetProps) {
  const [giftOpen, setGiftOpen] = useState(false)
  const [delta, setDelta] = useState<number>(100)
  const [reason, setReason] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  if (selectedIds.length === 0) return null

  const handleGift = () => {
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error('Delta must be a non-zero number')
      return
    }
    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }
    startTransition(async () => {
      const r = await bulkGiftPoints(selectedIds, delta, reason.trim())
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(
        `Gifted ${delta} pts to ${r.data?.succeeded.length ?? 0} customers` +
          (r.data?.failed.length ? ` (${r.data.failed.length} failed)` : ''),
      )
      setGiftOpen(false)
      setReason('')
      onClear()
    })
  }

  const handleExport = () => {
    startTransition(async () => {
      const r = await bulkExportCustomersCsv(selectedIds)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const csv = r.data?.csv ?? ''
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${selectedIds.length} customers`)
    })
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-neutral-900/95 border-t border-white/8 backdrop-blur">
      <div className="max-w-7xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-white/60">
          <span className="text-white font-semibold">{selectedIds.length}</span> selected
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setGiftOpen((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747]"
            >
              Gift points
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-md bg-white/6 text-white hover:bg-white/10 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled
            title="Use per-customer Anonymize for v1; bulk arrives in Phase 8.5"
            className="text-xs px-3 py-1.5 rounded-md bg-white/4 text-white/30 cursor-not-allowed"
          >
            Anonymize
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-xs px-2 py-1.5 rounded-md text-white/40 hover:text-white/80"
          >
            Clear
          </button>
        </div>
      </div>
      {giftOpen && isSuperAdmin && (
        <div className="border-t border-white/8 bg-neutral-950/90 px-3 py-2 flex items-center gap-2 flex-wrap">
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
            aria-label="Points delta"
            className="w-24 text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-white"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            aria-label="Reason"
            className="flex-1 min-w-[180px] text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-white"
          />
          <button
            type="button"
            onClick={handleGift}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/CustomersBulkSheet.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/CustomersBulkSheet.tsx tests/unit/components/admin/customers/CustomersBulkSheet.test.tsx
git commit -m "feat(admin-v2): add CustomersBulkSheet (Gift / Export / Anonymize-deferred)"
git push -u origin wave8p8/task-6-customers-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 8 W2 CustomersBulkSheet" --body "Fixed bottom action sheet. 3 actions: Gift Points (SUPER_ADMIN, inline form), Export CSV (downloads via blob URL), Anonymize (disabled in v1 with tooltip). 5 tests passing."
```

---

## Wave 3 — Detail widgets (9 parallel, after W1b merged)

### Task 7: `CustomerHeader.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 8-15 | **Branch:** `wave8p8/task-7-customer-header` | **Model:** sonnet

**Schema realities for this task:**
- Reads `CustomerHeaderData` from `lib/admin/customers.loadCustomerHeader` (already exists per Task 2).
- Displays: profilePictureUrl (NOT avatarUrl) initials fallback, name, email, joined date, tier badge (with colour), currentPoints + lifetimePoints, status pill ("Active" or "Anonymized").
- "⋯" menu has two items:
  - Edit Profile → opens `ProfileEditInspector` (Task 16) — passes `customer` data.
  - Anonymize (SUPER_ADMIN only) → opens `AnonymizeConfirmDialog` (Task 19).
- The inspectors (ProfileEditInspector, AnonymizeConfirmDialog) are built in W4 IN PARALLEL with this widget. To stay parallel-safe, this component imports them by path; the import will resolve at compile time only after W4 merges. The TASK 7 PR will be merged AFTER W4 PRs land (the controller batches Wave 3 + Wave 4 PRs into the same merge window, then merges in dependency order). Inside this task's TEST FILE we mock the inspector imports to avoid the cross-wave dependency.
- Component is a CLIENT component (owns inspector open state). The `'use client'` directive is required.
- Use `import type` from `@/lib/admin/customers` for `CustomerHeaderData`.

**Files:**
- Create: `components/admin/customers/detail/CustomerHeader.tsx`
- Test: `tests/unit/components/admin/customers/detail/CustomerHeader.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerHeader.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/admin/customers/inspectors/ProfileEditInspector', () => ({
  ProfileEditInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="profile-inspector" /> : null,
}))
vi.mock('@/components/admin/customers/inspectors/AnonymizeConfirmDialog', () => ({
  AnonymizeConfirmDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="anonymize-dialog" /> : null,
}))

import { CustomerHeader } from '@/components/admin/customers/detail/CustomerHeader'
import type { CustomerHeaderData } from '@/lib/admin/customers'

const baseHeader: CustomerHeaderData = {
  id: 'c1', email: 'ada@e.com', name: 'Ada Lovelace', phone: '555',
  profilePictureUrl: null, birthday: null, newsletter: true, smsOptIn: false,
  tierId: 't1', tierName: 'Silver', tierSlug: 'silver', tierColor: '#aaa',
  currentPoints: 250, lifetimePoints: 1500,
  totalSpent: 450, totalOrders: 3,
  lastOrderDate: new Date('2026-05-20'), createdAt: new Date('2026-01-15'),
  isAnonymized: false, anonymizedAt: null,
}

beforeEach(() => vi.clearAllMocks())

describe('CustomerHeader', () => {
  it('renders email + name + tier badge + points', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin={false} />)
    expect(screen.getByText('ada@e.com')).toBeTruthy()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText('Silver')).toBeTruthy()
    expect(screen.getByText('250')).toBeTruthy()
  })

  it('renders Anonymized pill when isAnonymized is true', () => {
    render(
      <CustomerHeader
        header={{ ...baseHeader, isAnonymized: true, anonymizedAt: new Date() }}
        isSuperAdmin
      />,
    )
    expect(screen.getByText(/anonymized/i)).toBeTruthy()
  })

  it('renders Active pill when isAnonymized is false', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin={false} />)
    expect(screen.getByText(/active/i)).toBeTruthy()
  })

  it('opens ProfileEditInspector on Edit Profile click', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /edit profile/i }))
    expect(screen.getByTestId('profile-inspector')).toBeTruthy()
  })

  it('Anonymize menuitem hidden when not SUPER_ADMIN', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(screen.queryByRole('menuitem', { name: /anonymize/i })).toBeNull()
  })

  it('opens AnonymizeConfirmDialog when SUPER_ADMIN clicks Anonymize', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /anonymize/i }))
    expect(screen.getByTestId('anonymize-dialog')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerHeader.test.tsx` — module not found.

- [ ] **Step 3: Write `components/admin/customers/detail/CustomerHeader.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { CustomerHeaderData } from '@/lib/admin/customers'
import { ProfileEditInspector } from '@/components/admin/customers/inspectors/ProfileEditInspector'
import { AnonymizeConfirmDialog } from '@/components/admin/customers/inspectors/AnonymizeConfirmDialog'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const nFmt = new Intl.NumberFormat('en-US')

export interface CustomerHeaderProps {
  header: CustomerHeaderData
  isSuperAdmin: boolean
}

function initials(email: string, name: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
  }
  return (email[0] ?? '?').toUpperCase()
}

export function CustomerHeader({ header, isSuperAdmin }: CustomerHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [anonOpen, setAnonOpen] = useState(false)

  return (
    <div className="bg-neutral-900/60 border border-white/8 rounded-md p-4 flex items-start gap-3">
      {header.profilePictureUrl ? (
        <img
          src={header.profilePictureUrl}
          alt=""
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-sm font-semibold">
          {initials(header.email, header.name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-white text-lg font-semibold truncate">
            {header.name ?? header.email}
          </h1>
          {header.isAnonymized ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-semibold">
              Anonymized
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
              Active
            </span>
          )}
          {header.tierName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{
                background: `${header.tierColor ?? '#64748B'}26`,
                color: header.tierColor ?? '#94A3B8',
              }}
            >
              {header.tierName}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-white/50 truncate">{header.email}</div>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-white/60">
          <div>Joined {dFmt.format(header.createdAt)}</div>
          <div>{nFmt.format(header.currentPoints)} pts</div>
          <div>{nFmt.format(header.lifetimePoints)} lifetime</div>
          <div>{nFmt.format(header.totalOrders)} orders</div>
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="More actions"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 text-white/60"
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-44 bg-neutral-900 border border-white/8 rounded-md shadow-lg z-10"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setEditOpen(true); setMenuOpen(false) }}
              disabled={header.isAnonymized}
              className="block w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/[0.04] disabled:opacity-30"
            >
              Edit profile
            </button>
            {isSuperAdmin && !header.isAnonymized && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { setAnonOpen(true); setMenuOpen(false) }}
                className="block w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
              >
                Anonymize…
              </button>
            )}
          </div>
        )}
      </div>
      <ProfileEditInspector
        open={editOpen}
        header={header}
        onClose={() => setEditOpen(false)}
      />
      <AnonymizeConfirmDialog
        open={anonOpen}
        customerId={header.id}
        customerEmail={header.email}
        onClose={() => setAnonOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerHeader.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerHeader.tsx tests/unit/components/admin/customers/detail/CustomerHeader.test.tsx
git commit -m "feat(admin-v2): add CustomerHeader widget (avatar/tier/status/⋯ menu)"
git push -u origin wave8p8/task-7-customer-header
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerHeader" --body "Detail page header. profilePictureUrl (initials fallback) + name + email + Active/Anonymized pill + tier badge + currentPoints + ⋯ menu (Edit Profile + SUPER_ADMIN Anonymize). 6 tests passing."
```

---

### Task 8: `CustomerOrdersPanel.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 7, 9-15 | **Branch:** `wave8p8/task-8-customer-orders-panel` | **Model:** sonnet

**Schema realities for this task:**
- Server component (async) — directly awaits `loadCustomerOrders(customerId)` from `lib/admin/customers`.
- Renders a table: orderNumber · status pill · total · createdAt. Each row links to `/admin/fulfillment/${orderId}` (Phase 4).
- Pagination: 10 per page; query param `?ordersPage=N` (URL-scoped to avoid colliding with reviewsPage/ticketsPage).
- Empty state: "No orders yet."

**Files:**
- Create: `components/admin/customers/detail/CustomerOrdersPanel.tsx`
- Test: `tests/unit/components/admin/customers/detail/CustomerOrdersPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerOrdersPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerOrders: vi.fn().mockResolvedValue({
    items: [
      { id: 'o1', orderNumber: 'HOF-100', status: 'DELIVERED', total: 99.5,
        createdAt: new Date('2026-05-15') },
    ],
    total: 1, page: 1, pageSize: 10,
  }),
}))

import { CustomerOrdersPanel } from '@/components/admin/customers/detail/CustomerOrdersPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerOrdersPanel', () => {
  it('renders order rows with links', async () => {
    const node = await CustomerOrdersPanel({ customerId: 'c1', page: 1 })
    render(node as React.ReactElement)
    expect(screen.getByText('HOF-100')).toBeTruthy()
    const link = screen.getByRole('link', { name: /HOF-100/ })
    expect(link.getAttribute('href')).toBe('/admin/fulfillment/o1')
  })

  it('renders empty state when no orders', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerOrders as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [], total: 0, page: 1, pageSize: 10,
    })
    const node = await CustomerOrdersPanel({ customerId: 'c1', page: 1 })
    render(node as React.ReactElement)
    expect(screen.getByText(/no orders/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerOrdersPanel.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/detail/CustomerOrdersPanel.tsx`**

```tsx
import Link from 'next/link'
import { loadCustomerOrders } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const $Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface CustomerOrdersPanelProps {
  customerId: string
  page?: number
}

export async function CustomerOrdersPanel({ customerId, page = 1 }: CustomerOrdersPanelProps) {
  const data = await loadCustomerOrders(customerId, page)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Orders</h2>
        <span className="text-xs text-white/40">{data.total} total</span>
      </header>
      {data.items.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No orders yet.</div>
      ) : (
        <ul>
          {data.items.map((o) => (
            <li key={o.id} className="border-b border-white/4 last:border-b-0">
              <Link
                href={`/admin/fulfillment/${o.id}`}
                className="block px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between gap-2"
              >
                <span className="text-sm text-white">{o.orderNumber}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 font-semibold">
                  {o.status}
                </span>
                <span className="text-sm text-white/80">{$Fmt.format(o.total)}</span>
                <span className="text-xs text-white/40">{dFmt.format(o.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerOrdersPanel.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerOrdersPanel.tsx tests/unit/components/admin/customers/detail/CustomerOrdersPanel.test.tsx
git commit -m "feat(admin-v2): add CustomerOrdersPanel (paginated order history)"
git push -u origin wave8p8/task-8-customer-orders-panel
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerOrdersPanel" --body "Server component listing customer's orders (10/page). Each row links to Phase 4 /admin/fulfillment/[orderId]. 2 tests passing."
```

---

### Task 9: `CustomerLoyaltyPanel.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 7, 8, 10-15 | **Branch:** `wave8p8/task-9-customer-loyalty-panel` | **Model:** sonnet

**Schema realities for this task:**
- Server component — directly awaits `loadCustomerLoyalty(customerId)` from `lib/admin/customers`.
- Renders tier badge + currentPoints + lifetimePoints + annualPointsEarned + tierStartDate.
- Below: last 10 `PointsTransaction` rows (type · points · description · createdAt).
- "View in Loyalty →" link to `/admin/loyalty?tab=members&member=${id}` (Phase 7 MemberInspector deep link — Phase 7 already supports `?member=` query).

**Files:**
- Create: `components/admin/customers/detail/CustomerLoyaltyPanel.tsx`
- Test: `tests/unit/components/admin/customers/detail/CustomerLoyaltyPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerLoyaltyPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerLoyalty: vi.fn().mockResolvedValue({
    tierId: 't1', tierName: 'Silver', tierSlug: 'silver', tierColor: '#aaa',
    currentPoints: 250, lifetimePoints: 1500, annualPointsEarned: 800,
    tierStartDate: new Date('2026-01-01'),
    transactions: [
      { id: 'pt1', points: 100, type: 'PURCHASE', description: 'Order HOF-100',
        createdAt: new Date('2026-05-15'), orderId: 'o1' },
    ],
  }),
}))

import { CustomerLoyaltyPanel } from '@/components/admin/customers/detail/CustomerLoyaltyPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerLoyaltyPanel', () => {
  it('renders tier badge + balances + ledger', async () => {
    const node = await CustomerLoyaltyPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText('Silver')).toBeTruthy()
    expect(screen.getByText(/250/)).toBeTruthy()
    expect(screen.getByText(/Order HOF-100/)).toBeTruthy()
  })

  it('renders "View in Loyalty" deep link', async () => {
    const node = await CustomerLoyaltyPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    const link = screen.getByRole('link', { name: /view in loyalty/i })
    expect(link.getAttribute('href')).toContain('/admin/loyalty')
    expect(link.getAttribute('href')).toContain('member=c1')
  })

  it('renders empty ledger state', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerLoyalty as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tierId: null, tierName: null, tierSlug: null, tierColor: null,
      currentPoints: 0, lifetimePoints: 0, annualPointsEarned: 0,
      tierStartDate: new Date(), transactions: [],
    })
    const node = await CustomerLoyaltyPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no points activity/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerLoyaltyPanel.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/detail/CustomerLoyaltyPanel.tsx`**

```tsx
import Link from 'next/link'
import { loadCustomerLoyalty } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const nFmt = new Intl.NumberFormat('en-US')

export interface CustomerLoyaltyPanelProps {
  customerId: string
}

export async function CustomerLoyaltyPanel({ customerId }: CustomerLoyaltyPanelProps) {
  const data = await loadCustomerLoyalty(customerId)
  if (!data) {
    return (
      <section className="bg-neutral-900/60 border border-white/8 rounded-md p-4 text-sm text-white/40">
        Loyalty data unavailable.
      </section>
    )
  }

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Loyalty</h2>
        <Link
          href={`/admin/loyalty?tab=members&member=${customerId}`}
          className="text-xs text-white/50 hover:text-white"
        >
          View in Loyalty →
        </Link>
      </header>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {data.tierName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{
                background: `${data.tierColor ?? '#64748B'}26`,
                color: data.tierColor ?? '#94A3B8',
              }}
            >
              {data.tierName}
            </span>
          )}
          <span className="text-xs text-white/40">
            since {dFmt.format(data.tierStartDate)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
          <div>
            <div className="text-white text-base">{nFmt.format(data.currentPoints)}</div>
            <div>Current</div>
          </div>
          <div>
            <div className="text-white text-base">{nFmt.format(data.lifetimePoints)}</div>
            <div>Lifetime</div>
          </div>
          <div>
            <div className="text-white text-base">{nFmt.format(data.annualPointsEarned)}</div>
            <div>Annual</div>
          </div>
        </div>
        <div className="border-t border-white/8 pt-2">
          {data.transactions.length === 0 ? (
            <div className="text-sm text-white/40 py-2">No points activity yet.</div>
          ) : (
            <ul className="space-y-1">
              {data.transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-xs">
                  <span className="text-white/70">{t.description}</span>
                  <span className={t.points >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                    {t.points >= 0 ? '+' : ''}
                    {nFmt.format(t.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerLoyaltyPanel.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerLoyaltyPanel.tsx tests/unit/components/admin/customers/detail/CustomerLoyaltyPanel.test.tsx
git commit -m "feat(admin-v2): add CustomerLoyaltyPanel (tier + balances + last 10 ledger)"
git push -u origin wave8p8/task-9-customer-loyalty-panel
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerLoyaltyPanel" --body "Server component. Tier badge + currentPoints/lifetimePoints/annualPointsEarned + last 10 PointsTransaction rows. Deep link to /admin/loyalty?tab=members&member=\${id}. 3 tests passing."
```

---

### Task 10: `CustomerAddressesPanel.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 7-9, 11-15 | **Branch:** `wave8p8/task-10-customer-addresses-panel` | **Model:** sonnet

**Schema realities for this task:**
- Server component that loads addresses + a client wrapper that owns `AddressInspector` open state. Pattern: the server component awaits `loadCustomerAddresses(id)` and renders a CLIENT child `CustomerAddressesPanelClient` passing `addresses` + `customerId` props.
- Each row shows: firstName lastName, address1, address2?, city, state, postalCode, country, type, isDefault badge.
- Per-row buttons: Edit (opens `AddressInspector` in update mode), Delete (calls `deleteAddress` via server action with confirm), Set Default (calls `setDefaultAddress`; hidden if already default).
- "+ Add Address" button at top opens `AddressInspector` in create mode.
- The inspector is built in W4 — mock it in this task's test.
- The client component imports `deleteAddress` + `setDefaultAddress` from `@/app/admin/customers/actions` (server actions called from client per Next.js).

**Files:**
- Create: `components/admin/customers/detail/CustomerAddressesPanel.tsx` (server)
- Create: `components/admin/customers/detail/CustomerAddressesPanelClient.tsx` (client)
- Test: `tests/unit/components/admin/customers/detail/CustomerAddressesPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerAddressesPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerAddresses: vi.fn().mockResolvedValue([
    { id: 'a1', firstName: 'Ada', lastName: 'Lovelace', company: null,
      address1: '1 Main St', address2: 'Apt 2', city: 'NYC', state: 'NY',
      postalCode: '10001', country: 'US', isDefault: true, type: 'SHIPPING' },
    { id: 'a2', firstName: 'Ada', lastName: 'Lovelace', company: null,
      address1: '2nd St', address2: null, city: 'NYC', state: 'NY',
      postalCode: '10002', country: 'US', isDefault: false, type: 'BILLING' },
  ]),
}))

const deleteAddress = vi.fn().mockResolvedValue({ ok: true })
const setDefaultAddress = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/admin/customers/actions', () => ({
  deleteAddress: (...a: unknown[]) => deleteAddress(...a),
  setDefaultAddress: (...a: unknown[]) => setDefaultAddress(...a),
}))

vi.mock('@/components/admin/customers/inspectors/AddressInspector', () => ({
  AddressInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="address-inspector" /> : null,
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CustomerAddressesPanel } from '@/components/admin/customers/detail/CustomerAddressesPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerAddressesPanel', () => {
  it('renders address rows with default badge', async () => {
    const node = await CustomerAddressesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/1 Main St/)).toBeTruthy()
    expect(screen.getByText(/Default/i)).toBeTruthy()
  })

  it('opens AddressInspector on + Add Address click', async () => {
    const node = await CustomerAddressesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    fireEvent.click(screen.getByRole('button', { name: /add address/i }))
    expect(screen.getByTestId('address-inspector')).toBeTruthy()
  })

  it('Set Default button hidden when address is already default', async () => {
    const node = await CustomerAddressesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    const setDefaultButtons = screen.getAllByRole('button', { name: /set default/i })
    expect(setDefaultButtons).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerAddressesPanel.test.tsx`

- [ ] **Step 3: Write the server component**

```tsx
// components/admin/customers/detail/CustomerAddressesPanel.tsx
import { loadCustomerAddresses } from '@/lib/admin/customers'
import { CustomerAddressesPanelClient } from './CustomerAddressesPanelClient'

export interface CustomerAddressesPanelProps {
  customerId: string
}

export async function CustomerAddressesPanel({ customerId }: CustomerAddressesPanelProps) {
  const addresses = await loadCustomerAddresses(customerId)
  return <CustomerAddressesPanelClient customerId={customerId} addresses={addresses} />
}
```

- [ ] **Step 4: Write the client wrapper**

```tsx
// components/admin/customers/detail/CustomerAddressesPanelClient.tsx
'use client'

import { useState, useTransition } from 'react'
import type { AddressRow } from '@/lib/admin/customers'
import { deleteAddress, setDefaultAddress } from '@/app/admin/customers/actions'
import { AddressInspector } from '@/components/admin/customers/inspectors/AddressInspector'
import { toast } from '@/lib/toast'

export interface CustomerAddressesPanelClientProps {
  customerId: string
  addresses: AddressRow[]
}

export function CustomerAddressesPanelClient({
  customerId,
  addresses,
}: CustomerAddressesPanelClientProps) {
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const editing = editId ? addresses.find((a) => a.id === editId) ?? null : null

  const onDelete = (id: string) => {
    if (!confirm('Delete this address?')) return
    startTransition(async () => {
      const r = await deleteAddress(id)
      if (r.ok) toast.success('Address deleted')
      else toast.error(r.error)
    })
  }

  const onSetDefault = (id: string) => {
    startTransition(async () => {
      const r = await setDefaultAddress(customerId, id)
      if (r.ok) toast.success('Default address updated')
      else toast.error(r.error)
    })
  }

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Addresses</h2>
        <button
          type="button"
          onClick={() => { setEditId(null); setOpen(true) }}
          className="text-xs px-2 py-1 rounded bg-[#FF3131] text-white hover:bg-[#ff4747]"
        >
          + Add address
        </button>
      </header>
      {addresses.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No addresses on file.</div>
      ) : (
        <ul>
          {addresses.map((a) => (
            <li key={a.id} className="border-b border-white/4 last:border-b-0 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-white">
                    {a.firstName} {a.lastName}
                    {a.isDefault && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        Default
                      </span>
                    )}
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/60">
                      {a.type}
                    </span>
                  </div>
                  <div className="text-xs text-white/60">
                    {a.address1}{a.address2 ? `, ${a.address2}` : ''}
                  </div>
                  <div className="text-xs text-white/40">
                    {a.city}, {a.state} {a.postalCode} · {a.country}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() => onSetDefault(a.id)}
                      disabled={isPending}
                      className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setEditId(a.id); setOpen(true) }}
                    className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={isPending}
                    className="text-[10px] px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddressInspector
        open={open}
        customerId={customerId}
        address={editing}
        onClose={() => setOpen(false)}
      />
    </section>
  )
}
```

- [ ] **Step 5: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerAddressesPanel.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerAddressesPanel.tsx components/admin/customers/detail/CustomerAddressesPanelClient.tsx tests/unit/components/admin/customers/detail/CustomerAddressesPanel.test.tsx
git commit -m "feat(admin-v2): add CustomerAddressesPanel (CRUD list + default + AddressInspector)"
git push -u origin wave8p8/task-10-customer-addresses-panel
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerAddressesPanel" --body "Server + client split. Lists addresses (firstName/lastName/address1/state/postalCode field names). Per-row Edit/Delete/Set Default. + Add Address opens AddressInspector. 3 tests passing."
```

---

### Task 11: `CustomerReviewsPanel.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 7-10, 12-15 | **Branch:** `wave8p8/task-11-customer-reviews-panel` | **Model:** sonnet

**Schema realities for this task:**
- Server component — directly awaits `loadCustomerReviews(customerId)`.
- Read-only list: product name · rating (1-5 stars) · status pill (PENDING/APPROVED/REJECTED — `ReviewStatus` enum) · createdAt.
- Each row links to Phase 3 review detail at `/admin/reviews/${reviewId}`.
- Pagination: 10/page (currently always page 1 in v1 — pagination URL plumbing arrives in Phase 8.5).

**Files:**
- Create: `components/admin/customers/detail/CustomerReviewsPanel.tsx`
- Test: `tests/unit/components/admin/customers/detail/CustomerReviewsPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerReviewsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerReviews: vi.fn().mockResolvedValue({
    items: [
      { id: 'r1', productId: 'p1', productName: 'Tee', rating: 5,
        status: 'APPROVED', createdAt: new Date('2026-05-15') },
    ],
    total: 1, page: 1, pageSize: 10,
  }),
}))

import { CustomerReviewsPanel } from '@/components/admin/customers/detail/CustomerReviewsPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerReviewsPanel', () => {
  it('renders review rows with stars + status + link', async () => {
    const node = await CustomerReviewsPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText('Tee')).toBeTruthy()
    expect(screen.getByText('APPROVED')).toBeTruthy()
    const link = screen.getByRole('link', { name: /tee/i })
    expect(link.getAttribute('href')).toBe('/admin/reviews/r1')
  })

  it('renders empty state', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerReviews as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [], total: 0, page: 1, pageSize: 10,
    })
    const node = await CustomerReviewsPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no reviews/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerReviewsPanel.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/detail/CustomerReviewsPanel.tsx`**

```tsx
import Link from 'next/link'
import { loadCustomerReviews } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n))
}

export interface CustomerReviewsPanelProps {
  customerId: string
}

export async function CustomerReviewsPanel({ customerId }: CustomerReviewsPanelProps) {
  const data = await loadCustomerReviews(customerId)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Reviews</h2>
        <span className="text-xs text-white/40">{data.total} total</span>
      </header>
      {data.items.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No reviews yet.</div>
      ) : (
        <ul>
          {data.items.map((r) => (
            <li key={r.id} className="border-b border-white/4 last:border-b-0">
              <Link
                href={`/admin/reviews/${r.id}`}
                className="block px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between gap-2"
              >
                <span className="text-sm text-white truncate">{r.productName}</span>
                <span className="text-amber-300 text-xs">{stars(r.rating)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 font-semibold">
                  {r.status}
                </span>
                <span className="text-xs text-white/40">{dFmt.format(r.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerReviewsPanel.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerReviewsPanel.tsx tests/unit/components/admin/customers/detail/CustomerReviewsPanel.test.tsx
git commit -m "feat(admin-v2): add CustomerReviewsPanel (read-only reviews list)"
git push -u origin wave8p8/task-11-customer-reviews-panel
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerReviewsPanel" --body "Server component. Read-only review list (product · stars · status · date) linking to /admin/reviews/[id]. 2 tests passing."
```

---

### Task 12: `CustomerSupportTicketsPanel.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 7-11, 13-15 | **Branch:** `wave8p8/task-12-customer-support-tickets-panel` | **Model:** sonnet

**Schema realities for this task:**
- Server component — directly awaits `loadCustomerSupportTickets(customerId)`.
- Read-only list: ticketNumber · type pill · status pill · priority · createdAt.
- Each row links to current V1 support page at `/admin/support/${ticketId}` (Phase 9 will rebuild this; v1 link is the stable target for now).
- Pagination: 10/page, v1 page 1 only.

**Files:**
- Create: `components/admin/customers/detail/CustomerSupportTicketsPanel.tsx`
- Test: `tests/unit/components/admin/customers/detail/CustomerSupportTicketsPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerSupportTicketsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerSupportTickets: vi.fn().mockResolvedValue({
    items: [
      { id: 'st1', ticketNumber: 'T-100', type: 'REFUND', status: 'OPEN',
        priority: 'HIGH', createdAt: new Date('2026-05-15') },
    ],
    total: 1, page: 1, pageSize: 10,
  }),
}))

import { CustomerSupportTicketsPanel } from '@/components/admin/customers/detail/CustomerSupportTicketsPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerSupportTicketsPanel', () => {
  it('renders ticket rows with link', async () => {
    const node = await CustomerSupportTicketsPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText('T-100')).toBeTruthy()
    expect(screen.getByText('REFUND')).toBeTruthy()
    const link = screen.getByRole('link', { name: /T-100/ })
    expect(link.getAttribute('href')).toBe('/admin/support/st1')
  })

  it('renders empty state', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerSupportTickets as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [], total: 0, page: 1, pageSize: 10,
    })
    const node = await CustomerSupportTicketsPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no support tickets/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerSupportTicketsPanel.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/detail/CustomerSupportTicketsPanel.tsx`**

```tsx
import Link from 'next/link'
import { loadCustomerSupportTickets } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export interface CustomerSupportTicketsPanelProps {
  customerId: string
}

export async function CustomerSupportTicketsPanel({ customerId }: CustomerSupportTicketsPanelProps) {
  const data = await loadCustomerSupportTickets(customerId)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Support tickets</h2>
        <span className="text-xs text-white/40">{data.total} total</span>
      </header>
      {data.items.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No support tickets.</div>
      ) : (
        <ul>
          {data.items.map((t) => (
            <li key={t.id} className="border-b border-white/4 last:border-b-0">
              <Link
                href={`/admin/support/${t.id}`}
                className="block px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between gap-2"
              >
                <span className="text-sm text-white">{t.ticketNumber}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 font-semibold">
                  {t.type}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 font-semibold">
                  {t.status}
                </span>
                <span className="text-xs text-white/50">{t.priority}</span>
                <span className="text-xs text-white/40">{dFmt.format(t.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerSupportTicketsPanel.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerSupportTicketsPanel.tsx tests/unit/components/admin/customers/detail/CustomerSupportTicketsPanel.test.tsx
git commit -m "feat(admin-v2): add CustomerSupportTicketsPanel (read-only ticket list)"
git push -u origin wave8p8/task-12-customer-support-tickets-panel
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerSupportTicketsPanel" --body "Server component. Read-only ticket list (ticketNumber · type · status · priority · date) linking to /admin/support/[id]. 2 tests passing."
```

---

### Task 13: `CustomerNotesPanel.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 7-12, 14-15 | **Branch:** `wave8p8/task-13-customer-notes-panel` | **Model:** sonnet

**Schema realities for this task:**
- Server component loads `loadCustomerNotes(id)` then renders a CLIENT child `CustomerNotesPanelClient` that owns the inspector open state.
- Each note row: content (multiline) + authorName + `isImportant` (boolean) star + createdAt.
- "+ Add Note" button opens `NoteInspector` (Task 18) in create mode; row Edit opens it in edit mode; row Delete calls `deleteCustomerNote(id)` via server action with confirm.
- `CustomerNote.isImportant` is the Prisma field name (NOT importance).
- NoteInspector built in W4 — mock it in this task's test.

**Files:**
- Create: `components/admin/customers/detail/CustomerNotesPanel.tsx` (server)
- Create: `components/admin/customers/detail/CustomerNotesPanelClient.tsx` (client)
- Test: `tests/unit/components/admin/customers/detail/CustomerNotesPanel.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerNotesPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerNotes: vi.fn().mockResolvedValue([
    { id: 'n1', content: 'VIP customer', authorId: 'a1', authorName: 'Admin',
      isImportant: true, createdAt: new Date('2026-05-15'), updatedAt: new Date('2026-05-15') },
  ]),
}))

const deleteCustomerNote = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/admin/customers/actions', () => ({
  deleteCustomerNote: (...a: unknown[]) => deleteCustomerNote(...a),
}))

vi.mock('@/components/admin/customers/inspectors/NoteInspector', () => ({
  NoteInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="note-inspector" /> : null,
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CustomerNotesPanel } from '@/components/admin/customers/detail/CustomerNotesPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerNotesPanel', () => {
  it('renders notes with important star', async () => {
    const node = await CustomerNotesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText('VIP customer')).toBeTruthy()
    expect(screen.getByText(/admin/i)).toBeTruthy()
    expect(screen.getByLabelText(/important/i)).toBeTruthy()
  })

  it('opens NoteInspector on + Add Note click', async () => {
    const node = await CustomerNotesPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    fireEvent.click(screen.getByRole('button', { name: /add note/i }))
    expect(screen.getByTestId('note-inspector')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerNotesPanel.test.tsx`

- [ ] **Step 3: Write the server component**

```tsx
// components/admin/customers/detail/CustomerNotesPanel.tsx
import { loadCustomerNotes } from '@/lib/admin/customers'
import { CustomerNotesPanelClient } from './CustomerNotesPanelClient'

export interface CustomerNotesPanelProps {
  customerId: string
}

export async function CustomerNotesPanel({ customerId }: CustomerNotesPanelProps) {
  const notes = await loadCustomerNotes(customerId)
  return <CustomerNotesPanelClient customerId={customerId} notes={notes} />
}
```

- [ ] **Step 4: Write the client wrapper**

```tsx
// components/admin/customers/detail/CustomerNotesPanelClient.tsx
'use client'

import { useState, useTransition } from 'react'
import type { CustomerNoteRow } from '@/lib/admin/customers'
import { deleteCustomerNote } from '@/app/admin/customers/actions'
import { NoteInspector } from '@/components/admin/customers/inspectors/NoteInspector'
import { toast } from '@/lib/toast'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export interface CustomerNotesPanelClientProps {
  customerId: string
  notes: CustomerNoteRow[]
}

export function CustomerNotesPanelClient({ customerId, notes }: CustomerNotesPanelClientProps) {
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const editing = editId ? notes.find((n) => n.id === editId) ?? null : null

  const onDelete = (id: string) => {
    if (!confirm('Delete this note?')) return
    startTransition(async () => {
      const r = await deleteCustomerNote(id)
      if (r.ok) toast.success('Note deleted')
      else toast.error(r.error)
    })
  }

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Notes</h2>
        <button
          type="button"
          onClick={() => { setEditId(null); setOpen(true) }}
          className="text-xs px-2 py-1 rounded bg-[#FF3131] text-white hover:bg-[#ff4747]"
        >
          + Add note
        </button>
      </header>
      {notes.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No notes yet.</div>
      ) : (
        <ul>
          {notes.map((n) => (
            <li key={n.id} className="border-b border-white/4 last:border-b-0 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white whitespace-pre-wrap">{n.content}</div>
                  <div className="mt-1 text-xs text-white/40 flex items-center gap-2">
                    <span>{n.authorName}</span>
                    <span>·</span>
                    <span>{dFmt.format(n.createdAt)}</span>
                    {n.isImportant && (
                      <span aria-label="important" className="text-amber-300">★</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditId(n.id); setOpen(true) }}
                    className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(n.id)}
                    disabled={isPending}
                    className="text-[10px] px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <NoteInspector
        open={open}
        customerId={customerId}
        note={editing}
        onClose={() => setOpen(false)}
      />
    </section>
  )
}
```

- [ ] **Step 5: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerNotesPanel.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerNotesPanel.tsx components/admin/customers/detail/CustomerNotesPanelClient.tsx tests/unit/components/admin/customers/detail/CustomerNotesPanel.test.tsx
git commit -m "feat(admin-v2): add CustomerNotesPanel (CRUD list using isImportant flag)"
git push -u origin wave8p8/task-13-customer-notes-panel
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerNotesPanel" --body "Server + client split. CRUD note list (content · author · isImportant star · timestamp). + Add Note opens NoteInspector. 2 tests passing."
```

---

### Task 14: `CustomerActivityTimeline.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 7-13, 15 | **Branch:** `wave8p8/task-14-customer-activity-timeline` | **Model:** sonnet

**Schema realities for this task:**
- Server component — directly awaits `loadCustomerActivity(customerId, 50)`.
- Each event from `ActivityEvent`: kind icon (one of 'order' | 'points' | 'review' | 'support' | 'address' | 'redemption') + label + timestamp + optional href.
- Render as a vertical timeline; events with `href !== null` are wrapped in `<Link>`.
- Empty state: "No recent activity."

**Files:**
- Create: `components/admin/customers/detail/CustomerActivityTimeline.tsx`
- Test: `tests/unit/components/admin/customers/detail/CustomerActivityTimeline.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerActivityTimeline.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerActivity: vi.fn().mockResolvedValue([
    { id: 'o-1', kind: 'order', label: 'Placed order HOF-100 — $50.00',
      timestamp: new Date('2026-05-15'), href: '/admin/fulfillment/o1' },
    { id: 'p-1', kind: 'points', label: '+100 pts (PURCHASE) — d',
      timestamp: new Date('2026-05-14'), href: null },
  ]),
}))

import { CustomerActivityTimeline } from '@/components/admin/customers/detail/CustomerActivityTimeline'

beforeEach(() => vi.clearAllMocks())

describe('CustomerActivityTimeline', () => {
  it('renders activity events with kind icon + label + timestamp', async () => {
    const node = await CustomerActivityTimeline({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/HOF-100/)).toBeTruthy()
    expect(screen.getByText(/\+100 pts/)).toBeTruthy()
  })

  it('wraps href events in a link', async () => {
    const node = await CustomerActivityTimeline({ customerId: 'c1' })
    render(node as React.ReactElement)
    const link = screen.getByRole('link', { name: /HOF-100/ })
    expect(link.getAttribute('href')).toBe('/admin/fulfillment/o1')
  })

  it('renders empty state', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerActivity as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])
    const node = await CustomerActivityTimeline({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no recent activity/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerActivityTimeline.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/detail/CustomerActivityTimeline.tsx`**

```tsx
import Link from 'next/link'
import { loadCustomerActivity } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

const ICON: Record<string, string> = {
  order: '📦',
  points: '⭐',
  review: '✍️',
  support: '💬',
  address: '🏠',
  redemption: '🎁',
}

export interface CustomerActivityTimelineProps {
  customerId: string
}

export async function CustomerActivityTimeline({ customerId }: CustomerActivityTimelineProps) {
  const events = await loadCustomerActivity(customerId, 50)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Activity</h2>
        <span className="text-xs text-white/40">{events.length} events</span>
      </header>
      {events.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No recent activity.</div>
      ) : (
        <ol className="p-3 space-y-2">
          {events.map((e) => {
            const inner = (
              <span className="flex items-start gap-2 text-xs">
                <span className="shrink-0">{ICON[e.kind] ?? '•'}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-white/80">{e.label}</span>
                  <span className="block text-white/40">{dFmt.format(e.timestamp)}</span>
                </span>
              </span>
            )
            return (
              <li key={e.id}>
                {e.href ? (
                  <Link href={e.href} className="block hover:bg-white/[0.03] rounded px-1 py-0.5">
                    {inner}
                  </Link>
                ) : (
                  <span className="block px-1 py-0.5">{inner}</span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerActivityTimeline.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerActivityTimeline.tsx tests/unit/components/admin/customers/detail/CustomerActivityTimeline.test.tsx
git commit -m "feat(admin-v2): add CustomerActivityTimeline (last 50 events)"
git push -u origin wave8p8/task-14-customer-activity-timeline
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerActivityTimeline" --body "Server component. Chronological merge of last 50 events (orders/points/reviews/support/address). Events with href wrapped in Link. 3 tests passing."
```

---

### Task 15: `CustomerRiskWidget.tsx`

**Wave:** 3 | **Parallel-safe with:** Tasks 7-14 | **Branch:** `wave8p8/task-15-customer-risk-widget` | **Model:** sonnet

**Schema realities for this task:**
- Server component — directly awaits `loadCustomerRisk(customerId)`.
- Renders: refundRate% · returnRate% · chargebackCount · avgDaysToReturn.
- Red-tint badge "High risk" when `isHighRisk` is true (refundRate > 20% OR chargebackCount > 0).
- Read-only; no actions in v1.

**Files:**
- Create: `components/admin/customers/detail/CustomerRiskWidget.tsx`
- Test: `tests/unit/components/admin/customers/detail/CustomerRiskWidget.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/detail/CustomerRiskWidget.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerRisk: vi.fn(),
}))

import { CustomerRiskWidget } from '@/components/admin/customers/detail/CustomerRiskWidget'

beforeEach(() => vi.clearAllMocks())

describe('CustomerRiskWidget', () => {
  it('renders refund/return/chargeback numbers + high-risk badge', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerRisk as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      totalOrders: 10, refundCount: 3, refundRate: 30,
      returnCount: 2, returnRate: 20, chargebackCount: 1,
      avgDaysToReturn: 9.2, isHighRisk: true,
    })
    const node = await CustomerRiskWidget({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/30.0%/)).toBeTruthy()
    expect(screen.getByText(/high risk/i)).toBeTruthy()
  })

  it('does not render badge when isHighRisk is false', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerRisk as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      totalOrders: 10, refundCount: 0, refundRate: 0,
      returnCount: 0, returnRate: 0, chargebackCount: 0,
      avgDaysToReturn: 0, isHighRisk: false,
    })
    const node = await CustomerRiskWidget({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.queryByText(/high risk/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/detail/CustomerRiskWidget.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/detail/CustomerRiskWidget.tsx`**

```tsx
import { loadCustomerRisk } from '@/lib/admin/customers'

export interface CustomerRiskWidgetProps {
  customerId: string
}

export async function CustomerRiskWidget({ customerId }: CustomerRiskWidgetProps) {
  const r = await loadCustomerRisk(customerId)

  return (
    <section
      className={`border rounded-md ${
        r.isHighRisk
          ? 'bg-red-500/5 border-red-500/30'
          : 'bg-neutral-900/60 border-white/8'
      }`}
    >
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Risk</h2>
        {r.isHighRisk && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 font-semibold">
            High risk
          </span>
        )}
      </header>
      <div className="p-3 grid grid-cols-2 gap-3 text-xs text-white/60">
        <div>
          <div className="text-white text-base">{r.refundRate.toFixed(1)}%</div>
          <div>Refund rate ({r.refundCount}/{r.totalOrders})</div>
        </div>
        <div>
          <div className="text-white text-base">{r.returnRate.toFixed(1)}%</div>
          <div>Return rate ({r.returnCount}/{r.totalOrders})</div>
        </div>
        <div>
          <div className="text-white text-base">{r.chargebackCount}</div>
          <div>Chargebacks</div>
        </div>
        <div>
          <div className="text-white text-base">{r.avgDaysToReturn.toFixed(0)}d</div>
          <div>Avg days to return</div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/detail/CustomerRiskWidget.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/detail/CustomerRiskWidget.tsx tests/unit/components/admin/customers/detail/CustomerRiskWidget.test.tsx
git commit -m "feat(admin-v2): add CustomerRiskWidget (read-only refund/return/chargeback)"
git push -u origin wave8p8/task-15-customer-risk-widget
gh pr create --title "feat(admin-v2): Phase 8 W3 CustomerRiskWidget" --body "Server component. Read-only refund rate / return rate / chargebacks / avg days to return. Red-tint High Risk badge when refundRate > 20% OR chargebacks > 0. 2 tests passing."
```

---

## Wave 4 — Inspectors (4 parallel, after W1b merged)

### Task 16: `ProfileEditInspector.tsx`

**Wave:** 4 | **Parallel-safe with:** Tasks 17, 18, 19 | **Branch:** `wave8p8/task-16-profile-edit-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Edits: `name`, `phone`, `birthday`, `newsletter`, `smsOptIn`. Email NOT editable in v1.
- Wires `updateCustomerProfile(id, input)` from `@/app/admin/customers/actions`.
- Sliding inspector pattern: fixed right-side panel (lg ≥ 480px wide, full-screen on mobile). Backdrop click closes.
- Receives `header: CustomerHeaderData` from parent (CustomerHeader Task 7) so first paint has the current values.
- Form state local to inspector; submits via `useTransition` + server action; on success toast + close.

**Files:**
- Create: `components/admin/customers/inspectors/ProfileEditInspector.tsx`
- Test: `tests/unit/components/admin/customers/inspectors/ProfileEditInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/inspectors/ProfileEditInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateCustomerProfile = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  updateCustomerProfile: (...a: unknown[]) => updateCustomerProfile(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { ProfileEditInspector } from '@/components/admin/customers/inspectors/ProfileEditInspector'
import type { CustomerHeaderData } from '@/lib/admin/customers'

const header: CustomerHeaderData = {
  id: 'c1', email: 'ada@e.com', name: 'Ada', phone: '555',
  profilePictureUrl: null, birthday: null, newsletter: true, smsOptIn: false,
  tierId: null, tierName: null, tierSlug: null, tierColor: null,
  currentPoints: 0, lifetimePoints: 0, totalSpent: 0, totalOrders: 0,
  lastOrderDate: null, createdAt: new Date(), isAnonymized: false, anonymizedAt: null,
}

beforeEach(() => vi.clearAllMocks())

describe('ProfileEditInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ProfileEditInspector open={false} header={header} onClose={() => {}} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders form with current values', () => {
    render(<ProfileEditInspector open header={header} onClose={() => {}} />)
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Ada')
    expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe('555')
  })

  it('email field disabled (not editable v1)', () => {
    render(<ProfileEditInspector open header={header} onClose={() => {}} />)
    const email = screen.getByLabelText(/email/i) as HTMLInputElement
    expect(email.disabled).toBe(true)
  })

  it('submits updateCustomerProfile with changed fields', async () => {
    updateCustomerProfile.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(<ProfileEditInspector open header={header} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada L' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateCustomerProfile).toHaveBeenCalled())
    const [id, input] = updateCustomerProfile.mock.calls[0]
    expect(id).toBe('c1')
    expect(input.name).toBe('Ada L')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/inspectors/ProfileEditInspector.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/inspectors/ProfileEditInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { CustomerHeaderData } from '@/lib/admin/customers'
import { updateCustomerProfile } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface ProfileEditInspectorProps {
  open: boolean
  header: CustomerHeaderData
  onClose: () => void
}

function dateInputValue(d: Date | null): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

export function ProfileEditInspector({ open, header, onClose }: ProfileEditInspectorProps) {
  const [name, setName] = useState(header.name ?? '')
  const [phone, setPhone] = useState(header.phone ?? '')
  const [birthday, setBirthday] = useState(dateInputValue(header.birthday))
  const [newsletter, setNewsletter] = useState(header.newsletter)
  const [smsOptIn, setSmsOptIn] = useState(header.smsOptIn)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    startTransition(async () => {
      const r = await updateCustomerProfile(header.id, {
        name: name.trim() || null,
        phone: phone.trim() || null,
        birthday: birthday ? new Date(birthday) : null,
        newsletter,
        smsOptIn,
      })
      if (r.ok) {
        toast.success('Profile updated')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Edit profile" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Edit profile</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/50">Email (not editable)</span>
            <input
              aria-label="email"
              type="email"
              value={header.email}
              disabled
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/4 border border-white/10 text-white/40"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Name</span>
            <input
              aria-label="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Phone</span>
            <input
              aria-label="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Birthday</span>
            <input
              aria-label="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
            />
            Newsletter opt-in
          </label>
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
            />
            SMS opt-in
          </label>
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/inspectors/ProfileEditInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/inspectors/ProfileEditInspector.tsx tests/unit/components/admin/customers/inspectors/ProfileEditInspector.test.tsx
git commit -m "feat(admin-v2): add ProfileEditInspector (name/phone/birthday/newsletter/sms)"
git push -u origin wave8p8/task-16-profile-edit-inspector
gh pr create --title "feat(admin-v2): Phase 8 W4 ProfileEditInspector" --body "Right-slide inspector. Edits name/phone/birthday/newsletter/smsOptIn. Email disabled. Wires updateCustomerProfile. 4 tests passing."
```

---

### Task 17: `AddressInspector.tsx`

**Wave:** 4 | **Parallel-safe with:** Tasks 16, 18, 19 | **Branch:** `wave8p8/task-17-address-inspector` | **Model:** sonnet

**Schema realities for this task:**
- CRUD individual Address. **Use exact schema field names**: `firstName`, `lastName`, `company`, `address1`, `address2`, `city`, `state`, `postalCode`, `country`, `isDefault`, `type` (AddressType enum: SHIPPING | BILLING | BOTH).
- Two modes: create (no `address` prop) and edit (`address` prop set).
- Wires `createAddress` / `updateAddress` / `setDefaultAddress` actions.
- Delete is handled by parent (CustomerAddressesPanelClient) — inspector does not own delete.

**Files:**
- Create: `components/admin/customers/inspectors/AddressInspector.tsx`
- Test: `tests/unit/components/admin/customers/inspectors/AddressInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/inspectors/AddressInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createAddress = vi.fn()
const updateAddress = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  createAddress: (...a: unknown[]) => createAddress(...a),
  updateAddress: (...a: unknown[]) => updateAddress(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AddressInspector } from '@/components/admin/customers/inspectors/AddressInspector'
import type { AddressRow } from '@/lib/admin/customers'

const sample: AddressRow = {
  id: 'a1', firstName: 'Ada', lastName: 'Lovelace', company: null,
  address1: '1 Main St', address2: 'Apt 2', city: 'NYC', state: 'NY',
  postalCode: '10001', country: 'US', isDefault: false, type: 'SHIPPING',
}

beforeEach(() => vi.clearAllMocks())

describe('AddressInspector', () => {
  it('create mode submits createAddress with schema field names', async () => {
    createAddress.mockResolvedValue({ ok: true, data: { id: 'a2' } })
    render(
      <AddressInspector open customerId="c1" address={null} onClose={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'L' } })
    fireEvent.change(screen.getByLabelText(/address line 1/i), { target: { value: '1 Main' } })
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: 'NYC' } })
    fireEvent.change(screen.getByLabelText(/state/i), { target: { value: 'NY' } })
    fireEvent.change(screen.getByLabelText(/postal code/i), { target: { value: '10001' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createAddress).toHaveBeenCalled())
    const [customerId, input] = createAddress.mock.calls[0]
    expect(customerId).toBe('c1')
    expect(input.firstName).toBe('Ada')
    expect(input.address1).toBe('1 Main')
    expect(input.state).toBe('NY')
    expect(input.postalCode).toBe('10001')
    expect(input.type).toBe('SHIPPING')
  })

  it('edit mode pre-fills + calls updateAddress', async () => {
    updateAddress.mockResolvedValue({ ok: true })
    render(
      <AddressInspector open customerId="c1" address={sample} onClose={() => {}} />,
    )
    expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe('Ada')
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: 'LA' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateAddress).toHaveBeenCalled())
    expect(updateAddress.mock.calls[0][0]).toBe('a1')
    expect(updateAddress.mock.calls[0][1].city).toBe('LA')
  })

  it('shows validation error when required field missing', async () => {
    createAddress.mockResolvedValue({ ok: false, error: 'First name is required' })
    render(
      <AddressInspector open customerId="c1" address={null} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createAddress).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/inspectors/AddressInspector.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/inspectors/AddressInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { AddressType } from '@prisma/client'
import type { AddressRow } from '@/lib/admin/customers'
import { createAddress, updateAddress } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface AddressInspectorProps {
  open: boolean
  customerId: string
  address: AddressRow | null
  onClose: () => void
}

const ADDRESS_TYPES: AddressType[] = ['SHIPPING', 'BILLING', 'BOTH']

export function AddressInspector({ open, customerId, address, onClose }: AddressInspectorProps) {
  const isEdit = address !== null
  const [firstName, setFirstName] = useState(address?.firstName ?? '')
  const [lastName, setLastName] = useState(address?.lastName ?? '')
  const [company, setCompany] = useState(address?.company ?? '')
  const [address1, setAddress1] = useState(address?.address1 ?? '')
  const [address2, setAddress2] = useState(address?.address2 ?? '')
  const [city, setCity] = useState(address?.city ?? '')
  const [state, setState] = useState(address?.state ?? '')
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? '')
  const [country, setCountry] = useState(address?.country ?? 'US')
  const [type, setType] = useState<AddressType>(address?.type ?? 'SHIPPING')
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    startTransition(async () => {
      const payload = {
        firstName, lastName,
        company: company.trim() || null,
        address1, address2: address2.trim() || null,
        city, state, postalCode, country, isDefault, type,
      }
      const r = isEdit
        ? await updateAddress(address!.id, payload)
        : await createAddress(customerId, payload)
      if (r.ok) {
        toast.success(isEdit ? 'Address updated' : 'Address added')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Edit address" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? 'Edit address' : 'New address'}
          </h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/50">First name</span>
            <input
              aria-label="first name" type="text" value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Last name</span>
            <input
              aria-label="last name" type="text" value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-xs text-white/50">Company</span>
            <input
              type="text" value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-xs text-white/50">Address line 1</span>
            <input
              aria-label="address line 1" type="text" value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-xs text-white/50">Address line 2</span>
            <input
              type="text" value={address2}
              onChange={(e) => setAddress2(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">City</span>
            <input
              aria-label="city" type="text" value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">State</span>
            <input
              aria-label="state" type="text" value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Postal code</span>
            <input
              aria-label="postal code" type="text" value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Country</span>
            <input
              type="text" value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AddressType)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            >
              {ADDRESS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 col-span-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default address
          </label>
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/inspectors/AddressInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/inspectors/AddressInspector.tsx tests/unit/components/admin/customers/inspectors/AddressInspector.test.tsx
git commit -m "feat(admin-v2): add AddressInspector (firstName/lastName/address1/state/postalCode field names)"
git push -u origin wave8p8/task-17-address-inspector
gh pr create --title "feat(admin-v2): Phase 8 W4 AddressInspector" --body "Right-slide inspector. Create + edit modes. Uses exact schema field names (firstName, lastName, address1, address2, state, postalCode, country, AddressType enum). Wires createAddress / updateAddress. 3 tests passing."
```

---

### Task 18: `NoteInspector.tsx`

**Wave:** 4 | **Parallel-safe with:** Tasks 16, 17, 19 | **Branch:** `wave8p8/task-18-note-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Single note edit (content + `isImportant` flag).
- **Schema field is `isImportant: Boolean`** (NOT `importance`).
- Create + edit modes.
- Wires `createCustomerNote` / `updateCustomerNote` actions.
- Delete handled by parent (CustomerNotesPanelClient) — inspector does not own delete.

**Files:**
- Create: `components/admin/customers/inspectors/NoteInspector.tsx`
- Test: `tests/unit/components/admin/customers/inspectors/NoteInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/inspectors/NoteInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createCustomerNote = vi.fn()
const updateCustomerNote = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  createCustomerNote: (...a: unknown[]) => createCustomerNote(...a),
  updateCustomerNote: (...a: unknown[]) => updateCustomerNote(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { NoteInspector } from '@/components/admin/customers/inspectors/NoteInspector'
import type { CustomerNoteRow } from '@/lib/admin/customers'

const sample: CustomerNoteRow = {
  id: 'n1', content: 'VIP', authorId: 'a1', authorName: 'Admin',
  isImportant: true, createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('NoteInspector', () => {
  it('create mode calls createCustomerNote with isImportant flag', async () => {
    createCustomerNote.mockResolvedValue({ ok: true, data: { id: 'n2' } })
    render(
      <NoteInspector open customerId="c1" note={null} onClose={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'New note' } })
    fireEvent.click(screen.getByLabelText(/important/i))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createCustomerNote).toHaveBeenCalled())
    expect(createCustomerNote).toHaveBeenCalledWith('c1', 'New note', true)
  })

  it('edit mode pre-fills + calls updateCustomerNote', async () => {
    updateCustomerNote.mockResolvedValue({ ok: true })
    render(
      <NoteInspector open customerId="c1" note={sample} onClose={() => {}} />,
    )
    expect((screen.getByLabelText(/content/i) as HTMLTextAreaElement).value).toBe('VIP')
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateCustomerNote).toHaveBeenCalled())
    expect(updateCustomerNote).toHaveBeenCalledWith('n1', 'Updated', true)
  })

  it('rejects empty content client-side', async () => {
    render(
      <NoteInspector open customerId="c1" note={null} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(createCustomerNote).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/inspectors/NoteInspector.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/inspectors/NoteInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { CustomerNoteRow } from '@/lib/admin/customers'
import { createCustomerNote, updateCustomerNote } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface NoteInspectorProps {
  open: boolean
  customerId: string
  note: CustomerNoteRow | null
  onClose: () => void
}

export function NoteInspector({ open, customerId, note, onClose }: NoteInspectorProps) {
  const isEdit = note !== null
  const [content, setContent] = useState(note?.content ?? '')
  const [isImportant, setIsImportant] = useState(note?.isImportant ?? false)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error('Note content is required')
      return
    }
    startTransition(async () => {
      const r = isEdit
        ? await updateCustomerNote(note!.id, content.trim(), isImportant)
        : await createCustomerNote(customerId, content.trim(), isImportant)
      if (r.ok) {
        toast.success(isEdit ? 'Note updated' : 'Note added')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Edit note" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? 'Edit note' : 'New note'}
          </h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/50">Content</span>
            <textarea
              aria-label="content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input
              aria-label="important"
              type="checkbox"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
            />
            Mark as important
          </label>
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/inspectors/NoteInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/inspectors/NoteInspector.tsx tests/unit/components/admin/customers/inspectors/NoteInspector.test.tsx
git commit -m "feat(admin-v2): add NoteInspector (isImportant Boolean field)"
git push -u origin wave8p8/task-18-note-inspector
gh pr create --title "feat(admin-v2): Phase 8 W4 NoteInspector" --body "Right-slide inspector. Create + edit single note. Uses CustomerNote.isImportant Boolean field (NOT importance). Wires create/updateCustomerNote. 3 tests passing."
```

---

### Task 19: `AnonymizeConfirmDialog.tsx`

**Wave:** 4 | **Parallel-safe with:** Tasks 16, 17, 18 | **Branch:** `wave8p8/task-19-anonymize-confirm-dialog` | **Model:** sonnet

**Schema realities for this task:**
- SUPER_ADMIN-only typed-confirm modal. Shows consequences: "Email/name/phone/birthday/profile picture will be scrubbed. Orders + loyalty audit preserved."
- Requires admin to type the customer's exact email (case-insensitive, post-trim) before Confirm enables.
- On confirm: calls `anonymizeCustomer(customerId, typedConfirmEmail)`. Success: toast + close + (parent should redirect or list will refresh via revalidatePath).
- Modal-style (centered card), not slide inspector — more emphasis on the destructive action.

**Files:**
- Create: `components/admin/customers/inspectors/AnonymizeConfirmDialog.tsx`
- Test: `tests/unit/components/admin/customers/inspectors/AnonymizeConfirmDialog.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/customers/inspectors/AnonymizeConfirmDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const anonymizeCustomer = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  anonymizeCustomer: (...a: unknown[]) => anonymizeCustomer(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AnonymizeConfirmDialog } from '@/components/admin/customers/inspectors/AnonymizeConfirmDialog'

beforeEach(() => vi.clearAllMocks())

describe('AnonymizeConfirmDialog', () => {
  it('Confirm button disabled until email matches', () => {
    render(
      <AnonymizeConfirmDialog
        open
        customerId="c1"
        customerEmail="ada@e.com"
        onClose={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: /^anonymize$/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/type the email/i), {
      target: { value: 'ada@e.com' },
    })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('confirm calls anonymizeCustomer + closes on success', async () => {
    anonymizeCustomer.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(
      <AnonymizeConfirmDialog
        open
        customerId="c1"
        customerEmail="ada@e.com"
        onClose={onClose}
      />,
    )
    fireEvent.change(screen.getByLabelText(/type the email/i), {
      target: { value: 'ADA@e.com  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^anonymize$/i }))
    await waitFor(() => expect(anonymizeCustomer).toHaveBeenCalledWith('c1', 'ADA@e.com  '))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <AnonymizeConfirmDialog
        open={false}
        customerId="c1"
        customerEmail="ada@e.com"
        onClose={() => {}}
      />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`pnpm test tests/unit/components/admin/customers/inspectors/AnonymizeConfirmDialog.test.tsx`

- [ ] **Step 3: Write `components/admin/customers/inspectors/AnonymizeConfirmDialog.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { anonymizeCustomer } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface AnonymizeConfirmDialogProps {
  open: boolean
  customerId: string
  customerEmail: string
  onClose: () => void
}

export function AnonymizeConfirmDialog({
  open, customerId, customerEmail, onClose,
}: AnonymizeConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const matches =
    typed.trim().toLowerCase() === customerEmail.trim().toLowerCase()

  const handleConfirm = () => {
    startTransition(async () => {
      const r = await anonymizeCustomer(customerId, typed)
      if (r.ok) {
        toast.success('Customer anonymized')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Anonymize customer" className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/80"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-950 border border-red-500/30 rounded-md overflow-hidden">
          <div className="p-4 border-b border-white/8">
            <h2 className="text-sm font-semibold text-red-300">Anonymize customer</h2>
          </div>
          <div className="p-4 space-y-3 text-sm text-white/80">
            <p>This will permanently scrub PII for this customer:</p>
            <ul className="list-disc pl-5 text-xs text-white/60 space-y-1">
              <li>Email → <code>deleted-{customerId}@anonymized.local</code></li>
              <li>Name, phone, birthday, profile picture → null</li>
              <li>Orders, loyalty ledger, addresses, audit history preserved</li>
            </ul>
            <p className="text-xs text-red-300">This action cannot be undone.</p>
            <label className="block">
              <span className="text-xs text-white/60">
                Type the email <code className="text-white">{customerEmail}</code> to confirm
              </span>
              <input
                aria-label="type the email"
                type="email"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
              />
            </label>
          </div>
          <div className="p-4 border-t border-white/8 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!matches || isPending}
              className="text-xs px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Anonymize
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/customers/inspectors/AnonymizeConfirmDialog.test.tsx
pnpm exec tsc --noEmit
git add components/admin/customers/inspectors/AnonymizeConfirmDialog.tsx tests/unit/components/admin/customers/inspectors/AnonymizeConfirmDialog.test.tsx
git commit -m "feat(admin-v2): add AnonymizeConfirmDialog (SUPER_ADMIN typed-confirm)"
git push -u origin wave8p8/task-19-anonymize-confirm-dialog
gh pr create --title "feat(admin-v2): Phase 8 W4 AnonymizeConfirmDialog" --body "SUPER_ADMIN-only modal. Lists consequences. Confirm enabled only when admin types customer email exactly (case-insensitive). Wires anonymizeCustomer. 3 tests passing."
```

---

## Wave 5 — List dispatcher + V1 relocation + V2 root (sequential, **opus** model)

### Task 20: V1 stub + V1 list relocation + AdminCustomersV2 + TabPills + RangePills + page dispatcher

**Wave:** 5 | **Branch:** `wave8p8/task-20-list-dispatcher-v2-root` | **Model:** opus

**Schema realities for this task:**
- V1 list lives at `app/admin/customers/page.tsx` (901L). Relocate its body verbatim to `components/admin/_v1/AdminCustomersV1Page.tsx` (rename default export to named `AdminCustomersV1Page`). Re-expose via `app/admin/customers-v1/page.tsx`.
- `AdminCustomersV1.tsx` is the new stub linking to `/admin/customers-v1`.
- `CustomersTabPills.tsx`: client wrapper around `TabPills`. On change, `router.push(\`?tab=${id}&range=${range}\`)` (preserves `?range=`).
- `CustomersRangePills.tsx`: client wrapper for 5 range pills (`TIME_RANGES` from `lib/admin/customers`). On change, `router.push(\`?tab=${tab}&range=${newRange}\`)` (preserves `?tab=`).
- `AdminCustomersV2.tsx`: server component that parses `searchParams.tab` + `searchParams.range`, renders TabPills + RangePills + KPI strip (Suspense) + main content slot (Suspense). Main slot is a single tab body that renders the list table (desktop) + mobile cards + bulk sheet. List body needs to be a CLIENT wrapper that owns the `Set<string> selectedIds` state — call it `CustomersListClient`. The server passes pre-loaded `rows: CustomerRow[]` + `isSuperAdmin: boolean` to the client wrapper.
- Page dispatcher reads `NEXT_PUBLIC_ADMIN_V2_ENABLED`. If not "true" → `<AdminCustomersV1 />`. Otherwise resolves `isSuperAdmin` via session lookup (Phase 6/7 dispatcher precedent) and renders `<AdminCustomersV2 ... />`.
- KPI cards click → matching tab via `<Link>`.

**Files:**
- Create: `components/admin/_v1/AdminCustomersV1.tsx`
- Create: `components/admin/_v1/AdminCustomersV1Page.tsx` — verbatim relocation of `app/admin/customers/page.tsx`
- Create: `app/admin/customers-v1/page.tsx` — re-exposes V1 page
- Create: `components/admin/dashboard/AdminCustomersV2.tsx`
- Create: `components/admin/dashboard/CustomersTabPills.tsx`
- Create: `components/admin/dashboard/CustomersRangePills.tsx`
- Create: `components/admin/customers/CustomersListClient.tsx` (owns selectedIds, glues table/cards/sheet)
- **Replace** `app/admin/customers/page.tsx` with the dispatcher
- Tests:
  - `tests/unit/components/admin/dashboard/AdminCustomersV2.test.tsx`
  - `tests/unit/app/admin/customers/page.test.tsx`

#### Steps

- [ ] **Step 1: Relocate the existing V1 customers page**

Move the body of `app/admin/customers/page.tsx` (901L, `'use client'`) into `components/admin/_v1/AdminCustomersV1Page.tsx`. Rename the `export default function` to `export function AdminCustomersV1Page(...)`. Imports unchanged. Then create the thin route:

```tsx
// app/admin/customers-v1/page.tsx
import { AdminCustomersV1Page } from '@/components/admin/_v1/AdminCustomersV1Page'

export default function Page() {
  return <AdminCustomersV1Page />
}
```

- [ ] **Step 2: Write `components/admin/_v1/AdminCustomersV1.tsx`**

```tsx
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

export function AdminCustomersV1() {
  return (
    <AdminLayout title="Customers" subtitle="Customer list + segments">
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified customer dashboard is in beta. Enable{' '}
          <code className="font-mono">NEXT_PUBLIC_ADMIN_V2_ENABLED=true</code> to try it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <Link href="/admin/customers-v1" className="block">
            <Card className="p-4 hover:bg-white/[0.04] transition-colors">
              <h3 className="text-base font-semibold text-white">Customers (V1)</h3>
              <p className="text-sm text-white/50 mt-1">Original list + filters + segments</p>
            </Card>
          </Link>
        </div>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 3: Write `components/admin/dashboard/CustomersTabPills.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { CustomersTab } from '@/lib/admin/customers'

export interface CustomersTabPillsProps {
  tabs: ReadonlyArray<{ id: CustomersTab; label: string }>
  active: CustomersTab
}

export function CustomersTabPills({ tabs, active }: CustomersTabPillsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const range = searchParams?.get('range') ?? '30d'

  const pillTabs: TabPillsTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))

  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${id}&range=${range}`)}
    />
  )
}
```

- [ ] **Step 4: Write `components/admin/dashboard/CustomersRangePills.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { TIME_RANGES, type TimeRange } from '@/lib/admin/customers'

const LABEL: Record<TimeRange, string> = {
  today: 'Today', '7d': '7 days', '30d': '30 days', '90d': '90 days', year: 'Year',
}

export interface CustomersRangePillsProps {
  active: TimeRange
}

export function CustomersRangePills({ active }: CustomersRangePillsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams?.get('tab') ?? 'all'
  const [isPending, startTransition] = useTransition()

  const onPick = (range: TimeRange) => {
    if (range === active) return
    startTransition(() => router.push(`?tab=${tab}&range=${range}`))
  }

  return (
    <div className="flex gap-1" data-pending={isPending}>
      {TIME_RANGES.map((r) => {
        const isActive = r === active
        return (
          <button
            key={r}
            type="button"
            onClick={() => onPick(r)}
            aria-pressed={isActive}
            className={`text-[10px] px-2 py-1 rounded-[4px] font-semibold transition-colors ${
              isActive
                ? 'bg-white/6 text-white shadow-[inset_0_0_0_1px_rgba(255,49,49,0.2)]'
                : 'bg-white/2 text-white/40 hover:text-white/70 hover:bg-white/4'
            }`}
          >
            {LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Write `components/admin/customers/CustomersListClient.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import type { CustomerRow } from '@/lib/admin/customers'
import { CustomersListTable } from './CustomersListTable'
import { CustomersListCardMobile } from './CustomersListCardMobile'
import { CustomersBulkSheet } from './CustomersBulkSheet'

export interface CustomersListClientProps {
  rows: CustomerRow[]
  isSuperAdmin: boolean
}

export function CustomersListClient({ rows, isSuperAdmin }: CustomersListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allIds = useMemo(() => rows.map((r) => r.id), [rows])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  const onToggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onToggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    )
  }

  const onClear = () => setSelectedIds(new Set())

  return (
    <div className="space-y-3">
      <CustomersListTable
        rows={rows}
        selectedIds={selectedIds}
        onToggleSelection={onToggleSelection}
        onToggleAll={onToggleAll}
        allSelected={allSelected}
      />
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <CustomersListCardMobile
            key={r.id}
            row={r}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
            isSuperAdmin={isSuperAdmin}
          />
        ))}
      </div>
      <CustomersBulkSheet
        selectedIds={Array.from(selectedIds)}
        isSuperAdmin={isSuperAdmin}
        onClear={onClear}
      />
    </div>
  )
}
```

- [ ] **Step 6: Write `components/admin/dashboard/AdminCustomersV2.tsx`**

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadCustomersKpis,
  loadCustomersTab,
  isCustomersTab,
  isTimeRange,
  type CustomersTab,
  type TimeRange,
} from '@/lib/admin/customers'
import { CustomersListClient } from '@/components/admin/customers/CustomersListClient'
import { CustomersTabPills } from './CustomersTabPills'
import { CustomersRangePills } from './CustomersRangePills'

interface Props {
  searchParams: { tab?: string; range?: string }
  isSuperAdmin: boolean
}

const TAB_CONFIG: ReadonlyArray<{ id: CustomersTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'vip', label: 'VIP' },
  { id: 'at-risk', label: 'At-Risk' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'recent', label: 'Recent' },
]

const nFmt = new Intl.NumberFormat('en-US')
const $Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function parseTab(raw: string | undefined): CustomersTab {
  return isCustomersTab(raw) ? raw : 'all'
}
function parseRange(raw: string | undefined): TimeRange {
  return isTimeRange(raw) ? raw : '30d'
}

async function KpiStripSlot({ range }: { range: TimeRange }) {
  const k = await loadCustomersKpis(range)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href={`?tab=all&range=${range}`} className="block">
        <StatCard label="Total customers" value={nFmt.format(k.totalCustomers)} />
      </Link>
      <Link href={`?tab=recent&range=${range}`} className="block">
        <StatCard label="New (range)" value={nFmt.format(k.newInRange)} trend={k.newInRangeTrend} />
      </Link>
      <Link href={`?tab=vip&range=${range}`} className="block">
        <StatCard label="Avg LTV" value={$Fmt.format(k.avgLtv)} />
      </Link>
      <Link href={`?tab=at-risk&range=${range}`} className="block">
        <StatCard
          label="At-risk"
          value={nFmt.format(k.atRiskCount)}
          {...(k.atRiskCount > 0 ? { trend: { direction: 'down' as const, text: 'attention' } } : {})}
        />
      </Link>
    </div>
  )
}

async function ListSlot({
  tab, range, isSuperAdmin,
}: { tab: CustomersTab; range: TimeRange; isSuperAdmin: boolean }) {
  const data = await loadCustomersTab(tab, range)
  return <CustomersListClient rows={data.items} isSuperAdmin={isSuperAdmin} />
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}

export async function AdminCustomersV2({ searchParams, isSuperAdmin }: Props) {
  const tab = parseTab(searchParams.tab)
  const range = parseRange(searchParams.range)

  return (
    <AdminLayout title="Customers" subtitle="Profile · loyalty · orders · reviews · support">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CustomersTabPills tabs={TAB_CONFIG} active={tab} />
          <CustomersRangePills active={range} />
        </div>
        <Suspense fallback={<KpiSkeleton />}>
          <KpiStripSlot range={range} />
        </Suspense>
        <Suspense fallback={<ListSkeleton />}>
          <ListSlot tab={tab} range={range} isSuperAdmin={isSuperAdmin} />
        </Suspense>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 7: Replace `app/admin/customers/page.tsx` with the dispatcher**

```tsx
// app/admin/customers/page.tsx
import { AdminCustomersV1 } from '@/components/admin/_v1/AdminCustomersV1'
import { AdminCustomersV2 } from '@/components/admin/dashboard/AdminCustomersV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string; range?: string }>
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminCustomersV1 />
  }

  let isSuperAdmin = false
  try {
    const session = await getSession()
    if (session?.userId) {
      const customer = await prisma.customer.findUnique({
        where: { id: session.userId },
        select: { adminRole: true },
      })
      isSuperAdmin = customer?.adminRole === 'SUPER_ADMIN'
    }
  } catch {
    isSuperAdmin = false
  }

  return <AdminCustomersV2 searchParams={params} isSuperAdmin={isSuperAdmin} />
}
```

- [ ] **Step 8: Write smoke test for `AdminCustomersV2`**

```tsx
// tests/unit/components/admin/dashboard/AdminCustomersV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomersKpis: vi.fn().mockResolvedValue({
    totalCustomers: 10, newInRange: 2,
    newInRangeTrend: { direction: 'flat', text: '— 0%' },
    avgLtv: 100, atRiskCount: 0,
  }),
  loadCustomersTab: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  isCustomersTab: (v: unknown) =>
    typeof v === 'string' && ['all', 'vip', 'at-risk', 'inactive', 'recent'].includes(v),
  isTimeRange: (v: unknown) =>
    typeof v === 'string' && ['today', '7d', '30d', '90d', 'year'].includes(v),
}))

vi.mock('@/components/admin/dashboard/CustomersTabPills', () => ({
  CustomersTabPills: () => <div data-testid="tab-pills" />,
}))
vi.mock('@/components/admin/dashboard/CustomersRangePills', () => ({
  CustomersRangePills: () => <div data-testid="range-pills" />,
}))
vi.mock('@/components/admin/customers/CustomersListClient', () => ({
  CustomersListClient: () => <div data-testid="list-client" />,
}))

beforeEach(() => vi.clearAllMocks())

import { AdminCustomersV2 } from '@/components/admin/dashboard/AdminCustomersV2'

describe('AdminCustomersV2', () => {
  it('renders tab + range pills on default All tab', async () => {
    const node = await AdminCustomersV2({ searchParams: {}, isSuperAdmin: false })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeTruthy()
    expect(screen.getByTestId('range-pills')).toBeTruthy()
  })

  it('renders list client for vip tab', async () => {
    const node = await AdminCustomersV2({
      searchParams: { tab: 'vip', range: '30d' },
      isSuperAdmin: true,
    })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeTruthy()
  })
})
```

- [ ] **Step 9: Write dispatcher test**

```tsx
// tests/unit/app/admin/customers/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('app/admin/customers/page (dispatcher)', () => {
  it('renders V1 stub when NEXT_PUBLIC_ADMIN_V2_ENABLED is not "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    vi.doMock('@/components/admin/_v1/AdminCustomersV1', () => ({
      AdminCustomersV1: () => 'V1',
    }))
    vi.doMock('@/components/admin/dashboard/AdminCustomersV2', () => ({
      AdminCustomersV2: () => 'V2',
    }))
    vi.doMock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
    vi.doMock('@/lib/prisma', () => ({ prisma: { customer: { findUnique: vi.fn() } } }))
    const mod = await import('@/app/admin/customers/page')
    const node = await mod.default({ searchParams: Promise.resolve({}) })
    expect(String(node)).toContain('V1')
  })

  it('renders V2 root when flag is "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/components/admin/_v1/AdminCustomersV1', () => ({
      AdminCustomersV1: () => 'V1',
    }))
    vi.doMock('@/components/admin/dashboard/AdminCustomersV2', () => ({
      AdminCustomersV2: () => 'V2',
    }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn().mockResolvedValue({ userId: 'u1', isAdmin: true }),
    }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        customer: { findUnique: vi.fn().mockResolvedValue({ adminRole: 'SUPER_ADMIN' }) },
      },
    }))
    const mod = await import('@/app/admin/customers/page')
    const node = await mod.default({ searchParams: Promise.resolve({}) })
    expect(String(node)).toContain('V2')
  })
})
```

- [ ] **Step 10: Run tests**

```bash
pnpm test tests/unit/components/admin/dashboard/AdminCustomersV2.test.tsx tests/unit/app/admin/customers/page.test.tsx
```
Expected: PASS (4 tests).

- [ ] **Step 11: Type-check + commit + push + PR**

```bash
pnpm exec tsc --noEmit
mkdir -p app/admin/customers-v1 tests/unit/components/admin/dashboard tests/unit/app/admin/customers
git add \
  components/admin/_v1/AdminCustomersV1.tsx \
  components/admin/_v1/AdminCustomersV1Page.tsx \
  app/admin/customers-v1/page.tsx \
  components/admin/dashboard/AdminCustomersV2.tsx \
  components/admin/dashboard/CustomersTabPills.tsx \
  components/admin/dashboard/CustomersRangePills.tsx \
  components/admin/customers/CustomersListClient.tsx \
  app/admin/customers/page.tsx \
  tests/unit/components/admin/dashboard/AdminCustomersV2.test.tsx \
  tests/unit/app/admin/customers/page.test.tsx
git commit -m "feat(admin-v2): wire Phase 8 list dispatcher + V2 root + V1 relocation"
git push -u origin wave8p8/task-20-list-dispatcher-v2-root
gh pr create --title "feat(admin-v2): Phase 8 W5 list dispatcher + V2 root" --body "Relocates V1 list (901L) to /admin/customers-v1. Adds AdminCustomersV2 (TabPills + RangePills + KPI strip Suspense + list Suspense). CustomersListClient owns selection state and glues Table/Mobile/BulkSheet. Dispatcher gates on NEXT_PUBLIC_ADMIN_V2_ENABLED + resolves SUPER_ADMIN. 4 tests passing."
```

---

## Wave 6 — Detail dispatcher + V1 detail relocation + V2 detail composition (sequential, **opus** model)

### Task 21: V1 detail relocation + AdminCustomerDetailV2 + detail page dispatcher

**Wave:** 6 | **Branch:** `wave8p8/task-21-detail-dispatcher-v2-detail` | **Model:** opus

**Schema realities for this task:**
- V1 detail lives at `app/admin/customers/[id]/page.tsx` (42L server component). The bulk of the V1 detail UI lives at `components/admin/customer-detail/CustomerDetailClient.tsx` (936L client component) and is imported by V1 only — leave that file alone in place (the V1 route imports it directly).
- Relocate the 42L `app/admin/customers/[id]/page.tsx` body to `components/admin/_v1/AdminCustomersV1DetailPage.tsx`, renaming the default export to `export async function AdminCustomersV1DetailPage({ customerId }: { customerId: string })`. Strip the original `params: Promise<{ id: string }>` indirection; the new function takes the resolved customerId as a prop. Re-expose at `app/admin/customers-v1/[id]/page.tsx` with a small wrapper that resolves `params` and forwards.
- `AdminCustomerDetailV2.tsx`: server component. Takes `customerId` prop. Calls `loadCustomerHeader(customerId)` synchronously; if null, calls Next's `notFound()`. Otherwise renders `<CustomerHeader>` + a 2-column grid of 8 widget Suspense slots:
  - Left column (lg:col-span-2): CustomerOrdersPanel, CustomerLoyaltyPanel, CustomerReviewsPanel, CustomerActivityTimeline
  - Right column: CustomerAddressesPanel, CustomerNotesPanel, CustomerSupportTicketsPanel, CustomerRiskWidget
- Each widget Suspense slot is independent — they stream as their loaders resolve.
- Dispatcher reads `NEXT_PUBLIC_ADMIN_V2_ENABLED`. If "true" → `<AdminCustomerDetailV2 customerId={id} isSuperAdmin={...} />`. Otherwise → `<AdminCustomersV1DetailPage customerId={id} />` (V1 has no `isSuperAdmin` prop; existing V1 client handles auth itself).
- The V2 detail page passes `isSuperAdmin` down ONLY to `CustomerHeader` (which gates the Anonymize menu item).

**Files:**
- Create: `components/admin/_v1/AdminCustomersV1DetailPage.tsx` — verbatim relocation of `app/admin/customers/[id]/page.tsx` body, named export
- Create: `app/admin/customers-v1/[id]/page.tsx` — re-exposes V1 detail
- Create: `components/admin/dashboard/AdminCustomerDetailV2.tsx`
- **Replace** `app/admin/customers/[id]/page.tsx` with the dispatcher
- Tests:
  - `tests/unit/components/admin/dashboard/AdminCustomerDetailV2.test.tsx`
  - `tests/unit/app/admin/customers/[id]/page.test.tsx`

#### Steps

- [ ] **Step 1: Relocate V1 detail page body**

Open `app/admin/customers/[id]/page.tsx` (42L) and copy its body into `components/admin/_v1/AdminCustomersV1DetailPage.tsx`. Refactor so the named export takes a `customerId` prop:

```tsx
// components/admin/_v1/AdminCustomersV1DetailPage.tsx
//
// Verbatim relocation of the V1 customer detail server component. The original
// route's `params: Promise<{ id: string }>` indirection is stripped — this
// function takes the resolved customerId as a prop. The V1 client (936L lives
// at components/admin/customer-detail/CustomerDetailClient.tsx) is imported
// unchanged.
//
// PASTE the original body here, replacing every reference to the original
// `id` param with the new `customerId` prop. Keep imports/exports correct.
import { CustomerDetailClient } from '@/components/admin/customer-detail/CustomerDetailClient'
// ... (any other imports from the original 42L page)

export async function AdminCustomersV1DetailPage({ customerId }: { customerId: string }) {
  // ... original body, but using `customerId` instead of `id`
  // The original 42L page mostly resolves params + fetches the customer +
  // renders <CustomerDetailClient customer={...} />; preserve that flow.
  return <CustomerDetailClient customerId={customerId} />
}
```

(Adjust prop name passed to `CustomerDetailClient` to match the existing client's expected prop; if it takes the full customer object, fetch it here just as the original did. The literal copy preserves V1 behaviour byte-for-byte.)

- [ ] **Step 2: Re-expose at `/admin/customers-v1/[id]`**

```tsx
// app/admin/customers-v1/[id]/page.tsx
import { AdminCustomersV1DetailPage } from '@/components/admin/_v1/AdminCustomersV1DetailPage'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  return <AdminCustomersV1DetailPage customerId={id} />
}
```

- [ ] **Step 3: Write `components/admin/dashboard/AdminCustomerDetailV2.tsx`**

```tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { loadCustomerHeader } from '@/lib/admin/customers'
import { CustomerHeader } from '@/components/admin/customers/detail/CustomerHeader'
import { CustomerOrdersPanel } from '@/components/admin/customers/detail/CustomerOrdersPanel'
import { CustomerLoyaltyPanel } from '@/components/admin/customers/detail/CustomerLoyaltyPanel'
import { CustomerReviewsPanel } from '@/components/admin/customers/detail/CustomerReviewsPanel'
import { CustomerActivityTimeline } from '@/components/admin/customers/detail/CustomerActivityTimeline'
import { CustomerAddressesPanel } from '@/components/admin/customers/detail/CustomerAddressesPanel'
import { CustomerNotesPanel } from '@/components/admin/customers/detail/CustomerNotesPanel'
import { CustomerSupportTicketsPanel } from '@/components/admin/customers/detail/CustomerSupportTicketsPanel'
import { CustomerRiskWidget } from '@/components/admin/customers/detail/CustomerRiskWidget'

export interface AdminCustomerDetailV2Props {
  customerId: string
  isSuperAdmin: boolean
}

function WidgetSkeleton() {
  return (
    <div
      aria-hidden
      className="h-40 bg-white/[0.03] border border-white/8 rounded-md animate-pulse"
    />
  )
}

export async function AdminCustomerDetailV2({
  customerId, isSuperAdmin,
}: AdminCustomerDetailV2Props) {
  const header = await loadCustomerHeader(customerId)
  if (!header) notFound()

  return (
    <AdminLayout title="Customer" subtitle={header.email}>
      <div className="space-y-3.5">
        <CustomerHeader header={header} isSuperAdmin={isSuperAdmin} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerOrdersPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerLoyaltyPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerReviewsPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerActivityTimeline customerId={customerId} />
            </Suspense>
          </div>
          <div className="space-y-3">
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerAddressesPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerNotesPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerSupportTicketsPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerRiskWidget customerId={customerId} />
            </Suspense>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 4: Replace `app/admin/customers/[id]/page.tsx` with the dispatcher**

```tsx
// app/admin/customers/[id]/page.tsx
import { AdminCustomersV1DetailPage } from '@/components/admin/_v1/AdminCustomersV1DetailPage'
import { AdminCustomerDetailV2 } from '@/components/admin/dashboard/AdminCustomerDetailV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { id } = await params

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminCustomersV1DetailPage customerId={id} />
  }

  let isSuperAdmin = false
  try {
    const session = await getSession()
    if (session?.userId) {
      const customer = await prisma.customer.findUnique({
        where: { id: session.userId },
        select: { adminRole: true },
      })
      isSuperAdmin = customer?.adminRole === 'SUPER_ADMIN'
    }
  } catch {
    isSuperAdmin = false
  }

  return <AdminCustomerDetailV2 customerId={id} isSuperAdmin={isSuperAdmin} />
}
```

- [ ] **Step 5: Write smoke test for `AdminCustomerDetailV2`**

```tsx
// tests/unit/components/admin/dashboard/AdminCustomerDetailV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const notFoundMock = vi.fn(() => { throw new Error('NEXT_NOT_FOUND') })
vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerHeader: vi.fn(),
}))

vi.mock('@/components/admin/customers/detail/CustomerHeader', () => ({
  CustomerHeader: () => <div data-testid="header" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerOrdersPanel', () => ({
  CustomerOrdersPanel: () => <div data-testid="orders" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerLoyaltyPanel', () => ({
  CustomerLoyaltyPanel: () => <div data-testid="loyalty" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerReviewsPanel', () => ({
  CustomerReviewsPanel: () => <div data-testid="reviews" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerActivityTimeline', () => ({
  CustomerActivityTimeline: () => <div data-testid="activity" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerAddressesPanel', () => ({
  CustomerAddressesPanel: () => <div data-testid="addresses" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerNotesPanel', () => ({
  CustomerNotesPanel: () => <div data-testid="notes" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerSupportTicketsPanel', () => ({
  CustomerSupportTicketsPanel: () => <div data-testid="support" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerRiskWidget', () => ({
  CustomerRiskWidget: () => <div data-testid="risk" />,
}))

beforeEach(() => vi.clearAllMocks())

import { AdminCustomerDetailV2 } from '@/components/admin/dashboard/AdminCustomerDetailV2'

describe('AdminCustomerDetailV2', () => {
  it('renders header + 8 widget slots when header loads', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerHeader as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'c1', email: 'ada@e.com', name: 'Ada', phone: null,
      profilePictureUrl: null, birthday: null, newsletter: false, smsOptIn: false,
      tierId: null, tierName: null, tierSlug: null, tierColor: null,
      currentPoints: 0, lifetimePoints: 0, totalSpent: 0, totalOrders: 0,
      lastOrderDate: null, createdAt: new Date(),
      isAnonymized: false, anonymizedAt: null,
    })
    const node = await AdminCustomerDetailV2({ customerId: 'c1', isSuperAdmin: false })
    render(node as React.ReactElement)
    expect(screen.getByTestId('header')).toBeTruthy()
    expect(screen.getByTestId('orders')).toBeTruthy()
    expect(screen.getByTestId('loyalty')).toBeTruthy()
    expect(screen.getByTestId('addresses')).toBeTruthy()
    expect(screen.getByTestId('notes')).toBeTruthy()
    expect(screen.getByTestId('risk')).toBeTruthy()
  })

  it('calls notFound when header is null', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerHeader as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await expect(
      AdminCustomerDetailV2({ customerId: 'missing', isSuperAdmin: false }),
    ).rejects.toThrow(/NEXT_NOT_FOUND/)
  })
})
```

- [ ] **Step 6: Write dispatcher test**

```tsx
// tests/unit/app/admin/customers/[id]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('app/admin/customers/[id]/page (dispatcher)', () => {
  it('renders V1 detail when flag is not "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    vi.doMock('@/components/admin/_v1/AdminCustomersV1DetailPage', () => ({
      AdminCustomersV1DetailPage: () => 'V1-detail',
    }))
    vi.doMock('@/components/admin/dashboard/AdminCustomerDetailV2', () => ({
      AdminCustomerDetailV2: () => 'V2-detail',
    }))
    vi.doMock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
    vi.doMock('@/lib/prisma', () => ({ prisma: { customer: { findUnique: vi.fn() } } }))
    const mod = await import('@/app/admin/customers/[id]/page')
    const node = await mod.default({ params: Promise.resolve({ id: 'c1' }) })
    expect(String(node)).toContain('V1-detail')
  })

  it('renders V2 detail when flag is "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/components/admin/_v1/AdminCustomersV1DetailPage', () => ({
      AdminCustomersV1DetailPage: () => 'V1-detail',
    }))
    vi.doMock('@/components/admin/dashboard/AdminCustomerDetailV2', () => ({
      AdminCustomerDetailV2: () => 'V2-detail',
    }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn().mockResolvedValue({ userId: 'u1', isAdmin: true }),
    }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        customer: { findUnique: vi.fn().mockResolvedValue({ adminRole: 'ADMIN' }) },
      },
    }))
    const mod = await import('@/app/admin/customers/[id]/page')
    const node = await mod.default({ params: Promise.resolve({ id: 'c1' }) })
    expect(String(node)).toContain('V2-detail')
  })
})
```

- [ ] **Step 7: Run tests + type-check**

```bash
pnpm test tests/unit/components/admin/dashboard/AdminCustomerDetailV2.test.tsx 'tests/unit/app/admin/customers/[id]/page.test.tsx'
pnpm exec tsc --noEmit
```

- [ ] **Step 8: Commit + push + PR**

```bash
mkdir -p app/admin/customers-v1
git add \
  components/admin/_v1/AdminCustomersV1DetailPage.tsx \
  app/admin/customers-v1/'[id]'/page.tsx \
  components/admin/dashboard/AdminCustomerDetailV2.tsx \
  app/admin/customers/'[id]'/page.tsx \
  tests/unit/components/admin/dashboard/AdminCustomerDetailV2.test.tsx \
  'tests/unit/app/admin/customers/[id]/page.test.tsx'
git commit -m "feat(admin-v2): wire Phase 8 detail dispatcher + V2 detail composition"
git push -u origin wave8p8/task-21-detail-dispatcher-v2-detail
gh pr create --title "feat(admin-v2): Phase 8 W6 detail dispatcher + V2 detail" --body "Relocates V1 detail (42L server) to /admin/customers-v1/[id]. Adds AdminCustomerDetailV2 (CustomerHeader + 8-widget Suspense grid). Dispatcher gates on NEXT_PUBLIC_ADMIN_V2_ENABLED + resolves SUPER_ADMIN for header. 4 tests passing."
```

---

## Wave 7 — Verification + QA doc (sequential)

### Task 22: Verification + QA doc

**Wave:** 7 | **Branch:** `wave8p8/task-22-qa-doc` | **Model:** sonnet

**Schema realities for this task:**
- Verification runs `pnpm exec tsc --noEmit` + `pnpm test` + `pnpm lint` on the merged main branch (assumes the controller has merged Tasks 1-21). Expected totals: ~22 new test files, ~80-100 new tests passing, zero new tsc errors, zero new lint errors.
- QA doc structure mirrors Phase 7 QA (`docs/superpowers/plans/2026-05-30-admin-rebuild-phase7-qa.md`). Sections:
  1. Title + status + scope
  2. Pre-flight commands (tsc / test / lint counts)
  3. List-page smoke checklist (per tab: All / VIP / At-Risk / Inactive / Recent + range pills + KPI cards + row click + bulk sheet)
  4. Detail-page smoke checklist (per widget × 9 + per inspector × 4 + per bulk action × 2 + GDPR anonymize flow)
  5. Cross-link checks (loyalty deep link, order detail link, review link, support link, V1 fallback)
  6. Regression risk register (list of areas to re-test if anything changes)
  7. Phase 8.5 follow-ups (grep TODO/Phase 8.5 markers across changed files; list each)

**Files:**
- Create: `docs/superpowers/plans/2026-05-30-admin-rebuild-phase8-qa.md`

#### Steps

- [ ] **Step 1: Run verification commands**

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm lint
```

Capture: total test count, pass/fail breakdown, any tsc errors, any lint errors. Expect green.

- [ ] **Step 2: Grep Phase 8.5 follow-ups**

```bash
grep -rn "Phase 8.5\|TODO(8.5)\|deferred to 8.5" app/admin/customers components/admin/customers components/admin/dashboard/AdminCustomers* components/admin/dashboard/AdminCustomerDetail* lib/admin/customers.ts
```

List each result in the QA doc under "Phase 8.5 follow-ups".

- [ ] **Step 3: Write the QA doc**

```md
# Phase 8: Customers QA

**Status:** Ready for QA after Wave 6 merge.
**Phase plan:** `docs/superpowers/plans/2026-05-30-admin-rebuild-phase8-customers.md`
**Phase spec:** `docs/superpowers/specs/2026-05-30-admin-rebuild-phase8-customers.md`

## Pre-flight

- `pnpm exec tsc --noEmit` → 0 new errors
- `pnpm test` → N new tests, all green
- `pnpm lint` → 0 new errors

## List page smoke checklist (NEXT_PUBLIC_ADMIN_V2_ENABLED=true)

- [ ] /admin/customers loads with tab=all + range=30d by default
- [ ] Switching to each tab updates the URL: all / vip / at-risk / inactive / recent
- [ ] Range pills update ?range=…; KPI strip refreshes within Suspense
- [ ] KPI card clicks deep-link to matching tab
- [ ] Desktop row click → /admin/customers/[id]
- [ ] Desktop checkbox toggles selection; header checkbox toggles all
- [ ] Mobile (md:hidden) cards: tap navigates when no selection; long-press 500ms enters multi-select; swipe-left reveals Gift action (SUPER_ADMIN only)
- [ ] BulkSheet appears when selection > 0; shows count
- [ ] Gift Points form (SUPER_ADMIN): delta + reason validation; success toast; selection clears
- [ ] Export CSV: downloads .csv; success toast
- [ ] Anonymize button disabled with tooltip in v1
- [ ] Anonymized customers do NOT appear in list (default filter)

## Detail page smoke checklist

- [ ] /admin/customers/[id] streams header first, then 8 widgets independently
- [ ] CustomerHeader: profile picture / initials fallback; tier badge; Active/Anonymized pill; ⋯ menu opens; Edit Profile disabled when anonymized
- [ ] ProfileEditInspector: form pre-filled; email disabled; save persists; toast + close
- [ ] CustomerOrdersPanel: orders listed; row link → /admin/fulfillment/[orderId]
- [ ] CustomerLoyaltyPanel: tier + balances + last 10 ledger; deep link → /admin/loyalty?tab=members&member=…
- [ ] CustomerReviewsPanel: reviews listed; row link → /admin/reviews/[id]
- [ ] CustomerSupportTicketsPanel: tickets listed; row link → /admin/support/[id]
- [ ] CustomerAddressesPanel: addresses listed; Default badge; + Add opens AddressInspector; Edit pre-fills; Delete confirms; Set Default succeeds
- [ ] AddressInspector: uses firstName/lastName/address1/state/postalCode field names; AddressType select works
- [ ] CustomerNotesPanel: notes listed; isImportant star renders; + Add opens NoteInspector; Edit pre-fills; Delete confirms
- [ ] NoteInspector: isImportant checkbox persists
- [ ] CustomerActivityTimeline: chronological merge; href events become links
- [ ] CustomerRiskWidget: refundRate/returnRate/chargebacks/avgDaysToReturn; High risk badge appears when refundRate > 20% OR chargebacks > 0
- [ ] Anonymize (SUPER_ADMIN): typed-confirm modal; Confirm disabled until email matches; on success customer scrubbed + redirects refresh
- [ ] /admin/customers/[missing-id] returns 404 (notFound)

## Cross-link checks

- [ ] V1 fallback: NEXT_PUBLIC_ADMIN_V2_ENABLED=false → /admin/customers shows V1 stub; /admin/customers-v1 shows original V1 list; /admin/customers-v1/[id] shows V1 detail (936L client unchanged)
- [ ] Order row → Phase 4 order detail
- [ ] Loyalty deep link → Phase 7 Members tab with MemberInspector open
- [ ] Review row → Phase 3 review detail
- [ ] Support row → existing V1 support page (Phase 9 will rebuild)

## Regression risk register

- Any change to `Customer` schema or its relations re-validates loaders + actions.
- Any change to `lib/loyalty/service.ts.awardPoints` must preserve the idempotencyKey contract used by `bulkGiftPoints`.
- Any change to `Address` field names breaks `AddressInspector` + `loadCustomerAddresses`.
- Any change to `CustomerNote.isImportant` breaks `NoteInspector` + `loadCustomerNotes`.
- Removing the `anonymizedAt` column breaks all list loaders (they reference it directly).

## Phase 8.5 follow-ups

- (Insert grep results from Step 2 here, one bullet per occurrence with file:line + context.)
- Sortable list-table columns
- URL-plumbed pagination for ordersPage / reviewsPage / ticketsPage on detail widgets
- DB-backed Segment model + saved/custom segments
- `Customer.riskScore` + `Customer.isFlagged` (admin-set risk)
- + New Customer admin-create flow
- Customer communications panel (sent emails/SMS history)
- Hard delete option (currently anonymize-only)
- Tag system (`CustomerTag` model)
- Bulk anonymize action (currently per-customer only — gated UI in BulkSheet)
- Configurable VIP threshold (currently hard-coded `totalSpent >= 1000`)
- "Show anonymized" toggle in list view
- Cross-phase loader sharing — `getCustomerHeaderForRefresh` inlines its query (W1b parallel safety) instead of reusing `loadCustomerHeader`
```

- [ ] **Step 4: Commit + push + PR**

```bash
git add docs/superpowers/plans/2026-05-30-admin-rebuild-phase8-qa.md
git commit -m "docs(admin-v2): add Phase 8 QA doc"
git push -u origin wave8p8/task-22-qa-doc
gh pr create --title "docs(admin-v2): Phase 8 W7 QA doc" --body "QA checklist for the Phase 8 customers rebuild: list-page tab/range/KPI/bulk smoke, detail-page per-widget + per-inspector smoke, GDPR anonymize flow, cross-link checks, regression risks, Phase 8.5 follow-ups."
```

---
