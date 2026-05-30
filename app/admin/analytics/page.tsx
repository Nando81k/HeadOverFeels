/**
 * Analytics Dashboard Page - Modernized
 * 
 * Comprehensive analytics view for admin with:
 * - Animated key metrics cards with sparklines
 * - Revenue trends chart with multiple views
 * - Product performance chart with rankings
 * - Customer acquisition chart with growth metrics
 * - Order status distribution with interactive legend
 * - Date range filtering
 * - Data export functionality
 * - Glass morphism dark theme
 * - Smooth animations throughout
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendUp, ShoppingCart, Users as UsersIcon, CurrencyDollar, Sparkle, ChartLine } from '@phosphor-icons/react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import dynamic from 'next/dynamic';

const MetricCard = dynamic(() => import('@/components/analytics/MetricCard'), {
  ssr: false,
  loading: () => <div className="h-32 animate-pulse bg-black/5 rounded-lg" />,
});
const RevenueChart = dynamic(() => import('@/components/analytics/RevenueChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-black/5 rounded-lg" />,
});
const ProductPerformanceChart = dynamic(() => import('@/components/analytics/ProductPerformanceChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-black/5 rounded-lg" />,
});
const CustomerAcquisitionChart = dynamic(() => import('@/components/analytics/CustomerAcquisitionChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-black/5 rounded-lg" />,
});
const OrderStatusChart = dynamic(() => import('@/components/analytics/OrderStatusChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-black/5 rounded-lg" />,
});
import DateRangeSelector, { DateRange } from '@/components/analytics/DateRangeSelector';
import ExportButton from '@/components/analytics/ExportButton';
import AnalyticsFilterPanel, { AnalyticsFilters } from '@/components/analytics/AnalyticsFilterPanel';
import DataInsights from '@/components/analytics/DataInsights';
import {
  RevenueAnalytics,
  ProductAnalytics,
  CustomerAnalytics,
  OrderAnalytics
} from '@/lib/analytics/types';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function AnalyticsPage() {
  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  });

  // Filters state
  const [filters, setFilters] = useState<AnalyticsFilters>({
    compareWithPrevious: true,
    granularity: 'daily',
    categories: [],
    orderStatuses: []
  });

  // Loading states
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Data states
  const [revenueData, setRevenueData] = useState<RevenueAnalytics | null>(null);
  const [productsData, setProductsData] = useState<ProductAnalytics | null>(null);
  const [customersData, setCustomersData] = useState<CustomerAnalytics | null>(null);
  const [ordersData, setOrdersData] = useState<OrderAnalytics | null>(null);

  // Error states
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setError(null);
    setLoadingRevenue(true);
    setLoadingProducts(true);
    setLoadingCustomers(true);
    setLoadingOrders(true);

    try {
      const startDate = dateRange.start.toISOString();
      const endDate = dateRange.end.toISOString();
      const { granularity } = filters;

      // Fetch all endpoints in parallel with filters
      const [revenueRes, productsRes, customersRes, ordersRes] = await Promise.all([
        fetch(`/api/analytics/revenue?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}`),
        fetch(`/api/analytics/products?startDate=${startDate}&endDate=${endDate}&limit=10`),
        fetch(`/api/analytics/customers?startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/analytics/orders?startDate=${startDate}&endDate=${endDate}`)
      ]);

      // Check for errors
      if (!revenueRes.ok || !productsRes.ok || !customersRes.ok || !ordersRes.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      // Parse responses
      const [revenue, products, customers, orders] = await Promise.all([
        revenueRes.json(),
        productsRes.json(),
        customersRes.json(),
        ordersRes.json()
      ]);

      // Update states with data from API response
      setRevenueData(revenue.data);
      setProductsData(products.data);
      setCustomersData(customers.data);
      setOrdersData(orders.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoadingRevenue(false);
      setLoadingProducts(false);
      setLoadingCustomers(false);
      setLoadingOrders(false);
    }
  };

  // Fetch data when date range or filters change
  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, filters]);

  // Filter data based on selected filters
  const getFilteredRevenueByCategory = () => {
    if (!revenueData || filters.categories.length === 0) {
      return revenueData?.revenueByCategory || [];
    }
    return revenueData.revenueByCategory.filter(item => 
      filters.categories.includes(item.category)
    );
  };

  const getFilteredOrdersByStatus = () => {
    if (!ordersData || filters.orderStatuses.length === 0) {
      return ordersData?.statusDistribution || [];
    }
    return ordersData.statusDistribution.filter((item: { status: string }) => 
      filters.orderStatuses.includes(item.status)
    );
  };

  // Prepare export data
  const getExportData = (): Record<string, unknown> => {
    return {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString()
      },
      filters: {
        compareWithPrevious: filters.compareWithPrevious,
        granularity: filters.granularity,
        categories: filters.categories,
        orderStatuses: filters.orderStatuses
      },
      revenue: revenueData,
      products: productsData,
      customers: customersData,
      orders: ordersData,
      generatedAt: new Date().toISOString()
    };
  };

  return (
    <AdminLayout
      title="Analytics Dashboard"
      subtitle="Track your business performance and trends"
      headerActions={
        <ExportButton
          data={getExportData()}
          filename={`analytics-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}`}
        />
      }
    >
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Dashboard Header */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <motion.div 
              className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10"
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <ChartLine size={28} weight="bold" className="text-purple-400" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white">Performance Overview</h2>
              <p className="text-sm text-white/40">Real-time business insights</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
            <Sparkle size={14} className="text-amber-400" />
            <span className="text-xs text-white/60">Live data</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </motion.div>

        {/* Date Range Selector */}
        <motion.div 
          variants={itemVariants}
          className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
        >
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </motion.div>

        {/* Filters Panel */}
        <motion.div variants={itemVariants}>
          <AnalyticsFilterPanel
            filters={filters}
            onFiltersChange={setFilters}
          />
        </motion.div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl"
            >
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={fetchAnalytics}
                className="mt-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Key Metrics Cards */}
        <motion.div 
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
        >
          <MetricCard
            title="Total Revenue"
            value={revenueData?.current.totalRevenue || 0}
            change={filters.compareWithPrevious ? revenueData?.growthRate : undefined}
            format="currency"
            icon={<CurrencyDollar size={20} weight="bold" />}
            sparklineData={revenueData?.revenueOverTime.map((d: { revenue: number }) => d.revenue)}
            loading={loadingRevenue}
            subtitle={`from ${revenueData?.current.orderCount || 0} orders`}
            accentColor="purple"
          />
          <MetricCard
            title="Total Orders"
            value={ordersData?.current.totalOrders || 0}
            change={filters.compareWithPrevious ? ordersData?.growthRate : undefined}
            format="number"
            icon={<ShoppingCart size={20} weight="bold" />}
            sparklineData={ordersData?.ordersOverTime.map((d: { count: number }) => d.count)}
            loading={loadingOrders}
            subtitle={`${((ordersData?.current.totalOrders || 0) / (ordersData?.ordersOverTime.length || 1)).toFixed(1)} avg/day`}
            accentColor="emerald"
          />
          <MetricCard
            title="Total Customers"
            value={customersData?.current.totalCustomers || 0}
            change={filters.compareWithPrevious ? customersData?.growthRate : undefined}
            format="number"
            icon={<UsersIcon className="w-5 h-5" />}
            sparklineData={customersData?.acquisitionOverTime.map((d: { newCustomers: number }) => d.newCustomers)}
            loading={loadingCustomers}
            subtitle={`${customersData?.current.newCustomers || 0} new customers`}
            accentColor="blue"
          />
          <MetricCard
            title="Average Order Value"
            value={revenueData?.current.averageOrderValue || 0}
            format="currency"
            icon={<TrendUp size={20} weight="bold" />}
            loading={loadingRevenue}
            subtitle="per order"
            accentColor="amber"
          />
        </motion.div>

        {/* Revenue Chart */}
        <motion.div variants={itemVariants}>
          <RevenueChart
            data={revenueData?.revenueOverTime.map((d: { date: string; revenue: number; orders: number }) => ({
              date: d.date,
              revenue: d.revenue,
              orders: d.orders
            })) || []}
            showOrders={true}
            loading={loadingRevenue}
            height={400}
          />
        </motion.div>

        {/* Products and Customer Acquisition */}
        <motion.div 
          variants={itemVariants}
          className="grid grid-cols-1 xl:grid-cols-2 gap-6"
        >
          <ProductPerformanceChart
            data={productsData?.topProductsByRevenue.map((p: { productName: string; revenue: number; unitsSold: number }) => ({
              productName: p.productName,
              revenue: p.revenue,
              unitsSold: p.unitsSold
            })) || []}
            metric="revenue"
            loading={loadingProducts}
            height={400}
          />
          <CustomerAcquisitionChart
            data={customersData?.acquisitionOverTime.map((d: { date: string; newCustomers: number; totalCustomers: number }) => ({
              date: d.date,
              newCustomers: d.newCustomers,
              totalCustomers: d.totalCustomers
            })) || []}
            loading={loadingCustomers}
            height={400}
          />
        </motion.div>

        {/* Order Status Distribution */}
        <motion.div 
          variants={itemVariants}
          className="grid grid-cols-1 xl:grid-cols-3 gap-6"
        >
          <div className="xl:col-span-1">
            <OrderStatusChart
              data={getFilteredOrdersByStatus().map((s: { status: string; count: number; percentage: number }) => ({
                status: s.status,
                count: s.count,
                percentage: s.percentage
              }))}
              type="donut"
              loading={loadingOrders}
              height={350}
            />
          </div>
          
          {/* Summary Stats */}
          <motion.div 
            className="xl:col-span-2 bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
            whileHover={{ borderColor: 'rgba(255,255,255,0.2)' }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <motion.div 
                className="p-2 rounded-xl bg-amber-500/20"
                whileHover={{ scale: 1.05, rotate: 5 }}
              >
                <Sparkle size={20} weight="bold" className="text-amber-400" />
              </motion.div>
              <h3 className="text-lg font-semibold text-white">Performance Summary</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Revenue Stats */}
              <motion.div 
                className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5"
                whileHover={{ borderColor: 'rgba(168,85,247,0.3)', backgroundColor: 'rgba(168,85,247,0.05)' }}
              >
                <h4 className="text-[10px] font-medium text-purple-400 uppercase tracking-[0.15em]">Revenue Insights</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Daily Average</span>
                    <span className="text-sm font-semibold text-white">
                      ${((revenueData?.current.totalRevenue || 0) / (revenueData?.revenueOverTime.length || 1)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Peak Day</span>
                    <span className="text-sm font-semibold text-white">
                      ${Math.max(...(revenueData?.revenueOverTime.map((d: { revenue: number }) => d.revenue) || [0])).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Growth Rate</span>
                    <span className={`text-sm font-semibold ${
                      (revenueData?.growthRate || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {(revenueData?.growthRate || 0) >= 0 ? '+' : ''}{(revenueData?.growthRate || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Customer Stats */}
              <motion.div 
                className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5"
                whileHover={{ borderColor: 'rgba(96,165,250,0.3)', backgroundColor: 'rgba(96,165,250,0.05)' }}
              >
                <h4 className="text-[10px] font-medium text-blue-400 uppercase tracking-[0.15em]">Customer Insights</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">New Customers</span>
                    <span className="text-sm font-semibold text-white">
                      {customersData?.current.newCustomers || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Repeat Rate</span>
                    <span className="text-sm font-semibold text-white">
                      {customersData?.current.repeatCustomerRate.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Growth Rate</span>
                    <span className={`text-sm font-semibold ${
                      (customersData?.growthRate || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {(customersData?.growthRate || 0) >= 0 ? '+' : ''}{(customersData?.growthRate || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Product Stats */}
              <motion.div 
                className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5"
                whileHover={{ borderColor: 'rgba(52,211,153,0.3)', backgroundColor: 'rgba(52,211,153,0.05)' }}
              >
                <h4 className="text-[10px] font-medium text-emerald-400 uppercase tracking-[0.15em]">Product Insights</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Top Product</span>
                    <span className="text-sm font-semibold text-white truncate max-w-[150px]">
                      {productsData?.topProductsByRevenue[0]?.productName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Products Sold</span>
                    <span className="text-sm font-semibold text-white">
                      {productsData?.totalProducts || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Total Units</span>
                    <span className="text-sm font-semibold text-white">
                      {productsData?.totalUnitsSold.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Order Stats */}
              <motion.div 
                className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5"
                whileHover={{ borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.05)' }}
              >
                <h4 className="text-[10px] font-medium text-amber-400 uppercase tracking-[0.15em]">Order Insights</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Completed</span>
                    <span className="text-sm font-semibold text-emerald-400">
                      {ordersData?.statusDistribution.find((s: { status: string }) => s.status.toLowerCase() === 'completed')?.count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Pending</span>
                    <span className="text-sm font-semibold text-amber-400">
                      {ordersData?.statusDistribution.find((s: { status: string }) => s.status.toLowerCase() === 'pending')?.count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/70">Average/Day</span>
                    <span className="text-sm font-semibold text-white">
                      {((ordersData?.current.totalOrders || 0) / (ordersData?.ordersOverTime.length || 1)).toFixed(1)}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* AI Insights Section */}
        <motion.div variants={itemVariants}>
          <DataInsights
            revenueChange={revenueData?.growthRate || 0}
            ordersChange={ordersData?.growthRate || 0}
            customersChange={customersData?.growthRate || 0}
            avgOrderValue={revenueData?.current.averageOrderValue || 0}
            previousAvgOrderValue={revenueData?.previous.averageOrderValue || 0}
            topProductName={productsData?.topProductsByRevenue[0]?.productName || ''}
            topProductRevenue={productsData?.topProductsByRevenue[0]?.revenue || 0}
            pendingOrders={ordersData?.statusDistribution.find((s: { status: string }) => s.status.toLowerCase() === 'pending')?.count || 0}
            totalOrders={ordersData?.current.totalOrders || 0}
          />
        </motion.div>

        {/* Revenue by Category - Shows filtered results */}
        <AnimatePresence>
          {filters.categories.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Filtered Revenue by Category ({filters.categories.length} selected)
              </h3>
              <div className="space-y-4">
                {getFilteredRevenueByCategory()?.map((category: { category: string; revenue: number; percentage: number }, index: number) => (
                  <motion.div 
                    key={category.category} 
                    className="space-y-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-white">{category.category}</span>
                      <span className="text-sm font-semibold text-white">
                        ${category.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 h-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${category.percentage}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                          style={{ boxShadow: '0 0 8px rgba(168,85,247,0.5)' }}
                        />
                      </div>
                      <span className="text-xs text-white/40 w-12 text-right">{category.percentage.toFixed(1)}%</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        <motion.div 
          variants={itemVariants}
          className="text-center py-6"
        >
          <p className="text-sm text-white/40">
            Analytics data updates in real-time based on your selected date range
          </p>
          <p className="text-xs text-white/20 mt-2">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </motion.div>
      </motion.div>
    </AdminLayout>
  );
}
