import Link from 'next/link'
import {
  CurrencyDollar,
  ShoppingBag,
  Users,
  Package,
  ArrowRight,
  Plus,
  TrendUp,
  Warning,
  ClockCounterClockwise,
  Lightning,
} from '@phosphor-icons/react/dist/ssr'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard, DashboardCard } from '@/components/admin/DashboardCard'

export const dynamic = 'force-dynamic'

const REVENUE_STATUS_FILTER = {
  paymentStatus: 'PAID' as const,
  status: { not: 'CANCELLED' as const },
}

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function startOfWeek(d = new Date()) {
  const day = d.getDay()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day, 0, 0, 0, 0)
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  CONFIRMED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  PROCESSING: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  SHIPPED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  DELIVERED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CANCELLED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  REFUNDED: 'bg-white/5 text-white/55 border-white/15',
}

export default async function AdminDashboardHome() {
  const today = startOfDay()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekStart = startOfWeek()
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    todayRevenue,
    yesterdayRevenue,
    todayOrders,
    yesterdayOrders,
    newCustomersWeek,
    newCustomersLastWeek,
    pendingOrdersCount,
    recentOrders,
    last7DaysItems,
    lowStockVariants,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: { ...REVENUE_STATUS_FILTER, createdAt: { gte: today } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { ...REVENUE_STATUS_FILTER, createdAt: { gte: yesterday, lt: today } },
    }),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.customer.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.customer.count({
      where: { createdAt: { gte: lastWeekStart, lt: weekStart } },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        customerEmail: true,
        customer: { select: { name: true } },
      },
    }),
    // Pull last 7 days of order items, aggregate by product in JS
    // (Prisma's groupBy._sum can't do quantity * price in a single query)
    prisma.orderItem.findMany({
      where: {
        order: {
          ...REVENUE_STATUS_FILTER,
          createdAt: { gte: sevenDaysAgo },
        },
      },
      select: { productId: true, quantity: true, price: true },
    }),
    prisma.productVariant.findMany({
      where: { inventory: { lte: 5 }, product: { isActive: true } },
      orderBy: { inventory: 'asc' },
      take: 5,
      select: {
        id: true,
        size: true,
        color: true,
        inventory: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
  ])

  const todayRev = todayRevenue._sum.total || 0
  const yestRev = yesterdayRevenue._sum.total || 0
  const revenueChange = yestRev > 0 ? ((todayRev - yestRev) / yestRev) * 100 : 0
  const orderChange =
    yesterdayOrders > 0 ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 : 0
  const customersChange =
    newCustomersLastWeek > 0
      ? ((newCustomersWeek - newCustomersLastWeek) / newCustomersLastWeek) * 100
      : 0

  // Aggregate top sellers in JS — sum quantity and revenue (qty * price) per product
  const topSellerStats = new Map<string, { quantity: number; revenue: number }>()
  for (const item of last7DaysItems) {
    const current = topSellerStats.get(item.productId) ?? { quantity: 0, revenue: 0 }
    current.quantity += item.quantity
    current.revenue += item.quantity * item.price
    topSellerStats.set(item.productId, current)
  }
  const topSellersRanked = Array.from(topSellerStats.entries())
    .map(([productId, stats]) => ({ productId, ...stats }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  const topProductIds = topSellersRanked.map((row) => row.productId)
  const topProducts =
    topProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, slug: true },
        })
      : []

  const topSellersWithName = topSellersRanked.map((row) => {
    const product = topProducts.find((p) => p.id === row.productId)
    return {
      productId: row.productId,
      name: product?.name ?? 'Unknown product',
      slug: product?.slug ?? null,
      quantity: row.quantity,
      revenue: row.revenue,
    }
  })

  const QUICK_ACTIONS: { label: string; href: string; icon: React.ReactNode }[] = [
    { label: 'New product', href: '/admin/products/new', icon: <Plus weight="bold" /> },
    { label: 'Fulfillment queue', href: '/admin/fulfillment', icon: <Package weight="bold" /> },
    { label: 'Promotions', href: '/admin/promotions', icon: <Lightning weight="bold" /> },
    { label: 'Analytics', href: '/admin/analytics', icon: <TrendUp weight="bold" /> },
  ]

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="At a glance — revenue, orders, customers, and operations"
      pendingOrders={pendingOrdersCount}
    >
      {/* KPI hero */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard
          title="Today's revenue"
          value={formatCurrency(todayRev)}
          icon={<CurrencyDollar weight="bold" />}
          change={
            yestRev > 0 ? { value: revenueChange, label: 'vs yesterday' } : undefined
          }
          href="/admin/sales"
        />
        <StatCard
          title="Today's orders"
          value={todayOrders}
          icon={<ShoppingBag weight="bold" />}
          change={
            yesterdayOrders > 0 ? { value: orderChange, label: 'vs yesterday' } : undefined
          }
          href="/admin/fulfillment"
        />
        <StatCard
          title="New customers (7d)"
          value={newCustomersWeek}
          icon={<Users weight="bold" />}
          change={
            newCustomersLastWeek > 0
              ? { value: customersChange, label: 'vs prev week' }
              : undefined
          }
          href="/admin/customers"
        />
        <StatCard
          title="Pending fulfillment"
          value={pendingOrdersCount}
          icon={<ClockCounterClockwise weight="bold" />}
          href="/admin/fulfillment"
          badge={pendingOrdersCount > 0 ? pendingOrdersCount : undefined}
        />
      </div>

      {/* Activity row — recent orders + top sellers + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {/* Recent orders */}
        <DashboardCard
          title="Recent orders"
          icon={<ShoppingBag size={14} weight="bold" className="text-white/70" />}
          action={{ label: 'View all', href: '/admin/fulfillment' }}
          noPadding
        >
          {recentOrders.length === 0 ? (
            <div className="p-5 text-center text-xs text-white/40">No orders yet.</div>
          ) : (
            <ul className="divide-y divide-white/8">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/fulfillment?orderId=${order.id}`}
                    className="flex items-center gap-3 px-3 sm:px-5 py-3 hover:bg-white/3 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold text-white truncate">
                          #{order.orderNumber}
                        </p>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                            STATUS_TONE[order.status] ?? STATUS_TONE.REFUNDED
                          }`}
                        >
                          {order.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/45 truncate">
                        {order.customer?.name ?? order.customerEmail} · {formatRelativeTime(order.createdAt)}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-white tabular-nums shrink-0">
                      {formatCurrency(order.total)}
                    </p>
                    <ArrowRight
                      size={11}
                      weight="bold"
                      className="text-white/30 group-hover:text-white/70 transition-colors shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* Top sellers (last 7 days) */}
        <DashboardCard
          title="Top sellers · 7d"
          icon={<TrendUp size={14} weight="bold" className="text-white/70" />}
          action={{ label: 'View all', href: '/admin/products' }}
          noPadding
        >
          {topSellersWithName.length === 0 ? (
            <div className="p-5 text-center text-xs text-white/40">
              No sales in the last 7 days.
            </div>
          ) : (
            <ul className="divide-y divide-white/8">
              {topSellersWithName.map((row, index) => (
                <li key={row.productId}>
                  <Link
                    href={row.slug ? `/admin/products/${row.productId}` : '#'}
                    className="flex items-center gap-3 px-3 sm:px-5 py-3 hover:bg-white/3 transition-colors group"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center text-[10px] font-bold shrink-0 ${
                        index === 0
                          ? 'bg-amber-500/20 text-amber-300'
                          : index === 1
                            ? 'bg-white/10 text-white/65'
                            : index === 2
                              ? 'bg-orange-500/15 text-orange-300'
                              : 'bg-white/5 text-white/40'
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{row.name}</p>
                      <p className="text-[11px] text-white/45">
                        {row.quantity} sold · {formatCurrency(row.revenue)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* Low stock alerts */}
        <DashboardCard
          title="Low stock"
          icon={<Warning size={14} weight="bold" className="text-amber-300" />}
          action={{ label: 'View all', href: '/admin/products?stock=low' }}
          noPadding
        >
          {lowStockVariants.length === 0 ? (
            <div className="p-5 text-center text-xs text-white/40">
              All variants in healthy stock.
            </div>
          ) : (
            <ul className="divide-y divide-white/8">
              {lowStockVariants.map((variant) => {
                const variantParts = [variant.size, variant.color]
                  .filter(Boolean)
                  .join(' · ')
                const isOut = variant.inventory === 0
                return (
                  <li key={variant.id}>
                    <Link
                      href={`/admin/products/${variant.product.id}`}
                      className="flex items-center gap-3 px-3 sm:px-5 py-3 hover:bg-white/3 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {variant.product.name}
                        </p>
                        <p className="text-[11px] text-white/45 truncate">
                          {variantParts || 'Default variant'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                          isOut
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isOut ? 'Out' : `${variant.inventory} left`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </DashboardCard>
      </div>

      {/* Quick actions */}
      <DashboardCard
        title="Quick actions"
        icon={<Lightning size={14} weight="bold" className="text-white/70" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 p-3 sm:p-4 bg-white/3 border border-white/10 hover:bg-white/8 hover:border-white/25 transition-colors"
            >
              <span className="flex h-8 w-8 items-center justify-center bg-white/5 group-hover:bg-white/10 transition-colors">
                <span className="[&>svg]:w-4 [&>svg]:h-4 text-white/80">{action.icon}</span>
              </span>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white/85 group-hover:text-white">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </DashboardCard>
    </AdminLayout>
  )
}
