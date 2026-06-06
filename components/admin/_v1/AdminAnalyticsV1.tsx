import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

const SECTIONS = [
  { href: '/admin/analytics-v1', title: 'Analytics (Legacy)', desc: 'Original analytics dashboard with charts and KPIs' },
  { href: '/admin/financial', title: 'Financial', desc: 'P&L, taxes, period grid, snapshots' },
  { href: '/admin/sales', title: 'Sales', desc: 'Revenue trends and top products' },
  { href: '/admin/expenses', title: 'Expenses', desc: 'Category breakdown and monthly bars' },
  { href: '/admin/goals', title: 'Sales Goals', desc: 'Daily / weekly / monthly / quarterly / yearly targets' },
  { href: '/admin/live-feed', title: 'Live Feed', desc: 'Real-time order and customer activity' },
]

/**
 * V1 stub for /admin/analytics. There is no unified analytics dashboard in V1 —
 * this surfaces the six legacy tools so the route still resolves when the
 * NEXT_PUBLIC_ADMIN_V2_ENABLED flag is off.
 */
export function AdminAnalyticsV1() {
  return (
    <AdminLayout title="Analytics" subtitle="Sales, customers, products, financial, expenses, live feed">
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified analytics dashboard is in beta. Enable{' '}
          <code className="font-mono">NEXT_PUBLIC_ADMIN_V2_ENABLED=true</code> to try it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="block">
              <Card className="p-4 hover:bg-white/[0.04] transition-colors">
                <h3 className="text-base font-semibold text-white">{s.title}</h3>
                <p className="text-sm text-white/50 mt-1">{s.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
