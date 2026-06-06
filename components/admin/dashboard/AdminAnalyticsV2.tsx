import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadAnalyticsKpis,
  loadOverviewData,
  loadSalesData,
  loadCustomersData,
  loadProductsData,
  loadFinancialData,
  loadExpensesData,
  isAnalyticsTab,
  isTimeRange,
  type AnalyticsTab,
  type TimeRange,
} from '@/lib/admin/analytics'
import { prisma } from '@/lib/prisma'
import { OverviewTab } from '@/components/admin/analytics/tabs/OverviewTab'
import { SalesTab } from '@/components/admin/analytics/SalesTab'
import { CustomersTab } from '@/components/admin/analytics/CustomersTab'
import { ProductsTab } from '@/components/admin/analytics/tabs/ProductsTab'
import { FinancialTab } from '@/components/admin/analytics/FinancialTab'
import { ExpensesTab } from '@/components/admin/analytics/tabs/ExpensesTab'
import type { ExpenseCategoryOption } from '@/components/admin/analytics/inspectors/ExpenseInspector'
import { AnalyticsTabPills } from './AnalyticsTabPills'
import { AnalyticsRangePills } from './AnalyticsRangePills'

interface Props {
  searchParams: { tab?: string; range?: string }
  /** Resolved by the page dispatcher from the current session; forwarded to ExpensesTab. */
  isSuperAdmin: boolean
}

const TAB_CONFIG: ReadonlyArray<{ id: AnalyticsTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products' },
  { id: 'financial', label: 'Financial' },
  { id: 'expenses', label: 'Expenses' },
]

const RANGE_CONFIG: ReadonlyArray<{ id: TimeRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'year', label: 'Year' },
]

const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const fmtNumber = new Intl.NumberFormat('en-US')

function parseTab(raw: string | undefined): AnalyticsTab {
  return isAnalyticsTab(raw) ? raw : 'overview'
}

function parseRange(raw: string | undefined): TimeRange {
  return isTimeRange(raw) ? raw : '30d'
}

// ─── Slot wrappers (each is its own await so Suspense can stream) ─────────────

async function KpiStripSlot({ range }: { range: TimeRange }) {
  const k = await loadAnalyticsKpis(range)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href={`?tab=sales&range=${range}`} className="block">
        <StatCard label="Revenue" value={fmtCurrency.format(k.revenue)} trend={k.revenueTrend} />
      </Link>
      <Link href={`?tab=sales&range=${range}`} className="block">
        <StatCard label="Orders" value={fmtNumber.format(k.orders)} trend={k.ordersTrend} />
      </Link>
      <Link href={`?tab=sales&range=${range}`} className="block">
        <StatCard label="AOV" value={fmtCurrency.format(k.aov)} trend={k.aovTrend} />
      </Link>
      <Link href={`?tab=financial&range=${range}`} className="block">
        <StatCard
          label="Gross Margin"
          value={`${k.grossMarginPct.toFixed(1)}%`}
          trend={k.marginTrend}
        />
      </Link>
    </div>
  )
}

async function OverviewSlot({ range }: { range: TimeRange }) {
  const d = await loadOverviewData(range)
  return <OverviewTab data={d} range={range} />
}

async function SalesSlot({ range }: { range: TimeRange }) {
  const d = await loadSalesData(range)
  return <SalesTab data={d} range={range} />
}

async function CustomersSlot({ range }: { range: TimeRange }) {
  const d = await loadCustomersData(range)
  return <CustomersTab data={d} range={range} />
}

async function ProductsSlot({ range }: { range: TimeRange }) {
  const d = await loadProductsData(range)
  return <ProductsTab data={d} range={range} />
}

async function FinancialSlot({ range }: { range: TimeRange }) {
  const d = await loadFinancialData(range)
  return <FinancialTab data={d} range={range} />
}

async function ExpensesSlot({
  range,
  categories,
  isSuperAdmin,
}: {
  range: TimeRange
  categories: ExpenseCategoryOption[]
  isSuperAdmin: boolean
}) {
  const d = await loadExpensesData(range)
  return (
    <ExpensesTab
      data={d}
      range={range}
      categories={categories}
      isSuperAdmin={isSuperAdmin}
    />
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TabSkeleton() {
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

// ─── Main component ───────────────────────────────────────────────────────────

export async function AdminAnalyticsV2({ searchParams, isSuperAdmin }: Props) {
  const currentTab = parseTab(searchParams.tab)
  const currentRange = parseRange(searchParams.range)

  // Load expense categories once at the V2 boundary (per plan coverage gap #3)
  // so the ExpensesTab slot doesn't repeat the same lookup on every render.
  const categoryRows = await prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, color: true },
  })
  const categories: ExpenseCategoryOption[] = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
  }))

  return (
    <AdminLayout
      title="Analytics"
      subtitle="Sales, customers, products, financial, expenses"
    >
      <div className="space-y-3.5">
        <AnalyticsTabPills tabs={TAB_CONFIG} active={currentTab} range={currentRange} />

        <AnalyticsRangePills ranges={RANGE_CONFIG} active={currentRange} tab={currentTab} />

        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiStripSlot range={currentRange} />
        </Suspense>

        {currentTab === 'overview' ? (
          <Suspense fallback={<TabSkeleton />}>
            <OverviewSlot range={currentRange} />
          </Suspense>
        ) : currentTab === 'sales' ? (
          <Suspense fallback={<TabSkeleton />}>
            <SalesSlot range={currentRange} />
          </Suspense>
        ) : currentTab === 'customers' ? (
          <Suspense fallback={<TabSkeleton />}>
            <CustomersSlot range={currentRange} />
          </Suspense>
        ) : currentTab === 'products' ? (
          <Suspense fallback={<TabSkeleton />}>
            <ProductsSlot range={currentRange} />
          </Suspense>
        ) : currentTab === 'financial' ? (
          <Suspense fallback={<TabSkeleton />}>
            <FinancialSlot range={currentRange} />
          </Suspense>
        ) : (
          <Suspense fallback={<TabSkeleton />}>
            <ExpensesSlot
              range={currentRange}
              categories={categories}
              isSuperAdmin={isSuperAdmin}
            />
          </Suspense>
        )}
      </div>
    </AdminLayout>
  )
}
