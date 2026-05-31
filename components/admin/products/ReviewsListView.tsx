'use client'

/**
 * ReviewsListView — admin reviews tab with inline approve/reject actions.
 *
 * Renders a scrollable list of ReviewItem rows. Each row shows:
 *   - Customer name + star rating
 *   - Review title + body excerpt
 *   - Product name + SKU
 *   - Status pill (PENDING / APPROVED / REJECTED / FLAGGED)
 *   - REPORTED badge (inert — isReported always false per current schema)
 *   - Inline Approve / Reject buttons (only shown for PENDING rows)
 *   - Date
 *
 * Phase 3 Task 11.
 */

import { useState, useTransition } from 'react'
import type { ReviewItem } from '@/lib/admin/products'
import { approveReview, rejectReview } from '@/app/admin/products/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewsListViewProps {
  /** Reviews to display. */
  reviews: ReviewItem[]
  /** Show loading skeletons instead of rows. */
  loading?: boolean
  /** Number of skeleton rows while loading. Default: 5. */
  skeletonRows?: number
  /**
   * Called after a successful approve or reject so the parent can
   * refresh the list (e.g., invalidate server data).
   */
  onMutated?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-[11px] text-amber-400 tracking-tight">
      {'★'.repeat(Math.max(0, Math.min(5, rating)))}
      {'☆'.repeat(Math.max(0, 5 - Math.min(5, rating)))}
    </span>
  )
}

function StatusPill({ status }: { status: ReviewItem['status'] }) {
  const map: Record<ReviewItem['status'], { label: string; className: string }> = {
    PENDING: {
      label: 'Pending',
      className: 'bg-amber-500/15 text-amber-400',
    },
    APPROVED: {
      label: 'Approved',
      className: 'bg-emerald-500/10 text-emerald-400',
    },
    REJECTED: {
      label: 'Rejected',
      className: 'bg-red-500/10 text-red-400',
    },
    FLAGGED: {
      label: 'Flagged',
      className: 'bg-orange-500/10 text-orange-400',
    },
  }

  const { label, className } = map[status] ?? map.PENDING

  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${className}`}
    >
      {label}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <li
      aria-hidden
      className="px-4 py-4 border-b border-white/[0.05] animate-pulse space-y-2"
    >
      <div className="flex items-center gap-3">
        <div className="h-3 w-28 bg-white/5 rounded" />
        <div className="h-3 w-16 bg-white/5 rounded" />
      </div>
      <div className="h-3 w-48 bg-white/5 rounded" />
      <div className="h-2.5 w-64 bg-white/5 rounded" />
      <div className="flex items-center gap-2 mt-1">
        <div className="h-5 w-14 bg-white/5 rounded-full" />
        <div className="h-5 w-16 bg-white/5 rounded" />
        <div className="h-5 w-16 bg-white/5 rounded" />
      </div>
    </li>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface ReviewRowProps {
  review: ReviewItem
  onMutated?: () => void
}

function ReviewRow({ review, onMutated }: ReviewRowProps) {
  const [isPending, startTransition] = useTransition()
  const [rowError, setRowError] = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState<ReviewItem['status']>(review.status)

  function handleApprove() {
    setRowError(null)
    startTransition(async () => {
      const result = await approveReview(review.id)
      if (result.ok) {
        setLocalStatus('APPROVED')
        onMutated?.()
      } else {
        setRowError(result.error)
      }
    })
  }

  function handleReject() {
    setRowError(null)
    startTransition(async () => {
      const result = await rejectReview(review.id)
      if (result.ok) {
        setLocalStatus('REJECTED')
        onMutated?.()
      } else {
        setRowError(result.error)
      }
    })
  }

  return (
    <li
      data-testid="review-row"
      className={[
        'px-4 py-4 border-b border-white/[0.05] transition-colors',
        isPending ? 'opacity-60 pointer-events-none' : 'hover:bg-white/[0.02]',
      ].join(' ')}
    >
      {/* Top row: customer + rating + date */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold text-white/90 truncate">
            {review.customerName}
          </span>
          <StarRating rating={review.rating} />
          {/* REPORTED badge — inert in current schema (isReported always false) */}
          {review.isReported && (
            <span
              data-testid="reported-badge"
              className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-red-600/20 text-red-400"
            >
              Reported
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/30 shrink-0">{formatDate(review.createdAt)}</span>
      </div>

      {/* Review title */}
      {review.title && (
        <p className="text-[11px] font-medium text-white/80 mb-0.5 truncate">{review.title}</p>
      )}

      {/* Review body excerpt */}
      {review.body && (
        <p className="text-[10px] text-white/45 leading-relaxed line-clamp-2 mb-2">
          {review.body}
        </p>
      )}

      {/* Product info */}
      <p className="text-[10px] text-white/35 mb-2">
        <span className="text-white/50">{review.productName}</span>
        {review.productSku && (
          <span className="font-mono ml-1 text-white/30">· {review.productSku}</span>
        )}
      </p>

      {/* Status + actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusPill status={localStatus} />

        {localStatus === 'PENDING' && (
          <>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              aria-label={`Approve review by ${review.customerName}`}
              className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              aria-label={`Reject review by ${review.customerName}`}
              className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}

        {rowError && (
          <span role="alert" className="text-[10px] text-red-400 ml-1">
            {rowError}
          </span>
        )}
      </div>
    </li>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewsListView({
  reviews,
  loading = false,
  skeletonRows = 5,
  onMutated,
}: ReviewsListViewProps) {
  if (loading) {
    return (
      <ul
        aria-label="Reviews loading"
        className="bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden"
      >
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </ul>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="bg-neutral-900/60 border border-white/8 rounded-lg px-4 py-10 text-center text-sm text-white/35">
        No reviews found.
      </div>
    )
  }

  return (
    <ul
      aria-label="Reviews list"
      className="bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden"
    >
      {reviews.map((review) => (
        <ReviewRow key={review.id} review={review} onMutated={onMutated} />
      ))}
    </ul>
  )
}
