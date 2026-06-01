// components/admin/fulfillment/detail/OrderHeader.tsx
import Link from 'next/link'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const STATUS_PILL: Record<string, string> = {
  PENDING:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  CONFIRMED:  'bg-sky-500/15 text-sky-300 border-sky-500/30',
  PROCESSING: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  SHIPPED:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  DELIVERED:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CANCELLED:  'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
  REFUNDED:   'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

interface OrderHeaderProps {
  detail: OrderDetailFull
}

export function OrderHeader({ detail }: OrderHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-white font-mono">{detail.orderNumber}</h1>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${STATUS_PILL[detail.status] ?? ''}`}>
            {detail.status}
          </span>
        </div>
        <div className="text-sm text-white/60 mt-1">
          {detail.customerId ? (
            <Link href={`/admin/customers/${detail.customerId}`} className="text-sky-300 hover:text-sky-200">
              {detail.customerName ?? detail.customerEmail}
            </Link>
          ) : (
            <span>{detail.customerEmail}</span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-white/40">Total</div>
        <div className="text-2xl font-semibold text-white tabular-nums">${detail.total.toFixed(2)}</div>
      </div>
    </header>
  )
}
