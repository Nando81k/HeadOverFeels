# Phase 8: Customers QA

**Status:** Ready for QA — all 22 tasks (Waves 1a–7) merged to `main`.
**Phase plan:** `docs/superpowers/plans/2026-05-30-admin-rebuild-phase8-customers.md`
**Phase spec:** `docs/superpowers/specs/2026-05-30-admin-rebuild-phase8-customers.md`

## Scope

New V2 `/admin/customers` umbrella (5 segment tabs: All / VIP / At-Risk / Inactive / Recent)
+ V2 `/admin/customers/[id]` detail (header + 9 widgets + 4 inspectors), gated behind
`NEXT_PUBLIC_ADMIN_V2_ENABLED`. V1 list + detail relocated verbatim to `/admin/customers-v1`
(+ `/[id]`). One schema migration (`Customer.anonymizedAt`) for GDPR right-to-erasure.

## Pre-flight (captured on merged `main`)

- `npx tsc --noEmit` → **0 new errors**. Zero tsc errors in any Phase 8 file. The ~12 files
  that still error are all pre-existing and unrelated to this phase (marketing campaign edit
  page, admin-audit-logs / audit-logs / fulfillment-decision / loyalty-tiers API routes,
  fulfillment OrdersListView + ReturnsListView, avatar AvatarModel, stripe config, the
  backfill-returns script, and the ProductsListView + rma-counter test files).
- `npx vitest run` (full suite) → **1366 passed / 1399 total**. The 33 failures live in 9
  pre-existing suites with **no Phase 8 involvement** (fulfillment-queue-grid,
  fulfillment-case-drawer, navigation-dropdown, product-page-client,
  navigation-mobile-menu-cart-widget, collections-page, products-page-filters,
  profile-page-tabs, ProductsListView). Verified by re-running those 9 suites at the
  pre-Phase-8 baseline (`df54b96`): **identical 33 failures / 6 errors** — Phase 8 introduced
  **zero** new test failures.
- Phase 8 customer suites in isolation → **23 test files / 102 tests, all green**
  (schema migration, data layer, server actions, 3 list components, 9 detail widgets,
  4 inspectors, V2 list root + dispatcher, V2 detail root + dispatcher).
- `npx eslint` (Phase 8 files) → **0 errors, 1 warning**: `@next/next/no-img-element` in
  `CustomerHeader.tsx:32` (profile-picture `<img>`). Tracked as Phase 8.5 polish.

## List page smoke checklist (NEXT_PUBLIC_ADMIN_V2_ENABLED=true)

- [ ] /admin/customers loads with tab=all + range=30d by default
- [ ] Switching to each tab updates the URL: all / vip / at-risk / inactive / recent
- [ ] Range pills update ?range=…; KPI strip refreshes within Suspense
- [ ] KPI card clicks deep-link to matching tab (Total→all, New→recent, Avg LTV→vip, At-risk→at-risk)
- [ ] Desktop row click → /admin/customers/[id]
- [ ] Desktop checkbox toggles selection; header checkbox toggles all
- [ ] Mobile (md:hidden) cards: tap navigates when no selection; long-press 500ms enters multi-select; swipe-left reveals Gift action (SUPER_ADMIN only)
- [ ] BulkSheet appears when selection > 0; shows count
- [ ] Gift Points form (SUPER_ADMIN): delta + reason validation; success toast; selection clears
- [ ] Export CSV: downloads .csv; success toast; over-cap (>10k) returns "narrow selection" error
- [ ] Anonymize bulk action DISABLED in v1 (tooltip: per-customer only; bulk shipping Phase 8.5)
- [ ] Anonymized customers do NOT appear in list (default `anonymizedAt: null` filter)

## Detail page smoke checklist

- [ ] /admin/customers/[id] streams header first, then 8 widgets independently (per-widget Suspense)
- [ ] CustomerHeader: profile picture / initials fallback; tier badge; Active/Anonymized pill; ⋯ menu opens; Edit Profile + Anonymize hidden/disabled when anonymized
- [ ] ProfileEditInspector: form pre-filled; email disabled; save persists; toast + close
- [ ] CustomerOrdersPanel: orders listed; row link → /admin/fulfillment/[orderId]
- [ ] CustomerLoyaltyPanel: tier + balances + last 10 ledger; deep link → /admin/loyalty?tab=members&member=…
- [ ] CustomerReviewsPanel: reviews listed; row link → /admin/reviews/[id]
- [ ] CustomerSupportTicketsPanel: tickets listed; row link → /admin/support/[id]
- [ ] CustomerAddressesPanel: addresses listed; Default badge; + Add opens AddressInspector; Edit pre-fills; Delete confirms (FK-violation → "referenced by orders" error); Set Default succeeds
- [ ] AddressInspector: uses firstName/lastName/address1/state/postalCode field names; AddressType select works
- [ ] CustomerNotesPanel: notes listed; isImportant star renders; + Add opens NoteInspector; Edit pre-fills; Delete confirms
- [ ] NoteInspector: isImportant checkbox persists
- [ ] CustomerActivityTimeline: chronological merge of order/points/review/support events; href events become links
- [ ] CustomerRiskWidget: refundRate/returnRate/chargebacks/avgDaysToReturn; High-risk badge when refundRate > 20% OR chargebacks > 0
- [ ] Anonymize (SUPER_ADMIN): typed-confirm modal; Confirm disabled until typed email matches (case-insensitive, trimmed); on success customer PII scrubbed, orders/loyalty/addresses preserved
- [ ] /admin/customers/[missing-id] returns 404 (notFound)

## Cross-link checks

- [ ] V1 fallback: NEXT_PUBLIC_ADMIN_V2_ENABLED=false → /admin/customers shows V1 stub; /admin/customers-v1 shows original V1 list; /admin/customers-v1/[id] shows V1 detail (936L CustomerDetailClient unchanged)
- [ ] Order row → Phase 4 order detail
- [ ] Loyalty deep link → Phase 7 Members tab with MemberInspector open
- [ ] Review row → Phase 3 review detail
- [ ] Support row → existing V1 support page (Phase 9 will rebuild)

## Regression risk register

- Any change to `Customer` schema or its relations re-validates loaders + actions.
- Any change to `lib/loyalty/service.ts.awardPoints` must preserve the idempotencyKey contract used by `bulkGiftPoints` (`gift-${batchId}-${customerId}`).
- Any change to `Address` field names breaks `AddressInspector` + `loadCustomerAddresses`.
- Any change to `CustomerNote.isImportant` breaks `NoteInspector` + `loadCustomerNotes`.
- Removing the `anonymizedAt` column breaks all list loaders (they reference it directly).
- The V2 list/detail dispatchers resolve `isSuperAdmin` via `getSession()` + `prisma.customer.adminRole`; changes to the session shape or the `adminRole` enum re-validate both dispatchers.

## Phase 8.5 follow-ups

In-code markers found via grep (`Phase 8.5` / `TODO(8.5)` / `deferred to 8.5`):

- `app/admin/customers/actions.ts:24` — `getCustomerHeaderForRefresh` inlines its own Prisma query (W1b parallel-safety); refactor to reuse `loadCustomerHeader` deferred to Phase 8.5.
- `components/admin/customers/CustomersBulkSheet.tsx:12` — bulk Anonymize action documented as v1-disabled; bulk shipping in Phase 8.5.
- `components/admin/customers/CustomersBulkSheet.tsx:109` — the disabled Anonymize button's tooltip ("Per-customer anonymize only in v1; bulk shipping Phase 8.5").

Planned backlog (not yet marked in code):

- `CustomerHeader` profile picture uses `<img>` (lint warning) — migrate to `next/image`.
- Sortable list-table columns.
- URL-plumbed pagination for ordersPage / reviewsPage / ticketsPage on detail widgets.
- DB-backed Segment model + saved/custom segments.
- `Customer.riskScore` + `Customer.isFlagged` (admin-set risk).
- "+ New Customer" admin-create flow.
- Customer communications panel (sent emails/SMS history).
- Hard delete option (currently anonymize-only).
- Tag system (`CustomerTag` model).
- Bulk anonymize action (currently per-customer only — gated UI in BulkSheet).
- Configurable VIP threshold (currently hard-coded `totalSpent >= 1000`).
- "Show anonymized" toggle in list view.
