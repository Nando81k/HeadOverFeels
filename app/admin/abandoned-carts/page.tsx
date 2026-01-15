import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import AbandonedCarts from '@/components/admin/AbandonedCarts'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function AbandonedCartsPage() {
  const pendingOrdersCount = await prisma.order.count({ 
    where: { status: 'PENDING' } 
  })

  return (
    <AdminLayout
      title="Abandoned Carts"
      subtitle="Track and recover abandoned shopping carts"
      pendingOrders={pendingOrdersCount}
    >
      <AbandonedCarts 
        refreshInterval={30000}
        maxItems={20}
      />
    </AdminLayout>
  )
}
