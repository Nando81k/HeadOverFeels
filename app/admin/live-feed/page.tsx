import { Bell } from '@phosphor-icons/react/dist/ssr'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DashboardCard } from '@/components/admin/DashboardCard'
import RealTimeSalesFeed from '@/components/admin/RealTimeSalesFeed'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function LiveFeedPage() {
  const pendingOrdersCount = await prisma.order.count({ 
    where: { status: 'PENDING' } 
  })

  return (
    <AdminLayout
      title="Live Sales Feed"
      subtitle="Real-time sales activity and notifications"
      pendingOrders={pendingOrdersCount}
    >
      {/* Real-Time Sales Feed */}
      <div className="mb-8">
        <DashboardCard
          title="Real-Time Sales Activity"
          icon={<Bell size={20} weight="bold" className="text-emerald-400" />}
        >
          <RealTimeSalesFeed 
            refreshInterval={5000}
            maxItems={50}
            showNotifications={true}
          />
        </DashboardCard>
      </div>
    </AdminLayout>
  )
}
