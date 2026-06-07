'use client'

import { useEffect, useState, useTransition } from 'react'
import { adjustMemberPoints, bulkAdjustMemberPoints } from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface AdjustPointsDialogProps {
  open: boolean
  /** Length 1 → single mode; length > 1 → bulk mode (SUPER_ADMIN gated). */
  memberIds: string[]
  isSuperAdmin: boolean
  onClose: () => void
  onSaved?: () => void
}

export function AdjustPointsDialog({
  open,
  memberIds,
  isSuperAdmin,
  onClose,
  onSaved,
}: AdjustPointsDialogProps) {
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')

  // Reset form whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    setAmount(0)
    setReason('')
  }, [open])

  const bulk = memberIds.length > 1
  const disabledByRole = bulk && !isSuperAdmin

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }
    if (amount === 0 || !Number.isFinite(amount)) {
      toast.error('Amount must be a non-zero number')
      return
    }
    startTransition(async () => {
      if (bulk) {
        const r = await bulkAdjustMemberPoints(memberIds, amount, reason.trim())
        if (r.ok) {
          const succeeded = r.data?.succeeded.length ?? 0
          const failed = r.data?.failed.length ?? 0
          toast.success(
            `Adjusted ${succeeded} member${succeeded === 1 ? '' : 's'}${failed > 0 ? ` (${failed} failed)` : ''}`,
          )
          onSaved?.()
          onClose()
        } else {
          toast.error(r.error ?? 'Bulk adjustment failed')
        }
      } else {
        const r = await adjustMemberPoints(memberIds[0], amount, reason.trim())
        if (r.ok) {
          toast.success('Points adjusted')
          onSaved?.()
          onClose()
        } else {
          toast.error(r.error ?? 'Adjustment failed')
        }
      }
    })
  }

  const inputCls =
    'w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20'
  const labelCls = 'text-white/60 text-xs'

  return (
    <Inspector
      open={open}
      onClose={onClose}
      title={bulk ? `Adjust Points — ${memberIds.length} members` : 'Adjust Points'}
      width={420}
    >
      <div className="space-y-4 text-sm">
        {bulk && !isSuperAdmin && (
          <p className="text-xs text-amber-400 border border-amber-400/30 bg-amber-400/10 rounded-md px-3 py-2">
            Bulk point adjustments require SUPER_ADMIN permissions.
          </p>
        )}

        <label className="block">
          <span className={labelCls}>Amount (positive grants, negative deducts)</span>
          <input
            aria-label="amount"
            type="number"
            step="1"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Reason</span>
          <textarea
            aria-label="reason"
            rows={4}
            className={`${inputCls} resize-none`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-white/8">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || disabledByRole}
            title={disabledByRole ? 'SUPER_ADMIN only' : 'Submit adjustment'}
            onClick={handleSubmit}
            className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </Inspector>
  )
}
