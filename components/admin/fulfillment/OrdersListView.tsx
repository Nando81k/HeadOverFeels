'use client'

/**
 * OrdersListView — orchestration layer for the admin fulfillment orders list.
 *
 * Composes:
 *  - OrdersListTable (desktop)
 *  - OrdersListCardMobile (mobile — one card per row)
 *  - OrderInspector (slide-out quick-edit panel)
 *  - OrderBulkActionsSheet (bottom sheet, shown when ≥1 row selected)
 *
 * Responsibilities:
 *  - Manages selectedIds Set state (checkbox multi-select)
 *  - Opens OrderInspector when ⋯ row-action or mobile Edit is clicked
 *  - Fetches OrderDetailFull via getOrderDetailForInspector server action on demand
 *    (NOT raw loadOrderDetail — keeps Prisma out of the client bundle, PR #92 precedent)
 *  - Opens OrderBulkActionsSheet whenever selectedIds.size > 0
 *  - Propagates onRefresh to parent after save / bulk action
 *
 * Phase 4 Task 9.
 */

import { useCallback, useState, useTransition } from 'react'
import type { OrderRow, OrderDetailFull } from '@/lib/admin/fulfillment'
import { getOrderDetailForInspector, bulkMarkShipped } from '@/app/admin/fulfillment/actions'
import { toast } from '@/lib/toast'
import { OrdersListTable } from './OrdersListTable'
import { OrdersListCardMobile } from './OrdersListCardMobile'
import { OrderInspector } from './OrderInspector'
import { OrderBulkActionsSheet } from './OrderBulkActionsSheet'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrdersListViewProps {
  /** Rows for the current page / filter result. */
  rows: OrderRow[]
  /** Show loading skeletons instead of rows. */
  loading?: boolean
  /** Called after a successful quick-edit save or bulk action so the parent can re-fetch. */
  onRefresh?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withAdded(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  next.add(id)
  return next
}

function withRemoved(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  next.delete(id)
  return next
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrdersListView({ rows, loading = false, onRefresh }: OrdersListViewProps) {
  // ── Selection state ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleSelect = useCallback((orderId: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, orderId) : withRemoved(prev, orderId)))
  }, [])

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
    },
    [rows],
  )

  // ── Inspector state ──────────────────────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<OrderDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openInspector = useCallback((orderId: string) => {
    setInspectorOpen(true)
    startTransition(async () => {
      const d = await getOrderDetailForInspector(orderId)
      setInspectorDetail(d)
    })
  }, [])

  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
  }, [])

  const handleSaved = useCallback(
    (_orderId: string) => {
      setInspectorOpen(false)
      setInspectorDetail(null)
      onRefresh?.()
    },
    [onRefresh],
  )

  // ── Mobile quick mark-shipped ─────────────────────────────────────────────────
  const handleMarkShipped = useCallback(async (orderId: string) => {
    const tn = window.prompt('Tracking number?')
    if (!tn) return
    const r = await bulkMarkShipped([orderId], { [orderId]: { trackingNumber: tn } })
    if (r.ok) {
      toast.success('Marked shipped')
    } else {
      toast.error(r.error)
    }
  }, [])

  // ── Bulk sheet ───────────────────────────────────────────────────────────────
  const bulkOpen = selectedIds.size > 0

  const handleBulkClear = useCallback(() => {
    setSelectedIds(new Set())
    onRefresh?.()
  }, [onRefresh])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Desktop table — hidden on mobile via CSS inside OrdersListTable */}
      <OrdersListTable
        rows={rows}
        selected={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />

      {/* Mobile card list — hidden on desktop via CSS inside each card */}
      <div className="md:hidden space-y-2" data-testid="orders-list-mobile">
        {rows.map((row) => (
          <OrdersListCardMobile
            key={row.id}
            row={row}
            selected={selectedIds.has(row.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onMarkShipped={handleMarkShipped}
          />
        ))}
      </div>

      {/* Quick-edit slide-out inspector */}
      <OrderInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onSaved={handleSaved}
      />

      {/* Bulk actions bottom sheet — shown when ≥1 selected */}
      <OrderBulkActionsSheet
        open={bulkOpen}
        orderIds={Array.from(selectedIds)}
        onClear={handleBulkClear}
      />
    </>
  )
}
