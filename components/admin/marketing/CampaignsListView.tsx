'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import type { CampaignRow } from '@/lib/admin/marketing'
import {
  getCampaignDetailForInspector,
  type CampaignDetailFull,
} from '@/app/admin/marketing/actions'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { CampaignInspector } from './CampaignInspector'
import { CampaignBulkSheet } from './CampaignBulkSheet'

export interface CampaignsListViewProps {
  rows: CampaignRow[]
  loading?: boolean
  onRefresh?: () => void
}

function withAdded(s: Set<string>, id: string) { const n = new Set(s); n.add(id); return n }
function withRemoved(s: Set<string>, id: string) { const n = new Set(s); n.delete(id); return n }

export function CampaignsListView({ rows, loading = false, onRefresh }: CampaignsListViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<CampaignDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)).map((r) => ({ id: r.id, status: r.status })),
    [rows, selectedIds],
  )

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, id) : withRemoved(prev, id)))
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
  }, [rows])

  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true)
    setInspectorDetail(null)
    startTransition(async () => {
      const d = await getCampaignDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])

  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
  }, [])

  const handleMutated = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
    onRefresh?.()
  }, [onRefresh])

  const handleClear = useCallback(() => {
    setSelectedIds(new Set())
    onRefresh?.()
  }, [onRefresh])

  return (
    <>
      <MarketingListTable
        variant="campaigns"
        rows={rows}
        selected={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />
      <div className="md:hidden space-y-2" data-testid="campaigns-mobile">
        {rows.map((r) => (
          <MarketingListCardMobile
            key={r.id}
            variant="campaigns"
            row={r}
            selected={selectedIds.has(r.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={() => { /* no swipe action for campaigns */ }}
          />
        ))}
      </div>
      <CampaignInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onMutated={handleMutated}
      />
      <CampaignBulkSheet
        open={selectedIds.size > 0}
        rows={selectedRows}
        onClear={handleClear}
      />
    </>
  )
}
