'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users } from 'lucide-react';

interface AnalyticsPreviewData {
  totalRevenue: number;
  revenueGrowth: number;
  totalOrders: number;
  ordersGrowth: number;
  totalCustomers: number;
  customersGrowth: number;
  sparklineData: number[];
}

export default function AnalyticsPreview() {
  const [data, setData] = useState<AnalyticsPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get last 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        // Fetch revenue analytics
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          granularity: 'daily',
          compareWithPrevious: 'true'
        });

        const [revenueRes, ordersRes, customersRes] = await Promise.all([
          fetch(`/api/analytics/revenue?${params}`),
          fetch(`/api/analytics/orders?${params}`),
          fetch(`/api/analytics/customers?${params}`)
        ]);

        if (!revenueRes.ok || !ordersRes.ok || !customersRes.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const [revenueResponse, ordersResponse, customersResponse] = await Promise.all([
          revenueRes.json(),
          ordersRes.json(),
          customersRes.json()
        ]);

        // Extract data from API response wrapper
        const revenueData = revenueResponse.data;
        const ordersData = ordersResponse.data;
        const customersData = customersResponse.data;

        // Validate response structure
        if (!revenueData?.revenueOverTime || !revenueData?.current || !ordersData?.current || !customersData?.current) {
          throw new Error('Invalid analytics data structure');
        }

        // Extract sparkline data (last 7 days revenue)
        const sparklineData = revenueData.revenueOverTime
          .slice(-7)
          .map((d: { revenue: number }) => d.revenue);

        setData({
          totalRevenue: revenueData.current.totalRevenue,
          revenueGrowth: revenueData.growthRate,
          totalOrders: ordersData.current.totalOrders,
          ordersGrowth: ordersData.growthRate,
          totalCustomers: customersData.current.totalCustomers,
          customersGrowth: customersData.growthRate,
          sparklineData
        });
      } catch (err) {
        console.error('Analytics preview error:', err);
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-6"></div>
        <div className="space-y-4">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200">
        <h3 className="text-xl font-semibold mb-4">Analytics Dashboard</h3>
        <p className="text-gray-600 mb-6">
          View comprehensive analytics, charts, and business insights.
        </p>
        <div className="text-sm text-red-600 mb-4">
          {error || 'Failed to load preview data'}
        </div>
        <a
          href="/admin/analytics"
          className="block w-full bg-black text-white py-3 px-4 rounded hover:bg-gray-800 transition-colors text-center"
        >
          View Full Analytics
        </a>
      </div>
    );
  }

  // Calculate min and max for sparkline scaling
  const minRevenue = Math.min(...data.sparklineData);
  const maxRevenue = Math.max(...data.sparklineData);
  const range = maxRevenue - minRevenue || 1;

  // Generate SVG sparkline path
  const sparklinePoints = data.sparklineData.map((value, index) => {
    const x = (index / (data.sparklineData.length - 1)) * 100;
    const y = 100 - ((value - minRevenue) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-white p-8 rounded-lg border border-gray-200">
      <h3 className="text-xl font-semibold mb-4">Analytics Dashboard</h3>
      <p className="text-gray-600 mb-6">
        View comprehensive analytics, charts, and business insights.
      </p>

      {/* Mini Sparkline */}
      <div className="mb-6 bg-gray-50 rounded-lg p-4">
        <div className="text-xs font-medium text-gray-600 mb-2">Revenue Trend (Last 7 Days)</div>
        <svg
          viewBox="0 0 100 30"
          className="w-full h-12"
          preserveAspectRatio="none"
        >
          <polyline
            points={sparklinePoints}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={`0,30 ${sparklinePoints} 100,30`}
            fill="url(#gradient)"
            opacity="0.2"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Key Metrics */}
      <div className="space-y-4 mb-6">
        {/* Revenue */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-gray-600">Revenue</div>
              <div className="text-sm font-semibold">
                ${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${
            data.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {data.revenueGrowth >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(data.revenueGrowth).toFixed(1)}%
          </div>
        </div>

        {/* Orders */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-600">Orders</div>
              <div className="text-sm font-semibold">{data.totalOrders}</div>
            </div>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${
            data.ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {data.ordersGrowth >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(data.ordersGrowth).toFixed(1)}%
          </div>
        </div>

        {/* Customers */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-gray-600">Customers</div>
              <div className="text-sm font-semibold">{data.totalCustomers}</div>
            </div>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${
            data.customersGrowth >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {data.customersGrowth >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(data.customersGrowth).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <a
        href="/admin/analytics"
        className="block w-full bg-black text-white py-3 px-4 rounded hover:bg-gray-800 transition-colors text-center font-medium"
      >
        View Full Analytics →
      </a>
    </div>
  );
}
