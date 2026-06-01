'use client'

/**
 * PromotionsListView — orchestration layer for the admin marketing promotions list.
 *
 * Composes:
 *  - MarketingListTable variant="promotions" (desktop)
 *  - MarketingListCardMobile variant="promotions" (mobile — one card per row)
 *  - PromotionInspector (slide-out quick-edit panel)
 *  - PromotionBulkSheet (bottom sheet, shown when ≥1 row selected)
 *
 * Responsibilities:
 *  - Manages selectedIds Set state (checkbox multi-select)
 *  - Opens PromotionInspector when ⋯ row-action or mobile Edit is clicked
 *  - Fetches PromotionDetailFull via getPromotionDetailForInspector server action on demand
 *    (NOT raw loadPromotionDetail — keeps Prisma out of the client bundle)
 *  - Opens PromotionBulkSheet whenever selectedIds.size > 0
 *  - Mobile quick-action 'activate' → togglePromotionActive then onRefresh
 *  - Propagates onRefresh to parent after save / bulk action
 *
 * Phase 5 Task 15.
 */

import { useCallback, useState, useTransition } from 'react'
import type { PromotionRow } from '@/lib/admin/marketing'
import type { PromotionDetailFull } from '@/app/admin/marketing/actions'
import {
  getPromotionDetailForInspector,
  togglePromotionActive,
} from '@/app/admin/marketing/actions'
import { toast } from '@/lib/toast'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { PromotionInspector } from './PromotionInspector'
import { PromotionBulkSheet } from './PromotionBulkSheet'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromotionsListViewProps {
  /** Rows for the current page / filter result. */
  rows: PromotionRow[]
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

export function PromotionsListView({ rows, loading = false, onRefresh }: PromotionsListViewProps) {
  // ── Selection state ──────────────────────────────────────────────────────────
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

  // ── Inspector state ──────────────────────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<PromotionDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true)
    setInspectorDetail(null)
    startTransition(async () => {
      const d = await getPromotionDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])

  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
  }, [])

  const handleSaved = useCallback(
    (_id: string) => {
      setInspectorOpen(false)
      setInspectorDetail(null)
      onRefresh?.()
    },
    [onRefresh],
  )

  // ── Mobile quick-action: activate/deactivate ──────────────────────────────────
  const handleQuickAction = useCallback(
    async (action: string, id: string) => {
      if (action === 'activate') {
        const r = await togglePromotionActive(id)
        if (r.ok) {
          toast.success('Toggled')
          onRefresh?.()
        } else {
          toast.error('Failed to toggle')
        }
      }
    },
    [onRefresh],
  )

  // ── Bulk sheet ───────────────────────────────────────────────────────────────
  const handleBulkClear = useCallback(() => {
    setSelectedIds(new Set())
    onRefresh?.()
  }, [onRefresh])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Desktop table — hidden on mobile via CSS inside MarketingListTable */}
      <MarketingListTable
        variant="promotions"
        rows={rows}
        selected={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />

      {/* Mobile card list — hidden on desktop via CSS inside each card */}
      <div className="md:hidden space-y-2" data-testid="promotions-list-mobile">
        {rows.map((row) => (
          <MarketingListCardMobile
            key={row.id}
            variant="promotions"
            row={row}
            selected={selectedIds.has(row.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={handleQuickAction}
          />
        ))}
      </div>

      {/* Quick-edit slide-out inspector */}
      <PromotionInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onSaved={handleSaved}
      />

      {/* Bulk actions bottom sheet — shown when ≥1 selected */}
      <PromotionBulkSheet
        open={selectedIds.size > 0}
        ids={Array.from(selectedIds)}
        onClear={handleBulkClear}
      />
    </>
  )
}
