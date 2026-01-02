/**
 * Customer Spending Chart Component
 * 
 * Displays customer spending trends over time with:
 * - Line/area chart for spending
 * - Monthly breakdown
 * - Comparison to average
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendUp, TrendDown, ChartLine, CalendarBlank, IconProps } from '@phosphor-icons/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

type PhosphorIcon = React.ComponentType<IconProps>;

interface SpendingData {
  month: string;
  spending: number;
  orders: number;
}

interface CustomerSpendingChartProps {
  data: SpendingData[];
  averageSpending?: number;
  loading?: boolean;
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: { 
  active?: boolean; 
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    const spending = payload[0]?.value || 0;
    const orders = payload.find(p => p.dataKey === 'orders')?.value || 0;
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-4 py-3 border border-white/20 rounded-xl shadow-2xl"
      >
        <p className="text-sm font-semibold text-white mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-white/60">Spending</span>
            <span className="text-sm font-semibold text-emerald-400">${spending.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-white/60">Orders</span>
            <span className="text-sm font-medium text-white">{orders}</span>
          </div>
        </div>
      </motion.div>
    );
  }
  return null;
}

export default function CustomerSpendingChart({
  data,
  averageSpending = 0,
  loading = false
}: CustomerSpendingChartProps) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  // Calculate totals and trends
  const totalSpending = data.reduce((sum, item) => sum + item.spending, 0);
  const totalOrders = data.reduce((sum, item) => sum + item.orders, 0);
  
  // Calculate trend (compare last 3 months to previous 3 months)
  const recentSpending = data.slice(-3).reduce((sum, item) => sum + item.spending, 0);
  const previousSpending = data.slice(-6, -3).reduce((sum, item) => sum + item.spending, 0);
  const spendingTrend = previousSpending > 0 
    ? ((recentSpending - previousSpending) / previousSpending) * 100 
    : recentSpending > 0 ? 100 : 0;

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
      >
        <div className="h-6 bg-white/10 rounded w-1/3 animate-pulse mb-6"></div>
        <div className="h-[200px] bg-white/5 rounded-lg animate-pulse" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div 
            className="p-2 rounded-xl bg-emerald-500/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <ChartLine size={24} weight="bold" className="text-emerald-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-white">Spending Trends</h3>
            <p className="text-sm text-white/40">Last {data.length} months</p>
          </div>
        </div>

        {/* Trend indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
          spendingTrend >= 0 
            ? 'bg-emerald-500/10 text-emerald-400' 
            : 'bg-red-500/10 text-red-400'
        }`}>
          {spendingTrend >= 0 ? (
            <TrendUp size={16} weight="bold" />
          ) : (
            <TrendDown size={16} weight="bold" />
          )}
          <span className="text-sm font-semibold">
            {spendingTrend >= 0 ? '+' : ''}{spendingTrend.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-white/40 mb-1">Total Spent</p>
          <p className="text-lg font-bold text-white">${totalSpending.toFixed(2)}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-white/40 mb-1">Total Orders</p>
          <p className="text-lg font-bold text-white">{totalOrders}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-white/40 mb-1">Avg Order</p>
          <p className="text-lg font-bold text-white">
            ${totalOrders > 0 ? (totalSpending / totalOrders).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="month" 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {averageSpending > 0 && (
              <ReferenceLine 
                y={averageSpending} 
                stroke="rgba(96, 165, 250, 0.5)" 
                strokeDasharray="5 5"
                label={{ 
                  value: 'Avg', 
                  fill: 'rgba(96, 165, 250, 0.7)', 
                  fontSize: 10,
                  position: 'right'
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="spending"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#spendingGradient)"
              animationBegin={0}
              animationDuration={1200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
