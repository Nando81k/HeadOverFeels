import { Bag } from '@phosphor-icons/react/dist/ssr'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DashboardCard } from '@/components/admin/DashboardCard'
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
      {/* Abandoned Carts Recovery */}
      <div className="mb-8">
        <DashboardCard
          title="Abandoned Cart Recovery"
          icon={<Bag size={20} weight="bold" className="text-purple-400" />}
        >
          <AbandonedCarts 
            refreshInterval={30000}
            maxItems={20}
          />
        </DashboardCard>
      </div>
    </AdminLayout>
  )
}
