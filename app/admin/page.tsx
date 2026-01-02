import Link from "next/link";
import { Package, ShoppingCart, Users, TrendUp, CurrencyDollar, Warning } from '@phosphor-icons/react/dist/ssr';
import { prisma } from "@/lib/prisma";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardCard, StatCard } from "@/components/admin/DashboardCard";
import DashboardStats from "@/components/admin/DashboardStats";
import LowStockAlerts from "@/components/admin/LowStockAlerts";
import ExportButton from "@/components/admin/ExportButton";
import RealTimeSalesFeed from "@/components/admin/RealTimeSalesFeed";
import SalesGoalsTracker from "@/components/admin/SalesGoalsTracker";

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

export default async function AdminDashboard() {
  const LOW_STOCK_THRESHOLD = 5;

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
    })
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
  return (
    <AdminLayout 
      title="Dashboard" 
      subtitle="Welcome back! Here's what's happening today."
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
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Revenue (Month)"
          value={formatCurrency(monthRevenue._sum.total || 0)}
          change={{
            value: lastMonthRevenue._sum.total 
              ? ((((monthRevenue._sum.total || 0) - lastMonthRevenue._sum.total) / lastMonthRevenue._sum.total) * 100)
              : 0,
            label: "vs last month"
          }}
          icon={<CurrencyDollar size={24} weight="bold" className="text-emerald-400" />}
        />
        
        <StatCard
          title="Orders (Month)"
          value={monthOrders}
          change={{
            value: weekOrders > 0 ? 12 : 0,
            label: "vs last month"
          }}
          icon={<ShoppingCart size={24} weight="bold" className="text-white/70" />}
          href="/admin/orders"
          badge={pendingOrdersCount}
        />
        
        <StatCard
          title="Active Products"
          value={activeProducts}
          icon={<Package size={24} weight="bold" className="text-white/70" />}
          href="/admin/products"
        />
        
        <StatCard
          title="Total Customers"
          value={totalCustomers}
          change={{
            value: 8,
            label: "this month"
          }}
          icon={<Users size={24} weight="bold" className="text-white/70" />}
          href="/admin/customers"
        />
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="mb-8">
          <DashboardCard 
            title="Low Stock Alerts" 
            icon={<Warning size={20} weight="bold" className="text-amber-400" />}
            action={{ label: "Manage Inventory", href: "/admin/products" }}
          >
            <LowStockAlerts products={lowStockProducts} threshold={LOW_STOCK_THRESHOLD} />
          </DashboardCard>
        </div>
      )}

      {/* Performance Overview */}
      <div className="mb-8">
        <h2 className="text-sm font-medium tracking-[0.15em] text-white/70 uppercase mb-4">Performance Overview</h2>
        <div className="bg-neutral-900 border border-white/10 p-6">
          <DashboardStats {...statsData} />
        </div>
      </div>

      {/* Sales Performance */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <DashboardCard 
          title="Sales Goals" 
          icon={<TrendUp size={20} weight="bold" className="text-white/70" />}
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
              maxItems={6}
              showNotifications={true}
            />
          </div>
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

      {/* Quick Access Links */}
      <div className="mt-8">
        <h2 className="text-sm font-medium tracking-[0.15em] text-white/70 uppercase mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/admin/analytics"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <div className="text-2xl mb-2 opacity-60 group-hover:opacity-100 transition-opacity">📊</div>
            <div className="text-xs font-medium text-white/70 uppercase tracking-wide">Analytics</div>
          </Link>
          
          <Link
            href="/admin/financial"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <div className="text-2xl mb-2 opacity-60 group-hover:opacity-100 transition-opacity">💰</div>
            <div className="text-xs font-medium text-white/70 uppercase tracking-wide">Financial</div>
          </Link>
          
          <Link
            href="/admin/drops"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <div className="text-2xl mb-2 opacity-60 group-hover:opacity-100 transition-opacity">⚡</div>
            <div className="text-xs font-medium text-white/70 uppercase tracking-wide">Drops</div>
          </Link>
          
          <Link
            href="/admin/abandoned-carts"
            className="p-4 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group text-center"
          >
            <div className="text-2xl mb-2 opacity-60 group-hover:opacity-100 transition-opacity">🛒</div>
            <div className="text-xs font-medium text-white/70 uppercase tracking-wide">Abandoned</div>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}