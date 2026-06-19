import Link from 'next/link'
import { loadCustomerSupportTickets } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export interface CustomerSupportTicketsPanelProps {
  customerId: string
}

export async function CustomerSupportTicketsPanel({ customerId }: CustomerSupportTicketsPanelProps) {
  const data = await loadCustomerSupportTickets(customerId)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Support tickets</h2>
        <span className="text-xs text-white/40">{data.total} total</span>
      </header>
      {data.items.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No support tickets.</div>
      ) : (
        <ul>
          {data.items.map((t) => (
            <li key={t.id} className="border-b border-white/4 last:border-b-0">
              <Link
                href={`/admin/support/${t.id}`}
                className="block px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between gap-2"
              >
                <span className="text-sm text-white">{t.ticketNumber}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 font-semibold">
                  {t.type}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 font-semibold">
                  {t.status}
                </span>
                <span className="text-xs text-white/50">{t.priority}</span>
                <span className="text-xs text-white/40">{dFmt.format(t.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
