/**
 * ProductPerformanceChart Component
 * 
 * Displays top products by revenue or units sold
 * - Horizontal bar chart
 * - Custom colors
 * - Formatted values
 */

'use client';

import { Package } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface ProductPerformanceChartProps {
  data: Array<{
    productName: string;
    revenue?: number;
    unitsSold?: number;
  }>;
  metric?: 'revenue' | 'units';
  loading?: boolean;
  height?: number;
}

// Custom tooltip
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value?: number }>}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-900">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
          }).format(payload[0].value || 0)}
        </p>
      </div>
    );
  }
  return null;
}

export default function ProductPerformanceChart({
  data,
  metric = 'revenue',
  loading = false,
  height = 400
}: ProductPerformanceChartProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        </div>
        <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  // Format data for the selected metric
  const chartData = data.map(item => ({
    name: item.productName.length > 25 
      ? item.productName.substring(0, 25) + '...'
      : item.productName,
    value: metric === 'revenue' ? item.revenue || 0 : item.unitsSold || 0
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Package className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Top Products by {metric === 'revenue' ? 'Revenue' : 'Units Sold'}
        </h3>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={false}
            tickFormatter={(value) =>
              metric === 'revenue'
                ? `$${(value / 1000).toFixed(0)}k`
                : value.toString()
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={false}
            width={150}
          />
          <Tooltip content={metric === 'revenue' ? <CustomTooltip /> : undefined} />
          <Bar
            dataKey="value"
            fill="#3b82f6"
            radius={[0, 8, 8, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
