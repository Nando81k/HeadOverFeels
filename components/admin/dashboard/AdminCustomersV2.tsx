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
