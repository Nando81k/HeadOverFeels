/**
 * MetricCard Component
 * 
 * Displays a single metric with:
 * - Large value display
 * - Growth indicator (↑↓ with percentage)
 * - Optional mini sparkline chart
 * - Color-coded changes (green positive, red negative)
 * - Loading skeleton state
 */

'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number; // Percentage change from previous period
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  sparklineData?: number[];
  loading?: boolean;
  format?: 'currency' | 'number' | 'percentage';
  subtitle?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  trend,
  icon,
  sparklineData,
  loading = false,
  format = 'number',
  subtitle
}: MetricCardProps) {
  // Format the display value
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  // Determine trend if not explicitly provided
  const determinedTrend = trend || (change !== undefined 
    ? change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    : 'neutral'
  );

  // Get colors based on trend
  const trendColors = {
    up: {
      text: 'text-green-600',
      bg: 'bg-green-50',
      icon: TrendingUp
    },
    down: {
      text: 'text-red-600',
      bg: 'bg-red-50',
      icon: TrendingDown
    },
    neutral: {
      text: 'text-gray-600',
      bg: 'bg-gray-50',
      icon: Minus
    }
  };

  const colors = trendColors[determinedTrend];
  const TrendIcon = colors.icon;

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  // Format sparkline data for Recharts
  const chartData = sparklineData?.map((value, index) => ({
    index,
    value
  })) || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="ml-4 text-gray-400">
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-3">
        <p className="text-3xl font-bold text-gray-900">
          {formatValue(value)}
        </p>
      </div>

      {/* Change Indicator and Sparkline */}
      <div className="flex items-center justify-between">
        {/* Change Badge */}
        {change !== undefined && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
            <TrendIcon className="w-4 h-4" />
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="ml-auto" style={{ width: '100px', height: '32px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={determinedTrend === 'up' ? '#10b981' : determinedTrend === 'down' ? '#ef4444' : '#6b7280'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
