'use client'

/**
 * EventsBulkSheet
 *
 * Bottom-anchored action sheet for bulk operations on a selection of
 * PointsMultiplierEvent records. Wires directly to server actions in
 * app/admin/loyalty/actions.ts.
 *
 * Actions:
 *  1. Activate   → bulkActivateEvents(ids)
 *  2. Deactivate → bulkDeactivateEvents(ids)
 *
 * Phase 7 Task 23.
 */

import { useTransition } from 'react'
import { bulkActivateEvents, bulkDeactivateEvents } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface EventsBulkSheetProps {
  /** IDs of currently selected events. */
  selectedIds: string[]
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function EventsBulkSheet({ selectedIds, onClear }: EventsBulkSheetProps) {
  const [pending, startTransition] = useTransition()

  function run(action: typeof bulkActivateEvents, label: string) {
    startTransition(async () => {
      try {
        const r = await action(selectedIds)
        if (r.ok) {
          const ok = r.data?.succeeded.length ?? 0
          const failed = r.data?.failed.length ?? 0
          toast.success(`${label} ${ok}${failed > 0 ? ` (${failed} failed)` : ''}`)
          onClear()
        } else {
          toast.error(r.error ?? 'Failed')
        }
      } catch {
        toast.error('Unexpected error')
      }
    })
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-[420px] z-50 bg-neutral-900/95 border border-white/8 rounded-md p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/80">
          {selectedIds.length} selected
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run(bulkActivateEvents, 'Activated')}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => run(bulkDeactivateEvents, 'Deactivated')}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white disabled:opacity-50"
          >
            Deactivate
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-white/50 hover:text-white disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
