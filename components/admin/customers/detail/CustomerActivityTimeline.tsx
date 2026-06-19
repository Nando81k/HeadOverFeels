import Link from 'next/link'
import type { ActivityEvent } from '@/lib/admin/customers'
import { loadCustomerActivity } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

const ICON: Record<ActivityEvent['type'], string> = {
  order: '📦',
  points: '⭐',
  review: '✍️',
  ticket: '🎟️',
}

export interface CustomerActivityTimelineProps {
  customerId: string
}

export async function CustomerActivityTimeline({ customerId }: CustomerActivityTimelineProps) {
  const events = await loadCustomerActivity(customerId, 50)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Activity</h2>
        <span className="text-xs text-white/40">{events.length} events</span>
      </header>
      {events.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No recent activity.</div>
      ) : (
        <ol className="p-3 space-y-2">
          {events.map((e) => {
            const orderHref =
              e.type === 'order'
                ? `/admin/fulfillment/${e.id.replace('order-', '')}`
                : null

            const inner = (
              <span className="flex items-start gap-2 text-xs">
                <span className="shrink-0 mt-0.5">{ICON[e.type] ?? '•'}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-white/80">
                    {e.label}
                    {e.meta ? (
                      <span className="text-white/50 ml-1">— {e.meta}</span>
                    ) : null}
                  </span>
                  <span className="block text-white/40">{dFmt.format(e.timestamp)}</span>
                </span>
              </span>
            )

            return (
              <li key={e.id}>
                {orderHref ? (
                  <Link
                    href={orderHref}
                    className="block hover:bg-white/[0.03] rounded px-1 py-0.5"
                  >
                    {inner}
                  </Link>
                ) : (
                  <span className="block px-1 py-0.5">{inner}</span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
