// components/admin/fulfillment/detail/RefundDialog.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { createRefund } from '@/app/admin/fulfillment/actions'
import type { RefundType } from '@prisma/client'

interface RefundDialogProps {
  open: boolean
  orderId: string
  maxAmount: number
  returnId?: string
  onClose: () => void
  onSuccess?: (refundId: string) => void
}

export function RefundDialog({
  open,
  orderId,
  maxAmount,
  returnId,
  onClose,
  onSuccess,
}: RefundDialogProps) {
  const [amount, setAmount] = useState<string>(maxAmount.toFixed(2))
  const [type, setType] = useState<RefundType>('FULL')
  const [reason, setReason] = useState('')
  const [, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Invalid amount')
      return
    }
    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }
    startTransition(async () => {
      const r = await createRefund(orderId, {
        amount: n,
        type,
        reason: reason.trim(),
        ...(returnId ? { returnId } : {}),
      })
      if (r.ok) {
        toast.success(`Refund processed (${r.data?.stripeRefundId ?? 'no stripe id'})`)
        onSuccess?.(r.data?.refundId ?? '')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-neutral-900 border border-white/8 rounded-lg p-5 w-full max-w-md space-y-3">
        <h3 className="text-sm font-semibold text-white">Process refund</h3>

        <div>
          <label htmlFor="refund-amount" className="text-xs text-white/50 block mb-1">
            Amount
          </label>
          <input
            id="refund-amount"
            type="number"
            step="0.01"
            min={0.01}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
          />
        </div>

        <div>
          <label htmlFor="refund-type" className="text-xs text-white/50 block mb-1">
            Type
          </label>
          <select
            id="refund-type"
            value={type}
            onChange={(e) => setType(e.target.value as RefundType)}
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm"
          >
            <option value="FULL">Full</option>
            <option value="PARTIAL">Partial</option>
            <option value="SHIPPING_ONLY">Shipping only</option>
          </select>
        </div>

        <div>
          <label htmlFor="refund-reason" className="text-xs text-white/50 block mb-1">
            Reason
          </label>
          <textarea
            id="refund-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm resize-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-xs bg-white/[0.06] text-white px-3 py-2 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 px-3 py-2 rounded"
          >
            Submit refund
          </button>
        </div>
      </div>
    </div>
  )
}
