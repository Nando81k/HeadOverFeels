/**
 * Analytics Dashboard Page
 * 
 * Comprehensive analytics view for admin with:
 * - Key metrics cards (Revenue, Orders, Customers, AOV)
 * - Revenue trends chart
 * - Product performance chart
 * - Customer acquisition chart
 * - Order status distribution
 * - Date range filtering
 * - Data export functionality
 */

'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingCart, Users as UsersIcon, DollarSign } from 'lucide-react';
import MetricCard from '@/components/analytics/MetricCard';
import RevenueChart from '@/components/analytics/RevenueChart';
import ProductPerformanceChart from '@/components/analytics/ProductPerformanceChart';
import CustomerAcquisitionChart from '@/components/analytics/CustomerAcquisitionChart';
import OrderStatusChart from '@/components/analytics/OrderStatusChart';
import DateRangeSelector, { DateRange } from '@/components/analytics/DateRangeSelector';
import ExportButton from '@/components/analytics/ExportButton';
import AnalyticsFilterPanel, { AnalyticsFilters } from '@/components/analytics/AnalyticsFilterPanel';
import {
  RevenueAnalytics,
  ProductAnalytics,
  CustomerAnalytics,
  OrderAnalytics
} from '@/lib/analytics/types';

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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">Track your business performance and trends</p>
          </div>
          <ExportButton
            data={getExportData()}
            filename={`analytics-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}`}
          />
        </div>

        {/* Date Range Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        {/* Filters Panel */}
        <AnalyticsFilterPanel
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Revenue"
            value={revenueData?.current.totalRevenue || 0}
            change={filters.compareWithPrevious ? revenueData?.growthRate : undefined}
            format="currency"
            icon={<DollarSign className="w-5 h-5" />}
            sparklineData={revenueData?.revenueOverTime.map((d: { revenue: number }) => d.revenue)}
            loading={loadingRevenue}
            subtitle={`from ${revenueData?.current.orderCount || 0} orders`}
          />
          <MetricCard
            title="Total Orders"
            value={ordersData?.current.totalOrders || 0}
            change={filters.compareWithPrevious ? ordersData?.growthRate : undefined}
            format="number"
            icon={<ShoppingCart className="w-5 h-5" />}
            sparklineData={ordersData?.ordersOverTime.map((d: { count: number }) => d.count)}
            loading={loadingOrders}
            subtitle={`${((ordersData?.current.totalOrders || 0) / (ordersData?.ordersOverTime.length || 1)).toFixed(1)} avg/day`}
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
          />
          <MetricCard
            title="Average Order Value"
            value={revenueData?.current.averageOrderValue || 0}
            format="currency"
            icon={<TrendingUp className="w-5 h-5" />}
            loading={loadingRevenue}
            subtitle="per order"
          />
        </div>

        {/* Revenue Chart */}
        {/* Revenue Chart */}
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

        {/* Products and Customer Acquisition */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        </div>

        {/* Order Status Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
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
          </div>          {/* Summary Stats */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Revenue Stats */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Revenue Insights</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Daily Average</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ${((revenueData?.current.totalRevenue || 0) / (revenueData?.revenueOverTime.length || 1)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Peak Day</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ${Math.max(...(revenueData?.revenueOverTime.map((d: { revenue: number }) => d.revenue) || [0])).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Growth Rate</span>
                    <span className={`text-sm font-semibold ${
                      (revenueData?.growthRate || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(revenueData?.growthRate || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Stats */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Customer Insights</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">New Customers</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {customersData?.current.newCustomers || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Repeat Rate</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {customersData?.current.repeatCustomerRate.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Growth Rate</span>
                    <span className={`text-sm font-semibold ${
                      (customersData?.growthRate || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(customersData?.growthRate || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Stats */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Product Insights</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Top Product</span>
                    <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">
                      {productsData?.topProductsByRevenue[0]?.productName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Products Sold</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {productsData?.totalProducts || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Units</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {productsData?.totalUnitsSold.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Stats */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Order Insights</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="text-sm font-semibold text-green-600">
                      {ordersData?.statusDistribution.find((s: { status: string }) => s.status.toLowerCase() === 'completed')?.count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Pending</span>
                    <span className="text-sm font-semibold text-yellow-600">
                      {ordersData?.statusDistribution.find((s: { status: string }) => s.status.toLowerCase() === 'pending')?.count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average/Day</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {((ordersData?.current.totalOrders || 0) / (ordersData?.ordersOverTime.length || 1)).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Category - Shows filtered results */}
        {filters.categories.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Filtered Revenue by Category ({filters.categories.length} selected)
            </h3>
            <div className="space-y-4">
              {getFilteredRevenueByCategory()?.map((category: { category: string; revenue: number; percentage: number }) => (
                <div key={category.category} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{category.category}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ${category.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${category.percentage.toFixed(1)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="text-center text-sm text-gray-500 py-4">
          <p>Analytics data updates in real-time based on your selected date range</p>
        </div>
      </div>
    </div>
  );
}
