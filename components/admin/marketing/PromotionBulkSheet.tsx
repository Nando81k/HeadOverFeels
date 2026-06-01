'use client'

/**
 * PromotionBulkSheet
 *
 * Bottom-anchored sheet listing 3 bulk actions for a selection of promotions.
 * Wires directly to server actions in app/admin/marketing/actions.ts.
 *
 * Actions:
 *  1. Activate    → bulkActivatePromotions(ids)
 *  2. Deactivate  → bulkDeactivatePromotions(ids)
 *  3. Delete      → confirm prompt → bulkDeletePromotions(ids)
 *
 * Phase 5 Task 10.
 */

import { useTransition } from 'react'
import { Check, Prohibit, Trash } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkActivatePromotions,
  bulkDeactivatePromotions,
  bulkDeletePromotions,
} from '@/app/admin/marketing/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PromotionBulkSheetProps {
  /** Whether the sheet is visible. */
  open: boolean
  /** IDs of currently selected promotions. */
  ids: string[]
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PromotionBulkSheet({ open, ids, onClear }: PromotionBulkSheetProps) {
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
    run(bulkActivatePromotions, 'activated')
  }

  // ── 2. Deactivate ──────────────────────────────────────────────────────────

  function handleDeactivate() {
    run(bulkDeactivatePromotions, 'deactivated')
  }

  // ── 3. Delete ──────────────────────────────────────────────────────────────

  function handleDelete() {
    if (window.confirm(`Delete ${ids.length} promotion${ids.length === 1 ? '' : 's'}?`)) {
      run(bulkDeletePromotions, 'deleted')
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
          label: 'Delete',
          icon: <Trash size={14} weight="bold" />,
          onClick: handleDelete,
          variant: 'destructive',
        },
      ]}
    />
  )
}
