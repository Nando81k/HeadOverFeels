# Admin Rebuild — Phase 6: Analytics + Financial QA Findings

**Date:** 2026-05-31
**Phase 6 PRs:** #141 (data layer), #142 (server actions), #143 RevenueTrendChart, #144 RevenueExpenseArea, #145 OrdersBarChart, #146 ExpenseMonthlyBar, #147 OrderStatusDonut, #148 CustomerAcquisitionChart, #149 ExpenseCategoryDonut, #150 TopProductsBar, #151 MarginTrendChart, #152 MarginScatter, #153 CohortTable, #154 LiveFeedSidebar, #155 PeriodGridTable, #156 ExpenseInspector, #157 CustomerInspector, #158 ExportButton, #159 GoalsInspector, #160 ProductInspector, #161 SalesTab, #162 OverviewTab, #163 CustomersTab, #164 ExpensesTab, #165 ProductsTab, #166 FinancialTab, #167 AdminAnalyticsV2 + V1 stub + AnalyticsTabPills + AnalyticsRangePills + dispatcher + analytics-v1 page

---

## Summary

Phase 6 ships the complete V2 `/admin/analytics` umbrella page: six tabs (Overview, Sales, Customers, Products, Financial, Expenses) with a KPI strip, 10 Recharts chart components, 4 Inspectors (Expense, Goals, Customer, Product), 4 utility components (LiveFeedSidebar, PeriodGridTable, CohortTable, ExportButton), and 14 server actions — all gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED` with zero schema migrations. Before flipping the flag, run through the smoke-test checklist below to confirm each sub-tab renders its charts and inspectors, CSV exports fire, the goals editor writes back, and the six legacy V1 analytics pages remain accessible when the flag is off.

---

## How to enable Phase 6

Add to `.env.local`:

```
NEXT_PUBLIC_ADMIN_V2_ENABLED=true
```

Restart the dev server (`pnpm dev`). Phases 1 through 6 all activate together under the single flag. The six legacy V1 analytics pages (`/admin/analytics-v1`, `/admin/financial`, `/admin/sales`, `/admin/expenses`, `/admin/goals`, `/admin/live-feed`) remain accessible regardless of the flag — they are not modified.

---

## Smoke test checklist

### Before you start

- [ ] `NEXT_PUBLIC_ADMIN_V2_ENABLED=true` in `.env.local`, dev server restarted
- [ ] Sign in as an admin user
- [ ] Navigate to `/admin/analytics`

---

### Shared controls (test before diving into tabs)

**AnalyticsTabPills**
- [ ] Six tab pills render: Overview / Sales / Customers / Products / Financial / Expenses
- [ ] Clicking a tab updates `?tab=` in the URL and renders the correct content
- [ ] Keyboard shortcut hints display (⌘1 through ⌘6 labels rendered by `showShortcutHints`)
- [ ] Pressing ⌘1–⌘6 (or equivalent shortcut) jumps to the corresponding tab

**AnalyticsRangePills**
- [ ] Five range pills render: Today / 7d / 30d / 90d / Year (default is 30d)
- [ ] Clicking a range updates `?range=` in the URL and re-fetches all charts
- [ ] Current `?tab=` is preserved when switching range (URL has both params)
- [ ] Navigating directly to `?tab=sales&range=90d` renders the Sales tab with 90-day data

**KPI strip** (always visible, above tab content)
- [ ] Four stat cards: Revenue / Orders / AOV / Gross Margin
- [ ] Revenue card → links to `?tab=sales`; Gross Margin card → links to `?tab=financial`
- [ ] Trend arrows (up/down) reflect change vs previous period
- [ ] Cards show `$0` and neutral trend on an empty dataset rather than crashing

---

### Tab: Overview (`?tab=overview`)

**Expect:** KPI strip + four charts in a 2×2 grid + Goals target cards + GoalsInspector

- [ ] RevenueTrendChart renders a line chart with labeled x-axis dates
- [ ] OrdersBarChart renders a bar chart grouped by date
- [ ] CustomerAcquisitionChart renders a bar/line chart of new vs returning customers
- [ ] OrderStatusDonut renders a pie chart with status slices and a legend
- [ ] Goals target cards (Daily / Weekly / Monthly / Quarterly / Yearly) display formatted currency targets
- [ ] "Edit goals" button opens GoalsInspector slide-out
- [ ] GoalsInspector: edit `monthlyTarget` → **Save** → `updateSalesGoals` fires → toast confirms → values update on next load
- [ ] ExportButton visible; click triggers `exportOverviewCsv` → browser download of a `.csv` file
- [ ] **Mobile (375px):** charts stack in a single column; Goals cards wrap to two columns

---

### Tab: Sales (`?tab=sales`)

**Expect:** RevenueTrendChart + TopProductsBar + LiveFeedSidebar

- [ ] RevenueTrendChart shows revenue trend for selected range
- [ ] TopProductsBar shows top-N products by revenue as a horizontal bar chart
- [ ] LiveFeedSidebar renders in a right column (desktop) or stacks below charts (mobile)
- [ ] LiveFeedSidebar polls for recent orders/events; items appear within 30 s of a real order
- [ ] LiveFeedSidebar internal accordion toggle (mobile) collapses/expands the feed
- [ ] ExportButton visible; `exportSalesCsv` downloads a CSV with order rows
- [ ] **Mobile (375px):** LiveFeedSidebar moves below charts and its accordion is collapsed by default

---

### Tab: Customers (`?tab=customers`)

**Expect:** CustomerAcquisitionChart + MarginScatter + CohortTable + CustomerInspector

- [ ] CustomerAcquisitionChart renders new vs returning customer bars for the selected range
- [ ] MarginScatter renders a scatter plot of customer vs margin data points
- [ ] CohortTable renders a matrix of cohort months × order buckets with colour-coded cells
- [ ] Click a customer row → CustomerInspector slide-out opens with customer summary
- [ ] CustomerInspector shows: name, email, loyalty tier, total spent, order count, AOV, last order date
- [ ] CustomerInspector shows a "View profile" link to `/admin/customers/[id]`
- [ ] CustomerInspector shows loading skeleton when data hasn't resolved yet
- [ ] ExportButton visible; `exportCustomersCsv` downloads a CSV
- [ ] **Mobile (375px):** CohortTable scrolls horizontally; MarginScatter occupies full width

---

### Tab: Products (`?tab=products`)

**Expect:** TopProductsBar + MarginScatter + ProductInspector

- [ ] TopProductsBar renders product revenue ranking bars
- [ ] MarginScatter renders margin vs volume scatter plot for products
- [ ] Click a product row → `getProductFinancialDetailForInspector` fires → ProductInspector opens
- [ ] ProductInspector shows: product name, SKU, revenue, COGS, gross margin %, units sold, AOV
- [ ] ProductInspector read-only; no edit fields (financial data is derived, not editable)
- [ ] `cogsCoveragePct` warning banner appears if < 100% of variants have cost prices set
- [ ] ExportButton visible; `exportProductsCsv` downloads a CSV
- [ ] **Mobile (375px):** charts stack; inspector slides up from bottom on mobile

---

### Tab: Financial (`?tab=financial`)

**Expect:** RevenueExpenseArea + MarginTrendChart + Tax Summary card + PeriodGridTable

- [ ] RevenueExpenseArea renders an area chart overlaying revenue and expense trends
- [ ] MarginTrendChart renders a line chart of gross margin % over time
- [ ] Tax Summary card displays total tax collected and a breakdown by period type (Monthly / Quarterly / Yearly)
- [ ] PeriodGridTable renders a date-period grid with revenue, expenses, and net columns
- [ ] PeriodGridTable lazy-backfills: on first visit, missing FinancialSnapshot rows are upserted — verify data appears (check DB `FinancialSnapshot` table counts before and after)
- [ ] PeriodGridTable shows last 12 months by default
- [ ] ExportButton visible; `exportFinancialCsv` downloads a CSV
- [ ] **Mobile (375px):** PeriodGridTable scrolls horizontally; area chart renders at full width

---

### Tab: Expenses (`?tab=expenses`)

**Expect:** ExpenseCategoryDonut + ExpenseMonthlyBar + expense table + ExpenseInspector

- [ ] ExpenseCategoryDonut renders a pie chart sliced by expense category with colour-coded cells
- [ ] ExpenseMonthlyBar renders a stacked bar chart of expense totals by month
- [ ] Expense rows are listed below with category badge, amount, date, status
- [ ] Click a row → `getExpenseDetailForInspector` fires → ExpenseInspector opens
- [ ] ExpenseInspector (create): click "New Expense" → form appears → fill fields → **Save** → `createExpense` fires → row appears in list
- [ ] ExpenseInspector (edit): open existing row → change amount or category → **Save** → `updateExpense` fires → row updates
- [ ] **SUPER_ADMIN delete gate:** as a non-SUPER_ADMIN admin, the Delete button is hidden in ExpenseInspector; as SUPER_ADMIN, the Delete button is visible and triggers `deleteExpense`
- [ ] ExportButton visible; `exportExpensesCsv` downloads a CSV
- [ ] **Mobile (375px):** donut and bar stack vertically; expense rows are full-width cards

---

### V1 fallback and legacy pages

- [ ] **Flag off:** set `NEXT_PUBLIC_ADMIN_V2_ENABLED=false` (or remove from `.env.local`), restart → `/admin/analytics` renders the V1 stub (six link cards for legacy pages)
- [ ] `/admin/analytics-v1` renders the original analytics dashboard content (line charts, KPI summary) — the URL route is a dedicated page, not gated by the flag
- [ ] `/admin/financial` renders V1 financial page (unmodified)
- [ ] `/admin/sales` renders V1 sales page (unmodified)
- [ ] `/admin/expenses` renders V1 expenses page (unmodified)
- [ ] `/admin/goals` renders V1 goals page (unmodified)
- [ ] `/admin/live-feed` renders V1 live feed page (unmodified)

---

## Known gaps / Phase 6.5 follow-ups

These items were explicitly deferred during Phase 6 implementation. Four `TODO(phase-6.5)` comments were found in chart components (see files below); additional plan-deferred items are listed.

### TODO(phase-6.5) comments found

| File | Line | Item |
|------|------|------|
| `components/admin/analytics/charts/RevenueTrendChart.tsx` | inline | Wire `onPointClick` to Recharts v3 `onClick` handler |
| `components/admin/analytics/charts/MarginScatter.tsx` | inline | Wire `onPointClick` to `ScatterChart` onClick handler |
| `components/admin/analytics/charts/CustomerAcquisitionChart.tsx` | inline | Wire click handler → drill-down date range |
| `components/admin/analytics/charts/OrdersBarChart.tsx` | inline | Wire click handler for bar drill-down |

### Plan-deferred items

- **Custom date range picker** — `?from=`/`?to=` query params for arbitrary date windows (currently only 5 preset ranges)
- **Nightly cron for FinancialSnapshot pre-population** — currently lazy-backfilled on first Financial tab visit; high-traffic installs should batch-populate nightly
- **Per-tab UTM attribution joins** — UTM parameters → revenue linkage deferred; `exportSalesCsv` rows do not include attribution source
- **Marketing performance cross-over tab** — ad spend vs revenue cross-tab linking Phase 5 marketing data with Phase 6 revenue
- **TaxRecord workflow page** — `TaxRecord` rows are visible in the tax summary card but there is no dedicated editor/workflow
- **Expense receipt upload / OCR** — `Expense.receiptUrl` is a nullable field; the Inspector has no file-upload widget yet
- **Budget alerts** — `Budget` model exists and is seeded but no alert threshold UI is exposed
- **Geographic distribution chart** — heatmap of orders by region/country
- **Hourly heatmap chart** — orders by hour-of-day (helps staffing decisions)
- **Inventory valuation chart** — `ProductVariant.costPrice × stockQuantity` aggregate chart
- **Real-time chart updates via Socket.IO** — charts currently refresh on page navigation; true push updates deferred
- **Inline-query refactor for `get*ForInspector` actions** — Wave 1 used inlined Prisma queries per the parallel-safe rule; these should be deduplicated against `lib/admin/analytics.ts` loaders in Phase 6.5

---

## Test coverage summary

Phase 6 ships **26 test files** covering all major components and the data layer:

| Category | Files | Tests |
|----------|-------|-------|
| Data layer (`lib/admin/analytics.ts`) | 1 | varies |
| Server actions (`app/admin/analytics/actions.ts`) | 1 | varies |
| Page dispatcher (`app/admin/analytics/page.tsx`) | 1 | varies |
| Chart components (10 charts) | 10 | varies |
| Utility components (CohortTable, LiveFeedSidebar, PeriodGridTable, ExportButton) | 4 | varies |
| Inspector components (4 inspectors) | 4 | varies |
| Tab components (OverviewTab, ProductsTab, ExpensesTab) | 3 | varies |
| Tab components (SalesTab, CustomersTab, FinancialTab) | 2 (in root analytics dir) | varies |
| **Total** | **26 files** | **125 passing** |

Run Phase 6 tests in isolation:

```bash
pnpm exec vitest run \
  "tests/unit/app/admin/analytics" \
  "tests/unit/components/admin/analytics" \
  "tests/unit/lib/admin/analytics"
```

All 26 Phase 6 test files pass: **125/125 tests green**.

---

## Regression risk

- **New DB tables:** NONE — zero Prisma migrations. Phase 6 reuses existing `Expense`, `ExpenseCategory`, `Budget`, `Invoice`, `TaxRecord`, `SalesGoals`, `SalesGoalHistory`, `FinancialSnapshot` models.
- **Existing V1 pages:** NOT modified — `/admin/financial`, `/admin/sales`, `/admin/expenses`, `/admin/goals`, `/admin/live-feed` are untouched.
- **`app/admin/analytics/page.tsx`:** replaced with a dispatcher (38 lines). Original 595-line V1 content preserved verbatim at `components/admin/_v1/AdminAnalyticsV1Page.tsx`, served via `/admin/analytics-v1`.
- **Existing API routes:** NOT modified — Phase 6 server actions wrap Prisma directly, they do not proxy existing `/api/admin/*` routes.
- **Phase 2 dashboard helpers:** NOT modified — `lib/admin/dashboard.ts`'s `TimeRange` and `getRangeBounds` are unchanged. Phase 6 defines its own `TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'` and `getRangeBounds` shim in `lib/admin/analytics.ts`.
- **Client bundle Prisma rule:** All `'use client'` components import only `type` from `lib/admin/analytics.ts`; runtime Prisma calls flow exclusively through server actions in `app/admin/analytics/actions.ts`.
- **`dark:` Tailwind modifier rule:** No `dark:` modifiers found in Phase 6 components. Always-dark palette uses `bg-neutral-*`, `text-white/50`, `border-white/8` direct classes.

---

## Lint / TypeScript status

### Phase 6 files (production + tests)

| Scope | Errors | Warnings |
|-------|--------|----------|
| Production (`components/admin/analytics/`, `app/admin/analytics/`, `lib/admin/analytics.ts`) | **0** | 0 |
| Tests (`tests/unit/**/analytics/**`) | 0 | 2 (unused import: `userEvent` in MarginScatter.test, `fireEvent` in TopProductsBar.test) |
| **Phase 6 total** | **0 errors** | **2 warnings** |

The 2 test warnings are unused import hints from `@testing-library/user-event` — cosmetic, do not affect runtime.

### Full codebase (for context — all pre-existing)

| Scope | Errors | Warnings |
|-------|--------|----------|
| Full lint (`pnpm lint`) | 496 errors | 313 warnings |
| Full TypeScript (`pnpm exec tsc --noEmit`) | 20 errors | — |

All 496 lint errors and 20 TypeScript errors are **pre-existing** and unrelated to Phase 6. Notable pre-existing issues:
- `tests/unit/stripe-refunds.test.ts` — `@typescript-eslint/no-explicit-any` (7 occurrences)
- `app/api/admin/admin-audit-logs/route.ts` — `AdminRole` / `verifyAdminRole` missing from `lib/auth/admin` exports (pre-Phase 6)
- `lib/stripe/config.ts` — Stripe API version mismatch (`2025-09-30.clover` vs `2025-10-29.clover`)
- `components/avatar/AvatarModel.tsx` — Three.js `Object3D` → `Mesh` type assertion errors

### Test suite (full)

| Scope | Files | Tests | Status |
|-------|-------|-------|--------|
| Phase 6 tests (isolated run) | 26 passed | 125 passed | **All green** |
| Full suite | 12 failed / 179 passed (191 total) | 36 failed / 1062 passed (1098 total) | Pre-existing failures |

The 12 failing test files in the full suite are all pre-existing regressions: `navigation-dropdown`, `navigation-mobile-menu-cart-widget`, `product-page-client`, `products-page-filters`, `profile-page-tabs`, `AdminLayout-dispatcher`, `components/admin/products/ProductsListView`, and others — none are Phase 6 files.

---

## Code consistency audit results

| Check | Result |
|-------|--------|
| Dispatcher imports V1 + V2 correctly | PASS — `AdminAnalyticsV1` from `_v1/`, `AdminAnalyticsV2` from `dashboard/` |
| All 6 tabs referenced by AdminAnalyticsV2 | PASS — OverviewTab, SalesTab, CustomersTab, ProductsTab, FinancialTab, ExpensesTab all in Suspense slots |
| All 10 charts referenced by tabs | PASS — all 10 chart components imported by at least one tab |
| All 4 Inspectors referenced by correct tab | PASS — ExpenseInspector→ExpensesTab; GoalsInspector→OverviewTab; CustomerInspector→CustomersTab; ProductInspector→ProductsTab |
| All 4 utility components referenced correctly | PASS — LiveFeedSidebar→SalesTab; PeriodGridTable→FinancialTab; CohortTable→CustomersTab; ExportButton in all 6 tabs |
| All 14 server actions have a consumer | PASS — 14 exported actions; all called by at least one component or passed through ExportButton switch |
| Single flag gate (`NEXT_PUBLIC_ADMIN_V2_ENABLED`) | PASS — only `app/admin/analytics/page.tsx` gates Phase 6; no additional flags |
| V1 legacy pages untouched | PASS — 6 routes confirmed present and unmodified |
| Tab path placement matches plan spec | PASS — SalesTab/CustomersTab/FinancialTab at `components/admin/analytics/`; OverviewTab/ProductsTab/ExpensesTab at `components/admin/analytics/tabs/` |
| No `dark:` Tailwind modifiers in Phase 6 | PASS — 0 occurrences |
| Responsive classes present | PASS — 15 occurrences of `sm:`, `grid-cols-*`, `overflow-x-auto` across Phase 6 components |
