/**
 * OrderStatusChart Component
 * 
 * Displays order status distribution
 * - Pie or donut chart
 * - Status breakdown with percentages
 * - Color-coded by status
 */

'use client';

import { Package } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';

interface OrderStatusChartProps {
  data: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  loading?: boolean;
  height?: number;
  type?: 'pie' | 'donut';
}

// Status colors
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
  refunded: '#6b7280'
};

// Custom tooltip
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; payload?: { status: string; percentage: number } }> }) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900 mb-1 capitalize">
          {data.payload?.status}
        </p>
        <p className="text-sm text-gray-600">
          Orders: <span className="font-semibold text-gray-900">{data.value}</span>
        </p>
        <p className="text-sm text-gray-600">
          Percentage: <span className="font-semibold text-gray-900">{data.payload?.percentage}%</span>
        </p>
      </div>
    );
  }
  return null;
}

export default function OrderStatusChart({
  data,
  loading = false,
  height = 400,
  type = 'donut'
}: OrderStatusChartProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-6 animate-pulse"></div>
        <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  // Get colors for each status
  const dataWithColors = data.map(item => ({
    ...item,
    color: STATUS_COLORS[item.status.toLowerCase()] || '#6b7280'
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Package className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Order Status Distribution</h3>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={dataWithColors}
            dataKey="count"
            nameKey="status"
            cx="50%"
            cy="50%"
            outerRadius={type === 'donut' ? 120 : 140}
            innerRadius={type === 'donut' ? 70 : 0}
            label={(entry) => `${entry.percentage}%`}
            labelLine={false}
          >
            {dataWithColors.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="capitalize text-sm">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {dataWithColors.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div>
              <p className="text-xs text-gray-600 capitalize">{item.status}</p>
              <p className="text-sm font-semibold text-gray-900">{item.count} orders</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
