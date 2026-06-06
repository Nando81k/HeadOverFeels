# Phase 6: Analytics + Financial — Sub-spec

**Status:** Approved 2026-06-06. Hand off to writing-plans.

**Parent spec:** `docs/superpowers/specs/2026-05-30-admin-rebuild-design.md`
**Sibling specs:** Phase 2 (Dashboard), Phase 3 (Products & Drops), Phase 4 (Fulfillment), Phase 5 (Marketing) — all shipped.

## Goal

Build a new V2 `/admin/analytics` umbrella page that unifies the existing `/admin/analytics`, `/admin/financial`, `/admin/sales`, `/admin/expenses`, `/admin/goals`, and `/admin/live-feed` V1 pages into a single 6-tab analytics + financial experience. Reuse all existing Prisma models — zero migrations.

## Decisions table

| # | Decision | Choice |
|---|---|---|
| 1 | Tab structure | **C** — 6 tabs: `overview` · `sales` · `customers` · `products` · `financial` · `expenses`. Goals folded into Overview (Inspector). Live-feed folded into Sales tab as sidebar. |
| 2a | KPI strip (4) | **B** — period-rolling Revenue / Orders / AOV / Gross Margin %, all respecting active date range with trend vs previous period. Cards click → matching tab pre-filtered. |
| 2b | Date range UX | **i** — URL-persisted `?range=today\|7d\|30d\|90d\|year` pill row, sticky at top of every tab, defaults to `30d`. Custom date picker deferred to Phase 6.5. |
| 3a | Chart palette | **B (standard)** — every tab earns its existence with 2-4 charts: Overview (4), Sales (2 + live feed), Customers (3), Products (2), Financial (3), Expenses (2). All Recharts (already installed). |
| 3b | Drill-down | **i** — row click → Inspector; KPI card click → navigate to matching tab (date filter preserved); chart point click → updates date range to that bucket, stays on tab. |
| 4a | Expense entry | **A** — Inspector slide-out (create + edit), reuses Phase 3/4/5 Inspector primitive. Categories from `ExpenseCategory` table. |
| 4b | Export | **i** — CSV export button per tab (6 actions). Phase 4 BulkExportCsv precedent: ActionResult<{ csv }> + client Blob download. |
| 4c | Goals editing | **I** — small "Edit goals" affordance in Overview tab opens GoalsInspector with the singleton `SalesGoals` row (5 targets). Phase 2's dashboard widget continues to read the same singleton read-only. |
| 4d | Financial period concept | **β** — continuous timeline charts + Financial tab's "By Period" 12-month P&L grid using `FinancialSnapshot` rows. Lazy backfill: missing periods get computed on read and UPSERT'd. |
| 4e | Cross-page integration | **x** — defer. No Marketing performance tab. Promotions/popups stay in Phase 5 Marketing umbrella. |

## Architecture

### Routing + dispatcher pattern (mirrors Phase 5)

```
app/admin/analytics/page.tsx                          ← dispatcher (V1 stub vs V2 root)
components/admin/_v1/AdminAnalyticsV1.tsx             ← stub linking to existing V1 pages
components/admin/dashboard/AdminAnalyticsV2.tsx       ← V2 root composition
components/admin/dashboard/AnalyticsTabPills.tsx      ← client wrapper around TabPills
components/admin/dashboard/AnalyticsRangePills.tsx    ← client wrapper for ?range= pill row
```

The 5 sibling V1 pages (`/admin/financial`, `/admin/sales`, `/admin/expenses`, `/admin/goals`, `/admin/live-feed`) stay intact and unmodified. The V1 stub on the V2 list page links to them as fallback while the flag is off — Phase 5 Marketing umbrella precedent.

The original `app/admin/analytics/page.tsx` (595L) gets extracted to `components/admin/_v1/AdminAnalyticsV1Page.tsx` as a verbatim relocation so the V1 stub can offer "Open V1 analytics" as one of its links (instead of a redirect to the same dispatched URL).

### V2 root composition (`AdminAnalyticsV2`)

```
AdminLayout
├── AnalyticsTabPills (6 tabs)
├── AnalyticsRangePills (5 ranges)
├── AnalyticsKpiStrip (Suspense) — 4 StatCards with period-rolling values + trend, each <Link href={`?tab=${target}&range=${range}`}>
└── Main content slot (Suspense per tab)
    ├── overview    → <OverviewTab range={range} />
    ├── sales       → <SalesTab range={range} />
    ├── customers   → <CustomersTab range={range} />
    ├── products    → <ProductsTab range={range} />
    ├── financial   → <FinancialTab range={range} />
    └── expenses    → <ExpensesTab range={range} filters={parsedFilters} />
```

Each tab is its own async server-component function so Suspense boundaries stream independently. Charts inside each tab can also be individually Suspense-wrapped for finer streaming when their loaders are expensive.

## Schema additions

**Zero new models.** Everything needed exists in `prisma/schema.prisma`:

- `Order` — financial fields (`subtotal`, `shipping`, `tax`, `total`, `discount`, `paymentStatus`)
- `OrderItem.price` + `ProductVariant.costPrice` + `Product.costPrice` — for gross margin computation
- `Customer` — cohort-friendly fields (`createdAt`, `loyaltyTierId`, `totalSpent`, `totalOrders`, `avgOrderValue`, `lastOrderDate`)
- `Expense` — full accounting model with `categoryId`, `amount`, `date`, `vendor`, `receiptUrl`, `isTaxDeductible`, `paymentMethod`, `status` (RECORDED/PENDING_APPROVAL/APPROVED/REJECTED/PAID), `invoiceId` FK
- `ExpenseCategory` — 11 categories already seeded (MANUFACTURING, SHIPPING, MARKETING, PACKAGING, PLATFORM_FEES, HOSTING, LABOR, UTILITIES, SUPPLIES, RETURNS_REFUNDS, OTHER)
- `Budget` — category budget with thresholds (`warningThreshold`, `criticalThreshold`)
- `Invoice` — vendor invoice with status (DRAFT/PENDING/PAID/OVERDUE/CANCELLED)
- `TaxRecord` — periodic tax records (MONTHLY/QUARTERLY/YEARLY) with `grossRevenue`, `taxableRevenue`, `salesTaxCollected`, `netIncome`, `estimatedTaxLiability`
- `SalesGoals` — singleton (`id = "default"`) with 5 targets (daily, weekly, monthly, quarterly, yearly)
- `SalesGoalHistory` — historical period actuals
- `FinancialSnapshot` — currently unused; Phase 6 starts populating it lazily. Fields: `date`, `periodType`, `totalRevenue`, `totalOrders`, `avgOrderValue`, `totalCOGS`, `totalExpenses`, `grossProfit`, `grossMargin`, `netProfit`, `netMargin`, `salesTaxCollected`, `inventoryValue`, `cashOnHand`. Unique on `(date, periodType)`.

**Lazy `FinancialSnapshot` backfill:** `loadFinancialPeriodGrid` checks for existing rows matching `(date, periodType)`; missing periods get computed from Orders + Expenses + ProductVariant.costPrice and UPSERT'd. Backfill is idempotent and fault-tolerant — a failed period skips silently with a server log.

**Deferred to Phase 6.5+:**
- Custom date range picker UI (`?from=`/`?to=`)
- Nightly cron to pre-populate `FinancialSnapshot`
- Per-tab attribution joins (UTM → revenue, promotion → revenue)
- TaxRecord workflow page (filing/payment lifecycle)
- Expense receipts upload / OCR
- Marketing performance tab cross-over (promotion redemption ROI)

## Components

### Page roots — `components/admin/dashboard/`

| File | Role |
|---|---|
| `AdminAnalyticsV2.tsx` | Server-component root composing TabPills + RangePills + KPI strip + tab Suspense slots |
| `AnalyticsTabPills.tsx` | Client wrapper around `TabPills` primitive; `router.push(\`?tab=${id}&range=${range}\`)` |
| `AnalyticsRangePills.tsx` | Client wrapper for the 5-range pill row; preserves `?tab=` when switching range |

### Tab components — `components/admin/analytics/`

| File | Content |
|---|---|
| `OverviewTab.tsx` | 4 charts (RevenueTrendChart, OrdersBarChart, CustomerAcquisitionChart, OrderStatusDonut) + Goals card with "Edit goals" button → GoalsInspector |
| `SalesTab.tsx` | RevenueTrendChart + TopProductsBar + LiveFeedSidebar (right column on desktop, collapsed accordion on mobile) |
| `CustomersTab.tsx` | CustomerAcquisitionChart + CohortTable + LTV scatter chart + paginated customer table (rows open CustomerInspector) |
| `ProductsTab.tsx` | TopProductsBar + MarginScatter + paginated product table (rows open ProductInspector) |
| `FinancialTab.tsx` | RevenueExpenseArea + MarginTrendChart + Tax Summary card (last 4 quarters from TaxRecord) + PeriodGridTable (12-month P&L) |
| `ExpensesTab.tsx` | ExpenseCategoryDonut + ExpenseMonthlyBar + paginated expense table (rows open ExpenseInspector) + "+ New Expense" button (opens ExpenseInspector in create mode) |

### Chart components — `components/admin/analytics/charts/`

All thin Recharts wrappers. Each accepts a typed dataset prop + optional empty-state fallback. Mocked via `vi.mock('recharts')` in tests (jsdom doesn't support canvas).

| File | Recharts type |
|---|---|
| `RevenueTrendChart.tsx` | `<LineChart>` |
| `OrdersBarChart.tsx` | `<BarChart>` |
| `CustomerAcquisitionChart.tsx` | `<AreaChart>` (stacked: new vs returning) |
| `OrderStatusDonut.tsx` | `<PieChart>` (donut variant) |
| `TopProductsBar.tsx` | `<BarChart>` (horizontal) |
| `MarginScatter.tsx` | `<ScatterChart>` (price × margin %) |
| `RevenueExpenseArea.tsx` | `<AreaChart>` (stacked: revenue + expenses) |
| `MarginTrendChart.tsx` | `<LineChart>` |
| `ExpenseCategoryDonut.tsx` | `<PieChart>` |
| `ExpenseMonthlyBar.tsx` | `<BarChart>` |

### Inspectors — `components/admin/analytics/inspectors/`

| File | Editable / read-only scope |
|---|---|
| `ExpenseInspector.tsx` | Full Expense form (category select, amount, date, description, vendor, paymentMethod, isTaxDeductible, taxCategory, notes, receiptUrl). Create + edit modes. |
| `GoalsInspector.tsx` | Edit SalesGoals singleton (5 targets: daily/weekly/monthly/quarterly/yearly). On save, logs prior values into SalesGoalHistory. |
| `CustomerInspector.tsx` | Read-only customer summary (email, name, signup date, lifetime spend, order count, AOV, loyalty tier, last order). "Open customer profile →" link for Phase 8. |
| `ProductInspector.tsx` | Read-only top-seller summary (name, image, units sold in range, revenue, gross margin, cost). "Open product details →" link to `/admin/products/[id]`. |

### Utility components — `components/admin/analytics/`

| File | Role |
|---|---|
| `LiveFeedSidebar.tsx` | Lifts V1's `RealTimeSalesFeed` component (Sales tab right column on desktop, collapsed accordion on mobile). 5s refresh interval. |
| `PeriodGridTable.tsx` | 12-month P&L grid using `FinancialSnapshot` rows. Columns: period · revenue · COGS · gross profit · expenses · net profit · margin %. Triggers lazy backfill on render if rows missing. |
| `CohortTable.tsx` | Signup-month × order-count cohort heat-grid (12 months back). Cell intensity scales with count. |
| `ExportButton.tsx` | Per-tab CSV download button. Wraps `exportTabCsv(tabName, range)` server action. Client Blob + a.download. |

## Data layer — `lib/admin/analytics.ts` (new)

Reuses Phase 2's helpers from `lib/admin/dashboard.ts`:
- `getRangeBounds(range, ref)` → `{ start, end, previousStart, previousEnd }`
- `buildTrend(current, previous)` → `{ direction, text }`
- `TimeRange` type — `'today' | '7d' | '30d' | '90d' | 'year'`

```ts
// KPI strip
loadAnalyticsKpis(range: TimeRange): Promise<AnalyticsKpiData>
// { revenue, revenueTrend, orders, ordersTrend, aov, aovTrend, grossMarginPct, marginTrend }

// Tab-specific aggregates (all accept range)
loadOverviewData(range): Promise<OverviewData>
loadSalesData(range): Promise<SalesData>
loadCustomersData(range): Promise<CustomersData>
loadProductsData(range): Promise<ProductsData>
loadFinancialData(range): Promise<FinancialData>
loadExpensesData(range, filters?): Promise<ExpensesData>

// Detail loaders (Inspector)
loadExpenseDetail(id: string): Promise<ExpenseDetailFull | null>
loadCustomerDetail(id: string): Promise<CustomerDetailFull | null>
loadProductFinancialDetail(id: string): Promise<ProductFinancialDetailFull | null>

// Period grid (lazy backfill)
loadFinancialPeriodGrid(periodType: 'monthly', count?: number): Promise<FinancialSnapshotRow[]>

// Sales goals
loadSalesGoalsForInspector(): Promise<SalesGoalsRow>
```

Hot paths use `prisma.aggregate` + `groupBy` + parallel `Promise.all()`. Target sub-200ms for Overview + Sales loaders.

## Server actions — `app/admin/analytics/actions.ts` (new)

```ts
// Expenses (CRUD)
createExpense(input: CreateExpenseInput): ActionResult<{ id: string }>
updateExpense(id: string, input: UpdateExpenseInput): ActionResult
deleteExpense(id: string): ActionResult                          // SUPER_ADMIN
getExpenseDetailForInspector(id: string): Promise<ExpenseDetailFull | null>

// Sales goals
updateSalesGoals(input: UpdateSalesGoalsInput): ActionResult     // updates singleton + appends SalesGoalHistory inside $transaction
getSalesGoalsForInspector(): Promise<SalesGoalsRow>

// Per-tab CSV export
exportOverviewCsv(range: TimeRange): ActionResult<{ csv: string }>
exportSalesCsv(range: TimeRange): ActionResult<{ csv: string }>
exportCustomersCsv(range: TimeRange): ActionResult<{ csv: string }>
exportProductsCsv(range: TimeRange): ActionResult<{ csv: string }>
exportFinancialCsv(range: TimeRange): ActionResult<{ csv: string }>
exportExpensesCsv(range: TimeRange, filters?: ExpenseFilters): ActionResult<{ csv: string }>

// Inspector data wrappers (Prisma-out-of-client-bundle pattern)
getCustomerDetailForInspector(id: string): Promise<CustomerDetailFull | null>
getProductFinancialDetailForInspector(id: string): Promise<ProductFinancialDetailFull | null>
```

~14 server actions. `requireAdmin()` for all; `requireAdminRole('SUPER_ADMIN')` for `deleteExpense`. CSV cap at 10,000 rows (returns error if exceeded — "Narrow the date range").

Inspector wrappers inline their Prisma queries during W1 parallel-safety (don't import from data layer being built in parallel). Refactor deferred to Phase 6.5.

## Data flow

1. Page dispatcher reads `searchParams.tab` + `searchParams.range` → renders `AdminAnalyticsV2`.
2. Each tab slot awaits its specific `load*Data(range)`; outer page `revalidate = 60`.
3. Range pill change → `router.push(\`?tab=${currentTab}&range=${newRange}\`)` → page re-streams with new bounds (caches per tab+range pair).
4. KPI card click → `router.push(\`?tab=${target}&range=${range}\`)`.
5. Chart point click → `router.push(\`?tab=${currentTab}&range=custom&from=${bucketStart}&to=${bucketEnd}\`)` — though `custom` range is deferred to Phase 6.5; v1 ships chart-click as a no-op with TODO comment.
6. Inspector mutations call server actions → `revalidatePath('/admin/analytics')`.
7. `loadFinancialPeriodGrid` lazy-backfill: for each missing period in `(date, 'monthly')`, compute + `prisma.financialSnapshot.upsert()`. Done inside a `Promise.allSettled` batch — partial failures don't block the rest.
8. CSV export: action returns `{ csv: string }`; client triggers Blob + a.download (Phase 4/5 precedent).

## Error handling

- All loaders return `null` (or empty datasets) on missing data; tabs render empty-state with friendly copy.
- `updateSalesGoals` wrapped in `$transaction` — singleton update + SalesGoalHistory insert atomic.
- `deleteExpense` checks `invoiceId` FK; if linked to an Invoice, returns `{ ok: false, error: 'Expense linked to invoice; remove from invoice first' }`.
- CSV exports cap at 10,000 rows; over-cap returns `{ ok: false, error: 'Too many rows — narrow the date range' }`.
- Chart components render an empty placeholder if dataset is `[]` (no Recharts crash on empty data).
- `loadFinancialPeriodGrid` backfill errors logged but don't block the response — partial grid returns.

## Testing

Per-component test files using Vitest + @testing-library/react. **Recharts components mocked via `vi.mock('recharts')` returning bare divs** (jsdom doesn't support canvas; this is the standard Recharts test pattern). Target ~180-220 tests across the phase.

- 1 KPI loader + 6 tab data loaders + 4 detail loaders + 1 period grid loader test files (mocked Prisma)
- 1 actions test file (~14 actions with mocked Prisma + mocked Stripe placeholder if any)
- 6 Tab component tests (rendering with mocked data + Inspector trigger + ExportButton presence)
- 10 chart component tests (props + empty state + clickable point handler)
- 4 Inspector tests (open/close + form submit + validation + onSaved/onMutated callback)
- 4 utility component tests (LiveFeedSidebar, PeriodGridTable, CohortTable, ExportButton)
- 1 dispatcher test (vi.resetModules() pattern) + 1 AdminAnalyticsV2 smoke test (tree-walking pattern for async server components)

## Wave plan

| Wave | Tasks | Parallel? | Notes |
|---|---|---|---|
| W1 | Data layer (`lib/admin/analytics.ts`) + Server actions (`actions.ts`) | 2 parallel | No schema migration; reuses Phase 2 helpers |
| W2 | 10 chart components | 10 parallel | All thin Recharts wrappers; independent |
| W3 | 4 Inspectors + 4 utility components | 8 parallel | Independent |
| W4 | 6 Tab components | 6 parallel | Depend on W2 + W3 |
| W5 | AdminAnalyticsV2 root + V1 stub + AnalyticsTabPills + AnalyticsRangePills + page dispatcher | Sequential, **opus** | Critical integration |
| W6 | Verification + QA doc | Sequential | Final |

~24 tasks total. Chart-heavy with 10 thin wrappers in W2. Comparable to Phase 5 (24 tasks).

## Constraints (per master spec)

- Dark futurist + Linear Calm density.
- Mobile co-equal — charts stack vertically, tables → mobile cards with long-press/swipe, full-screen Inspector.
- Per-widget Suspense boundaries with `revalidate = 60`.
- Branch naming `wave6p6/task-N-<short-name>`; worktree isolation on every Agent dispatch.
- Per-fix PRs — one focused commit per PR; controller batches per wave.
- Each subagent reads this spec + the plan for its specific task.
- No `dark:` Tailwind modifiers (PR #93 precedent).
- No Prisma in the client bundle (PR #92 precedent).
- `PaginatedResult` shape is `{ items, total, page, pageSize }` (Phase 3/4/5 precedent).
- Vitest 4.1.7: 1-arg `vi.fn<T>()` generics.
- Recharts mocked in tests via `vi.mock('recharts')`.

## Out of scope (deferred to Phase 6.5+)

- Custom date range picker (popover calendar with `?from=`/`?to=`)
- Nightly cron to pre-populate `FinancialSnapshot` (lazy backfill is v1)
- Per-tab attribution joins (UTM → revenue, promotion → revenue)
- Marketing performance cross-over tab
- TaxRecord workflow page (filing/payment lifecycle)
- Expense receipt upload / OCR
- Budget alerts (warning/critical threshold notifications)
- Geographic distribution / hourly heatmap charts
- Inventory valuation chart (FinancialSnapshot.inventoryValue surfaces, but no dedicated viz)
- Real-time chart updates via Socket.IO
