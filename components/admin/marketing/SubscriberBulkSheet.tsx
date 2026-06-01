'use client'

/**
 * SubscriberBulkSheet
 *
 * Bottom-anchored sheet listing 3 bulk actions for a selection of newsletter
 * subscribers. Wires directly to server actions in app/admin/marketing/actions.ts.
 *
 * Actions:
 *  1. Unsubscribe  → bulkUnsubscribeSubscribers   (sets isActive=false)
 *  2. Export CSV   → bulkExportSubscribersCsv      (blob download)
 *  3. Delete       → bulkDeleteSubscribers          (SUPER_ADMIN-gated; disabled if not)
 *
 * Phase 5 Task 12.
 */

import { useTransition } from 'react'
import { Prohibit, DownloadSimple, Trash } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkUnsubscribeSubscribers,
  bulkExportSubscribersCsv,
  bulkDeleteSubscribers,
} from '@/app/admin/marketing/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SubscriberBulkSheetProps {
  /** Whether the sheet is visible. */
  open: boolean
  /** IDs of currently selected subscribers. */
  ids: string[]
  /** Whether the current user has SUPER_ADMIN role (gates Delete). */
  isSuperAdmin: boolean
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SubscriberBulkSheet({
  open,
  ids,
  isSuperAdmin,
  onClear,
}: SubscriberBulkSheetProps) {
  const [, startTransition] = useTransition()

  // ── 1. Unsubscribe ─────────────────────────────────────────────────────────

  function handleUnsubscribe() {
    if (!window.confirm(`Unsubscribe ${ids.length} subscriber${ids.length === 1 ? '' : 's'}?`)) return
    startTransition(async () => {
      try {
        const r = await bulkUnsubscribeSubscribers(ids)
        if (r.ok) {
          toast.success(`${r.affected} subscriber${r.affected === 1 ? '' : 's'} unsubscribed`)
          onClear()
        } else {
          toast.error(r.error ?? 'Failed to unsubscribe')
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 2. Export CSV ──────────────────────────────────────────────────────────

  function handleExportCsv() {
    startTransition(async () => {
      try {
        const r = await bulkExportSubscribersCsv(ids)
        if (!r.ok) {
          toast.error(r.error ?? 'Export failed')
          return
        }
        const csv = r.data?.csv ?? ''
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `subscribers-${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        toast.success('CSV downloaded')
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 3. Delete (SUPER_ADMIN only) ───────────────────────────────────────────

  function handleDelete() {
    if (!window.confirm(`Permanently delete ${ids.length} subscriber${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        const r = await bulkDeleteSubscribers(ids)
        if (r.ok) {
          toast.success(`${r.affected} subscriber${r.affected === 1 ? '' : 's'} deleted`)
          onClear()
        } else {
          toast.error(r.error ?? 'Failed to delete')
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
      count={ids.length}
      onCancel={onClear}
      actions={[
        {
          label: 'Unsubscribe',
          icon: <Prohibit size={14} weight="bold" />,
          onClick: handleUnsubscribe,
        },
        {
          label: 'Export CSV',
          icon: <DownloadSimple size={14} weight="bold" />,
          onClick: handleExportCsv,
        },
        {
          label: 'Delete',
          icon: <Trash size={14} weight="bold" />,
          onClick: handleDelete,
          variant: 'destructive',
          disabled: !isSuperAdmin,
        },
      ]}
    />
  )
}
