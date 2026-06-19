import Link from 'next/link'
import { loadCustomerLoyalty } from '@/lib/admin/customers'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const nFmt = new Intl.NumberFormat('en-US')

export interface CustomerLoyaltyPanelProps {
  customerId: string
}

export async function CustomerLoyaltyPanel({ customerId }: CustomerLoyaltyPanelProps) {
  const data = await loadCustomerLoyalty(customerId)
  if (!data) {
    return (
      <section className="bg-neutral-900/60 border border-white/8 rounded-md p-4 text-sm text-white/40">
        Loyalty data unavailable.
      </section>
    )
  }

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Loyalty</h2>
        <Link
          href={`/admin/loyalty?tab=members&member=${customerId}`}
          className="text-xs text-white/50 hover:text-white"
        >
          View in Loyalty →
        </Link>
      </header>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {data.tierName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{
                background: `${data.tierColor ?? '#64748B'}26`,
                color: data.tierColor ?? '#94A3B8',
              }}
            >
              {data.tierName}
            </span>
          )}
          <span className="text-xs text-white/40">
            since {dFmt.format(data.tierStartDate)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-white/60">
          <div>
            <div className="text-white text-base">{nFmt.format(data.currentPoints)}</div>
            <div>Current</div>
          </div>
          <div>
            <div className="text-white text-base">{nFmt.format(data.lifetimePoints)}</div>
            <div>Lifetime</div>
          </div>
          <div>
            <div className="text-white text-base">{nFmt.format(data.annualPointsEarned)}</div>
            <div>Annual</div>
          </div>
        </div>
        <div className="border-t border-white/8 pt-2">
          {data.transactions.length === 0 ? (
            <div className="text-sm text-white/40 py-2">No points activity yet.</div>
          ) : (
            <ul className="space-y-1">
              {data.transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-xs">
                  <span className="text-white/70">{t.description}</span>
                  <span className={t.points >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                    {t.points >= 0 ? '+' : ''}
                    {nFmt.format(t.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
