'use client'

import { useState, useTransition } from 'react'
import { anonymizeCustomer } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface AnonymizeConfirmDialogProps {
  open: boolean
  customerId: string
  customerEmail: string
  onClose: () => void
}

export function AnonymizeConfirmDialog({
  open, customerId, customerEmail, onClose,
}: AnonymizeConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const matches =
    typed.trim().toLowerCase() === customerEmail.trim().toLowerCase()

  const handleConfirm = () => {
    startTransition(async () => {
      const r = await anonymizeCustomer(customerId, typed)
      if (r.ok) {
        toast.success('Customer anonymized')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Anonymize customer" className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/80"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-950 border border-red-500/30 rounded-md overflow-hidden">
          <div className="p-4 border-b border-white/8">
            <h2 className="text-sm font-semibold text-red-300">Anonymize customer</h2>
          </div>
          <div className="p-4 space-y-3 text-sm text-white/80">
            <p>This will permanently scrub PII for this customer:</p>
            <ul className="list-disc pl-5 text-xs text-white/60 space-y-1">
              <li>Email → <code>deleted-{customerId}@anonymized.local</code></li>
              <li>Name, phone, birthday, profile picture → null</li>
              <li>Orders, loyalty ledger, addresses, audit history preserved</li>
            </ul>
            <p className="text-xs text-red-300">This action cannot be undone.</p>
            <label className="block">
              <span className="text-xs text-white/60">
                Type the email <code className="text-white">{customerEmail}</code> to confirm
              </span>
              <input
                aria-label="type the email"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
              />
            </label>
          </div>
          <div className="p-4 border-t border-white/8 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!matches || isPending}
              className="text-xs px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Anonymize
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
