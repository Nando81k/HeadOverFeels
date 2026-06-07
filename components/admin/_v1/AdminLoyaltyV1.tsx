import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

const SECTIONS = [
  {
    href: '/admin/loyalty-v1',
    title: 'Overview (Legacy)',
    desc: 'Original loyalty dashboard with stats and quick controls',
  },
  {
    href: '/admin/loyalty/customers',
    title: 'Members',
    desc: 'Customer loyalty list',
  },
  {
    href: '/admin/loyalty/tiers',
    title: 'Tiers',
    desc: 'Tier configuration',
  },
  {
    href: '/admin/loyalty/rewards',
    title: 'Rewards',
    desc: 'Reward catalog',
  },
  {
    href: '/admin/loyalty/redemptions',
    title: 'Redemptions',
    desc: 'Redemption audit',
  },
  {
    href: '/admin/loyalty/events',
    title: 'Events',
    desc: 'Multiplier events',
  },
  {
    href: '/admin/loyalty/settings',
    title: 'Settings',
    desc: 'Program settings',
  },
]

/**
 * V1 stub for /admin/loyalty. The unified loyalty dashboard arrives in V2 — this
 * surfaces the seven legacy sub-routes so the route still resolves when the
 * NEXT_PUBLIC_ADMIN_V2_ENABLED flag is off.
 */
export function AdminLoyaltyV1() {
  return (
    <AdminLayout
      title="Loyalty"
      subtitle="Overview, members, tiers, rewards, redemptions, events"
    >
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified loyalty dashboard is in beta. Enable{' '}
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
