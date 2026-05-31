import { Suspense } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadProductsKpis,
  loadProductsTab,
  loadCollections,
  loadReviewsList,
  isProductsTab,
  type ProductsTab,
} from '@/lib/admin/products'
import { ProductsListView } from '@/components/admin/products/ProductsListView'
import { CollectionsListView } from '@/components/admin/products/CollectionsListView'
import { ReviewsListView } from '@/components/admin/products/ReviewsListView'
import { ProductsTabPills } from './ProductsTabPills'
import { KpiStripSkeleton } from './skeletons'

interface Props {
  searchParams: { tab?: string }
}

const TAB_CONFIG: ReadonlyArray<{ id: ProductsTab; label: string }> = [
  { id: 'all', label: 'All Products' },
  { id: 'drops', label: 'Active Drops' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'collections', label: 'Collections' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'archived', label: 'Archived' },
]

function parseTab(raw: string | undefined): ProductsTab {
  return isProductsTab(raw) ? raw : 'all'
}

// ─── Slot wrappers (each is its own await so Suspense can stream) ─────────────

async function KpiStripSlot() {
  const data = await loadProductsKpis()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <StatCard label="Active" value={data.active} />
      <StatCard label="Drops Live" value={data.dropsLive} />
      <StatCard label="Low Stock" value={data.lowStock} variant="warning" />
      <StatCard label="Drafts" value={data.drafts} />
    </div>
  )
}

async function ProductsListTabSlot({ tab }: { tab: ProductsTab }) {
  const result = await loadProductsTab(tab)
  return <ProductsListView rows={result.items} />
}

async function CollectionsListSlot() {
  const collections = await loadCollections()
  return <CollectionsListView collections={collections} />
}

async function ReviewsListSlot() {
  const result = await loadReviewsList()
  return <ReviewsListView reviews={result.items} />
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

// ─── Main component ───────────────────────────────────────────────────────────

export async function AdminProductsV2({ searchParams }: Props) {
  const currentTab = parseTab(searchParams.tab)

  return (
    <AdminLayout title="Products" subtitle="Catalog, drops, collections, and reviews">
      <div className="space-y-3.5">
        <ProductsTabPills tabs={TAB_CONFIG} active={currentTab} />

        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiStripSlot />
        </Suspense>

        {/* TODO(phase-3.5): real filter bar (search, category, status, tag, sort) */}
        <div className="text-xs text-white/40 mb-4">Filter bar — Phase 3.5</div>

        {currentTab === 'collections' ? (
          <Suspense fallback={<ListSkeleton />}>
            <CollectionsListSlot />
          </Suspense>
        ) : currentTab === 'reviews' ? (
          <Suspense fallback={<ListSkeleton />}>
            <ReviewsListSlot />
          </Suspense>
        ) : (
          <Suspense fallback={<ListSkeleton />}>
            <ProductsListTabSlot tab={currentTab} />
          </Suspense>
        )}
      </div>
    </AdminLayout>
  )
}
