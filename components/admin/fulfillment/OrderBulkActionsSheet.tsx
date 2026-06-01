'use client'

/**
 * OrderBulkActionsSheet
 *
 * Bottom-anchored sheet listing 4 bulk actions for a selection of orders.
 * Wires directly to server actions in app/admin/fulfillment/actions.ts.
 *
 * Actions (v1 — prompt/confirm UX is intentional simplicity; modal upgrade is Phase 4.5):
 *  1. Mark Shipped      → bulkMarkShipped   (prompt per order for tracking number)
 *  2. Print Labels      → bulkPurchaseLabels (EasyPost batch purchase)
 *  3. Send Tracking     → bulkSendTrackingEmail
 *  4. Export CSV        → bulkExportCsv     (blob download)
 *
 * Phase 4 Task 7.
 */

import { useTransition } from 'react'
import { Truck, Printer, EnvelopeSimple, DownloadSimple } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkMarkShipped,
  bulkPurchaseLabels,
  bulkSendTrackingEmail,
  bulkExportCsv,
} from '@/app/admin/fulfillment/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface OrderBulkActionsSheetProps {
  /** IDs of currently selected orders. */
  orderIds: string[]
  /** Whether the sheet is visible. */
  open: boolean
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function OrderBulkActionsSheet({ orderIds, open, onClear }: OrderBulkActionsSheetProps) {
  const [, startTransition] = useTransition()

  // ── 1. Mark Shipped ────────────────────────────────────────────────────────

  function handleMarkShipped() {
    const tracking: Record<string, { trackingNumber: string }> = {}
    for (const id of orderIds) {
      const tn = window.prompt(`Tracking number for order ${id}?`)
      if (tn && tn.trim()) tracking[id] = { trackingNumber: tn.trim() }
    }
    if (Object.keys(tracking).length === 0) return

    startTransition(async () => {
      try {
        const r = await bulkMarkShipped(orderIds, tracking)
        if (r.ok) {
          toast.success(`${r.affected} order${r.affected === 1 ? '' : 's'} marked shipped`)
          onClear()
        } else {
          toast.error(r.error)
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 2. Print Labels ────────────────────────────────────────────────────────

  function handlePrintLabels() {
    startTransition(async () => {
      try {
        const r = await bulkPurchaseLabels(orderIds)
        if (r.ok) {
          toast.success(`Purchased ${r.affected} label${r.affected === 1 ? '' : 's'}`)
          onClear()
        } else {
          toast.error(r.error)
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 3. Send Tracking Email ─────────────────────────────────────────────────

  function handleSendTracking() {
    startTransition(async () => {
      try {
        const r = await bulkSendTrackingEmail(orderIds)
        if (r.ok) {
          toast.success(`Tracking email sent for ${r.affected} order${r.affected === 1 ? '' : 's'}`)
          onClear()
        } else {
          toast.error(r.error)
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 4. Export CSV ──────────────────────────────────────────────────────────

  function handleExportCsv() {
    startTransition(async () => {
      try {
        const r = await bulkExportCsv(orderIds)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        const csv = r.data?.csv ?? ''
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `orders-${Date.now()}.csv`
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BottomActionSheet
      open={open}
      count={orderIds.length}
      onCancel={onClear}
      actions={[
        {
          label: 'Mark Shipped',
          icon: <Truck size={14} weight="bold" />,
          onClick: handleMarkShipped,
        },
        {
          label: 'Print Labels',
          icon: <Printer size={14} weight="bold" />,
          onClick: handlePrintLabels,
        },
        {
          label: 'Send Tracking',
          icon: <EnvelopeSimple size={14} weight="bold" />,
          onClick: handleSendTracking,
        },
        {
          label: 'Export CSV',
          icon: <DownloadSimple size={14} weight="bold" />,
          onClick: handleExportCsv,
        },
      ]}
    />
  )
}
