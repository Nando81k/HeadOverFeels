import { CurrencyDollar, Calendar, ChartLineUp } from '@phosphor-icons/react/dist/ssr'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/admin/DashboardCard'
import SalesGoalsTracker from '@/components/admin/SalesGoalsTracker'
import RealTimeSalesFeed from '@/components/admin/RealTimeSalesFeed'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getTodayStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function getYesterdayStart(): Date {
  const today = getTodayStart()
  return new Date(today.getTime() - 24 * 60 * 60 * 1000)
}

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day
  return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0)
}

function getLastWeekStart(): Date {
  const thisWeek = getWeekStart()
  return new Date(thisWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
}

function getMonthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

function getLastMonthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
}

function getLastMonthEnd(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
}

export default async function SalesAnalyticsPage() {
  const [
    todayRevenue,
    yesterdayRevenue,
    weekRevenue,
    lastWeekRevenue,
    monthRevenue,
    lastMonthRevenue,
    todayOrders,
    weekOrders,
    monthOrders,
    pendingOrdersCount,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: 'PAID',
        status: { not: 'CANCELLED' },
        createdAt: { gte: getTodayStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: 'PAID',
        status: { not: 'CANCELLED' },
        createdAt: { gte: getYesterdayStart(), lt: getTodayStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: 'PAID',
        status: { not: 'CANCELLED' },
        createdAt: { gte: getWeekStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: 'PAID',
        status: { not: 'CANCELLED' },
        createdAt: { gte: getLastWeekStart(), lt: getWeekStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: 'PAID',
        status: { not: 'CANCELLED' },
        createdAt: { gte: getMonthStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: 'PAID',
        status: { not: 'CANCELLED' },
        createdAt: { gte: getLastMonthStart(), lte: getLastMonthEnd() },
      },
    }),
    prisma.order.count({
      where: { createdAt: { gte: getTodayStart() } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: getWeekStart() } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: getMonthStart() } },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
  ])

  const todayRev = todayRevenue._sum.total || 0
  const yesterdayRev = yesterdayRevenue._sum.total || 0
  const weekRev = weekRevenue._sum.total || 0
  const lastWeekRev = lastWeekRevenue._sum.total || 0
  const monthRev = monthRevenue._sum.total || 0
  const lastMonthRev = lastMonthRevenue._sum.total || 0

  const todayChange = yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 : 0
  const weekChange = lastWeekRev > 0 ? ((weekRev - lastWeekRev) / lastWeekRev) * 100 : 0
  const monthChange = lastMonthRev > 0 ? ((monthRev - lastMonthRev) / lastMonthRev) * 100 : 0

  return (
    <AdminLayout
      title="Sales Analytics"
      subtitle="Revenue and order velocity at a glance"
      pendingOrders={pendingOrdersCount}
    >
      {/* Revenue stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard
          title="Today"
          value={formatCurrency(todayRev)}
          icon={<CurrencyDollar weight="bold" />}
          change={
            yesterdayRev > 0
              ? { value: todayChange, label: `${todayOrders} orders · vs yesterday` }
              : undefined
          }
        />
        <StatCard
          title="This Week"
          value={formatCurrency(weekRev)}
          icon={<Calendar weight="bold" />}
          change={
            lastWeekRev > 0
              ? { value: weekChange, label: `${weekOrders} orders · vs last week` }
              : undefined
          }
        />
        <StatCard
          title="This Month"
          value={formatCurrency(monthRev)}
          icon={<ChartLineUp weight="bold" />}
          change={
            lastMonthRev > 0
              ? { value: monthChange, label: `${monthOrders} orders · vs last month` }
              : undefined
          }
        />
      </div>

      {/* Sales Goals Tracker */}
      <div className="mb-6 sm:mb-8">
        <SalesGoalsTracker />
      </div>

      {/* Real-time Sales Feed */}
      <div>
        <RealTimeSalesFeed />
      </div>
    </AdminLayout>
  )
}
