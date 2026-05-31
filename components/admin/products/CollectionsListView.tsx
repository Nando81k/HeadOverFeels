'use client'

/**
 * CollectionsListView — grid of collection cards for the admin products page.
 *
 * Renders a responsive grid of CollectionListItem cards with:
 *   - Collection thumbnail (primaryImage or placeholder gradient)
 *   - Collection name
 *   - Product count badge
 *   - Last-updated date
 *   - "Edit" action button per card
 *   - Empty state when no collections exist
 *   - Loading skeletons while data is fetching
 *
 * Phase 3 Task 9 — Collections tab sub-view.
 */

import Image from 'next/image'
import type { CollectionListItem } from '@/lib/admin/products'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionsListViewProps {
  /** Collections to render. */
  collections: CollectionListItem[]
  /** Called when "Edit" is clicked for a collection. */
  onEdit?: (id: string) => void
  /** Show loading skeletons instead of cards. */
  loading?: boolean
  /** Number of skeleton cards while loading. Default: 6. */
  skeletonCount?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CollectionThumbnail({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <div className="w-full aspect-video rounded-md overflow-hidden bg-white/5 border border-white/8">
        <Image
          src={src}
          alt={name}
          width={320}
          height={180}
          className="object-cover w-full h-full"
          unoptimized
        />
      </div>
    )
  }
  return (
    <div
      className="w-full aspect-video rounded-md bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/8"
      aria-hidden
    />
  )
}

function SkeletonCard() {
  return (
    <div className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3">
      <div className="w-full aspect-video bg-white/5 animate-pulse rounded-md" />
      <div className="space-y-2">
        <div className="h-3.5 w-3/4 bg-white/5 animate-pulse rounded" />
        <div className="h-3 w-1/3 bg-white/5 animate-pulse rounded" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Grid-layout collections viewer.
 * Used inside the Collections sub-tab of the admin products page.
 */
export function CollectionsListView({
  collections,
  onEdit,
  loading = false,
  skeletonCount = 6,
}: CollectionsListViewProps) {
  if (loading) {
    return (
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="collections-list-loading"
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-white/35">
        No collections found.
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid="collections-list"
    >
      {collections.map((col) => (
        <div
          key={col.id}
          className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3 group hover:border-white/16 transition-colors"
          data-testid="collection-card"
        >
          {/* Thumbnail */}
          <CollectionThumbnail src={col.primaryImage} name={col.name} />

          {/* Details */}
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white leading-tight truncate">{col.name}</p>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-white/50 border border-white/8">
                {col.productCount} {col.productCount === 1 ? 'product' : 'products'}
              </span>
            </div>
            <p className="text-[11px] text-white/35">Updated {formatDate(col.updatedAt)}</p>
          </div>

          {/* Action */}
          <button
            type="button"
            onClick={() => onEdit?.(col.id)}
            aria-label={`Edit ${col.name}`}
            className="w-full py-1.5 rounded-md text-[11px] font-semibold text-white/50 border border-white/8 hover:border-white/20 hover:text-white/80 transition-colors"
          >
            Edit
          </button>
        </div>
      ))}
    </div>
  )
}
