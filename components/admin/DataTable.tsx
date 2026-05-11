'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { CaretDown, CaretUp, CircleNotch } from '@phosphor-icons/react'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  /** Unique column id. Used as the React key. */
  id: string
  /** Header text. */
  label: string
  /** How to render the cell for a given row. */
  render: (row: T) => ReactNode
  /** When set, the header is clickable and bubbles `sortKey` up to `sort.onChange`. */
  sortKey?: string
  /** Right-align the column (e.g. amounts, counts). */
  align?: 'left' | 'right'
  /** Hide column on mobile (defaults to false → shows in mobile card stack). */
  hideOnMobile?: boolean
  /** Override the column label on mobile cards (e.g. shorter version). */
  mobileLabel?: string
  /** Extra class on the `<th>` and `<td>`. */
  className?: string
}

export interface DataTableSelection<T> {
  /** Returns the row's unique id for tracking selection. */
  getRowId: (row: T) => string
  /** Currently selected row ids. */
  selectedIds: Set<string>
  /** Toggle one row's selection. */
  onToggle: (id: string) => void
  /** Toggle select-all-on-current-page. */
  onToggleAll: () => void
  /** Optional: which rows can be selected. Default: all. */
  isSelectable?: (row: T) => boolean
}

export interface DataTableSort {
  /** Currently active sort key (matches some column's `sortKey`). */
  key: string | null
  direction: 'asc' | 'desc'
  /** Called when a sortable header is clicked. */
  onChange: (key: string) => void
}

interface EmptyStatePayload {
  icon: ReactNode
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  /** Row id helper — required for keys and (when selection is on) checkbox state. */
  getRowId: (row: T) => string
  /** Loading state — replaces table body with skeleton rows. */
  loading?: boolean
  /** Number of skeleton rows shown while loading. Default 6. */
  skeletonRows?: number
  /** Empty state config — rendered when data is empty and not loading. */
  emptyState?: EmptyStatePayload
  /** Optional: clicking a row navigates to this URL. */
  rowHref?: (row: T) => string
  /** Optional bulk selection wiring. */
  selection?: DataTableSelection<T>
  /** Optional sort wiring. Headers without `sortKey` stay non-interactive. */
  sort?: DataTableSort
  /** Optional class on the outer container. */
  className?: string
}

/**
 * Canonical admin list table.
 *
 * - Sticky header on desktop tables
 * - Loading skeletons + empty state baked in
 * - Mobile fallback: each row renders as a stacked card with `label: value`
 *   pairs for every column not marked `hideOnMobile`
 * - Optional bulk selection via `selection` prop (composes with
 *   `<BulkActionToolbar>`)
 * - Optional sortable columns (parent owns the sort state)
 *
 * Example:
 * ```tsx
 * const columns: Column<Order>[] = [
 *   { id: 'number', label: 'Order', render: (o) => `#${o.orderNumber}`, sortKey: 'orderNumber' },
 *   { id: 'status', label: 'Status', render: (o) => <StatusPill ... /> },
 *   { id: 'total', label: 'Total', align: 'right', sortKey: 'total', render: (o) => `$${o.total}` },
 * ]
 *
 * <DataTable
 *   data={orders}
 *   columns={columns}
 *   getRowId={(o) => o.id}
 *   loading={loading}
 *   rowHref={(o) => `/admin/fulfillment?orderId=${o.id}`}
 *   sort={{ key: sortKey, direction: sortDir, onChange: handleSort }}
 *   emptyState={{ icon: <ShoppingCart .../>, title: 'No orders yet', ... }}
 * />
 * ```
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  loading = false,
  skeletonRows = 6,
  emptyState,
  rowHref,
  selection,
  sort,
  className = '',
}: DataTableProps<T>) {
  const showSelection = !!selection

  // ─── Loading skeletons ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`bg-neutral-900 border border-white/10 ${className}`}>
        <DesktopSkeleton columns={columns} rows={skeletonRows} showSelection={showSelection} />
        <MobileSkeleton rows={skeletonRows} />
      </div>
    )
  }

  // ─── Empty state ───────────────────────────────────────────────────────
  if (data.length === 0 && emptyState) {
    return <EmptyState {...emptyState} className={className} size="comfortable" />
  }

  if (data.length === 0) {
    return (
      <div className={`bg-neutral-900 border border-white/10 p-10 text-center ${className}`}>
        <p className="text-sm text-white/45">No results.</p>
      </div>
    )
  }

  // ─── Selection helpers ─────────────────────────────────────────────────
  const selectableIds = selection
    ? data.filter((row) => !selection.isSelectable || selection.isSelectable(row)).map((row) => getRowId(row))
    : []
  const allSelectableSelected =
    showSelection &&
    selection &&
    selectableIds.length > 0 &&
    selectableIds.every((id) => selection.selectedIds.has(id))

  return (
    <div className={`bg-neutral-900 border border-white/10 ${className}`}>
      {/* ─── Desktop table ─────────────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/[0.03] sticky top-0 z-10">
            <tr className="border-b border-white/10">
              {showSelection && (
                <th className="px-4 py-3 text-left w-10">
                  {selectableIds.length > 0 && selection && (
                    <input
                      type="checkbox"
                      checked={!!allSelectableSelected}
                      onChange={selection.onToggleAll}
                      aria-label="Select all rows"
                      className="w-4 h-4 cursor-pointer accent-white"
                    />
                  )}
                </th>
              )}
              {columns.map((col) => {
                const isSortable = !!col.sortKey && !!sort
                const isActive = isSortable && sort!.key === col.sortKey
                const align = col.align === 'right' ? 'text-right' : 'text-left'
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={`px-4 py-3 ${align} text-[10px] font-bold uppercase tracking-wider text-white/45 ${col.className ?? ''}`}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => sort!.onChange(col.sortKey!)}
                        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${isActive ? 'text-white' : ''}`}
                      >
                        {col.label}
                        {isActive ? (
                          sort!.direction === 'asc' ? (
                            <CaretUp size={9} weight="bold" />
                          ) : (
                            <CaretDown size={9} weight="bold" />
                          )
                        ) : (
                          <CaretDown size={9} weight="bold" className="opacity-30" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((row) => {
              const id = getRowId(row)
              const isSelected = selection?.selectedIds.has(id) ?? false
              const isRowSelectable = selection
                ? !selection.isSelectable || selection.isSelectable(row)
                : false
              const baseRowClass = `transition-colors ${
                isSelected ? 'bg-white/[0.04]' : rowHref ? 'hover:bg-white/[0.02]' : ''
              }`

              const cells = (
                <>
                  {showSelection && selection && (
                    <td className="px-4 py-3 w-10">
                      {isRowSelectable && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => selection.onToggle(id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select row ${id}`}
                          className="w-4 h-4 cursor-pointer accent-white"
                        />
                      )}
                    </td>
                  )}
                  {columns.map((col) => {
                    const align = col.align === 'right' ? 'text-right' : 'text-left'
                    return (
                      <td
                        key={col.id}
                        className={`px-4 py-3 text-xs text-white/85 ${align} ${col.className ?? ''}`}
                      >
                        {col.render(row)}
                      </td>
                    )
                  })}
                </>
              )

              return (
                <tr key={id} className={baseRowClass}>
                  {rowHref ? (
                    // Use a transparent overlay link so individual interactive
                    // elements inside cells (checkboxes, buttons) keep working.
                    <td className="contents">
                      <RowAsLink
                        href={rowHref(row)}
                        showSelection={showSelection}
                        selection={selection}
                        row={row}
                        id={id}
                        isSelected={isSelected}
                        isRowSelectable={isRowSelectable}
                        columns={columns}
                      />
                    </td>
                  ) : (
                    cells
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Mobile cards ──────────────────────────────────────────────── */}
      <div className="sm:hidden divide-y divide-white/5">
        {data.map((row) => {
          const id = getRowId(row)
          const isSelected = selection?.selectedIds.has(id) ?? false
          const isRowSelectable = selection
            ? !selection.isSelectable || selection.isSelectable(row)
            : false

          const card = (
            <div
              className={`p-4 transition-colors ${
                isSelected ? 'bg-white/[0.04]' : rowHref ? 'hover:bg-white/[0.02]' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {showSelection && selection && isRowSelectable && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => selection.onToggle(id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select row ${id}`}
                    className="w-4 h-4 cursor-pointer accent-white mt-0.5 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {columns
                    .filter((col) => !col.hideOnMobile)
                    .map((col) => (
                      <div key={col.id} className="flex items-baseline gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 shrink-0 min-w-[5rem]">
                          {col.mobileLabel ?? col.label}
                        </span>
                        <span className="text-xs text-white/85 truncate">{col.render(row)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )

          if (rowHref) {
            return (
              <Link key={id} href={rowHref(row)} className="block">
                {card}
              </Link>
            )
          }
          return <div key={id}>{card}</div>
        })}
      </div>
    </div>
  )
}

// ─── Internal helpers ────────────────────────────────────────────────────

interface RowAsLinkProps<T> {
  href: string
  showSelection: boolean
  selection?: DataTableSelection<T>
  row: T
  id: string
  isSelected: boolean
  isRowSelectable: boolean
  columns: Column<T>[]
}

/**
 * Renders the row's cells with a transparent overlay `<Link>` covering the
 * whole row. We can't put an `<a>` directly around a `<tr>`, so we render a
 * `position: relative` first cell with an absolutely-positioned `<Link>`
 * stretching across the row, behind any interactive content (checkboxes,
 * buttons) that uses higher z-index implicitly via `position: relative`.
 */
function RowAsLink<T>({
  href,
  showSelection,
  selection,
  row,
  id,
  isSelected,
  isRowSelectable,
  columns,
}: RowAsLinkProps<T>) {
  return (
    <>
      {showSelection && selection && (
        <td className="px-4 py-3 w-10 relative z-10">
          {isRowSelectable && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => selection.onToggle(id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select row ${id}`}
              className="w-4 h-4 cursor-pointer accent-white"
            />
          )}
        </td>
      )}
      {columns.map((col, i) => {
        const align = col.align === 'right' ? 'text-right' : 'text-left'
        const isFirst = i === 0 && !showSelection
        return (
          <td
            key={col.id}
            className={`px-4 py-3 text-xs text-white/85 ${align} ${col.className ?? ''} ${isFirst ? 'relative' : ''}`}
          >
            {isFirst && (
              <Link
                href={href}
                aria-label={`View row ${id}`}
                className="absolute inset-y-0 -left-px right-[-9999px] z-0"
              />
            )}
            <span className="relative z-10">{col.render(row)}</span>
          </td>
        )
      })}
    </>
  )
}

function DesktopSkeleton<T>({
  columns,
  rows,
  showSelection,
}: {
  columns: Column<T>[]
  rows: number
  showSelection: boolean
}) {
  return (
    <div className="hidden sm:block">
      <div className="border-b border-white/10 px-4 py-3 flex items-center gap-4">
        <CircleNotch size={14} weight="bold" className="animate-spin text-white/40" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Loading…</span>
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            {showSelection && <div className="w-4 h-4 bg-white/5 animate-pulse" />}
            {columns.map((col) => (
              <div
                key={col.id}
                className={`h-3 bg-white/5 animate-pulse flex-1 max-w-[12rem]`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function MobileSkeleton({ rows }: { rows: number }) {
  return (
    <div className="sm:hidden divide-y divide-white/5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 space-y-2">
          <div className="h-3 w-2/3 bg-white/5 animate-pulse" />
          <div className="h-3 w-1/2 bg-white/5 animate-pulse" />
        </div>
      ))}
    </div>
  )
}
