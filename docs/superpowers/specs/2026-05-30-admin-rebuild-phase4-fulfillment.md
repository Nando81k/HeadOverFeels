# Phase 4: Fulfillment — Sub-spec

**Status:** Approved 2026-05-31. Hand off to writing-plans.

**Parent spec:** `docs/superpowers/specs/2026-05-30-admin-rebuild-design.md`
**Sibling specs:** Phase 2 (Dashboard), Phase 3 (Products & Drops) — both shipped.

## Goal

Rebuild the `/admin/fulfillment` page interior (currently a 2,806-line V1 queue workbench) as a V2 Shopify-style orders list, gated by `NEXT_PUBLIC_ADMIN_V2_ENABLED`. Introduce first-class `Return`/`RefundRecord` schema so returns are no longer wedged into `SupportTicket` fields. Build a fresh V2 order detail page that lifts V1's EasyPost label-purchase + return-decision logic into restyled widgets.

## Decisions table

| # | Decision | Choice |
|---|---|---|
| 1 | Mental model | **B** — pivot to conventional orders list (drops V1's queue triage workbench) |
| 2 | Sub-tabs (7) | **C** — `all` · `needs-action` · `processing` · `shipped` · `delivered` · `returns` · `archived` (Cancelled + Refunded) |
| 3 | KPI strip (4) | **C** — Needs Action · Ready to Ship · Today's Revenue · Returns Pending. Cards click → jump to matching tab |
| 4a | Filters | **B (standard)** — search (order # / email / tracking #) + date range + payment status + carrier + has-tracking |
| 4b | Inspector scope | **ii** — read-only summary + 3 inline edits: status dropdown, internal notes textarea, tracking + carrier inputs (+ EasyPost label button); bigger ops → full detail page |
| 5a | Bulk actions (4) | **A (conservative)** — Mark Shipped (tracking prompt) · Print Labels (EasyPost batch) · Send Tracking Email · Export CSV |
| 5b | Order detail page | **ii** — lift V1's `FulfillmentCaseDrawer` payload-fetch + label-purchase + return-decision logic into a fresh V2 detail composition |
| 6a | Live updates | **A** — toast notification on new order (Socket.IO via Phase 2's LiveActivity infra); click → `router.refresh()` |
| 6b | Returns surface | **iii (scope expansion)** — first-class `Return` + `ReturnItem` + `RefundRecord` models; hand-authored migration; backfill from existing `SupportTicket` returns |

## Architecture

### Routing + dispatcher pattern

Mirrors Phase 2/3:

```
app/admin/fulfillment/page.tsx          ← dispatcher (V1 vs V2 by env flag)
app/admin/fulfillment/[orderId]/page.tsx ← dispatcher (V1 vs V2)
components/admin/_v1/AdminFulfillmentV1.tsx   ← V1 page extracted unchanged
components/admin/dashboard/AdminFulfillmentV2.tsx
components/admin/_v1/AdminOrderDetailV1.tsx   ← V1 drawer extracted to standalone page
components/admin/dashboard/AdminOrderDetailV2.tsx
```

V1 stays the default until rollout. The page is a server component; tab navigation is client-side via a small `FulfillmentTabPills.tsx` wrapper (same pattern as Phase 3's `ProductsTabPills`).

### V2 root composition (`AdminFulfillmentV2`)

```
AdminLayout
├── TabPills (6 tabs)
├── FulfillmentKpiStrip (Suspense) — 4 cards, each <Link href={`?tab=${target}`}>
├── FilterBar (search + date range + payment status + carrier + has-tracking)
└── Main content slot (Suspense per tab)
    ├── all          → <OrdersListView tab="all" .../>
    ├── needs-action → <OrdersListView tab="needs-action" .../>
    ├── processing   → <OrdersListView tab="processing" .../>
    ├── shipped      → <OrdersListView tab="shipped" .../>
    ├── delivered    → <OrdersListView tab="delivered" .../>
    ├── returns      → <ReturnsListView .../>
    └── archived     → <ArchivedListView .../>
```

Each slot is its own `async` server-component function so Suspense boundaries stream independently (mirrors `AdminDashboardV2` and `AdminProductsV2`).

`NewOrderToast` mounts once globally inside `AdminFulfillmentV2`; subscribes to Phase 2's Socket.IO `order:new` event, surfaces a toast, click → `router.refresh()`.

## Schema additions

Three new models (hand-authored migration — Phase 1 P3006 workaround precedent):

```prisma
model Return {
  id                   String       @id @default(cuid())
  rmaNumber            String       @unique  // RMA-NNNNNN sequential
  orderId              String
  order                Order        @relation(fields: [orderId], references: [id])
  customerId           String
  customer             Customer     @relation(fields: [customerId], references: [id])
  status               ReturnStatus @default(REQUESTED)
  reason               String
  internalNotes        String?
  returnLabel          String?      // EasyPost label URL
  returnTrackingNumber String?
  receivedAt           DateTime?
  windowExpiresAt      DateTime     // requestedAt + 30d
  requestedAt          DateTime     @default(now())
  decidedAt            DateTime?
  decidedById          String?      // Customer.id (admin who decided)
  items                ReturnItem[]
  refunds              RefundRecord[]
  supportTicketId      String?      @unique  // backfill link
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt
  @@index([status, requestedAt])
  @@index([orderId])
}

model ReturnItem {
  id           String              @id @default(cuid())
  returnId     String
  return       Return              @relation(fields: [returnId], references: [id], onDelete: Cascade)
  orderItemId  String
  orderItem    OrderItem           @relation(fields: [orderItemId], references: [id])
  quantity     Int
  condition    ReturnItemCondition @default(UNOPENED)
  reason       String?
}

model RefundRecord {
  id              String     @id @default(cuid())
  orderId         String
  order           Order      @relation(fields: [orderId], references: [id])
  returnId        String?
  return          Return?    @relation(fields: [returnId], references: [id])
  amount          Float
  type            RefundType  // FULL | PARTIAL | SHIPPING_ONLY
  reason          String
  stripeRefundId  String?
  createdAt       DateTime   @default(now())
  createdById     String     // Customer.id
  @@index([orderId])
}

enum ReturnStatus { REQUESTED APPROVED REJECTED RECEIVED REFUNDED }
enum ReturnItemCondition { UNOPENED USED DAMAGED }
enum RefundType { FULL PARTIAL SHIPPING_ONLY }
```

**Backfill:** transactional script (run by migration). For each `SupportTicket` where `type IN (RETURN, REFUND, EXCHANGE) AND returnRequested = true`, create a matching `Return` row with `supportTicketId` linked, status derived from `returnApproved` + ticket status. Existing `SupportTicket` rows remain as the conversation thread. Rollback on any per-ticket failure with a detailed reason log.

**Return window:** hard-coded 30 days from delivery for v1. "Configurable per product" deferred to Phase 4.5.

**RMA numbering:** `RMA-NNNNNN` sequential from a database-backed counter. Implementation: dedicated `RmaCounter` singleton table with row-level lock (`SELECT ... FOR UPDATE`) inside the same transaction that creates the `Return`, so concurrent requests never collide.

## Components

### Shared views — `components/admin/fulfillment/`

| File | Role |
|---|---|
| `OrdersListTable.tsx` | Desktop sticky-header table. Columns: order # · customer · status · payment · total · created · tracking · ⋯ action |
| `OrdersListCardMobile.tsx` | Mobile card. Long-press → multi-select. Swipe-left → quick actions (Mark Shipped). |
| `OrdersListView.tsx` | Orchestrator. Wires table + mobile cards + Inspector + BulkActionsSheet. Used by 5 tabs (all/needs-action/processing/shipped/delivered) |
| `OrderInspector.tsx` | Slide-out using the Inspector primitive. Sections: read-only header summary, status dropdown, internal-notes textarea, tracking-number + carrier dropdown + "Buy label" button. "Open full detail →" link. |
| `OrderBulkActionsSheet.tsx` | BottomActionSheet with 4 actions: Mark Shipped (prompts tracking) · Print Labels (EasyPost batch) · Send Tracking Email · Export CSV |
| `ReturnsListView.tsx` | Table of `Return` rows. Columns: RMA # · order # · customer · status · requested · refund amount · ⋯ action |
| `ReturnInspector.tsx` | Slide-out. Sections: items table with condition badges, refund-amount input, Approve (generates EasyPost return label + sets status APPROVED) / Reject buttons |
| `ArchivedListView.tsx` | Read-only table of CANCELLED + REFUNDED orders. No bulk actions. |
| `NewOrderToast.tsx` | Bottom-right toast on Socket.IO `order:new`. Click → `router.refresh()`. |

### Order detail V2 — `components/admin/fulfillment/detail/`

| File | Role |
|---|---|
| `OrderHeader.tsx` | Order #, status pill, customer link, total |
| `OrderLineItems.tsx` | Line items table: thumbnail · name · variant · qty · price · subtotal |
| `OrderShippingPanel.tsx` | Shipping address (editable) · tracking input + carrier · "Buy label" button (EasyPost) |
| `OrderPaymentPanel.tsx` | Payment summary · Refund button → `RefundDialog` |
| `OrderTimeline.tsx` | Sequential events derived from Order fields (created, paid, shipped, delivered) + Return events |
| `OrderNotesPanel.tsx` | Internal + customer notes (both editable) |
| `OrderReturnsPanel.tsx` | List of attached Returns with status pills · "+ Create Return" button |
| `RefundDialog.tsx` | Modal: amount input · type select (FULL/PARTIAL/SHIPPING_ONLY) · reason textarea · Submit |

## Data layer — `lib/admin/fulfillment.ts` (new)

```ts
loadFulfillmentKpis(): Promise<FulfillmentKpiData>
// { needsActionCount, readyToShipCount, todaysRevenue, returnsPendingCount }

loadOrdersTab(tab: OrdersTab, filters?: OrdersFilters): Promise<PaginatedResult<OrderRow>>
loadReturnsTab(filters?: ReturnsFilters): Promise<PaginatedResult<ReturnRow>>
loadArchivedTab(filters?: OrdersFilters): Promise<PaginatedResult<OrderRow>>
loadOrderDetail(id: string): Promise<OrderDetailFull | null>
loadReturnDetail(id: string): Promise<ReturnWithItems | null>
loadCarriers(): Promise<CarrierOption[]>  // cached 24h
```

`OrderRow` shape: `{ id, orderNumber, customerName, customerEmail, status, paymentStatus, totalAmount, createdAt, trackingNumber?, carrier?, itemCount }`.

Tab → query mapping handled inside `loadOrdersTab`:

| Tab | Where clause |
|---|---|
| `all` | `status NOT IN (CANCELLED, REFUNDED)` |
| `needs-action` | `status = PENDING OR paymentStatus = FAILED` |
| `processing` | `status IN (CONFIRMED, PROCESSING)` |
| `shipped` | `status = SHIPPED` |
| `delivered` | `status = DELIVERED` |
| `archived` | `status IN (CANCELLED, REFUNDED)` |

## Server actions — `app/admin/fulfillment/actions.ts` (new)

```ts
// Single-order
updateOrderStatus(orderId, status: OrderStatus): ActionResult
saveOrderNotes(orderId, { internalNotes, notes }): ActionResult
setTracking(orderId, { trackingNumber, carrier }): ActionResult
purchaseShippingLabel(orderId): ActionResult<{ labelUrl, trackingNumber }>
sendTrackingEmail(orderId): ActionResult
getOrderDetailForInspector(orderId): Promise<OrderDetailFull | null>  // client-side fetch wrapper

// Bulk
bulkMarkShipped(orderIds, trackingByOrderId): BulkResult
bulkPurchaseLabels(orderIds): BulkResult
bulkSendTrackingEmail(orderIds): BulkResult
bulkExportCsv(orderIds): Promise<string>  // returns CSV blob URL

// Returns
createReturn(orderId, items, reason): ActionResult<{ rmaNumber }>
approveReturn(returnId): ActionResult<{ labelUrl }>  // generates EasyPost return label
rejectReturn(returnId, reason): ActionResult
markReturnReceived(returnId): ActionResult

// Refunds (SUPER_ADMIN only — same pattern as Phase 3's bulkDelete)
createRefund(orderId, { amount, type, reason, returnId? }): ActionResult<{ refundId }>
```

All actions go through `requireAdmin()` (overloaded no-arg variant added in Phase 3). `createRefund` uses `requireAdminRole('SUPER_ADMIN')`. All mutations call `revalidatePath('/admin/fulfillment')` + `revalidatePath(\`/admin/fulfillment/${orderId}\`)`.

`getOrderDetailForInspector` is a server-action wrapper — same pattern as the Phase 3 PR #92 hotfix. Keeps Prisma out of the client bundle.

## Data flow

1. Page dispatcher reads `searchParams.tab` → renders `AdminFulfillmentV2` → SSR cascade kicks off Suspense slots in parallel.
2. Each tab slot awaits its specific loader; `revalidate = 60` on the page.
3. Mutations in Inspector / BulkSheet call server actions → `revalidatePath` invalidates relevant pages.
4. `NewOrderToast` subscribes to Socket.IO; on event → toast → click → `router.refresh()`.
5. EasyPost label purchase preserves the V1 idempotency guard (`Order.trackingNumber` non-null short-circuits).
6. Optimistic UI on `bulkMarkShipped` (status flips immediately, rolls back on error).

## Error handling

- Server actions return `ActionResult<T>` / `BulkResult` (same shapes as Phase 3).
- Stripe refund failures → don't write `RefundRecord`; surface error in `RefundDialog` toast.
- EasyPost rate-fetch failures → fallback to manual tracking entry (existing V1 behavior preserved).
- Backfill migration: runs in a transaction, rollback on any per-ticket failure, logs every skip with reason.
- `createRefund` always wraps the Stripe call in try/catch; partial state (refund created but `RefundRecord` write failed) is impossible because the write happens inside the same `prisma.$transaction` as the audit log.

## Testing

Per-component test files using Vitest + @testing-library/react (Phase 1 harness). Target ~240+ tests across the phase (matches Phase 3 coverage).

- `loadFulfillmentKpis` / `loadOrdersTab` (per tab × where clause) / `loadReturnsTab` / `loadOrderDetail` unit tests with mocked Prisma
- Server action tests with mocked Stripe + EasyPost
- Component tests per List / Inspector / Card / Dialog (rendering, selection, interactions)
- Dispatcher tests (V1/V2 branches via `vi.resetModules()`)
- Migration backfill integration test: seed a `SupportTicket` return → run backfill → verify `Return` row + items
- RMA counter concurrency test (parallel creates → all get unique sequential numbers)

## Wave plan (drives the implementation plan)

| Wave | Tasks | Parallel? | Notes |
|---|---|---|---|
| W1 | Schema + migration + RMA counter + backfill script | Sequential | Foundation. Hand-authored migration. |
| W2 | Data layer (`lib/admin/fulfillment.ts`) + Server actions (`actions.ts`) | 2 parallel | Different files |
| W3 | `OrdersListTable` (desktop) + `OrdersListCardMobile` (mobile) | 2 parallel | |
| W4 | `OrderInspector` + `OrderBulkActionsSheet` + `ReturnInspector` | 3 parallel | |
| W5 | `OrdersListView` + `ReturnsListView` + `ArchivedListView` + `NewOrderToast` | 4 parallel | Depend on W4 |
| W6 | `AdminFulfillmentV2` root + page dispatcher | Sequential, **opus** | Critical integration |
| W7 | Order detail page widgets (Header, LineItems, Shipping, Payment, Timeline, Notes, Returns, RefundDialog) | ~6 parallel | |
| W8 | Order detail V2 composition + dispatcher + verification + QA doc | Sequential | Final |

~18–20 tasks total. Larger than Phase 3 (14) because of the schema work + detail page.

## Constraints (per master spec, no re-litigation)

- Dark futurist + Linear Calm density.
- Mobile co-equal — long-press multi-select, swipe-left row actions, BottomActionSheet, full-screen Inspector on mobile.
- Per-widget Suspense boundaries with `revalidate = 60`.
- Branch naming `wave4p4/task-N-<short-name>`; worktree isolation on every Agent dispatch.
- Per-fix PRs — one focused commit per PR; controller batches per wave.
- `isolation: "worktree"` on every Agent dispatch.
- Each subagent reads this spec + the plan for its specific task.

## Out of scope (deferred to Phase 4.5+)

- Configurable return window per product (hard-coded 30d in v1).
- Multi-shipment splits for forward orders (single tracking number per order).
- Local pickup / store fulfillment (no schema support today; brand doesn't offer it).
- Saved views (V1 has them; v2 drops them — URL params do the job).
- Returns chat thread inside `Return` (we keep linking to `SupportTicket` for the conversation).
- Stripe disputes / chargebacks dashboard.
