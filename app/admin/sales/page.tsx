import Link from "next/link";
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { prisma } from "@/lib/prisma";
import SalesGoalsTracker from "@/components/admin/SalesGoalsTracker";
import RealTimeSalesFeed from "@/components/admin/RealTimeSalesFeed";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
        createdAt: { gte: getTodayStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
        createdAt: { gte: getYesterdayStart(), lt: getTodayStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
        createdAt: { gte: getWeekStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
        createdAt: { gte: getLastWeekStart(), lt: getWeekStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
        createdAt: { gte: getMonthStart() },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
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
  ]);

  const todayRev = todayRevenue._sum.total || 0;
  const yesterdayRev = yesterdayRevenue._sum.total || 0;
  const weekRev = weekRevenue._sum.total || 0;
  const lastWeekRev = lastWeekRevenue._sum.total || 0;
  const monthRev = monthRevenue._sum.total || 0;
  const lastMonthRev = lastMonthRevenue._sum.total || 0;

  const todayChange = yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 : 0;
  const weekChange = lastWeekRev > 0 ? ((weekRev - lastWeekRev) / lastWeekRev) * 100 : 0;
  const monthChange = lastMonthRev > 0 ? ((monthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft size={24} weight="bold" className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Sales Analytics</h1>
            <p className="text-gray-600 mt-2">Track sales performance and trends</p>
          </div>
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Today</h3>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(todayRev)}</p>
            <p className="text-sm text-gray-600 mt-2">{todayOrders} orders</p>
            {todayChange !== 0 && (
              <p
                className={`text-sm mt-2 ${
                  todayChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {todayChange >= 0 ? "+" : ""}
                {todayChange.toFixed(1)}% vs yesterday
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">This Week</h3>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(weekRev)}</p>
            <p className="text-sm text-gray-600 mt-2">{weekOrders} orders</p>
            {weekChange !== 0 && (
              <p
                className={`text-sm mt-2 ${
                  weekChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {weekChange >= 0 ? "+" : ""}
                {weekChange.toFixed(1)}% vs last week
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">This Month</h3>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(monthRev)}</p>
            <p className="text-sm text-gray-600 mt-2">{monthOrders} orders</p>
            {monthChange !== 0 && (
              <p
                className={`text-sm mt-2 ${
                  monthChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {monthChange >= 0 ? "+" : ""}
                {monthChange.toFixed(1)}% vs last month
              </p>
            )}
          </div>
        </div>

        {/* Sales Goals Tracker */}
        <div className="mb-8">
          <SalesGoalsTracker />
        </div>

        {/* Real-time Sales Feed */}
        <div>
          <RealTimeSalesFeed />
        </div>
      </div>
    </div>
  );
}
