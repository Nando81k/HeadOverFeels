'use client'

/**
 * CampaignBulkSheet
 *
 * Bottom-anchored sheet with 2 bulk actions for a selection of campaigns.
 * Wires directly to server actions in app/admin/marketing/actions.ts.
 *
 * Actions:
 *  1. Duplicate  → bulkDuplicateCampaigns(ids)  (any status — always allowed)
 *  2. Delete drafts → warns if any row is non-DRAFT, then confirms and
 *                     calls bulkDeleteCampaigns(ids)
 *
 * Phase 5 Task 13.
 */

import { useTransition } from 'react'
import type { CampaignStatusValue } from '@/lib/admin/marketing'
import { Copy, Trash } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkDuplicateCampaigns,
  bulkDeleteCampaigns,
} from '@/app/admin/marketing/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CampaignBulkSheetProps {
  /** Whether the sheet is visible. */
  open: boolean
  /** Selected rows — needs full rows (not just ids) to detect non-DRAFT status client-side. */
  rows: Array<{ id: string; status: CampaignStatusValue }>
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CampaignBulkSheet({ open, rows, onClear }: CampaignBulkSheetProps) {
  const [, startTransition] = useTransition()

  const ids = rows.map((r) => r.id)
  const hasNonDraft = rows.some((r) => r.status !== 'DRAFT')

  // ── 1. Duplicate ────────────────────────────────────────────────────────────

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const r = await bulkDuplicateCampaigns(ids)
        if (r.ok) {
          toast.success(`${r.affected} campaign${r.affected === 1 ? '' : 's'} duplicated`)
          onClear()
        } else {
          toast.error(r.error ?? 'Failed to duplicate campaigns')
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 2. Delete (drafts only) ─────────────────────────────────────────────────

  function handleDelete() {
    if (hasNonDraft) {
      toast.warning('Only DRAFT campaigns can be deleted')
      return
    }
    const count = rows.length
    if (!window.confirm(`Delete ${count} campaign${count === 1 ? '' : 's'} (drafts only)?`)) return

    startTransition(async () => {
      try {
        const r = await bulkDeleteCampaigns(ids)
        if (r.ok) {
          toast.success(`${r.affected} campaign${r.affected === 1 ? '' : 's'} deleted`)
          onClear()
        } else {
          toast.error(r.error ?? 'Failed to delete campaigns')
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BottomActionSheet
      open={open}
      count={rows.length}
      onCancel={onClear}
      actions={[
        {
          label: 'Duplicate',
          icon: <Copy size={14} weight="bold" />,
          onClick: handleDuplicate,
        },
        {
          label: 'Delete drafts',
          icon: <Trash size={14} weight="bold" />,
          onClick: handleDelete,
        },
      ]}
    />
  )
}
