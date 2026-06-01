// components/admin/fulfillment/detail/OrderShippingPanel.tsx
'use client'

// TODO(phase-4.5): editable address

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { setTracking, purchaseShippingLabel } from '@/app/admin/fulfillment/actions'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

interface OrderShippingPanelProps {
  detail: OrderDetailFull
}

export function OrderShippingPanel({ detail }: OrderShippingPanelProps) {
  const [pending, startTransition] = useTransition()
  const [tn, setTn] = useState(detail.trackingNumber ?? '')
  const [carrier, setCarrier] = useState(detail.carrier ?? '')
  const [labelUrl, setLabelUrl] = useState<string | null>(null)

  void pending

  const handleSaveTracking = () => {
    startTransition(async () => {
      const r = await setTracking(detail.id, { trackingNumber: tn, carrier })
      if (r.ok) {
        toast.success('Tracking saved')
      } else {
        toast.error((r as { ok: false; error: string }).error)
      }
    })
  }

  const handleBuyLabel = () => {
    startTransition(async () => {
      const r = await purchaseShippingLabel(detail.id)
      if (r.ok && r.data) {
        toast.success(`Label purchased — ${r.data.trackingNumber}`)
        if (r.data.trackingNumber) {
          setTn(r.data.trackingNumber)
        }
        if (r.data.labelUrl) {
          setLabelUrl(r.data.labelUrl)
          window.open(r.data.labelUrl, '_blank', 'noopener,noreferrer')
        }
      } else {
        toast.error((r as { ok: false; error: string }).error)
      }
    })
  }

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60 space-y-3">
      <h2 className="text-sm font-semibold text-white">Shipping</h2>

      {/* Shipping address — READ-ONLY in v1 (TODO phase-4.5: editable address) */}
      {detail.shippingAddress ? (
        <div className="text-xs text-white/70 space-y-0.5">
          <div className="text-white">
            {detail.shippingAddress.firstName} {detail.shippingAddress.lastName}
          </div>
          <div>{detail.shippingAddress.address1}</div>
          {detail.shippingAddress.address2 && (
            <div>{detail.shippingAddress.address2}</div>
          )}
          <div>
            {detail.shippingAddress.city}, {detail.shippingAddress.state}{' '}
            {detail.shippingAddress.postalCode}
          </div>
          <div className="text-white/50">{detail.shippingAddress.country}</div>
        </div>
      ) : (
        <p className="text-xs text-white/40">No shipping address on file.</p>
      )}

      {/* Tracking + carrier inputs */}
      <div className="pt-3 border-t border-white/8 space-y-2">
        <div>
          <label
            htmlFor="ship-tn"
            className="text-xs text-white/50 block mb-0.5"
          >
            Tracking number
          </label>
          <input
            id="ship-tn"
            value={tn}
            onChange={(e) => setTn(e.target.value)}
            placeholder="e.g. 1Z999AA10123456784"
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20"
          />
        </div>

        <div>
          <label
            htmlFor="ship-carrier"
            className="text-xs text-white/50 block mb-0.5"
          >
            Carrier
          </label>
          <input
            id="ship-carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="e.g. UPS, FedEx, USPS"
            className="w-full bg-neutral-900/80 border border-white/8 rounded px-2 py-1.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSaveTracking}
            disabled={pending}
            className="text-xs bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors"
          >
            Save tracking
          </button>
          <button
            type="button"
            onClick={handleBuyLabel}
            disabled={pending}
            className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 text-emerald-300 px-3 py-1.5 rounded transition-colors"
          >
            Buy label
          </button>
        </div>

        {/* Label URL — shown after purchase */}
        {labelUrl && (
          <a
            href={labelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-emerald-400 hover:text-emerald-300 truncate mt-1"
          >
            Open label ↗
          </a>
        )}
      </div>
    </section>
  )
}
