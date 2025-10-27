import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DashboardStats from "@/components/admin/DashboardStats";
import LowStockAlerts from "@/components/admin/LowStockAlerts";
import ExportButton from "@/components/admin/ExportButton";
import ExportHistory from "@/components/admin/ExportHistory";
import RefreshButton from "@/components/admin/RefreshButton";
import AnalyticsPreview from "@/components/admin/AnalyticsPreview";

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Head Over Feels</h1>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                Admin Dashboard
              </span>
            </div>
            <div className="flex items-center gap-4">
              <RefreshButton />
              <Link 
                href="/" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Store
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Dashboard Stats */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
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
          </div>
          <DashboardStats {...statsData} />
        </div>

        {/* Alerts Section */}
        {lowStockProducts.length > 0 && (
          <div className="mb-8">
            <LowStockAlerts products={lowStockProducts} threshold={LOW_STOCK_THRESHOLD} />
          </div>
        )}

        {/* Quick Actions & Analytics Row */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Analytics Preview - Full Height */}
          <AnalyticsPreview />

          {/* Recent Orders */}
          {recentOrders.length > 0 && (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Recent Orders</h3>
                <Link 
                  href="/admin/orders"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            #{order.orderNumber}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'PROCESSING' ? 'bg-purple-100 text-purple-800' :
                            order.status === 'SHIPPED' ? 'bg-indigo-100 text-indigo-800' :
                            order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                            order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {order.customer ? (
                            <span className="font-medium">{order.customer.name}</span>
                          ) : (
                            <span className="text-gray-400">Guest</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-bold text-gray-900">
                          {formatCurrency(order.total)}
                        </div>
                        <div className="text-xs text-gray-500">
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
            </div>
          )}
        </div>

        {/* Management Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Management</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Products */}
            <Link 
              href="/admin/products"
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <span className="text-2xl">📦</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{activeProducts}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Products</h3>
              <p className="text-sm text-gray-600">Manage inventory & pricing</p>
            </Link>

            {/* Orders */}
            <Link 
              href="/admin/orders"
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group relative"
            >
              {pendingOrdersCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center shadow-lg">
                  {pendingOrdersCount}
                </span>
              )}
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <span className="text-2xl">🛒</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{monthOrders}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Orders</h3>
              <p className="text-sm text-gray-600 mb-4">Process & fulfill orders</p>
              {pendingOrdersCount > 0 && (
                <div className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                  {pendingOrdersCount} pending
                </div>
              )}
            </Link>

            {/* Customers */}
            <Link 
              href="/admin/customers"
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <span className="text-2xl">👥</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{totalCustomers}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Customers</h3>
              <p className="text-sm text-gray-600">CRM & relationships</p>
            </Link>

            {/* Collections */}
            <Link 
              href="/admin/collections"
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                  <span className="text-2xl">🏷️</span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Collections</h3>
              <p className="text-sm text-gray-600 mb-4">Organize products</p>
            </Link>

            {/* Reviews */}
            <Link 
              href="/admin/reviews"
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors">
                  <span className="text-2xl">⭐</span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Reviews</h3>
              <p className="text-sm text-gray-600">Moderate feedback</p>
            </Link>
          </div>
        </div>

        {/* Export History */}
        <ExportHistory />
      </main>
    </div>
  );
}