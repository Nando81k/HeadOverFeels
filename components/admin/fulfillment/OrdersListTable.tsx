'use client'

/**
 * OrdersListTable — desktop order list for the admin fulfillment page.
 *
 * Renders a sticky-header table of OrderRow items with:
 *   - Checkbox bulk-select (header select-all + per-row)
 *   - Order number (monospace)
 *   - Customer name + email sub-line
 *   - Order status pill (PENDING/CONFIRMED/PROCESSING green-ish; SHIPPED blue; DELIVERED neutral; CANCELLED/REFUNDED muted)
 *   - Payment status pill (PAID green; FAILED red; PENDING amber; REFUNDED muted)
 *   - Total amount (right-aligned, tabular nums)
 *   - Created date
 *   - Tracking number (truncated with carrier tooltip)
 *   - ⋯ row-action button (calls onOpenInspector)
 *   - Loading skeletons + empty state
 *
 * Phase 4 Task 4 — desktop only (hidden md:block).
 * Mobile card list is a separate component (Task 5).
 */

import type { OrderRow } from '@/lib/admin/fulfillment'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrdersListTableProps {
  /** Rows to render. */
  rows: OrderRow[]
  /** Currently selected order ids. */
  selected: Set<string>
  /** Toggle a single row's selection. Called with (orderId, isNowChecked). */
  onSelect: (orderId: string, checked: boolean) => void
  /** Called when the ⋯ action button is clicked for a row. */
  onOpenInspector: (orderId: string) => void
  /** Toggle select-all. Called with isNowChecked. */
  onSelectAll?: (checked: boolean) => void
  /** Show loading skeleton rows instead of data. */
  loading?: boolean
  /** Number of skeleton rows while loading. Default: 8. */
  skeletonRows?: number
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  PENDING:    'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  CONFIRMED:  'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  PROCESSING: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  SHIPPED:    'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  DELIVERED:  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  CANCELLED:  'bg-white/5 text-white/40 border border-white/10',
  REFUNDED:   'bg-rose-500/10 text-rose-300/80 border border-rose-500/20',
}

const PAYMENT_PILL: Record<string, string> = {
  PAID:     'bg-emerald-500/10 text-emerald-400',
  FAILED:   'bg-red-500/15 text-red-400',
  PENDING:  'bg-amber-500/10 text-amber-300',
  REFUNDED: 'bg-rose-500/10 text-rose-300/80',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAmount(n: number): string {
  return `$${n.toFixed(2)}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-3 py-3 w-10">
        <div className="w-4 h-4 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-20 bg-white/5 animate-pulse rounded font-mono" />
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
      <td className="px-3 py-3">
        <div className="h-3 w-28 bg-white/5 animate-pulse rounded font-mono" />
      </td>
      <td className="px-3 py-3 w-10" />
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Desktop-only orders list table.
 * Hidden on mobile via `hidden md:block` — pair with OrdersListCardMobile for small viewports.
 */
export function OrdersListTable({
  rows,
  selected,
  onSelect,
  onOpenInspector,
  onSelectAll,
  loading = false,
  skeletonRows = 8,
}: OrdersListTableProps) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = rows.some((r) => selected.has(r.id))

  // Empty state (not loading, no rows)
  if (!loading && rows.length === 0) {
    return (
      <div className="hidden md:flex items-center justify-center py-16 border border-white/8 rounded-lg bg-neutral-900/40">
        <p className="text-sm text-white/35">No orders match the current filter.</p>
      </div>
    )
  }

  return (
    <div className="hidden md:block bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          {/* ── Header ────────────────────────────────────────────────────── */}
          <thead className="bg-white/[0.02] sticky top-0 z-10">
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2.5 w-10 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  aria-label="Select all orders"
                  className="w-4 h-4 cursor-pointer accent-red-500"
                />
              </th>
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
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Tracking
              </th>
              {/* actions column — no label */}
              <th className="px-3 py-2.5 w-10" aria-hidden />
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-white/[0.04]">
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => <SkeletonRow key={i} />)
              : rows.map((row) => {
                  const isSelected = selected.has(row.id)
                  return (
                    <tr
                      key={row.id}
                      data-testid="orders-table-row"
                      className={[
                        'transition-colors group',
                        isSelected
                          ? 'bg-red-500/[0.04] shadow-[inset_2px_0_0_theme(colors.red.500)]'
                          : 'hover:bg-white/[0.02]',
                      ].join(' ')}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onSelect(row.id, e.target.checked)}
                          aria-label={`Select order ${row.orderNumber}`}
                          className="w-4 h-4 cursor-pointer accent-red-500"
                        />
                      </td>

                      {/* Order number */}
                      <td className="px-3 py-3 font-mono text-[11px] text-white whitespace-nowrap">
                        {row.orderNumber}
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-3">
                        <div className="font-semibold text-[11px] text-white leading-tight">
                          {row.customerName ?? '—'}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          {row.customerEmail}
                        </div>
                      </td>

                      {/* Order status pill */}
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

                      {/* Payment status pill */}
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
                      <td className="px-3 py-3 text-right text-xs text-white/85 tabular-nums whitespace-nowrap">
                        {formatAmount(row.totalAmount)}
                      </td>

                      {/* Created */}
                      <td className="px-3 py-3 text-[11px] text-white/50 whitespace-nowrap">
                        {formatDate(row.createdAt)}
                      </td>

                      {/* Tracking */}
                      <td className="px-3 py-3 font-mono text-[10px] text-white/50 whitespace-nowrap">
                        {row.trackingNumber ? (
                          <span title={[row.carrier, row.trackingNumber].filter(Boolean).join(' — ')}>
                            {row.trackingNumber.length > 14
                              ? `${row.trackingNumber.slice(0, 14)}…`
                              : row.trackingNumber}
                          </span>
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 w-10 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenInspector(row.id)}
                          aria-label={`Open inspector for ${row.orderNumber}`}
                          className="text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          ⋯
                        </button>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
