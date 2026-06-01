// components/admin/fulfillment/detail/OrderReturnsPanel.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { createReturn, type CreateReturnItemInput } from '@/app/admin/fulfillment/actions'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const RETURN_STATUS_PILL: Record<string, string> = {
  REQUESTED: 'bg-amber-500/15 text-amber-300',
  APPROVED:  'bg-sky-500/15 text-sky-300',
  REJECTED:  'bg-red-500/15 text-red-300',
  RECEIVED:  'bg-indigo-500/15 text-indigo-300',
  REFUNDED:  'bg-emerald-500/15 text-emerald-300',
}

interface OrderReturnsPanelProps {
  detail: OrderDetailFull
}

export function OrderReturnsPanel({ detail }: OrderReturnsPanelProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [, startTransition] = useTransition()

  const handleSubmit = () => {
    const items: CreateReturnItemInput[] = detail.items
      .filter((it) => (quantities[it.id] ?? 0) > 0)
      .map((it) => ({
        orderItemId: it.id,
        quantity: quantities[it.id],
        condition: 'UNOPENED' as const,
      }))
    if (items.length === 0) {
      toast.error('Select at least one item')
      return
    }
    startTransition(async () => {
      const r = await createReturn(detail.id, items, reason)
      if (r.ok) {
        toast.success(`Return created: ${r.data?.rmaNumber}`)
        setOpen(false)
        setReason('')
        setQuantities({})
      } else {
        toast.error((r as { ok: false; error: string }).error)
      }
    })
  }

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Returns</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded"
        >
          + Create Return
        </button>
      </div>

      <ul className="space-y-1.5">
        {detail.returns.length === 0 && (
          <li className="text-xs text-white/40">No returns yet.</li>
        )}
        {detail.returns.map((r) => (
          <li key={r.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono text-white">{r.rmaNumber}</span>
              <span className="text-white/40">
                {new Date(r.requestedAt).toLocaleDateString()}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded font-medium ${RETURN_STATUS_PILL[r.status] ?? 'bg-white/10 text-white/60'}`}>
              {r.status}
            </span>
          </li>
        ))}
      </ul>

      {open && (
        <div className="pt-3 border-t border-white/8 space-y-2">
          {detail.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 text-xs">
              <label htmlFor={`qty-${it.id}`} className="flex-1 text-white">
                {it.productName}
              </label>
              <input
                id={`qty-${it.id}`}
                type="number"
                min={0}
                max={it.quantity}
                value={quantities[it.id] ?? 0}
                onChange={(e) =>
                  setQuantities((q) => ({ ...q, [it.id]: parseInt(e.target.value, 10) || 0 }))
                }
                className="w-16 bg-neutral-900/80 border border-white/8 rounded px-2 py-1 text-white"
              />
              <span className="text-white/40">/ {it.quantity}</span>
            </div>
          ))}
          <div>
            <label htmlFor="return-reason" className="text-xs text-white/50 block">
              Reason
            </label>
            <textarea
              id="return-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3 py-2 rounded"
          >
            Submit Return
          </button>
        </div>
      )}
    </section>
  )
}
