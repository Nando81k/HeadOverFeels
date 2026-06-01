'use client'

/**
 * PopupBulkSheet
 *
 * Bottom-anchored sheet listing 4 bulk actions for a selection of marketing popups.
 * Wires directly to server actions in app/admin/marketing/actions.ts.
 *
 * Actions:
 *  1. Activate    → bulkActivatePopups
 *  2. Deactivate  → bulkDeactivatePopups
 *  3. Duplicate   → bulkDuplicatePopups
 *  4. Delete      → window.confirm → bulkDeletePopups
 *
 * Phase 5 Task 11.
 */

import { useTransition } from 'react'
import { Check, Prohibit, Copy, Trash } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkActivatePopups,
  bulkDeactivatePopups,
  bulkDuplicatePopups,
  bulkDeletePopups,
} from '@/app/admin/marketing/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PopupBulkSheetProps {
  /** IDs of currently selected popups. */
  ids: string[]
  /** Whether the sheet is visible. */
  open: boolean
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PopupBulkSheet({ open, ids, onClear }: PopupBulkSheetProps) {
  const [, startTransition] = useTransition()

  function run(
    fn: (ids: string[]) => Promise<{ ok: boolean; affected?: number; error?: string }>,
    label: string,
  ) {
    startTransition(async () => {
      try {
        const r = await fn(ids)
        if (r.ok) {
          toast.success(`${r.affected} ${label}`)
          onClear()
        } else {
          toast.error(r.error ?? 'Failed')
        }
      } catch {
        toast.error('Unexpected error')
      }
    })
  }

  // ── 1. Activate ────────────────────────────────────────────────────────────

  function handleActivate() {
    run(bulkActivatePopups, 'activated')
  }

  // ── 2. Deactivate ──────────────────────────────────────────────────────────

  function handleDeactivate() {
    run(bulkDeactivatePopups, 'deactivated')
  }

  // ── 3. Duplicate ───────────────────────────────────────────────────────────

  function handleDuplicate() {
    run(bulkDuplicatePopups, 'duplicated')
  }

  // ── 4. Delete (confirm first) ──────────────────────────────────────────────

  function handleDelete() {
    if (window.confirm(`Delete ${ids.length} popup${ids.length === 1 ? '' : 's'}?`)) {
      run(bulkDeletePopups, 'deleted')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BottomActionSheet
      open={open}
      count={ids.length}
      onCancel={onClear}
      actions={[
        {
          label: 'Activate',
          icon: <Check size={14} weight="bold" />,
          onClick: handleActivate,
        },
        {
          label: 'Deactivate',
          icon: <Prohibit size={14} weight="bold" />,
          onClick: handleDeactivate,
        },
        {
          label: 'Duplicate',
          icon: <Copy size={14} weight="bold" />,
          onClick: handleDuplicate,
        },
        {
          label: 'Delete',
          icon: <Trash size={14} weight="bold" />,
          onClick: handleDelete,
          variant: 'destructive',
        },
      ]}
    />
  )
}
