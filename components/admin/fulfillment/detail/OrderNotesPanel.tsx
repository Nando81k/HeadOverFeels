// components/admin/fulfillment/detail/OrderNotesPanel.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { saveOrderNotes } from '@/app/admin/fulfillment/actions'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

interface OrderNotesPanelProps {
  detail: OrderDetailFull
}

function formatSavedAt(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function OrderNotesPanel({ detail }: OrderNotesPanelProps) {
  const [, startTransition] = useTransition()

  const [internalNotes, setInternalNotes] = useState(detail.internalNotes ?? '')
  const [notes, setNotes] = useState(detail.notes ?? '')

  const [internalSavedAt, setInternalSavedAt] = useState<Date | null>(null)
  const [customerSavedAt, setCustomerSavedAt] = useState<Date | null>(null)

  const internalDirty = internalNotes !== (detail.internalNotes ?? '')
  const customerDirty = notes !== (detail.notes ?? '')

  const handleSaveInternal = () => {
    startTransition(async () => {
      const r = await saveOrderNotes(detail.id, { internalNotes })
      if (r.ok) {
        toast.success('Internal notes saved')
        setInternalSavedAt(new Date())
      } else {
        toast.error('error' in r ? r.error : 'Failed to save internal notes')
      }
    })
  }

  const handleSaveCustomer = () => {
    startTransition(async () => {
      const r = await saveOrderNotes(detail.id, { notes })
      if (r.ok) {
        toast.success('Customer notes saved')
        setCustomerSavedAt(new Date())
      } else {
        toast.error('error' in r ? r.error : 'Failed to save customer notes')
      }
    })
  }

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60 space-y-4">
      <h2 className="text-sm font-semibold text-white">Notes</h2>

      {/* Internal notes */}
      <div className="space-y-1.5">
        <label
          htmlFor="internal-notes"
          className="text-xs text-white/50 block"
        >
          Internal notes (operator only)
        </label>
        <textarea
          id="internal-notes"
          aria-label="Internal notes"
          rows={3}
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Add internal notes visible only to admins…"
          className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm placeholder:text-white/30 resize-y focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveInternal}
            disabled={!internalDirty}
            className="text-xs bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded transition-colors"
          >
            Save internal
          </button>
          {internalSavedAt && (
            <span className="text-xs text-white/30">
              Saved {formatSavedAt(internalSavedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Customer notes */}
      <div className="space-y-1.5">
        <label
          htmlFor="customer-notes"
          className="text-xs text-white/50 block"
        >
          Customer notes (visible on receipt)
        </label>
        <textarea
          id="customer-notes"
          aria-label="Customer notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note visible to the customer on their receipt…"
          className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm placeholder:text-white/30 resize-y focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveCustomer}
            disabled={!customerDirty}
            className="text-xs bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded transition-colors"
          >
            Save customer
          </button>
          {customerSavedAt && (
            <span className="text-xs text-white/30">
              Saved {formatSavedAt(customerSavedAt)}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
