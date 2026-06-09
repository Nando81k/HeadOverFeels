# Phase 8: Customers — Sub-spec

**Status:** Approved 2026-06-08. Hand off to writing-plans.

**Parent spec:** `docs/superpowers/specs/2026-05-30-admin-rebuild-design.md`
**Sibling specs:** Phase 2-7 — all shipped.

## Goal

Rebuild the `/admin/customers` page interior (V1 list 901L) AND the `/admin/customers/[id]` detail page (V1 detail client 936L) as V2 surfaces: 5-tab segment-based list page + comprehensive 8-widget detail page, gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED`. One small migration (`Customer.anonymizedAt`) for GDPR right-to-erasure; everything else reuses existing schema.

## Decisions table

| # | Decision | Choice |
|---|---|---|
| 1 | Tab structure | **A** — 5 segment-based tabs: `all` · `vip` · `at-risk` · `inactive` · `recent`. Segments stay computed (mirror V1's `calculateCustomerSegment`). No DB Segment model. |
| 2a | KPI strip (4) | **B (mixed)** — Total Customers (snapshot) · New (range, with trend) · Avg LTV ($) · At-Risk count (warning when > 0). Cards click → matching tab. |
| 2b | Row click behavior | **i** — Row click → full detail page at `/admin/customers/[id]` (no Inspector intermediate). Bulk select via row checkboxes. Matches Shopify/Stripe convention. |
| 3a | Detail page sections | **A** — 8 widgets: CustomerHeader · CustomerOrdersPanel · CustomerLoyaltyPanel · CustomerAddressesPanel · CustomerReviewsPanel · CustomerSupportTicketsPanel · CustomerNotesPanel · CustomerActivityTimeline. Plus CustomerRiskWidget (read-only computed) and CustomerHeader anonymize action makes it functionally 9 widgets / 10 with risk. |
| 3b | GDPR right-to-erasure | **i** — Anonymize-in-place. Add `Customer.anonymizedAt DateTime?` column. SUPER_ADMIN-only `anonymizeCustomer` action: sets email to `deleted-${id}@anonymized.local`, nulls name/phone/birthday/avatar, marks anonymizedAt=now(). Orders/loyalty/audit preserved. List filters out anonymized by default. Typed-confirm (admin types customer's exact email) UX. |
| 3c | Admin notes | **α** — CRUD list (existing CustomerNote model + V1 API routes wrapped as actions). Multiple dated notes per customer, optional importance flag. |
| 4a | Bulk actions | **A (conservative)** — Bulk Gift Points (SUPER_ADMIN, reuses Phase 7 atomic awardPoints) · Bulk Export CSV (cap 10,000) · Bulk Anonymize (SUPER_ADMIN, GDPR). |
| 4b | Risk / fraud surface | **i** — `CustomerRiskWidget` (read-only computed). Refund rate (refunds / orders), return rate (returns / orders), chargeback count, avg days between order and return. Red-tint badge when refund rate > 20% or chargebacks > 0. No "flag as risky" action in v1. |
| 4c | Customer creation | **α** — Defer to Phase 8.5. Most flows signup-driven. No "+ New Customer" button in v1. |

## Architecture

### Routing + dispatcher pattern (mirrors Phase 6/7)

```
app/admin/customers/page.tsx              ← dispatcher (V1 stub vs V2 root)
app/admin/customers/[id]/page.tsx         ← dispatcher (V1 redirect to /admin/customers-v1/[id] vs V2 detail)
app/admin/customers-v1/page.tsx           ← relocated V1 list (verbatim)
app/admin/customers-v1/[id]/page.tsx      ← relocated V1 detail (verbatim)
components/admin/_v1/AdminCustomersV1.tsx           ← V1 stub linking to /admin/customers-v1
components/admin/_v1/AdminCustomersV1Page.tsx       ← verbatim relocation of V1 list
components/admin/_v1/AdminCustomersV1DetailPage.tsx ← verbatim relocation of V1 detail
components/admin/dashboard/AdminCustomersV2.tsx     ← V2 list root composition
components/admin/dashboard/AdminCustomerDetailV2.tsx ← V2 detail composition
components/admin/dashboard/CustomersTabPills.tsx    ← client wrapper for TabPills
components/admin/dashboard/CustomersRangePills.tsx  ← client wrapper for ?range= pill row
```

V1 sub-routes (currently only `/admin/customers` + `/admin/customers/[id]`) get relocated to `/admin/customers-v1` + `/admin/customers-v1/[id]` so dispatchers can replace the canonical routes without breaking V1 fallback.

### V2 list root composition (`AdminCustomersV2`)

```
AdminLayout
├── CustomersTabPills (5 tabs)
├── CustomersRangePills (5 ranges — affects "New (range)" KPI + "Recent" tab signup window)
├── CustomersKpiStrip (Suspense) — 4 StatCards, each <Link>
└── Main content slot (Suspense):
    ├── CustomersListTable (desktop sticky-header — hidden < md)
    ├── CustomersListCardMobile per row (mobile — md:hidden)
    └── CustomersBulkSheet (BottomActionSheet, visible when selectedIds.length > 0)
```

Per-tab data is fetched by `loadCustomersTab(tab, range, filters?)` — one loader, tab + range drive the where clause (Phase 7 LoyaltyTab precedent).

### V2 detail composition (`AdminCustomerDetailV2`)

```
AdminLayout
├── CustomerHeader (always visible — email, avatar, tier, status, "⋯" menu with Anonymize SUPER_ADMIN)
└── 2-column grid on desktop (lg:), single column on mobile:
    Left column (lg:col-span-2):
    ├── CustomerOrdersPanel (Suspense) — paginated order history
    ├── CustomerLoyaltyPanel (Suspense) — tier + currentPoints + last-10 ledger entries
    ├── CustomerReviewsPanel (Suspense) — read-only list of customer's reviews
    └── CustomerActivityTimeline (Suspense) — chronological merge of orders/points/reviews/tickets/addresses
    Right column:
    ├── CustomerAddressesPanel (Suspense) — CRUD list
    ├── CustomerNotesPanel (Suspense) — CRUD using existing CustomerNote model
    ├── CustomerSupportTicketsPanel (Suspense) — read-only ticket list (Phase 9 cross-link)
    └── CustomerRiskWidget (Suspense) — computed refund/return/chargeback risk numbers
```

Each widget = async server-component function with its own Suspense boundary → independent streaming.

## Schema additions

**One migration:**

```prisma
model Customer {
  // ... existing fields
  anonymizedAt DateTime?  // null = active; set = GDPR right-to-erasure applied
  @@index([anonymizedAt])
}
```

Migration sql (hand-authored, Phase 4 precedent):
```sql
ALTER TABLE "customers" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
CREATE INDEX "customers_anonymizedAt_idx" ON "customers"("anonymizedAt");
```

All other models reused:
- `Customer` — full profile + adminRole + loyalty + tracking + relations
- `CustomerNote` — existing CRUD model (authorId + importance flag)
- `Address` — relation, CRUD via Phase 8 actions
- `Order`, `Review`, `SupportTicket`, `PointsTransaction`, `RewardRedemption`, `Return` — read-only relations for detail widgets

**Default filter:** All list loaders filter `WHERE anonymizedAt IS NULL` unless explicit toggle ("Show anonymized").

**Deferred to Phase 8.5+:**
- `Segment` + `CustomerSegment` join models (saved/custom segments)
- `Customer.riskScore` + `Customer.isFlagged` (admin-set risk)
- `+ New Customer` admin-create flow
- Customer communications panel (sent emails/SMS history)
- Hard delete (currently anonymize only)
- Tag system (`CustomerTag` model)
- Bulk tier change

## Components

### Page roots — `components/admin/dashboard/`

| File | Role |
|---|---|
| `AdminCustomersV2.tsx` | Server root: TabPills + RangePills + KPI strip + list Suspense slot |
| `AdminCustomerDetailV2.tsx` | Server root: CustomerHeader + 2-column grid of 8 widget Suspense slots |
| `CustomersTabPills.tsx` | Client wrapper for `TabPills`; `router.push(\`?tab=${id}&range=${range}\`)` |
| `CustomersRangePills.tsx` | Client wrapper for 5-range pill row |

### List components — `components/admin/customers/`

| File | Role |
|---|---|
| `CustomersListTable.tsx` | Desktop sticky-header table. Columns: checkbox · email · tier badge · totalOrders · totalSpent · currentPoints · lastOrderDate · ⋯ action. Row click → `router.push(\`/admin/customers/${id}\`)`. |
| `CustomersListCardMobile.tsx` | Mobile card per row. Long-press → multi-select. Swipe-left → "Gift Points" quick action. |
| `CustomersBulkSheet.tsx` | BottomActionSheet with 3 actions: Bulk Gift Points (SUPER_ADMIN, opens Phase 7 AdjustPointsDialog in bulk mode) · Bulk Export CSV · Bulk Anonymize (SUPER_ADMIN, typed-confirm dialog) |

### Detail widgets — `components/admin/customers/detail/`

| File | Role |
|---|---|
| `CustomerHeader.tsx` | Top banner: email, name, avatar, joined date, tier badge, currentPoints, status pill (Active / Anonymized). "⋯" menu with "Edit Profile" (opens ProfileEditInspector) + "Anonymize" (SUPER_ADMIN, opens AnonymizeConfirmDialog). |
| `CustomerOrdersPanel.tsx` | Paginated table of customer's Orders (last 50 by default, 10/page). Columns: orderNumber · status pill · total · createdAt. Row link → Phase 4 order detail. |
| `CustomerLoyaltyPanel.tsx` | Tier badge + currentPoints + lifetimePoints + annualPointsEarned + last 10 PointsTransaction rows. Link to Phase 7 MemberInspector view (`/admin/loyalty?tab=members&member=${id}` or similar). |
| `CustomerAddressesPanel.tsx` | List of Address rows with "Default" badge. "+ Add Address" → AddressInspector. Per-row Edit/Delete/Set Default buttons. |
| `CustomerReviewsPanel.tsx` | Read-only list of customer's Reviews. Columns: product name · rating · status pill · createdAt. Link to Phase 3 review detail. |
| `CustomerSupportTicketsPanel.tsx` | Read-only list of customer's SupportTickets. Columns: ticketNumber · type pill · status pill · priority · createdAt. Link to current V1 support page. |
| `CustomerNotesPanel.tsx` | CRUD list using existing CustomerNote model. Each note: content + author + importance flag + timestamp. "+ Add Note" → NoteInspector. |
| `CustomerActivityTimeline.tsx` | Chronological merge of last 50 events (orders, points txns, reviews, tickets, address changes). Each event: icon + label + timestamp. |
| `CustomerRiskWidget.tsx` | Read-only computed risk numbers. Refund rate (refunds / orders), return rate (returns / orders), chargeback count, avg days between order and return. Red-tint when refund rate > 20% or chargebacks > 0. |

### Inspectors — `components/admin/customers/inspectors/`

| File | Scope |
|---|---|
| `ProfileEditInspector.tsx` | Edit Customer.name, phone, birthday, newsletter, smsOptIn. Wires `updateCustomerProfile`. |
| `AddressInspector.tsx` | CRUD individual Address (line1, line2, city, region, postalCode, country, isDefault). Wires create/update/delete + setDefaultAddress actions. |
| `NoteInspector.tsx` | Single note edit (content + importance flag). Create + edit modes. Wires create/update/delete note actions. |
| `AnonymizeConfirmDialog.tsx` | SUPER_ADMIN-only typed-confirm modal. Shows consequences ("Email/name/phone will be scrubbed. Orders + loyalty preserved.") + requires admin to type customer's exact email before Confirm enables. Wires `anonymizeCustomer`. |

## Data layer — `lib/admin/customers.ts` (new)

Reuses Phase 6/7's helpers (local `TimeRange` + `getRangeBounds` + `buildTrend` copies). Reuses `calculateCustomerSegment` from `lib/customers/admin-customer-query.ts` for tab where-clause logic.

```ts
// KPI
loadCustomersKpis(range: TimeRange): Promise<CustomersKpiData>
// { totalCustomers, newInRange, newInRangeTrend, avgLtv, atRiskCount }

// Tab loader (one loader; tab + range drive where clause)
loadCustomersTab(
  tab: CustomersTab,
  range: TimeRange,
  filters?: CustomersFilters,
): Promise<PaginatedResult<CustomerRow>>

// Detail loaders (one per widget; each Suspense-wrappable)
loadCustomerHeader(id: string): Promise<CustomerHeaderData | null>
loadCustomerOrders(id: string, page?, pageSize?): Promise<PaginatedResult<OrderRow>>
loadCustomerLoyalty(id: string): Promise<CustomerLoyaltyData>
loadCustomerAddresses(id: string): Promise<AddressRow[]>
loadCustomerReviews(id: string, page?, pageSize?): Promise<PaginatedResult<ReviewRow>>
loadCustomerSupportTickets(id: string, page?, pageSize?): Promise<PaginatedResult<SupportTicketRow>>
loadCustomerNotes(id: string): Promise<CustomerNoteRow[]>
loadCustomerActivity(id: string, limit?: number): Promise<ActivityEvent[]>
loadCustomerRisk(id: string): Promise<CustomerRiskData>
```

Tab → where clause:
- `all` → `anonymizedAt IS NULL`
- `vip` → `anonymizedAt IS NULL AND totalSpent >= 1000`
- `at-risk` → `anonymizedAt IS NULL AND totalOrders >= 2 AND lastOrderDate < (now - 90 days)`
- `inactive` → `anonymizedAt IS NULL AND (totalOrders = 0 OR lastOrderDate < (now - 180 days))`
- `recent` → `anonymizedAt IS NULL AND createdAt >= (now - rangeWindow)`

VIP threshold (`totalSpent >= 1000`) hard-coded in v1; configurable via Setting table is Phase 8.5.

## Server actions — `app/admin/customers/actions.ts` (new)

```ts
// Profile
updateCustomerProfile(id, input): ActionResult
getCustomerHeaderForRefresh(id): Promise<CustomerHeaderData | null>  // re-fetch after edit

// Notes (wraps existing /api/admin/customers/[id]/notes routes)
createCustomerNote(customerId, content, importance?): ActionResult<{ id: string }>
updateCustomerNote(noteId, content, importance?): ActionResult
deleteCustomerNote(noteId): ActionResult

// Addresses (wraps Prisma Address model directly)
createAddress(customerId, input): ActionResult<{ id: string }>
updateAddress(addressId, input): ActionResult
deleteAddress(addressId): ActionResult
setDefaultAddress(customerId, addressId): ActionResult

// Bulk
bulkGiftPoints(customerIds, delta, reason): BulkResult  // SUPER_ADMIN; wraps lib/loyalty/service.ts awardPoints with per-customer idempotency
bulkExportCustomersCsv(customerIds): ActionResult<{ csv: string }>  // cap 10,000

// GDPR (SUPER_ADMIN)
anonymizeCustomer(id, typedConfirmEmail): ActionResult
```

**Total: ~12 server actions.** `requireAdmin()` for all; `requireAdminRole('SUPER_ADMIN')` for `bulkGiftPoints` + `anonymizeCustomer`. All mutations call `revalidatePath('/admin/customers')` + `revalidatePath('/admin/customers/${id}')`.

**Idempotency for bulkGiftPoints:** generate one `batchId = crypto.randomUUID()` per call; per-customer key `gift-${batchId}-${customerId}` passed to `awardPoints`. Phase 7 W1 Task 2 precedent.

**Anonymize implementation (in transaction):**
```ts
prisma.$transaction([
  prisma.customer.update({
    where: { id, anonymizedAt: null },  // not-already-anonymized guard
    data: {
      email: `deleted-${id}@anonymized.local`,
      name: null,
      phone: null,
      birthday: null,
      profilePictureUrl: null,
      anonymizedAt: new Date(),
    },
  }),
  // Optionally also: prisma.address.deleteMany({ where: { customerId: id } }),
  // (decision: keep addresses for order audit — they live on Order.shippingAddress separately)
])
```

## Data flow

1. Page dispatcher reads `searchParams.tab` + `searchParams.range` → renders `AdminCustomersV2`.
2. KPI Suspense + table Suspense stream independently.
3. Range pill change → `router.push(\`?tab=${tab}&range=${range}\`)`.
4. Row click → `router.push(\`/admin/customers/${id}\`)` → V2 detail page.
5. Detail page widgets each await their loader; 9 independent Suspense boundaries (one per widget).
6. Inspector mutations call server actions → `revalidatePath`.
7. `anonymizeCustomer`: typed-confirm pattern (admin types exact email) + SUPER_ADMIN → atomic transaction → list view auto-filters anonymized rows next refresh.
8. `bulkGiftPoints` routes through `lib/loyalty/service.ts.awardPoints` per Phase 7 atomic pattern.

## Error handling

- All loaders return `null` / empty on missing data; widgets render empty-state.
- `anonymizeCustomer` rejects if `typedConfirmEmail !== customer.email` with "Confirmation email mismatch".
- `anonymizeCustomer` rejects via the `anonymizedAt: null` where-clause guard if already anonymized.
- `bulkGiftPoints` per-customer overdraft pre-check; failures collected, batch continues.
- `CustomerOrdersPanel` / `CustomerReviewsPanel` / `CustomerSupportTicketsPanel` paginate (10/page default).
- `deleteAddress` rejects if address is referenced by any unfulfilled Order (FK protection via try/catch).
- `setDefaultAddress` updates customer's chosen-default in a transaction.
- CSV export cap: 10,000 rows → over-cap returns `"Too many rows — narrow selection"`.

## Testing

Per-component test files using Vitest + @testing-library/react. Target ~150-180 tests.

- 1 KPI loader + 1 tab loader + 9 detail loaders test files (mocked Prisma)
- 1 actions test file (12 actions with mocked Prisma + mocked `lib/loyalty/service.ts`)
- 3 list component tests
- 9 detail widget tests
- 4 Inspector tests (Profile, Address, Note, AnonymizeConfirm)
- 1 list dispatcher test + 1 detail dispatcher test + 1 AdminCustomersV2 smoke + 1 AdminCustomerDetailV2 smoke

## Wave plan (drives the implementation plan)

| Wave | Tasks | Parallel? | Notes |
|---|---|---|---|
| W1 | Schema migration (anonymizedAt) + Data layer + Server actions | 3 parallel | Migration is small (single nullable column + index). Hand-authored SQL. |
| W2 | 3 list components (Table, Mobile card, BulkSheet) | 3 parallel | |
| W3 | 9 detail widgets | 9 parallel | Independent; each Suspense-wrappable |
| W4 | 4 Inspectors (Profile, Address, Note, AnonymizeConfirm) | 4 parallel | |
| W5 | List dispatcher + V1 list relocation + AdminCustomersV2 + TabPills + RangePills | Sequential, **opus** | Critical integration |
| W6 | Detail dispatcher + V1 detail relocation + AdminCustomerDetailV2 composition | Sequential, **opus** | Critical integration |
| W7 | Verification + QA doc | Sequential | Final |

~25 tasks total.

## Constraints (per master spec)

- Dark futurist + Linear Calm density.
- Mobile co-equal — list cards stack with long-press multi-select + swipe-left quick action.
- Per-widget Suspense boundaries with `revalidate = 60`.
- Branch naming `wave8p8/task-N-<short-name>`; worktree isolation on every Agent dispatch.
- Per-fix PRs — one focused commit per PR; controller batches per wave.
- Each subagent reads this spec + the plan for its specific task.
- No `dark:` Tailwind modifiers (PR #93 precedent).
- No Prisma in the client bundle (PR #92 precedent).
- `PaginatedResult` shape is `{ items, total, page, pageSize }` (Phase 3-7 precedent).
- Vitest 4.1.7: 1-arg `vi.fn<T>()` generics.
- All points mutations route through existing `lib/loyalty/service.ts` atomic ops (Phase 7 precedent).
- Hand-authored migration (no `prisma migrate dev` — P3006 shadow DB issue).

## Out of scope (deferred to Phase 8.5+)

- DB-backed Segment model + saved/custom segments (current segments are computed)
- `Customer.riskScore` + `Customer.isFlagged` (admin-set risk; current risk is computed read-only)
- "+ New Customer" admin-create flow
- Customer communications panel (sent emails/SMS history)
- Hard delete (currently anonymize-in-place only)
- Tag system (`CustomerTag` model)
- Bulk tier change (one-off via Phase 7 only)
- Bulk email (Phase 5 Marketing owns campaigns)
- Configurable VIP threshold (currently hard-coded `totalSpent >= 1000`)
- "Show anonymized" toggle in list view (current is filter-out-only)
