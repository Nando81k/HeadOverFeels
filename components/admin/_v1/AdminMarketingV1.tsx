import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

const SECTIONS = [
  { href: '/admin/promotions', title: 'Promotions', desc: 'Discount codes, BOGO, free shipping' },
  { href: '/admin/popups', title: 'Popups', desc: 'Modals, banners, email capture' },
  { href: '/admin/newsletter', title: 'Newsletter', desc: 'Subscribers, campaigns, delivery' },
  { href: '/admin/abandoned-carts', title: 'Abandoned Carts', desc: 'Recovery emails and discount codes' },
]

/**
 * V1 stub for /admin/marketing. There is no unified marketing dashboard in V1 —
 * this surfaces the four existing tools so the route still resolves when the
 * NEXT_PUBLIC_ADMIN_V2_ENABLED flag is off.
 */
export function AdminMarketingV1() {
  return (
    <AdminLayout title="Marketing" subtitle="Promotions, popups, subscribers, campaigns, carts">
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified marketing dashboard is in beta. Enable{' '}
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
