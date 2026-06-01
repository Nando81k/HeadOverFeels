'use client'

/**
 * AbandonedCartsListView — orchestration layer for the admin marketing abandoned carts list.
 *
 * Composes:
 *  - MarketingListTable variant="carts" (desktop)
 *  - MarketingListCardMobile variant="carts" (mobile — one card per row)
 *  - AbandonedCartInspector (slide-out detail panel)
 *  - AbandonedCartBulkSheet (bottom sheet, shown when ≥1 row selected)
 *
 * Responsibilities:
 *  - Manages selectedIds Set state (checkbox multi-select)
 *  - Opens AbandonedCartInspector when ⋯ row-action or mobile Edit is clicked
 *  - Fetches AbandonedCartDetailFull via getAbandonedCartDetailForInspector on demand
 *    (keeps Prisma out of client bundle, PR #92 precedent)
 *  - Mobile quick-action 'send-recovery' → sendCartRecoveryEmail(id)
 *  - Opens AbandonedCartBulkSheet whenever selectedIds.size > 0
 *  - Propagates onRefresh to parent after mutation / bulk action
 *
 * Phase 5 Task 19.
 */

import { useCallback, useState, useTransition } from 'react'
import type { AbandonedCartRow } from '@/lib/admin/marketing'
import {
  getAbandonedCartDetailForInspector,
  sendCartRecoveryEmail,
} from '@/app/admin/marketing/actions'
import type { AbandonedCartDetailFull } from '@/app/admin/marketing/actions'
import { toast } from '@/lib/toast'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { AbandonedCartInspector } from './AbandonedCartInspector'
import { AbandonedCartBulkSheet } from './AbandonedCartBulkSheet'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AbandonedCartsListViewProps {
  /** Rows for the current page / filter result. */
  rows: AbandonedCartRow[]
  /** Show loading skeletons instead of rows. */
  loading?: boolean
  /** Called after a successful inspector save or bulk action so the parent can re-fetch. */
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

export function AbandonedCartsListView({
  rows,
  loading = false,
  onRefresh,
}: AbandonedCartsListViewProps) {
  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, id) : withRemoved(prev, id)))
  }, [])

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
    },
    [rows],
  )

  // ── Inspector state ────────────────────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<AbandonedCartDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true)
    setInspectorDetail(null)
    startTransition(async () => {
      const d = await getAbandonedCartDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])

  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
  }, [])

  const handleMutated = useCallback(
    (_id: string) => {
      setInspectorOpen(false)
      setInspectorDetail(null)
      onRefresh?.()
    },
    [onRefresh],
  )

  // ── Mobile quick action: send-recovery ────────────────────────────────────
  const handleQuickAction = useCallback(async (action: string, id: string) => {
    if (action === 'send-recovery') {
      const r = await sendCartRecoveryEmail(id)
      if (r.ok) {
        toast.success('Recovery email queued')
      } else {
        toast.error('Failed to send recovery email')
      }
    }
  }, [])

  // ── Bulk sheet ─────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setSelectedIds(new Set())
    onRefresh?.()
  }, [onRefresh])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Desktop table — hidden on mobile via CSS inside MarketingListTable */}
      <MarketingListTable
        variant="carts"
        rows={rows}
        selected={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />

      {/* Mobile card list */}
      <div className="md:hidden space-y-2" data-testid="carts-mobile">
        {rows.map((row) => (
          <MarketingListCardMobile
            key={row.id}
            variant="carts"
            row={row}
            selected={selectedIds.has(row.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={handleQuickAction}
          />
        ))}
      </div>

      {/* Slide-out inspector */}
      <AbandonedCartInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onMutated={handleMutated}
      />

      {/* Bulk actions bottom sheet — shown when ≥1 selected */}
      <AbandonedCartBulkSheet
        open={selectedIds.size > 0}
        ids={Array.from(selectedIds)}
        onClear={handleClear}
      />
    </>
  )
}
