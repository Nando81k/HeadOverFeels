// components/admin/fulfillment/detail/RefundDialog.tsx
// TODO: Task 21 will replace this stub with the full RefundDialog implementation.
// This file exists only so OrderPaymentPanel can import it without TS/build errors.
'use client'

export interface RefundDialogProps {
  open: boolean
  orderId: string
  maxAmount: number
  onClose: () => void
}

export function RefundDialog({ open, onClose }: RefundDialogProps) {
  if (!open) return null

  return (
    <dialog
      open
      aria-label="Refund dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-white/8 rounded-lg p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white text-sm">Refund dialog (Task 21 — coming soon)</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-xs text-white/50 hover:text-white"
        >
          Close
        </button>
      </div>
    </dialog>
  )
}
