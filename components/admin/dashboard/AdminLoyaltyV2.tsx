import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadLoyaltyKpis,
  loadOverviewData,
  loadMembersTab,
  loadTiersTab,
  loadRewardsTab,
  loadRedemptionsTab,
  loadEventsTab,
  loadLoyaltySettings,
  isLoyaltyTab,
  isTimeRange,
  type LoyaltyTab,
  type TimeRange,
} from '@/lib/admin/loyalty'
import { OverviewTab } from '@/components/admin/loyalty/tabs/OverviewTab'
import { MembersTab } from '@/components/admin/loyalty/tabs/MembersTab'
import { TiersTab } from '@/components/admin/loyalty/tabs/TiersTab'
import { RewardsTab } from '@/components/admin/loyalty/tabs/RewardsTab'
import { RedemptionsTab } from '@/components/admin/loyalty/tabs/RedemptionsTab'
import { EventsTab } from '@/components/admin/loyalty/tabs/EventsTab'
import { LoyaltySettingsButton } from '@/components/admin/loyalty/LoyaltySettingsButton'
import { LoyaltyTabPills } from './LoyaltyTabPills'
import { LoyaltyRangePills } from './LoyaltyRangePills'

interface Props {
  searchParams: { tab?: string; range?: string }
  /** Resolved by the page dispatcher from the current session; forwarded to
   * MembersTab/TiersTab/RedemptionsTab so they can gate privileged actions. */
  isSuperAdmin: boolean
}

const TAB_CONFIG: ReadonlyArray<{ id: LoyaltyTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'tiers', label: 'Tiers' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'redemptions', label: 'Redemptions' },
  { id: 'events', label: 'Events' },
]

const RANGE_CONFIG: ReadonlyArray<{ id: TimeRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'year', label: 'Year' },
]

const fmtNumber = new Intl.NumberFormat('en-US')

function parseTab(raw: string | undefined): LoyaltyTab {
  return isLoyaltyTab(raw) ? raw : 'overview'
}

function parseRange(raw: string | undefined): TimeRange {
  return isTimeRange(raw) ? raw : '30d'
}

// ─── Slot wrappers (each is its own await so Suspense can stream) ─────────────

async function KpiStripSlot({ range }: { range: TimeRange }) {
  const k = await loadLoyaltyKpis(range)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href={`?tab=members&range=${range}`} className="block">
        <StatCard label="Active Members" value={fmtNumber.format(k.activeMembers)} />
      </Link>
      <Link href={`?tab=overview&range=${range}`} className="block">
        <StatCard
          label="Points Earned"
          value={fmtNumber.format(k.pointsEarned)}
          trend={k.pointsEarnedTrend}
        />
      </Link>
      <Link href={`?tab=overview&range=${range}`} className="block">
        <StatCard
          label="Points Redeemed"
          value={fmtNumber.format(k.pointsRedeemed)}
          trend={k.pointsRedeemedTrend}
        />
      </Link>
      <Link href={`?tab=redemptions&range=${range}`} className="block">
        <StatCard
          label="Redemption Rate"
          value={`${k.redemptionRate.toFixed(1)}%`}
          trend={k.redemptionRateTrend}
        />
      </Link>
    </div>
  )
}

async function OverviewSlot({ range }: { range: TimeRange }) {
  const data = await loadOverviewData(range)
  return <OverviewTab data={data} range={range} />
}

async function MembersSlot({
  range,
  isSuperAdmin,
}: {
  range: TimeRange
  isSuperAdmin: boolean
}) {
  const data = await loadMembersTab()
  return <MembersTab data={data} range={range} isSuperAdmin={isSuperAdmin} />
}

async function TiersSlot({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const tiers = await loadTiersTab()
  return <TiersTab tiers={tiers} isSuperAdmin={isSuperAdmin} />
}

async function RewardsSlot({ range }: { range: TimeRange }) {
  const data = await loadRewardsTab()
  return <RewardsTab data={data} range={range} />
}

async function RedemptionsSlot({
  range,
  isSuperAdmin,
}: {
  range: TimeRange
  isSuperAdmin: boolean
}) {
  const data = await loadRedemptionsTab(range)
  return <RedemptionsTab data={data} range={range} isSuperAdmin={isSuperAdmin} />
}

async function EventsSlot({ range }: { range: TimeRange }) {
  const data = await loadEventsTab()
  return <EventsTab data={data} range={range} />
}

async function SettingsBtnSlot() {
  const settings = await loadLoyaltySettings()
  return <LoyaltySettingsButton settings={settings} />
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-16 bg-white/[0.03] border border-white/8 rounded-md animate-pulse"
        />
      ))}
    </div>
  )
}

function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-20 bg-white/[0.03] border border-white/8 rounded-md animate-pulse"
        />
      ))}
    </div>
  )
}

function SettingsButtonSkeleton() {
  return (
    <div
      aria-hidden
      className="w-16 h-7 bg-white/[0.03] border border-white/8 rounded-md animate-pulse"
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export async function AdminLoyaltyV2({ searchParams, isSuperAdmin }: Props) {
  const currentTab = parseTab(searchParams.tab)
  const currentRange = parseRange(searchParams.range)

  return (
    <AdminLayout
      title="Loyalty"
      subtitle="Overview, members, tiers, rewards, redemptions, events"
    >
      <div className="space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <LoyaltyTabPills tabs={TAB_CONFIG} active={currentTab} range={currentRange} />
          <div className="flex items-center gap-2">
            <LoyaltyRangePills
              ranges={RANGE_CONFIG}
              active={currentRange}
              tab={currentTab}
            />
            <Suspense fallback={<SettingsButtonSkeleton />}>
              <SettingsBtnSlot />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiStripSlot range={currentRange} />
        </Suspense>

        {currentTab === 'overview' ? (
          <Suspense fallback={<TabSkeleton />}>
            <OverviewSlot range={currentRange} />
          </Suspense>
        ) : currentTab === 'members' ? (
          <Suspense fallback={<TabSkeleton />}>
            <MembersSlot range={currentRange} isSuperAdmin={isSuperAdmin} />
          </Suspense>
        ) : currentTab === 'tiers' ? (
          <Suspense fallback={<TabSkeleton />}>
            <TiersSlot isSuperAdmin={isSuperAdmin} />
          </Suspense>
        ) : currentTab === 'rewards' ? (
          <Suspense fallback={<TabSkeleton />}>
            <RewardsSlot range={currentRange} />
          </Suspense>
        ) : currentTab === 'redemptions' ? (
          <Suspense fallback={<TabSkeleton />}>
            <RedemptionsSlot range={currentRange} isSuperAdmin={isSuperAdmin} />
          </Suspense>
        ) : (
          <Suspense fallback={<TabSkeleton />}>
            <EventsSlot range={currentRange} />
          </Suspense>
        )}
      </div>
    </AdminLayout>
  )
}
