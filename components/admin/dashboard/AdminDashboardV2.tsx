import { Suspense } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  loadHeroRevenue,
  loadKpiStrip,
  loadNeedsAttention,
  loadSalesGoals,
  loadInitialActivity,
  type TimeRange,
} from '@/lib/admin/dashboard'
import { HeroRevenue } from './HeroRevenue'
import { KpiStrip } from './KpiStrip'
import { NeedsAttention } from './NeedsAttention'
import { SalesGoals } from './SalesGoals'
import { LiveActivityFeed } from './LiveActivityFeed'
import {
  KpiStripSkeleton,
  LiveActivityFeedSkeleton,
  SalesGoalsSkeleton,
  NeedsAttentionSkeleton,
} from './skeletons'
import { HeroMetricSkeleton } from '@/components/ui/skeleton'

interface Props {
  searchParams: { range?: string }
}

const RANGES: ReadonlyArray<TimeRange> = ['today', 'week', 'month', 'year']

function parseRange(raw: string | undefined): TimeRange {
  return RANGES.includes(raw as TimeRange) ? (raw as TimeRange) : 'today'
}

// Server-component child wrappers (each is its own await so Suspense can stream)
async function HeroRevenueSlot({ range }: { range: TimeRange }) {
  const data = await loadHeroRevenue(range)
  return <HeroRevenue data={data} range={range} />
}

async function KpiStripSlot({ range }: { range: TimeRange }) {
  const data = await loadKpiStrip(range)
  return <KpiStrip data={data} />
}

async function NeedsAttentionSlot() {
  const alerts = await loadNeedsAttention()
  return <NeedsAttention initialAlerts={alerts} />
}

async function SalesGoalsSlot() {
  const data = await loadSalesGoals()
  return <SalesGoals data={data} />
}

async function LiveActivityFeedSlot() {
  const items = await loadInitialActivity(5)
  return <LiveActivityFeed initialItems={items} />
}

export async function AdminDashboardV2({ searchParams }: Props) {
  const range = parseRange(searchParams.range)

  return (
    <AdminLayout title="Dashboard" subtitle="Today's snapshot">
      <div className="space-y-3.5">
        <Suspense fallback={<HeroMetricSkeleton />}>
          <HeroRevenueSlot range={range} />
        </Suspense>

        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiStripSlot range={range} />
        </Suspense>

        {/* Mobile order: needs-attention before activity (urgency-first) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-3">
          {/* Right column (desktop) / 2nd on mobile actually goes first - use Tailwind order */}
          <div className="space-y-3 order-2 lg:order-1">
            <Suspense fallback={<LiveActivityFeedSkeleton />}>
              <LiveActivityFeedSlot />
            </Suspense>
            <Suspense fallback={<SalesGoalsSkeleton />}>
              <SalesGoalsSlot />
            </Suspense>
          </div>
          <div className="order-1 lg:order-2">
            <Suspense fallback={<NeedsAttentionSkeleton />}>
              <NeedsAttentionSlot />
            </Suspense>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
