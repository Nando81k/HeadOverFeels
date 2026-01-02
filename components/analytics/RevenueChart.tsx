/**
 * RevenueChart Component - Modernized
 * 
 * Displays revenue trends over time with:
 * - Animated entrance and data transitions
 * - Line/Area/bar chart toggle
 * - Gradient fills and glows
 * - Interactive tooltips with insights
 * - Period comparison overlay
 * - Glass morphism dark theme
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartBar, TrendUp, ChartLine, Waves } from '@phosphor-icons/react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
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

// Custom animated tooltip component
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-5 py-4 border border-white/20 rounded-xl shadow-2xl"
      >
        <p className="text-sm font-semibold text-white mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((entry, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shadow-lg"
                  style={{ 
                    backgroundColor: entry.color,
                    boxShadow: `0 0 8px ${entry.color}40`
                  }}
                />
                <span className="text-white/60 text-sm">{entry.name}</span>
              </div>
              <span className="font-bold text-white">
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
      </motion.div>
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
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('area');

  // Calculate stats
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const avgRevenue = data.length > 0 ? totalRevenue / data.length : 0;
  const maxRevenue = Math.max(...data.map(d => d.revenue), 0);
  const maxRevenueDay = data.find(d => d.revenue === maxRevenue)?.date;

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-white/10 rounded w-1/4 animate-pulse"></div>
          <div className="h-10 bg-white/10 rounded w-32 animate-pulse"></div>
        </div>
        <div className="h-96 bg-white/5 rounded-xl animate-pulse flex items-center justify-center">
          <div className="w-16 h-16 border-2 border-white/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      </motion.div>
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

  const chartTypes = [
    { type: 'area' as const, icon: Waves, label: 'Area' },
    { type: 'line' as const, icon: ChartLine, label: 'Line' },
    { type: 'bar' as const, icon: ChartBar, label: 'Bar' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6 overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <motion.div 
            className="p-2 rounded-xl bg-purple-500/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <TrendUp size={24} weight="bold" className="text-purple-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-white">Revenue Over Time</h3>
            <p className="text-sm text-white/40">
              Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalRevenue)}
            </p>
          </div>
        </div>

        {/* Chart Type Toggle */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
          {chartTypes.map(({ type, icon: Icon, label }) => (
            <motion.button
              key={type}
              onClick={() => setChartType(type)}
              className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                chartType === type
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {chartType === type && (
                <motion.div
                  layoutId="activeChartType"
                  className="absolute inset-0 bg-white/10 rounded-lg border border-white/20"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon size={16} weight="bold" className="relative z-10" />
              <span className="relative z-10 hidden sm:inline">{label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Daily Average</p>
          <p className="text-lg font-bold text-white">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(avgRevenue)}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Peak Day</p>
          <p className="text-lg font-bold text-emerald-400">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(maxRevenue)}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Best Day</p>
          <p className="text-lg font-bold text-white">
            {maxRevenueDay ? new Date(maxRevenueDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Chart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={chartType}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <ResponsiveContainer width="100%" height={height}>
            {chartType === 'area' ? (
              <AreaChart data={formattedData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => <span className="text-white/60 text-sm">{value}</span>}
                  iconType="circle"
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#a855f7"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                {showOrders && (
                  <Area
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    fill="url(#ordersGradient)"
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                )}
              </AreaChart>
            ) : chartType === 'line' ? (
              <LineChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => <span className="text-white/60 text-sm">{value}</span>}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#a855f7"
                  strokeWidth={3}
                  dot={{ fill: '#a855f7', r: 4, strokeWidth: 2, stroke: '#1a1a1a' }}
                  activeDot={{ r: 8, fill: '#a855f7', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                {showOrders && (
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={{ fill: '#60a5fa', r: 3, strokeWidth: 2, stroke: '#1a1a1a' }}
                    activeDot={{ r: 6 }}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                )}
              </LineChart>
            ) : (
              <BarChart data={formattedData}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => <span className="text-white/60 text-sm">{value}</span>}
                  iconType="square"
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="url(#barGradient)"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                {showOrders && (
                  <Bar
                    dataKey="orders"
                    name="Orders"
                    fill="#60a5fa"
                    radius={[6, 6, 0, 0]}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
