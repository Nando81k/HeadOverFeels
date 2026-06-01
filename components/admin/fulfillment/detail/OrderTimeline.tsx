// components/admin/fulfillment/detail/OrderTimeline.tsx
//
// Pure display server component — no client-side logic required.
// Derives a chronological event list from Order timestamp fields.
//
// Schema adaptation:
//   Order has NO paidAt field — we derive "Payment received" from updatedAt when
//   paymentStatus === 'PAID'. This is a best-effort approximation; the exact
//   payment-transition timestamp is not stored in the current schema.
//   TODO(phase-4.5): real paidAt column

import type { OrderDetailFull } from '@/lib/admin/fulfillment'

interface TimelineEvent {
  at: Date
  label: string
  detail?: string
}

interface OrderTimelineProps {
  detail: OrderDetailFull
}

export function OrderTimeline({ detail }: OrderTimelineProps) {
  const events: TimelineEvent[] = []

  // Always present — order was placed at createdAt.
  events.push({ at: detail.createdAt, label: 'Order placed' })

  // Order has no paidAt field — derive from updatedAt as a best-effort timestamp.
  // The updatedAt reflects the last mutation on the order row, which in most flows
  // corresponds to the payment confirmation write.
  // TODO(phase-4.5): real paidAt column
  if (detail.paymentStatus === 'PAID') {
    events.push({ at: detail.updatedAt, label: 'Payment received' })
  }

  if (detail.shippedAt) {
    events.push({
      at: detail.shippedAt,
      label: detail.carrier ? `Shipped via ${detail.carrier}` : 'Shipped',
      detail: detail.trackingNumber ?? undefined,
    })
  }

  if (detail.deliveredAt) {
    events.push({ at: detail.deliveredAt, label: 'Delivered' })
  }

  // Return events — one event per return (requestedAt only; detailed return
  // timeline lives in the ReturnInspector).
  for (const r of detail.returns) {
    events.push({
      at: r.requestedAt,
      label: 'Return requested',
      detail: r.rmaNumber,
    })
  }

  // Sort ascending by timestamp so the timeline reads top-to-bottom = earliest-to-latest.
  events.sort((a, b) => a.at.getTime() - b.at.getTime())

  if (events.length === 0) {
    return (
      <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60">
        <h2 className="text-sm font-semibold text-white mb-3">Timeline</h2>
        <p className="text-xs text-white/40">No events recorded.</p>
      </section>
    )
  }

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60">
      <h2 className="text-sm font-semibold text-white mb-3">Timeline</h2>
      <ol className="space-y-2">
        {events.map((e, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400/60 mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white">{e.label}</div>
              {e.detail && (
                <div className="text-[11px] text-white/50 font-mono">{e.detail}</div>
              )}
              <div className="text-[11px] text-white/40">{e.at.toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
