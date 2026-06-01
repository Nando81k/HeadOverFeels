import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadMarketingKpis,
  loadPromotionsTab,
  loadPopupsTab,
  loadSubscribersTab,
  loadCampaignsTab,
  loadAbandonedCartsTab,
  isMarketingTab,
  type MarketingTab,
} from '@/lib/admin/marketing'
import { PromotionsListView } from '@/components/admin/marketing/PromotionsListView'
import { PopupsListView } from '@/components/admin/marketing/PopupsListView'
import { SubscribersListView } from '@/components/admin/marketing/SubscribersListView'
import { CampaignsListView } from '@/components/admin/marketing/CampaignsListView'
import { AbandonedCartsListView } from '@/components/admin/marketing/AbandonedCartsListView'
import { MarketingTabPills } from './MarketingTabPills'

interface Props {
  searchParams: { tab?: string }
  /** Resolved by the page dispatcher from the current session; forwarded to SubscribersListView (PII Delete gate). */
  isSuperAdmin: boolean
}

const TAB_CONFIG: ReadonlyArray<{ id: MarketingTab; label: string }> = [
  { id: 'promotions', label: 'Promotions' },
  { id: 'popups', label: 'Popups' },
  { id: 'subscribers', label: 'Subscribers' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'abandoned-carts', label: 'Abandoned Carts' },
]

function parseTab(raw: string | undefined): MarketingTab {
  return isMarketingTab(raw) ? raw : 'promotions'
}

// ─── Slot wrappers (each is its own await so Suspense can stream) ─────────────

async function KpiStripSlot() {
  const k = await loadMarketingKpis()
  const deltaText = k.subscriberDeltaPct
    ? `${k.subscriberDeltaPct > 0 ? '+' : ''}${k.subscriberDeltaPct.toFixed(0)}% this week`
    : undefined
  const deltaDirection: 'up' | 'down' | 'flat' =
    k.subscriberDeltaPct > 0 ? 'up' : k.subscriberDeltaPct < 0 ? 'down' : 'flat'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href="?tab=promotions" className="block">
        <StatCard
          label="Active Promotions"
          value={k.activePromotions}
          variant={k.activePromotions === 0 ? 'warning' : 'default'}
        />
      </Link>
      <Link href="?tab=popups" className="block">
        <StatCard label="Popup Conv (7d)" value={k.popupConversions7d} />
      </Link>
      <Link href="?tab=subscribers" className="block">
        <StatCard
          label="Subscribers"
          value={k.subscriberCount}
          trend={deltaText ? { direction: deltaDirection, text: deltaText } : undefined}
        />
      </Link>
      <Link href="?tab=abandoned-carts" className="block">
        <StatCard
          label="Carts to Recover"
          value={k.cartsToRecover}
          variant={k.cartsToRecover > 5 ? 'warning' : 'default'}
        />
      </Link>
    </div>
  )
}

async function PromotionsSlot() {
  const r = await loadPromotionsTab()
  return <PromotionsListView rows={r.items} />
}

async function PopupsSlot() {
  const r = await loadPopupsTab()
  return <PopupsListView rows={r.items} />
}

async function SubscribersSlot({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const r = await loadSubscribersTab()
  return <SubscribersListView rows={r.items} isSuperAdmin={isSuperAdmin} />
}

async function CampaignsSlot() {
  const r = await loadCampaignsTab()
  return <CampaignsListView rows={r.items} />
}

async function AbandonedCartsSlot() {
  const r = await loadAbandonedCartsTab()
  return <AbandonedCartsListView rows={r.items} />
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

export async function AdminMarketingV2({ searchParams, isSuperAdmin }: Props) {
  const currentTab = parseTab(searchParams.tab)

  return (
    <AdminLayout title="Marketing" subtitle="Promotions, popups, subscribers, campaigns, carts">
      <div className="space-y-3.5">
        <MarketingTabPills tabs={TAB_CONFIG} active={currentTab} />

        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiStripSlot />
        </Suspense>

        {/* TODO(phase-5.5): real filter bar (search, type/template/status filters, date range) */}
        <div className="text-xs text-white/40 mb-4">Filter bar — Phase 5.5</div>

        {currentTab === 'promotions' ? (
          <Suspense fallback={<ListSkeleton />}>
            <PromotionsSlot />
          </Suspense>
        ) : currentTab === 'popups' ? (
          <Suspense fallback={<ListSkeleton />}>
            <PopupsSlot />
          </Suspense>
        ) : currentTab === 'subscribers' ? (
          <Suspense fallback={<ListSkeleton />}>
            <SubscribersSlot isSuperAdmin={isSuperAdmin} />
          </Suspense>
        ) : currentTab === 'campaigns' ? (
          <Suspense fallback={<ListSkeleton />}>
            <CampaignsSlot />
          </Suspense>
        ) : (
          <Suspense fallback={<ListSkeleton />}>
            <AbandonedCartsSlot />
          </Suspense>
        )}
      </div>
    </AdminLayout>
  )
}
