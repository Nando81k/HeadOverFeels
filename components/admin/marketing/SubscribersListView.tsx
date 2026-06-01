'use client'

/**
 * SubscribersListView — orchestration layer for the admin marketing subscribers list.
 *
 * Composes:
 *  - MarketingListTable variant="subscribers" (desktop)
 *  - MarketingListCardMobile variant="subscribers" (mobile — one card per row)
 *  - SubscriberInspector (slide-out detail/action panel)
 *  - SubscriberBulkSheet (bottom sheet, shown when ≥1 row selected)
 *
 * Responsibilities:
 *  - Manages selectedIds Set state (checkbox multi-select)
 *  - Opens SubscriberInspector when ⋯ row-action or mobile Edit is clicked
 *  - Fetches SubscriberDetailFull via getSubscriberDetailForInspector server action on demand
 *    (NOT raw loaders — keeps Prisma out of the client bundle)
 *  - Opens SubscriberBulkSheet whenever selectedIds.size > 0
 *  - Forwards isSuperAdmin to both SubscriberInspector and SubscriberBulkSheet (PII Delete gate)
 *  - Mobile quick-action 'unsubscribe' → unsubscribeSubscriber then onRefresh
 *  - Propagates onRefresh to parent after mutation / bulk action
 *
 * Phase 5 Task 17.
 */

import { useCallback, useState, useTransition } from 'react'
import type { SubscriberRow } from '@/lib/admin/marketing'
import type { SubscriberDetailFull } from '@/app/admin/marketing/actions'
import {
  getSubscriberDetailForInspector,
  unsubscribeSubscriber,
} from '@/app/admin/marketing/actions'
import { toast } from '@/lib/toast'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { SubscriberInspector } from './SubscriberInspector'
import { SubscriberBulkSheet } from './SubscriberBulkSheet'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubscribersListViewProps {
  /** Rows for the current page / filter result. */
  rows: SubscriberRow[]
  /** Whether the current user has SUPER_ADMIN role — forwarded to Inspector + BulkSheet (PII Delete gate). */
  isSuperAdmin: boolean
  /** Show loading skeletons instead of rows. */
  loading?: boolean
  /** Called after a successful mutation or bulk action so the parent can re-fetch. */
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

export function SubscribersListView({
  rows,
  isSuperAdmin,
  loading = false,
  onRefresh,
}: SubscribersListViewProps) {
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
  const [inspectorDetail, setInspectorDetail] = useState<SubscriberDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true)
    setInspectorDetail(null)
    startTransition(async () => {
      const d = await getSubscriberDetailForInspector(id)
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

  // ── Mobile quick-action: unsubscribe ─────────────────────────────────────────
  const handleQuickAction = useCallback(
    async (action: string, id: string) => {
      if (action === 'unsubscribe') {
        const r = await unsubscribeSubscriber(id)
        if (r.ok) {
          toast.success('Unsubscribed')
          onRefresh?.()
        } else {
          toast.error('Failed to unsubscribe')
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
        variant="subscribers"
        rows={rows}
        selected={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />

      {/* Mobile card list — hidden on desktop via CSS inside each card */}
      <div className="md:hidden space-y-2" data-testid="subscribers-list-mobile">
        {rows.map((row) => (
          <MarketingListCardMobile
            key={row.id}
            variant="subscribers"
            row={row}
            selected={selectedIds.has(row.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={handleQuickAction}
          />
        ))}
      </div>

      {/* Quick-detail slide-out inspector */}
      <SubscriberInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        isSuperAdmin={isSuperAdmin}
        onClose={closeInspector}
        onMutated={handleMutated}
      />

      {/* Bulk actions bottom sheet — shown when ≥1 selected */}
      <SubscriberBulkSheet
        open={selectedIds.size > 0}
        ids={Array.from(selectedIds)}
        isSuperAdmin={isSuperAdmin}
        onClear={handleBulkClear}
      />
    </>
  )
}
