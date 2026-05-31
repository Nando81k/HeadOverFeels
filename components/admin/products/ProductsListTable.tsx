'use client'

/**
 * ProductsListTable — desktop product list for the admin products page.
 *
 * Renders a sticky-header table of ProductRow items with:
 *   - Checkbox bulk-select (header select-all + per-row)
 *   - Primary image thumbnail
 *   - Product name + category / variant-count sub-line
 *   - SKU (monospace)
 *   - Price (formatted)
 *   - Inventory (amber warning when ≤ 10)
 *   - Status pill (ACTIVE → green, ARCHIVED → neutral, DRAFT → muted)
 *   - Drop "Live" pill when isDrop=true (replaces status pill, shows countdown)
 *   - ⋯ row-action button (no-op placeholder, wired by parent via onRowAction)
 *   - Loading skeletons + empty state
 *
 * Phase 3 Task 4 — desktop only (mobile card list is a separate component).
 */

import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { ProductRow } from '@/lib/admin/products'

// ─── Constants ────────────────────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 10

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductsListTableProps {
  /** Rows to render. */
  rows: ProductRow[]
  /** Currently selected product ids. */
  selectedIds: Set<string>
  /** Toggle a single row's selection. */
  onToggle: (id: string) => void
  /** Toggle select-all for the current page. */
  onToggleAll: () => void
  /** Called when the ⋯ button is clicked for a row. */
  onRowAction?: (id: string) => void
  /** Show loading skeletons instead of rows. */
  loading?: boolean
  /** Number of skeleton rows while loading. Default: 6. */
  skeletonRows?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  return `$${cents.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/** Returns remaining ms until dropEndDate (0 when past). */
function msUntil(date: Date): number {
  return Math.max(0, date.getTime() - Date.now())
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ended'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m left`
  if (m > 0) return `${m}m ${s}s left`
  return `${s}s left`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ row }: { row: ProductRow }) {
  const [countdown, setCountdown] = useState<string>(() =>
    row.isDrop && row.dropEndDate ? formatCountdown(msUntil(row.dropEndDate)) : '',
  )

  useEffect(() => {
    if (!row.isDrop || !row.dropEndDate) return
    const tick = () => setCountdown(formatCountdown(msUntil(row.dropEndDate!)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [row.isDrop, row.dropEndDate])

  if (row.isDrop) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 shadow-[0_0_6px_rgba(239,68,68,0.25)]"
        title={countdown}
        aria-label={`Drop live — ${countdown}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Drop · Live
      </span>
    )
  }

  if (row.status === 'ACTIVE') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
        Active
      </span>
    )
  }

  if (row.status === 'ARCHIVED') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-white/40">
        Archived
      </span>
    )
  }

  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-white/30">
      Draft
    </span>
  )
}

function Thumbnail({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <div className="w-8 h-8 rounded overflow-hidden bg-white/5 border border-white/8 shrink-0">
        <Image
          src={src}
          alt={name}
          width={32}
          height={32}
          className="object-cover w-full h-full"
          unoptimized
        />
      </div>
    )
  }
  return (
    <div
      className="w-8 h-8 rounded bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/8 shrink-0"
      aria-hidden
    />
  )
}

function InventoryCell({ value }: { value: number }) {
  const isLow = value <= LOW_STOCK_THRESHOLD
  return (
    <span className={isLow ? 'text-amber-400 font-semibold' : 'text-white/85'}>
      {value}
      {isLow && value > 0 && (
        <span className="ml-1 text-amber-400" aria-label="low stock">
          ⚠
        </span>
      )}
      {value === 0 && (
        <span className="ml-1 text-red-400" aria-label="out of stock">
          ✕
        </span>
      )}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      <td className="px-3 py-3 w-10">
        <div className="w-4 h-4 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3 w-10">
        <div className="w-8 h-8 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1.5">
          <div className="h-3 w-40 bg-white/5 animate-pulse rounded" />
          <div className="h-2.5 w-24 bg-white/5 animate-pulse rounded" />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-16 bg-white/5 animate-pulse rounded font-mono" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-12 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-8 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-5 w-16 bg-white/5 animate-pulse rounded-full" />
      </td>
      <td className="px-3 py-3 w-8" />
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Desktop-only products list table.
 * Hidden on mobile via `hidden md:block` — pair with a mobile card list for small viewports.
 */
export function ProductsListTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  onRowAction,
  loading = false,
  skeletonRows = 6,
}: ProductsListTableProps) {
  const selectableIds = rows.map((r) => r.id)
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
  const someSelected = selectableIds.some((id) => selectedIds.has(id))

  return (
    <div className="hidden md:block bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
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
                  onChange={onToggleAll}
                  aria-label="Select all products"
                  className="w-4 h-4 cursor-pointer accent-red-500"
                />
              </th>
              {/* thumbnail column — no label */}
              <th className="px-3 py-2.5 w-10" aria-hidden />
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Product
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                SKU
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Price
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Stock
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Status
              </th>
              {/* actions column — no label */}
              <th className="px-3 py-2.5 w-8" aria-hidden />
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-white/[0.04]">
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => <SkeletonRow key={i} />)
              : rows.length === 0
                ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-sm text-white/35"
                      >
                        No products found.
                      </td>
                    </tr>
                  )
                : rows.map((row) => {
                    const isSelected = selectedIds.has(row.id)
                    const isDropRow = row.isDrop

                    return (
                      <tr
                        key={row.id}
                        data-testid="products-table-row"
                        className={[
                          'transition-colors group',
                          isSelected
                            ? 'bg-red-500/[0.04] shadow-[inset_2px_0_0_theme(colors.red.500)]'
                            : isDropRow
                              ? 'bg-red-500/[0.025] hover:bg-red-500/[0.04]'
                              : 'hover:bg-white/[0.02]',
                        ].join(' ')}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggle(row.id)}
                            aria-label={`Select ${row.name}`}
                            className="w-4 h-4 cursor-pointer accent-red-500"
                          />
                        </td>

                        {/* Thumbnail */}
                        <td className="px-3 py-3 w-10">
                          <Thumbnail src={row.primaryImage} name={row.name} />
                        </td>

                        {/* Product name + meta */}
                        <td className="px-3 py-3">
                          <div className="font-semibold text-[11px] text-white leading-tight truncate max-w-[200px]">
                            {row.name}
                          </div>
                          {isDropRow && row.dropEndDate ? (
                            <DropSubLine dropEndDate={row.dropEndDate} category={row.category} />
                          ) : (
                            <div className="text-[10px] text-white/40 mt-0.5">
                              {[row.category, row.variantCount > 0 && `${row.variantCount} variant${row.variantCount !== 1 ? 's' : ''}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>

                        {/* SKU */}
                        <td className="px-3 py-3 font-mono text-[10px] text-white/50">
                          {row.sku ?? '—'}
                        </td>

                        {/* Price */}
                        <td className="px-3 py-3 text-xs text-white/85">
                          {formatPrice(row.price)}
                        </td>

                        {/* Stock */}
                        <td className="px-3 py-3 text-xs">
                          <InventoryCell value={row.inventory} />
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <StatusPill row={row} />
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 w-8">
                          <button
                            type="button"
                            onClick={() => onRowAction?.(row.id)}
                            aria-label={`Actions for ${row.name}`}
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

// ─── DropSubLine ──────────────────────────────────────────────────────────────

function DropSubLine({ dropEndDate, category }: { dropEndDate: Date; category: string | null }) {
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntil(dropEndDate)))

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntil(dropEndDate)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [dropEndDate])

  const dateStr = dropEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = dropEndDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="text-[10px] text-red-400/80 mt-0.5">
      {category && <span>{category} · </span>}
      Drop · Live until {dateStr}, {timeStr} · {countdown}
    </div>
  )
}
