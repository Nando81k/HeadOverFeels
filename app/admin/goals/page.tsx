import { Target, ChartLineUp, Trophy, Flame, CalendarBlank, Lightning } from '@phosphor-icons/react/dist/ssr'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import SalesGoalsTracker from '@/components/admin/SalesGoalsTracker'
import { OrderStatus } from '@prisma/client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Valid order statuses for revenue
const VALID_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
]

export default async function GoalsPage() {
  const pendingOrdersCount = await prisma.order.count({ 
    where: { status: 'PENDING' } 
  })

  // Get current date ranges
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  // Fetch summary stats
  const [monthlyOrderCount, yearlyOrderCount, topProductsThisMonth] = await Promise.all([
    prisma.order.count({
      where: {
        createdAt: { gte: startOfMonth },
        status: { in: VALID_STATUSES },
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: startOfYear },
        status: { in: VALID_STATUSES },
      },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: startOfMonth },
          status: { in: VALID_STATUSES },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ])

  // Get product details for top products
  const topProductIds = topProductsThisMonth.map(p => p.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true, price: true },
  })

  const topProducts = topProductsThisMonth.map(item => {
    const product = products.find(p => p.id === item.productId)
    return {
      id: item.productId,
      name: product?.name || 'Unknown',
      price: product?.price || 0,
      soldCount: item._sum.quantity || 0,
    }
  })

  return (
    <AdminLayout
      title="Sales Goals"
      subtitle="Track and manage your sales targets"
      pendingOrders={pendingOrdersCount}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white border border-blue-500/30">
          <div className="flex items-center justify-between mb-3">
            <CalendarBlank size={24} weight="bold" className="opacity-80" />
            <span className="text-xs font-medium bg-white/20 px-2 py-1">This Month</span>
          </div>
          <div className="text-3xl font-bold">{monthlyOrderCount}</div>
          <div className="text-sm opacity-80">Orders completed</div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-5 text-white border border-purple-500/30">
          <div className="flex items-center justify-between mb-3">
            <ChartLineUp size={24} weight="bold" className="opacity-80" />
            <span className="text-xs font-medium bg-white/20 px-2 py-1">This Year</span>
          </div>
          <div className="text-3xl font-bold">{yearlyOrderCount}</div>
          <div className="text-sm opacity-80">Total orders</div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white border border-amber-500/30">
          <div className="flex items-center justify-between mb-3">
            <Trophy size={24} weight="bold" className="opacity-80" />
            <span className="text-xs font-medium bg-white/20 px-2 py-1">Achievement</span>
          </div>
          <div className="text-3xl font-bold">{topProducts.length}</div>
          <div className="text-sm opacity-80">Products selling</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-green-700 p-5 text-white border border-emerald-500/30">
          <div className="flex items-center justify-between mb-3">
            <Lightning size={24} weight="bold" className="opacity-80" />
            <span className="text-xs font-medium bg-white/20 px-2 py-1">Active</span>
          </div>
          <div className="text-3xl font-bold">{pendingOrdersCount}</div>
          <div className="text-sm opacity-80">Pending orders</div>
        </div>
      </div>

      {/* Main Goals Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Goals Tracker - Takes 2/3 of width */}
        <div className="lg:col-span-2">
          <SalesGoalsTracker showEditButton={true} />
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Top Products This Month */}
          <div className="bg-neutral-900 border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-amber-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 border border-amber-500/30">
                  <Trophy size={18} weight="bold" className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Top Products</h3>
                  <p className="text-xs text-white/40">Best sellers this month</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              {topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center gap-3 p-2 hover:bg-white/5 transition-colors">
                      <div className={`w-7 h-7 flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-amber-500/20 text-amber-400' :
                        index === 1 ? 'bg-white/10 text-white/60' :
                        index === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-white/5 text-white/40'
                      }`}>
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">{product.name}</div>
                        <div className="text-xs text-white/40">${product.price.toFixed(2)}</div>
                      </div>
                      <div className="text-sm font-semibold text-white/70">{product.soldCount} sold</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-white/40">
                  <Trophy size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No sales this month yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Tips Card */}
          <div className="bg-purple-500/10 border border-purple-500/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={20} weight="fill" className="text-purple-400" />
              <h3 className="font-bold text-white">Goal Setting Tips</h3>
            </div>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">•</span>
                Set realistic daily targets based on historical averages
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">•</span>
                Weekly goals should account for weekend variations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">•</span>
                Review and adjust monthly goals quarterly
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">•</span>
                Track streak days to build momentum
              </li>
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
