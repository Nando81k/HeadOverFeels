'use client'

import { useState, useTransition } from 'react'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  sendCartRecoveryEmail,
  generateCartRecoveryCode,
  markCartRecovered,
} from '@/app/admin/marketing/actions'
import type { AbandonedCartDetailFull } from '@/app/admin/marketing/actions'

export interface AbandonedCartInspectorProps {
  open: boolean
  detail: AbandonedCartDetailFull | null
  onClose: () => void
  onMutated?: (id: string) => void
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AbandonedCartInspector({
  open,
  detail,
  onClose,
  onMutated,
}: AbandonedCartInspectorProps) {
  const [, startTransition] = useTransition()
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  function handleSendRecovery() {
    if (!detail) return
    startTransition(async () => {
      const r = await sendCartRecoveryEmail(detail.id)
      if (r.ok) {
        toast.success('Recovery email queued')
        onMutated?.(detail.id)
      } else {
        toast.error('Failed to send recovery email')
      }
    })
  }

  function handleGenerateCode() {
    if (!detail) return
    startTransition(async () => {
      const r = await generateCartRecoveryCode(detail.id)
      if (r.ok && r.data) {
        setGeneratedCode(r.data.code)
        toast.success(`Code generated: ${r.data.code}`)
        onMutated?.(detail.id)
      } else {
        toast.error('Failed to generate recovery code')
      }
    })
  }

  function handleMarkRecovered() {
    if (!detail) return
    if (!window.confirm('Mark this cart as recovered?')) return
    startTransition(async () => {
      const r = await markCartRecovered(detail.id)
      if (r.ok) {
        toast.success('Cart marked as recovered')
        onMutated?.(detail.id)
      } else {
        toast.error('Failed to mark as recovered')
      }
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title={detail?.customerEmail ?? 'Abandoned cart'}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* Header: customer info */}
          <div className="bg-neutral-900/60 border border-white/8 rounded-lg p-4">
            <p className="text-white font-semibold text-sm">
              {detail.customerName ?? detail.customerEmail}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">{detail.customerEmail}</p>
            <p className="text-[11px] text-white/40 mt-1">
              Abandoned {formatDate(detail.abandonedAt)}
            </p>
          </div>

          {/* Cart contents */}
          <div className="bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-white/8 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-white/40">
                {detail.itemCount} item{detail.itemCount === 1 ? '' : 's'}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {formatCurrency(detail.totalValue)}
              </span>
            </div>
            <ul className="divide-y divide-white/[0.04]">
              {detail.items.map((item, i) => (
                <li key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{item.productName}</p>
                    {item.variantDetails && (
                      <p className="text-[11px] text-white/40 mt-0.5">{item.variantDetails}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-sm tabular-nums">
                      {formatCurrency(item.price)}
                    </p>
                    <p className="text-[11px] text-white/40">x{item.quantity}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Recovery status section */}
          {(detail.recoveryEmailSent || detail.discountCode || generatedCode || detail.recovered) && (
            <div className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-white/40 mb-2">
                Recovery status
              </p>
              {detail.recoveryEmailSent && (
                <p className="text-[11px] text-white/60">
                  Recovery email sent{detail.recoveryEmailSentAt ? ` ${formatDate(detail.recoveryEmailSentAt)}` : ''}
                </p>
              )}
              {(generatedCode ?? detail.discountCode) && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-3 mt-2">
                  <p className="text-[11px] uppercase text-emerald-300/70 mb-1">Code</p>
                  <p className="font-mono text-base text-emerald-200">
                    {generatedCode ?? detail.discountCode}
                  </p>
                  <p className="text-[11px] text-emerald-300/50 mt-1">Active 7 days</p>
                </div>
              )}
              {detail.recovered && (
                <p className="text-[11px] text-white/60">
                  Marked recovered{detail.recoveredAt ? ` ${formatDate(detail.recoveredAt)}` : ''}
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSendRecovery}
              disabled={detail.recoveryEmailSent}
              className="w-full px-4 py-2.5 text-sm bg-white/[0.06] border border-white/15 rounded-lg text-white hover:bg-white/[0.09] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {detail.recoveryEmailSent ? 'Send Recovery Email (sent)' : 'Send Recovery Email'}
            </button>
            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={!!(detail.discountCode || generatedCode) || detail.recovered}
              className="w-full px-4 py-2.5 text-sm bg-white/[0.06] border border-white/15 rounded-lg text-white hover:bg-white/[0.09] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate One-Time Code
            </button>
            <button
              type="button"
              onClick={handleMarkRecovered}
              disabled={detail.recovered}
              className="w-full px-4 py-2.5 text-sm bg-emerald-500/15 border border-emerald-500/40 rounded-lg text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {detail.recovered ? 'Recovered' : 'Mark Recovered'}
            </button>
          </div>
        </div>
      )}
    </Inspector>
  )
}
