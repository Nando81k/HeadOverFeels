import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

export function AdminCustomersV1() {
  return (
    <AdminLayout title="Customers" subtitle="Customer list + segments">
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified customer dashboard is in beta. Enable{' '}
          <code className="font-mono">NEXT_PUBLIC_ADMIN_V2_ENABLED=true</code> to try it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <Link href="/admin/customers-v1" className="block">
            <Card className="p-4 hover:bg-white/[0.04] transition-colors">
              <h3 className="text-base font-semibold text-white">Customers (V1)</h3>
              <p className="text-sm text-white/50 mt-1">Original list + filters + segments</p>
            </Card>
          </Link>
        </div>
      </div>
    </AdminLayout>
  )
}
