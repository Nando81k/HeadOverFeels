'use client'

/**
 * CustomersListTable — desktop customer list for the admin customers page.
 *
 * Renders a sticky-header table of CustomerRow items with:
 *   - Checkbox bulk-select (header select-all + per-row)
 *   - Email + name sub-line (clicking navigates to detail page)
 *   - Tier badge (color-coded from tier.primaryColor)
 *   - Total orders count
 *   - Total spent (currency formatted)
 *   - Current points
 *   - Last order date
 *   - ⋯ action placeholder
 *   - Loading skeletons + empty state
 *
 * Phase 8 Task 4 — desktop only (hidden md:block).
 * Mobile card list is a separate component (Task 5).
 *
 * Selection state is OWNED by parent — this component is purely controlled.
 */

import { useRouter } from 'next/navigation'
import type { CustomerRow } from '@/lib/admin/customers'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomersListTableProps {
  /** Rows to render. */
  rows: CustomerRow[]
  /** Currently selected customer ids. */
  selectedIds: Set<string>
  /** Toggle a single row's selection. Called with customerId. */
  onToggleSelection: (id: string) => void
  /** Toggle select-all. */
  onToggleAll: () => void
  /** Whether all visible rows are currently selected. */
  allSelected: boolean
  /** Show loading skeleton rows instead of data. */
  loading?: boolean
  /** Number of skeleton rows while loading. Default: 8. */
  skeletonRows?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const nFmt = new Intl.NumberFormat('en-US')
const $Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-3 py-3 w-10">
        <div className="w-4 h-4 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1.5">
          <div className="h-3 w-36 bg-white/5 animate-pulse rounded" />
          <div className="h-2.5 w-24 bg-white/5 animate-pulse rounded" />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="h-5 w-16 bg-white/5 animate-pulse rounded-full" />
      </td>
      <td className="px-3 py-3 text-right">
        <div className="h-3 w-8 bg-white/5 animate-pulse rounded ml-auto" />
      </td>
      <td className="px-3 py-3 text-right">
        <div className="h-3 w-14 bg-white/5 animate-pulse rounded ml-auto" />
      </td>
      <td className="px-3 py-3 text-right">
        <div className="h-3 w-12 bg-white/5 animate-pulse rounded ml-auto" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3 w-10" />
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Desktop-only customers list table.
 * Hidden on mobile via `hidden md:block` — pair with CustomersListCardMobile for small viewports.
 */
export function CustomersListTable({
  rows,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  allSelected,
  loading = false,
  skeletonRows = 8,
}: CustomersListTableProps) {
  const router = useRouter()

  // Empty state (not loading, no rows)
  if (!loading && rows.length === 0) {
    return (
      <div className="hidden md:flex items-center justify-center py-16 border border-white/8 rounded-lg bg-neutral-900/40">
        <p className="text-sm text-white/35">No customers match the current filter.</p>
      </div>
    )
  }

  return (
    <div className="hidden md:block bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px]">
          {/* ── Header ────────────────────────────────────────────────────── */}
          <thead className="bg-white/[0.02] sticky top-0 z-10">
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2.5 w-10 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Select all customers"
                  className="w-4 h-4 cursor-pointer accent-red-500"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Email
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Tier
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/40">
                Orders
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/40">
                Spent
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/40">
                Points
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Last Order
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
                  const isSelected = selectedIds.has(row.id)
                  return (
                    <tr
                      key={row.id}
                      data-testid="customers-table-row"
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
                          onChange={() => onToggleSelection(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${row.email}`}
                          className="w-4 h-4 cursor-pointer accent-red-500"
                        />
                      </td>

                      {/* Email + name */}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          aria-label={`Open ${row.email}`}
                          onClick={() => router.push(`/admin/customers/${row.id}`)}
                          className="text-left w-full"
                        >
                          <div className="font-medium text-[11px] text-white leading-tight">
                            {row.email}
                          </div>
                          {row.name && (
                            <div className="text-[10px] text-white/40 mt-0.5">{row.name}</div>
                          )}
                        </button>
                      </td>

                      {/* Tier badge */}
                      <td className="px-3 py-3">
                        {row.tierName ? (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              background: `${row.tierColor ?? '#64748B'}26`,
                              color: row.tierColor ?? '#94A3B8',
                            }}
                          >
                            {row.tierName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/25">—</span>
                        )}
                      </td>

                      {/* Total orders */}
                      <td className="px-3 py-3 text-right text-xs text-white/80 tabular-nums">
                        {nFmt.format(row.totalOrders)}
                      </td>

                      {/* Total spent */}
                      <td className="px-3 py-3 text-right text-xs text-white/80 tabular-nums whitespace-nowrap">
                        {$Fmt.format(row.totalSpent)}
                      </td>

                      {/* Current points */}
                      <td className="px-3 py-3 text-right text-xs text-white/80 tabular-nums">
                        {nFmt.format(row.currentPoints)}
                      </td>

                      {/* Last order date */}
                      <td className="px-3 py-3 text-[11px] text-white/50 whitespace-nowrap">
                        {row.lastOrderDate ? (
                          dFmt.format(row.lastOrderDate)
                        ) : (
                          <span className="text-white/25">never</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 w-10 text-right">
                        <span
                          className="text-white/30 group-hover:text-white/60 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 select-none"
                          aria-hidden
                        >
                          ⋯
                        </span>
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
