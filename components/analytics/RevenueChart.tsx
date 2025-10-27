/**
 * RevenueChart Component
 * 
 * Displays revenue trends over time with:
 * - Line/bar chart toggle
 * - Responsive design
 * - Custom tooltips
 * - Time-series data
 * - Loading states
 */

'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    orders?: number;
  }>;
  loading?: boolean;
  showOrders?: boolean;
  height?: number;
}

// Custom tooltip component (outside of main component)
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-semibold text-gray-900">
              {entry.name === 'Revenue' 
                ? new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0
                  }).format(entry.value || 0)
                : entry.value
              }
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function RevenueChart({
  data,
  loading = false,
  showOrders = true,
  height = 400
}: RevenueChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
        </div>
        <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  // Format data for display
  const formattedData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Revenue Over Time</h3>
        </div>

        {/* Chart Type Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              chartType === 'line'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              chartType === 'bar'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        {chartType === 'line' ? (
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={false}
              tickFormatter={(value) =>
                `$${(value / 1000).toFixed(0)}k`
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#9333ea"
              strokeWidth={3}
              dot={{ fill: '#9333ea', r: 4 }}
              activeDot={{ r: 6 }}
            />
            {showOrders && (
              <Line
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        ) : (
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={false}
              tickFormatter={(value) =>
                `$${(value / 1000).toFixed(0)}k`
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="square"
            />
            <Bar
              dataKey="revenue"
              name="Revenue"
              fill="#9333ea"
              radius={[8, 8, 0, 0]}
            />
            {showOrders && (
              <Bar
                dataKey="orders"
                name="Orders"
                fill="#3b82f6"
                radius={[8, 8, 0, 0]}
              />
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
