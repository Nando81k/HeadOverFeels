'use client'

/**
 * CustomersBulkSheet
 *
 * Bottom-anchored action sheet listing 3 bulk actions for a selection of
 * customers. Wires directly to server actions in app/admin/customers/actions.ts.
 *
 * Actions:
 *  1. Gift Points    → opens AdjustPointsDialog in bulk mode (SUPER_ADMIN-gated inside dialog)
 *  2. Export CSV     → bulkExportCustomersCsv(selectedIds) → Blob download
 *  3. Anonymize      → DISABLED in v1 (tooltip: "Per-customer anonymize only in v1; bulk shipping Phase 8.5")
 *
 * Phase 8 Task 6 (Wave 2).
 */

import { useState, useTransition } from 'react'
import { Gift, DownloadSimple, UserMinus } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { AdjustPointsDialog } from '@/components/admin/loyalty/AdjustPointsDialog'
import { toast } from '@/lib/toast'
import { bulkExportCustomersCsv } from '@/app/admin/customers/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CustomersBulkSheetProps {
  /** IDs of currently selected customers. Sheet is visible when length > 0. */
  selectedIds: string[]
  /** Whether the current user has SUPER_ADMIN role (gates Gift Points dialog). */
  isSuperAdmin: boolean
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CustomersBulkSheet({
  selectedIds,
  isSuperAdmin,
  onClear,
}: CustomersBulkSheetProps) {
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [, startTransition] = useTransition()

  // ── 1. Gift Points (opens AdjustPointsDialog in bulk mode) ────────────────

  function handleGiftPoints() {
    setAdjustOpen(true)
  }

  // ── 2. Export CSV ──────────────────────────────────────────────────────────

  function handleExportCsv() {
    startTransition(async () => {
      try {
        const r = await bulkExportCustomersCsv(selectedIds)
        if (!r.ok) {
          toast.error(r.error ?? 'Export failed')
          return
        }
        const csv = r.data?.csv ?? ''
        downloadCsv(csv, `customers-${Date.now()}.csv`)
        toast.success('CSV downloaded')
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <BottomActionSheet
        open={selectedIds.length > 0}
        count={selectedIds.length}
        onCancel={onClear}
        actions={[
          {
            label: 'Gift Points',
            icon: <Gift size={14} weight="bold" />,
            onClick: handleGiftPoints,
          },
          {
            label: 'Export CSV',
            icon: <DownloadSimple size={14} weight="bold" />,
            onClick: handleExportCsv,
          },
          {
            label: 'Anonymize',
            icon: <UserMinus size={14} weight="bold" />,
            onClick: () => {},
            disabled: true,
            variant: 'destructive',
            title: 'Per-customer anonymize only in v1; bulk shipping Phase 8.5',
          },
        ]}
      />
      <AdjustPointsDialog
        open={adjustOpen}
        memberIds={selectedIds}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setAdjustOpen(false)}
        onSaved={() => {
          setAdjustOpen(false)
          onClear()
        }}
      />
    </>
  )
}
