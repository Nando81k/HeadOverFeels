'use client'

/**
 * AbandonedCartBulkSheet
 *
 * Bottom-anchored sheet listing 3 bulk actions for a selection of abandoned carts.
 * Wires directly to server actions in app/admin/marketing/actions.ts.
 *
 * Actions:
 *  1. Send Recovery     → bulkSendRecoveryEmails
 *  2. Generate Codes    → confirm prompt → bulkGenerateRecoveryCodes
 *  3. Mark Recovered    → confirm prompt → bulkMarkCartsRecovered
 *
 * Phase 5 Task 14.
 */

import { useTransition } from 'react'
import { EnvelopeSimple, Ticket, Check } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkSendRecoveryEmails,
  bulkGenerateRecoveryCodes,
  bulkMarkCartsRecovered,
} from '@/app/admin/marketing/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AbandonedCartBulkSheetProps {
  /** IDs of currently selected carts. */
  ids: string[]
  /** Whether the sheet is visible. */
  open: boolean
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AbandonedCartBulkSheet({ open, ids, onClear }: AbandonedCartBulkSheetProps) {
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

  // ── 1. Send Recovery ───────────────────────────────────────────────────────

  function handleSendRecovery() {
    run(bulkSendRecoveryEmails, 'recovery emails queued')
  }

  // ── 2. Generate Codes ──────────────────────────────────────────────────────

  function handleGenerateCodes() {
    const ok = window.confirm(
      `Generate one-time 10%-off codes for ${ids.length} cart${ids.length === 1 ? '' : 's'}?`,
    )
    if (!ok) return
    run(bulkGenerateRecoveryCodes, 'codes generated')
  }

  // ── 3. Mark Recovered ──────────────────────────────────────────────────────

  function handleMarkRecovered() {
    const ok = window.confirm(
      `Mark ${ids.length} cart${ids.length === 1 ? '' : 's'} as recovered?`,
    )
    if (!ok) return
    run(bulkMarkCartsRecovered, 'marked recovered')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BottomActionSheet
      open={open}
      count={ids.length}
      onCancel={onClear}
      actions={[
        {
          label: 'Send Recovery',
          icon: <EnvelopeSimple size={14} weight="bold" />,
          onClick: handleSendRecovery,
        },
        {
          label: 'Generate Codes',
          icon: <Ticket size={14} weight="bold" />,
          onClick: handleGenerateCodes,
        },
        {
          label: 'Mark Recovered',
          icon: <Check size={14} weight="bold" />,
          onClick: handleMarkRecovered,
        },
      ]}
    />
  )
}
