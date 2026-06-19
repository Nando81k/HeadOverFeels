import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { loadCustomerHeader } from '@/lib/admin/customers'
import { CustomerHeader } from '@/components/admin/customers/detail/CustomerHeader'
import { CustomerOrdersPanel } from '@/components/admin/customers/detail/CustomerOrdersPanel'
import { CustomerLoyaltyPanel } from '@/components/admin/customers/detail/CustomerLoyaltyPanel'
import { CustomerReviewsPanel } from '@/components/admin/customers/detail/CustomerReviewsPanel'
import { CustomerActivityTimeline } from '@/components/admin/customers/detail/CustomerActivityTimeline'
import { CustomerAddressesPanel } from '@/components/admin/customers/detail/CustomerAddressesPanel'
import { CustomerNotesPanel } from '@/components/admin/customers/detail/CustomerNotesPanel'
import { CustomerSupportTicketsPanel } from '@/components/admin/customers/detail/CustomerSupportTicketsPanel'
import { CustomerRiskWidget } from '@/components/admin/customers/detail/CustomerRiskWidget'

export interface AdminCustomerDetailV2Props {
  customerId: string
  isSuperAdmin: boolean
}

function WidgetSkeleton() {
  return (
    <div
      aria-hidden
      className="h-40 bg-white/[0.03] border border-white/8 rounded-md animate-pulse"
    />
  )
}

export async function AdminCustomerDetailV2({
  customerId,
  isSuperAdmin,
}: AdminCustomerDetailV2Props) {
  const header = await loadCustomerHeader(customerId)
  if (!header) notFound()

  return (
    <AdminLayout title="Customer" subtitle={header.email}>
      <div className="space-y-3.5">
        <CustomerHeader header={header} isSuperAdmin={isSuperAdmin} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerOrdersPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerLoyaltyPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerReviewsPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerActivityTimeline customerId={customerId} />
            </Suspense>
          </div>
          <div className="space-y-3">
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerAddressesPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerNotesPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerSupportTicketsPanel customerId={customerId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerRiskWidget customerId={customerId} />
            </Suspense>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
