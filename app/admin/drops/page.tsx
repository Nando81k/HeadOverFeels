import { Lightning } from '@phosphor-icons/react/dist/ssr'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DashboardCard } from '@/components/admin/DashboardCard'
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
      {/* Drop Performance Analytics */}
      <div className="mb-8">
        <DashboardCard
          title="Drop Performance Analytics"
          icon={<Lightning size={20} weight="bold" className="text-amber-400" />}
        >
          <DropPerformanceAnalytics refreshInterval={60000} />
        </DashboardCard>
      </div>
    </AdminLayout>
  )
}
