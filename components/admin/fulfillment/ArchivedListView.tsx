'use client'

/**
 * ArchivedListView — read-only list of CANCELLED + REFUNDED orders.
 *
 * Differences from OrdersListTable / OrdersListView:
 *  - No checkboxes (read-only — no selection)
 *  - No ⋯ action button (no inspector)
 *  - No onRefresh / onSelect props (nothing mutates)
 *  - Each row links to /admin/fulfillment/:id (full detail page)
 *  - Status pills use muted tones (CANCELLED = neutral, REFUNDED = rose-tinted)
 *  - Mobile: horizontally scrollable table (no duplicate markup, no swipe actions)
 *
 * Phase 4 Task 11 (Wave 5).
 */

import Link from 'next/link'
import type { OrderRow } from '@/lib/admin/fulfillment'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArchivedListViewProps {
  /** Pre-filtered CANCELLED + REFUNDED rows (filtering done by loadArchivedTab). */
  rows: OrderRow[]
  /** Show loading skeletons instead of rows. */
  loading?: boolean
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  CANCELLED: 'bg-white/5 text-white/40 border border-white/10',
  REFUNDED:  'bg-rose-500/10 text-rose-300/80 border border-rose-500/20',
}

const PAYMENT_PILL: Record<string, string> = {
  REFUNDED: 'bg-rose-500/10 text-rose-300/80',
  PAID:     'bg-emerald-500/10 text-emerald-400',
  FAILED:   'bg-red-500/15 text-red-400',
  PENDING:  'bg-amber-500/10 text-amber-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAmount(n: number): string {
  return `$${n.toFixed(2)}`
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-3 py-3">
        <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1.5">
          <div className="h-3 w-32 bg-white/5 animate-pulse rounded" />
          <div className="h-2.5 w-40 bg-white/5 animate-pulse rounded" />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="h-5 w-24 bg-white/5 animate-pulse rounded-full" />
      </td>
      <td className="px-3 py-3">
        <div className="h-5 w-16 bg-white/5 animate-pulse rounded-full" />
      </td>
      <td className="px-3 py-3 text-right">
        <div className="h-3 w-14 bg-white/5 animate-pulse rounded ml-auto" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArchivedListView({ rows, loading = false }: ArchivedListViewProps) {
  // Empty state (not loading, no data)
  if (!loading && rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-white/40 border border-white/8 rounded-lg bg-neutral-900/40">
        No archived orders.
      </div>
    )
  }

  return (
    <div className="bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]" data-testid="archived-list-table">
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <thead className="bg-white/[0.02] sticky top-0 z-10">
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Order #
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Customer
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Payment
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/40">
                Total
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Created
              </th>
            </tr>
          </thead>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-white/[0.04]">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    data-testid="archived-table-row"
                    className="transition-colors hover:bg-white/[0.015]"
                  >
                    {/* Order number — links to full detail page */}
                    <td className="px-3 py-3 font-mono text-[11px] whitespace-nowrap">
                      <Link
                        href={`/admin/fulfillment/${row.id}`}
                        className="text-sky-300/80 hover:text-sky-200 transition-colors"
                      >
                        {row.orderNumber}
                      </Link>
                    </td>

                    {/* Customer */}
                    <td className="px-3 py-3">
                      <div className="font-semibold text-[11px] text-white/60 leading-tight">
                        {row.customerName ?? '—'}
                      </div>
                      <div className="text-[10px] text-white/35 mt-0.5">
                        {row.customerEmail}
                      </div>
                    </td>

                    {/* Order status pill — muted styling */}
                    <td className="px-3 py-3">
                      <span
                        className={[
                          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold',
                          STATUS_PILL[row.status] ?? 'bg-white/5 text-white/40',
                        ].join(' ')}
                      >
                        {row.status}
                      </span>
                    </td>

                    {/* Payment status pill — muted styling */}
                    <td className="px-3 py-3">
                      <span
                        className={[
                          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold',
                          PAYMENT_PILL[row.paymentStatus] ?? 'bg-white/5 text-white/40',
                        ].join(' ')}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="px-3 py-3 text-right text-xs text-white/50 tabular-nums whitespace-nowrap">
                      {formatAmount(row.totalAmount)}
                    </td>

                    {/* Created */}
                    <td className="px-3 py-3 text-[11px] text-white/40 whitespace-nowrap">
                      {formatDate(row.createdAt)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
