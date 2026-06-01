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
  { id: 'all',          label: 'All Orders' },
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

// ─── Slot wrappers (each is its own await so Suspense can stream) ─────────────

async function KpiStripSlot() {
  const k = await loadFulfillmentKpis()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href="?tab=needs-action" className="block">
        <StatCard
          label="Needs Action"
          value={k.needsActionCount}
          variant={k.needsActionCount > 0 ? 'warning' : 'default'}
        />
      </Link>
      <Link href="?tab=processing" className="block">
        <StatCard label="Ready to Ship" value={k.readyToShipCount} />
      </Link>
      <Link href="?tab=all" className="block">
        <StatCard label="Today's Revenue" value={`$${k.todaysRevenue.toFixed(2)}`} />
      </Link>
      <Link href="?tab=returns" className="block">
        <StatCard label="Returns Pending" value={k.returnsPendingCount} />
      </Link>
    </div>
  )
}

async function OrdersListTabSlot({ tab }: { tab: OrdersTab }) {
  const result = await loadOrdersTab(tab)
  return <OrdersListView rows={result.items} />
}

async function ReturnsListSlot() {
  const result = await loadReturnsTab()
  return <ReturnsListView rows={result.items} />
}

async function ArchivedListSlot() {
  const result = await loadArchivedTab()
  return <ArchivedListView rows={result.items} />
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export async function AdminFulfillmentV2({ searchParams }: Props) {
  const currentTab = parseTab(searchParams.tab)

  return (
    <AdminLayout title="Fulfillment" subtitle="Orders, returns, and refunds">
      <div className="space-y-3.5">
        <FulfillmentTabPills tabs={TAB_CONFIG} active={currentTab} />

        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiStripSlot />
        </Suspense>

        {/* TODO(phase-4.5): real filter bar (search, date range, payment, carrier, has-tracking) */}
        <div className="text-xs text-white/40 mb-4">Filter bar — Phase 4.5</div>

        {currentTab === 'returns' ? (
          <Suspense fallback={<ListSkeleton />}>
            <ReturnsListSlot />
          </Suspense>
        ) : currentTab === 'archived' ? (
          <Suspense fallback={<ListSkeleton />}>
            <ArchivedListSlot />
          </Suspense>
        ) : (
          <Suspense fallback={<ListSkeleton />}>
            <OrdersListTabSlot tab={currentTab} />
          </Suspense>
        )}

        <NewOrderToast />
      </div>
    </AdminLayout>
  )
}
