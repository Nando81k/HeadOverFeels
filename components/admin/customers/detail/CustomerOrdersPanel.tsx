import Link from 'next/link'
import { loadCustomerOrders } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const $Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface CustomerOrdersPanelProps {
  customerId: string
  page?: number
}

export async function CustomerOrdersPanel({ customerId, page = 1 }: CustomerOrdersPanelProps) {
  const data = await loadCustomerOrders(customerId, page)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Orders</h2>
        <span className="text-xs text-white/40">{data.total} total</span>
      </header>
      {data.items.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No orders yet.</div>
      ) : (
        <ul>
          {data.items.map((o) => (
            <li key={o.id} className="border-b border-white/4 last:border-b-0">
              <Link
                href={`/admin/fulfillment/${o.id}`}
                className="block px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between gap-2"
              >
                <span className="text-sm text-white">{o.orderNumber}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 font-semibold">
                  {o.status}
                </span>
                <span className="text-sm text-white/80">{$Fmt.format(o.total)}</span>
                <span className="text-xs text-white/40">{dFmt.format(o.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
