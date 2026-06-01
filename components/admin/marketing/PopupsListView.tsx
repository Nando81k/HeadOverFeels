'use client'

/**
 * PopupsListView — orchestrator for the Marketing > Popups tab.
 *
 * Wires together:
 *  - MarketingListTable (variant="popups") — desktop table
 *  - MarketingListCardMobile (variant="popups") — mobile swipeable cards
 *  - PopupInspector — slide-out detail/edit drawer
 *  - PopupBulkSheet — bottom action sheet for multi-select bulk ops
 *
 * Mobile quick-action 'activate' → calls togglePopupActive(id).
 *
 * Phase 5 Task 16.
 */

import { useCallback, useState, useTransition } from 'react'
import type { PopupRow } from '@/lib/admin/marketing'
import {
  getPopupDetailForInspector,
  togglePopupActive,
} from '@/app/admin/marketing/actions'
import type { PopupDetailFull } from '@/app/admin/marketing/actions'
import { toast } from '@/lib/toast'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { PopupInspector } from './PopupInspector'
import { PopupBulkSheet } from './PopupBulkSheet'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withAdded(s: Set<string>, id: string): Set<string> {
  const n = new Set(s)
  n.add(id)
  return n
}

function withRemoved(s: Set<string>, id: string): Set<string> {
  const n = new Set(s)
  n.delete(id)
  return n
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PopupsListViewProps {
  rows: PopupRow[]
  loading?: boolean
  onRefresh?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PopupsListView({ rows, loading = false, onRefresh }: PopupsListViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<PopupDetailFull | null>(null)
  const [, startTransition] = useTransition()

  // ── Selection handlers ─────────────────────────────────────────────────────

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, id) : withRemoved(prev, id)))
  }, [])

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
    },
    [rows],
  )

  // ── Inspector handlers ─────────────────────────────────────────────────────

  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true)
    setInspectorDetail(null)
    startTransition(async () => {
      const d = await getPopupDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])

  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
  }, [])

  const handleSaved = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
    onRefresh?.()
  }, [onRefresh])

  // ── Mobile quick-action handler ────────────────────────────────────────────

  const handleQuickAction = useCallback(async (action: string, id: string) => {
    if (action === 'activate') {
      const r = await togglePopupActive(id)
      if (r.ok) {
        toast.success('Toggled')
      } else {
        toast.error('Failed to toggle')
      }
    }
  }, [])

  // ── Bulk sheet clear handler ───────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setSelectedIds(new Set())
    onRefresh?.()
  }, [onRefresh])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Desktop table — hidden on mobile */}
      <MarketingListTable
        variant="popups"
        rows={rows}
        selected={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />

      {/* Mobile cards — hidden on md+ */}
      <div className="md:hidden space-y-2" data-testid="popups-mobile">
        {rows.map((r) => (
          <MarketingListCardMobile
            key={r.id}
            variant="popups"
            row={r}
            selected={selectedIds.has(r.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={handleQuickAction}
          />
        ))}
      </div>

      {/* Inspector drawer */}
      <PopupInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onSaved={handleSaved}
      />

      {/* Bulk action sheet */}
      <PopupBulkSheet
        open={selectedIds.size > 0}
        ids={Array.from(selectedIds)}
        onClear={handleClear}
      />
    </>
  )
}
