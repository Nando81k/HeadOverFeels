import Link from 'next/link'
import { loadCustomerReviews } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n))
}

export interface CustomerReviewsPanelProps {
  customerId: string
}

export async function CustomerReviewsPanel({ customerId }: CustomerReviewsPanelProps) {
  const data = await loadCustomerReviews(customerId)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Reviews</h2>
        <span className="text-xs text-white/40">{data.total} total</span>
      </header>
      {data.items.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No reviews yet.</div>
      ) : (
        <ul>
          {data.items.map((r) => (
            <li key={r.id} className="border-b border-white/4 last:border-b-0">
              <Link
                href={`/admin/reviews/${r.id}`}
                className="block px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between gap-2"
              >
                <span className="text-sm text-white truncate">{r.productName}</span>
                <span className="text-amber-300 text-xs">{stars(r.rating)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 font-semibold">
                  {r.status}
                </span>
                <span className="text-xs text-white/40">{dFmt.format(r.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
