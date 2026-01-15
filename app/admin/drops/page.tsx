import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import DropPerformanceAnalytics from '@/components/admin/DropPerformanceAnalytics'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function DropsPage() {
  const pendingOrdersCount = await prisma.order.count({ 
    where: { status: 'PENDING' } 
  })

  return (
    <AdminLayout
      title="Drop Performance"
      subtitle="Analyze limited edition drop performance and metrics"
      pendingOrders={pendingOrdersCount}
    >
      <DropPerformanceAnalytics refreshInterval={60000} />
    </AdminLayout>
  )
}
