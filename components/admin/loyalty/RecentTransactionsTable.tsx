import type { PointsTransactionType } from '@/app/admin/loyalty/actions'

export interface RecentTransactionRow {
  id: string
  customerEmail: string
  customerName: string | null
  type: PointsTransactionType
  points: number
  description: string
  createdAt: Date
}

export interface RecentTransactionsTableProps {
  transactions: RecentTransactionRow[]
}

const TYPE_COLORS: Record<PointsTransactionType, string> = {
  PURCHASE: '#6366f1',
  ACCOUNT_CREATION: '#10b981',
  FIRST_PURCHASE: '#10b981',
  REVIEW: '#f59e0b',
  SOCIAL_FOLLOW: '#06b6d4',
  SOCIAL_SHARE: '#06b6d4',
  UGC_UPLOAD: '#06b6d4',
  BIRTHDAY: '#ec4899',
  REFERRAL_GIVE: '#8b5cf6',
  REFERRAL_RECEIVE: '#8b5cf6',
  ADMIN_ADJUSTMENT: '#FF3131',
  TIER_BONUS: '#fbbf24',
  REDEMPTION: '#ef4444',
  EXPIRATION: '#6b7280',
}

function relative(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  return d.toLocaleDateString()
}

export function RecentTransactionsTable({ transactions }: RecentTransactionsTableProps) {
  if (transactions.length === 0) {
    return <div className="text-xs text-white/40 py-2">No recent activity.</div>
  }

  return (
    <ul className="divide-y divide-white/8">
      {transactions.map((t) => {
        const color = TYPE_COLORS[t.type as PointsTransactionType] ?? '#6b7280'
        return (
          <li key={t.id} className="flex items-center gap-3 py-2 text-xs text-white/80">
            <span
              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0"
              style={{ backgroundColor: `${color}33`, color }}
            >
              {t.type}
            </span>
            <span className="flex-1 truncate min-w-0">
              <span className="text-white">{t.customerEmail}</span>
              <span className="text-white/40"> — {t.description}</span>
            </span>
            <span className={t.points >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {t.points >= 0 ? `+${t.points}` : `${t.points}`}
            </span>
            <span className="text-white/40 shrink-0">{relative(t.createdAt)}</span>
          </li>
        )
      })}
    </ul>
  )
}
