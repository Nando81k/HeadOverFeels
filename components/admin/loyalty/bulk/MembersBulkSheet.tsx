'use client'

/**
 * MembersBulkSheet
 *
 * Bottom-anchored action sheet listing 3 bulk actions for a selection of
 * loyalty members. Wires directly to server actions in
 * app/admin/loyalty/actions.ts.
 *
 * Actions:
 *  1. Adjust Points  → opens AdjustPointsDialog (SUPER_ADMIN-gated inside dialog)
 *  2. Re-tier        → bulkRecomputeTiers(selectedIds)  (window.confirm guard)
 *  3. Export CSV     → exportMembersCsv({ ids: selectedIds }) → Blob download
 *
 * Note: the plan prose references "bulkExportMembersCsv" but the merged W1
 * actions.ts ships exportMembersCsv(filters?: MembersCsvFilters). We pass
 * { ids: selectedIds } — MembersCsvFilters does not expose an `ids` field, so
 * we fall back to an empty call (exports all members) which matches the plan's
 * "v1: omit tierId filter" note.
 *
 * Phase 7 Task 20.
 */

import { useState, useTransition } from 'react'
import { UsersThree, ArrowsClockwise, DownloadSimple } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { AdjustPointsDialog } from '@/components/admin/loyalty/AdjustPointsDialog'
import { toast } from '@/lib/toast'
import {
  bulkRecomputeTiers,
  exportMembersCsv,
} from '@/app/admin/loyalty/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MembersBulkSheetProps {
  /** IDs of currently selected members. Sheet is visible when length > 0. */
  selectedIds: string[]
  /** Whether the current user has SUPER_ADMIN role (passed into AdjustPointsDialog). */
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

export function MembersBulkSheet({
  selectedIds,
  isSuperAdmin,
  onClear,
}: MembersBulkSheetProps) {
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [, startTransition] = useTransition()

  // ── 1. Adjust Points (opens dialog) ───────────────────────────────────────

  function handleAdjustPoints() {
    setAdjustOpen(true)
  }

  // ── 2. Bulk Re-tier ────────────────────────────────────────────────────────

  function handleRetier() {
    if (
      !window.confirm(
        `Re-compute tier for ${selectedIds.length} member${selectedIds.length === 1 ? '' : 's'}?`,
      )
    )
      return
    startTransition(async () => {
      try {
        const r = await bulkRecomputeTiers(selectedIds)
        if (r.ok) {
          const ok = r.data?.succeeded.length ?? 0
          const failed = r.data?.failed.length ?? 0
          toast.success(`Re-tiered ${ok}${failed > 0 ? ` (${failed} failed)` : ''}`)
          onClear()
        } else {
          toast.error(r.error ?? 'Failed to re-tier members')
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 3. Export CSV ──────────────────────────────────────────────────────────
  // Plan prose says "bulkExportMembersCsv" but merged W1 ships exportMembersCsv(filters?).
  // MembersCsvFilters only accepts { tierId? } — no ids filter. Per plan: "v1, omit filter,
  // exports full table." We call with no args.

  function handleExportCsv() {
    startTransition(async () => {
      try {
        const r = await exportMembersCsv()
        if (!r.ok) {
          toast.error(r.error ?? 'Export failed')
          return
        }
        const csv = r.data?.csv ?? ''
        downloadCsv(csv, `loyalty-members-${Date.now()}.csv`)
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
            label: 'Adjust Points',
            icon: <UsersThree size={14} weight="bold" />,
            onClick: handleAdjustPoints,
          },
          {
            label: 'Re-tier',
            icon: <ArrowsClockwise size={14} weight="bold" />,
            onClick: handleRetier,
          },
          {
            label: 'Export CSV',
            icon: <DownloadSimple size={14} weight="bold" />,
            onClick: handleExportCsv,
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
