import Link from "next/link";
import { 
  Package, 
  ShoppingCart, 
  Users, 
  TrendUp, 
  CurrencyDollar, 
  Warning,
  Fire,
  ChartLine,
  Headset,
  Heart,
  Lightning,
  ShoppingBag,
  Star,
  ArrowRight,
  Gift,
  Receipt
} from '@phosphor-icons/react/dist/ssr';
import { prisma } from "@/lib/prisma";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardCard, StatCard } from "@/components/admin/DashboardCard";
import DashboardStats from "@/components/admin/DashboardStats";
import ExportButton from "@/components/admin/ExportButton";
import RealTimeSalesFeed from "@/components/admin/RealTimeSalesFeed";
import SalesGoalsTracker from "@/components/admin/SalesGoalsTracker";
import { getActiveDrop, ActiveDrop } from "@/lib/drops";

// Force dynamic rendering (no prerendering during build)
export const dynamic = 'force-dynamic';

// Helper function to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper functions to get date ranges
function getTodayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function getYesterdayStart(): Date {
  const today = getTodayStart();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
}

function getLastWeekStart(): Date {
  const thisWeek = getWeekStart();
  return new Date(thisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function getLastMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
}

function getLastMonthEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
}

function getYearStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function getLastYearStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
}

function getLastYearEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
}

function getSevenDaysAgo(): Date {
  const now = new Date();
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export default async function AdminDashboard() {
  const LOW_STOCK_THRESHOLD = 5;
  const sevenDaysAgo = getSevenDaysAgo();

  // Fetch stats for all time periods in parallel
  const [
    // Today
    todayOrders,
    todayRevenue,
    yesterdayRevenue,
    
    // This Week
    weekOrders,
    weekRevenue,
    lastWeekRevenue,
    
    // This Month
    monthOrders,
    monthRevenue,
    lastMonthRevenue,
    
    // This Year
    yearOrders,
    yearRevenue,
    lastYearRevenue,
    
    // General stats
    activeProducts,
    totalCustomers,
    pendingOrdersCount,
    
    // Recent orders
    recentOrders,
    
    // Low stock products
    lowStockProducts,
    
    // Support tickets
    openTickets,
    urgentTickets,
    
    // Abandoned carts
    abandonedCartsCount,
    abandonedCartsValue,
    
    // Loyalty stats
    totalLoyaltyPoints,
    pendingRedemptions,
    
    // Active drop
    activeDrop,
    
    // Customer growth
    newCustomersThisMonth,
    
    // Reviews waiting
    pendingReviews,
  ] = await Promise.all([
    // Today's orders
    prisma.order.count({
      where: { createdAt: { gte: getTodayStart() } }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getTodayStart() }
      }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getYesterdayStart(), lt: getTodayStart() }
      }
    }),
    
    // This week's orders
    prisma.order.count({
      where: { createdAt: { gte: getWeekStart() } }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getWeekStart() }
      }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getLastWeekStart(), lt: getWeekStart() }
      }
    }),
    
    // This month's orders
    prisma.order.count({
      where: { createdAt: { gte: getMonthStart() } }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getMonthStart() }
      }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getLastMonthStart(), lte: getLastMonthEnd() }
      }
    }),
    
    // This year's orders
    prisma.order.count({
      where: { createdAt: { gte: getYearStart() } }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getYearStart() }
      }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: getLastYearStart(), lte: getLastYearEnd() }
      }
    }),
    
    // General stats
    prisma.product.count({ where: { isActive: true } }),
    prisma.customer.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    
    // Recent 5 orders
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            name: true,
            email: true
          }
        }
      }
    }),
    
    // Low stock products (products with any variant below threshold)
    prisma.product.findMany({
      where: {
        isActive: true,
        variants: {
          some: {
            inventory: { lt: LOW_STOCK_THRESHOLD }
          }
        }
      },
      include: {
        variants: {
          where: {
            inventory: { lt: LOW_STOCK_THRESHOLD }
          },
          select: {
            id: true,
            size: true,
            color: true,
            inventory: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    }),
    
    // Support tickets - open count
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    
    // Support tickets - urgent (high priority + open)
    prisma.supportTicket.count({ 
      where: { 
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        priority: 'HIGH'
      } 
    }),
    
    // Abandoned carts count (last 7 days)
    prisma.abandonedCart.count({
      where: {
        recovered: false,
        abandonedAt: { gte: sevenDaysAgo }
      }
    }),
    
    // Abandoned carts value
    prisma.abandonedCart.aggregate({
      _sum: { totalValue: true },
      where: {
        recovered: false,
        abandonedAt: { gte: sevenDaysAgo }
      }
    }),
    
    // Total loyalty points in circulation
    prisma.customer.aggregate({
      _sum: { currentPoints: true }
    }),
    
    // Pending reward redemptions
    prisma.rewardRedemption.count({
      where: { status: 'PENDING' }
    }),
    
    // Active drop
    getActiveDrop(),
    
    // New customers this month
    prisma.customer.count({
      where: { createdAt: { gte: getMonthStart() } }
    }),
    
    // Pending reviews
    prisma.review.count({
      where: { status: 'PENDING' }
    }),
  ]);

  const statsData = {
    todayStats: {
      currentOrders: todayOrders,
      currentRevenue: todayRevenue._sum.total || 0,
      previousRevenue: yesterdayRevenue._sum.total || 0,
      activeProducts,
      totalCustomers,
    },
    weekStats: {
      currentOrders: weekOrders,
      currentRevenue: weekRevenue._sum.total || 0,
      previousRevenue: lastWeekRevenue._sum.total || 0,
      activeProducts,
      totalCustomers,
    },
    monthStats: {
      currentOrders: monthOrders,
      currentRevenue: monthRevenue._sum.total || 0,
      previousRevenue: lastMonthRevenue._sum.total || 0,
      activeProducts,
      totalCustomers,
    },
    yearStats: {
      currentOrders: yearOrders,
      currentRevenue: yearRevenue._sum.total || 0,
      previousRevenue: lastYearRevenue._sum.total || 0,
      activeProducts,
      totalCustomers,
    },
  };

  // Calculate AOV (Average Order Value)
  const avgOrderValue = monthOrders > 0 
    ? (monthRevenue._sum.total || 0) / monthOrders 
    : 0;
  
  // Calculate monthly revenue change %
  const monthlyRevenueChange = lastMonthRevenue._sum.total 
    ? ((((monthRevenue._sum.total || 0) - lastMonthRevenue._sum.total) / lastMonthRevenue._sum.total) * 100)
    : 0;

  // Get drop status info
  const getDropStatus = (drop: ActiveDrop | null) => {
    if (!drop) return null;
    const now = new Date();
    const release = drop.releaseDate ? new Date(drop.releaseDate) : null;
    const end = drop.dropEndDate ? new Date(drop.dropEndDate) : null;
    
    if (release && release > now) {
      return { status: 'upcoming', label: 'UPCOMING', color: 'text-blue-400 bg-blue-500/20' };
    }
    if (end && end > now) {
      return { status: 'live', label: 'LIVE NOW', color: 'text-[#FF3131] bg-[#FF3131]/20' };
    }
    return { status: 'ended', label: 'ENDED', color: 'text-white/40 bg-white/10' };
  };

  const dropStatus = getDropStatus(activeDrop);
  const dropTotalStock = activeDrop?.variants.reduce((sum, v) => sum + v.inventory, 0) || 0;
  const dropStockPercent = activeDrop?.maxQuantity ? Math.round((dropTotalStock / activeDrop.maxQuantity) * 100) : 100;

  return (
    <AdminLayout 
      title="Command Center" 
      subtitle="Your business at a glance — everything that matters, one place."
      pendingOrders={pendingOrdersCount}
      headerActions={
        <ExportButton
          period="month"
          stats={{
            orders: monthOrders,
            revenue: monthRevenue._sum.total || 0,
            products: activeProducts,
            customers: totalCustomers,
          }}
          orders={recentOrders}
        />
      }
    >
      {/* Hero Section: Active Drop or Today's Performance */}
      {activeDrop && dropStatus?.status !== 'ended' ? (
        <Link 
          href={`/admin/drops`}
          className="block mb-8 group"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 border border-white/10 hover:border-[#FF3131]/30 transition-all">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[#FF3131]/10 to-transparent" />
            <div className="relative p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${dropStatus?.color}`}>
                      {dropStatus?.label}
                    </span>
                    {dropStatus?.status === 'live' && (
                      <span className="flex items-center gap-1.5 text-xs text-white/50">
                        <span className="w-2 h-2 bg-[#FF3131] rounded-full animate-pulse" />
                        Active Drop
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2 group-hover:text-[#FF3131] transition-colors">
                    {activeDrop.name}
                  </h2>
                  <p className="text-white/50 text-sm max-w-md">
                    {activeDrop.description?.slice(0, 120) || 'Limited edition drop — manage inventory, track sales, and monitor performance.'}
                    {(activeDrop.description?.length || 0) > 120 ? '...' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap lg:flex-nowrap gap-4 lg:gap-6">
                  <div className="text-center p-4 bg-white/5 border border-white/10 min-w-[100px]">
                    <div className="text-2xl font-bold text-white">{dropTotalStock}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Units Left</div>
                    <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#FF3131] rounded-full transition-all"
                        style={{ width: `${dropStockPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center p-4 bg-white/5 border border-white/10 min-w-[100px]">
                    <div className="text-2xl font-bold text-white">{formatCurrency(activeDrop.price)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Price</div>
                    {activeDrop.compareAtPrice && activeDrop.compareAtPrice > activeDrop.price && (
                      <div className="text-xs text-white/30 line-through mt-1">
                        {formatCurrency(activeDrop.compareAtPrice)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center text-white/40 group-hover:text-[#FF3131] transition-colors">
                    <ArrowRight size={24} weight="bold" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="mb-8 p-6 lg:p-8 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 border border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Fire size={20} weight="fill" className="text-[#FF3131]" />
                <span className="text-xs uppercase tracking-wider text-white/50">Today&apos;s Performance</span>
              </div>
              <div className="text-3xl lg:text-4xl font-bold text-white">
                {formatCurrency(todayRevenue._sum.total || 0)}
              </div>
              <div className="text-sm text-white/50 mt-1">
                {todayOrders} order{todayOrders !== 1 ? 's' : ''} today
              </div>
            </div>
            <div className="flex gap-4 lg:gap-6">
              <Link href="/admin/drops" className="text-center p-4 bg-white/5 border border-white/10 hover:border-[#FF3131]/30 transition-all group">
                <Lightning size={24} weight="fill" className="text-white/40 group-hover:text-[#FF3131] mx-auto mb-2 transition-colors" />
                <div className="text-xs uppercase tracking-wider text-white/50">No Active Drop</div>
                <div className="text-[10px] text-white/30 mt-1">Click to create</div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Primary Stats Grid - 8 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(todayRevenue._sum.total || 0)}
          change={{
            value: (yesterdayRevenue._sum.total || 0) > 0
              ? (((todayRevenue._sum.total || 0) - (yesterdayRevenue._sum.total || 0)) / (yesterdayRevenue._sum.total || 1)) * 100
              : 0,
            label: "vs yesterday"
          }}
          icon={<CurrencyDollar size={24} weight="bold" className="text-emerald-400" />}
          href="/admin/financial"
        />
        
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(monthRevenue._sum.total || 0)}
          change={{
            value: monthlyRevenueChange,
            label: "vs last month"
          }}
          icon={<TrendUp size={24} weight="bold" className="text-[#FF3131]" />}
          href="/admin/analytics"
        />

        <StatCard
          title="Orders"
          value={monthOrders}
          icon={<ShoppingCart size={24} weight="bold" className="text-white/70" />}
          href="/admin/orders"
          badge={pendingOrdersCount > 0 ? pendingOrdersCount : undefined}
        />
        
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          icon={<Receipt size={24} weight="bold" className="text-purple-400" />}
          href="/admin/analytics"
        />

        <StatCard
          title="Active Products"
          value={activeProducts}
          icon={<Package size={24} weight="bold" className="text-white/70" />}
          href="/admin/products"
          badge={lowStockProducts.length > 0 ? lowStockProducts.length : undefined}
        />
        
        <StatCard
          title="Customers"
          value={totalCustomers}
          change={{
            value: newCustomersThisMonth,
            label: "new this month"
          }}
          icon={<Users size={24} weight="bold" className="text-blue-400" />}
          href="/admin/customers"
        />

        <StatCard
          title="Support Queue"
          value={openTickets}
          icon={<Headset size={24} weight="bold" className={urgentTickets > 0 ? "text-amber-400" : "text-white/70"} />}
          href="/admin/support"
          badge={urgentTickets > 0 ? urgentTickets : undefined}
        />
        
        <StatCard
          title="Loyalty Points"
          value={(totalLoyaltyPoints._sum.currentPoints || 0).toLocaleString()}
          icon={<Heart size={24} weight="fill" className="text-pink-400" />}
          href="/admin/loyalty"
          badge={pendingRedemptions > 0 ? pendingRedemptions : undefined}
        />
      </div>

      {/* Insights Grid - 4 actionable cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Low Stock Alert */}
        <Link 
          href="/admin/products" 
          className="p-5 bg-neutral-900 border border-white/10 hover:border-amber-500/30 transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <Warning size={24} weight="fill" className="text-amber-400" />
            {lowStockProducts.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400">
                Action Needed
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-1">{lowStockProducts.length}</div>
          <div className="text-xs text-white/50 uppercase tracking-wider">Low Stock Items</div>
          <div className="text-[11px] text-white/30 mt-2 group-hover:text-white/50 transition-colors">
            {lowStockProducts.length > 0 ? `${lowStockProducts.length} products need restocking` : 'All products stocked'}
          </div>
        </Link>

        {/* Support Queue */}
        <Link 
          href="/admin/support" 
          className={`p-5 bg-neutral-900 border transition-all group ${urgentTickets > 0 ? 'border-red-500/30 hover:border-red-500/50' : 'border-white/10 hover:border-white/20'}`}
        >
          <div className="flex items-start justify-between mb-3">
            <Headset size={24} weight="fill" className={urgentTickets > 0 ? "text-red-400" : "text-white/40"} />
            {urgentTickets > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-500/20 text-red-400">
                {urgentTickets} Urgent
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-1">{openTickets}</div>
          <div className="text-xs text-white/50 uppercase tracking-wider">Open Tickets</div>
          <div className="text-[11px] text-white/30 mt-2 group-hover:text-white/50 transition-colors">
            {openTickets > 0 ? 'Customers waiting for response' : 'No open tickets'}
          </div>
        </Link>

        {/* Abandoned Carts */}
        <Link 
          href="/admin/abandoned-carts" 
          className="p-5 bg-neutral-900 border border-white/10 hover:border-emerald-500/30 transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <ShoppingBag size={24} weight="fill" className="text-white/40" />
            {(abandonedCartsValue._sum.totalValue || 0) > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400">
                Recoverable
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-1">{abandonedCartsCount}</div>
          <div className="text-xs text-white/50 uppercase tracking-wider">Abandoned (7 days)</div>
          <div className="text-[11px] text-white/30 mt-2 group-hover:text-white/50 transition-colors">
            {formatCurrency(abandonedCartsValue._sum.totalValue || 0)} potential revenue
          </div>
        </Link>

        {/* Reviews */}
        <Link 
          href="/admin/reviews" 
          className="p-5 bg-neutral-900 border border-white/10 hover:border-white/20 transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <Star size={24} weight="fill" className="text-yellow-400" />
            {pendingReviews > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-yellow-500/20 text-yellow-400">
                {pendingReviews} Pending
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-1">{pendingReviews}</div>
          <div className="text-xs text-white/50 uppercase tracking-wider">Reviews to Moderate</div>
          <div className="text-[11px] text-white/30 mt-2 group-hover:text-white/50 transition-colors">
            {pendingReviews > 0 ? 'Approve or respond to reviews' : 'All reviews moderated'}
          </div>
        </Link>
      </div>

      {/* Sales Performance Section */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <DashboardCard 
          title="Sales Goals" 
          icon={<TrendUp size={20} weight="bold" className="text-[#FF3131]" />}
          action={{ label: "Manage Goals", href: "/admin/goals" }}
          noPadding
        >
          <div className="p-5">
            <SalesGoalsTracker />
          </div>
        </DashboardCard>

        <DashboardCard 
          title="Real-Time Sales Feed" 
          icon={<CurrencyDollar size={20} weight="bold" className="text-emerald-400" />}
          action={{ label: "View All Orders", href: "/admin/orders" }}
          noPadding
        >
          <div className="p-5">
            <RealTimeSalesFeed 
              refreshInterval={10000}
              maxItems={5}
              showNotifications={true}
            />
          </div>
        </DashboardCard>
      </div>

      {/* Performance Overview */}
      <div className="mb-8">
        <DashboardCard 
          title="Performance Overview"
          icon={<ChartLine size={20} weight="bold" className="text-white/70" />}
          action={{ label: "Full Analytics", href: "/admin/analytics" }}
        >
          <DashboardStats {...statsData} />
        </DashboardCard>
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <DashboardCard 
          title="Recent Orders" 
          icon={<ShoppingCart size={20} weight="bold" className="text-white/70" />}
          action={{ label: "View All", href: "/admin/orders" }}
        >
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="block p-4 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">
                        #{order.orderNumber}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        order.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                        order.status === 'CONFIRMED' ? 'bg-blue-500/20 text-blue-400' :
                        order.status === 'PROCESSING' ? 'bg-purple-500/20 text-purple-400' :
                        order.status === 'SHIPPED' ? 'bg-indigo-500/20 text-indigo-400' :
                        order.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                        order.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-sm text-white/50 truncate">
                      {order.customer ? (
                        <span className="font-medium">{order.customer.name}</span>
                      ) : (
                        <span className="text-white/30">Guest</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-bold text-white">
                      {formatCurrency(order.total)}
                    </div>
                    <div className="text-xs text-white/40">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </DashboardCard>
      )}

      {/* Quick Access Links - Expanded to 8 */}
      <div className="mt-8">
        <h2 className="text-sm font-medium tracking-[0.15em] text-white/70 uppercase mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Link
            href="/admin/products/new"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-[#FF3131]/30 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <Package size={24} weight="bold" className="mx-auto mb-2 text-white/40 group-hover:text-[#FF3131] transition-colors" />
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-wide">New Product</div>
          </Link>
          
          <Link
            href="/admin/drops"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-[#FF3131]/30 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <Lightning size={24} weight="fill" className="mx-auto mb-2 text-white/40 group-hover:text-[#FF3131] transition-colors" />
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Drops</div>
          </Link>
          
          <Link
            href="/admin/analytics"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <ChartLine size={24} weight="bold" className="mx-auto mb-2 text-white/40 group-hover:text-white transition-colors" />
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Analytics</div>
          </Link>
          
          <Link
            href="/admin/financial"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-emerald-500/30 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <CurrencyDollar size={24} weight="bold" className="mx-auto mb-2 text-white/40 group-hover:text-emerald-400 transition-colors" />
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Financial</div>
          </Link>

          <Link
            href="/admin/support"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <Headset size={24} weight="bold" className="mx-auto mb-2 text-white/40 group-hover:text-white transition-colors" />
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Support</div>
          </Link>
          
          <Link
            href="/admin/loyalty"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-pink-500/30 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <Heart size={24} weight="fill" className="mx-auto mb-2 text-white/40 group-hover:text-pink-400 transition-colors" />
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Loyalty</div>
          </Link>
          
          <Link
            href="/admin/collections"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <Gift size={24} weight="bold" className="mx-auto mb-2 text-white/40 group-hover:text-white transition-colors" />
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Collections</div>
          </Link>
          
          <Link
            href="/admin/abandoned-carts"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <ShoppingBag size={24} weight="bold" className="mx-auto mb-2 text-white/40 group-hover:text-white transition-colors" />
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Abandoned</div>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}