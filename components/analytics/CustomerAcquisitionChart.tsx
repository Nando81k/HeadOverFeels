/**
 * CustomerAcquisitionChart Component - Modernized
 * 
 * Displays customer acquisition trends over time with:
 * - Animated area chart with smooth entrance
 * - New vs total customers comparison
 * - Interactive tooltips with insights
 * - Quick stat cards with trends
 * - Glass morphism dark theme
 * - Smooth animations and micro-interactions
 */

'use client';

import { motion } from 'framer-motion';
import { Users, UserPlus, TrendUp, TrendDown, ChartLineUp, CalendarBlank } from '@phosphor-icons/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface CustomerAcquisitionChartProps {
  data: Array<{
    date: string;
    newCustomers: number;
    totalCustomers: number;
  }>;
  loading?: boolean;
  height?: number;
}

// Custom animated tooltip
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-5 py-4 border border-white/20 rounded-xl shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <CalendarBlank size={14} className="text-white/50" />
          <p className="text-sm font-semibold text-white">{label}</p>
        </div>
        <div className="space-y-2">
          {payload.map((entry, index: number) => {
            const isNew = entry.dataKey === 'newCustomers';
            return (
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
                <div className="flex items-center gap-2">
                  {isNew && <UserPlus size={12} style={{ color: entry.color }} />}
                  {!isNew && <Users size={12} style={{ color: entry.color }} />}
                  <span className="font-bold text-white">{entry.value?.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  }
  return null;
}

export default function CustomerAcquisitionChart({
  data,
  loading = false,
  height = 400
}: CustomerAcquisitionChartProps) {
  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-white/10 rounded-xl animate-pulse" />
          <div className="h-6 bg-white/10 rounded w-1/3 animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white/5 rounded-xl animate-pulse flex items-center justify-center">
          <div className="w-16 h-16 border-2 border-white/20 border-t-emerald-500 rounded-full animate-spin" />
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

  // Calculate stats
  const totalNew = data.reduce((sum, item) => sum + item.newCustomers, 0);
  const latestTotal = data.length > 0 ? data[data.length - 1].totalCustomers : 0;
  const avgNewPerDay = data.length > 0 ? totalNew / data.length : 0;
  
  // Growth rate calculation
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, d) => sum + d.newCustomers, 0) / firstHalf.length : 0;
  const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, d) => sum + d.newCustomers, 0) / secondHalf.length : 0;
  const growthRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;
  const isGrowing = growthRate >= 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <motion.div 
          className="p-2 rounded-xl bg-emerald-500/20"
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <Users size={24} weight="bold" className="text-emerald-400" />
        </motion.div>
        <div>
          <h3 className="text-lg font-semibold text-white">Customer Acquisition</h3>
          <p className="text-sm text-white/40">Growth trends over time</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-xl p-3 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-1">
            <UserPlus size={14} className="text-emerald-400" />
            <p className="text-[10px] uppercase tracking-wider text-white/40">New Customers</p>
          </div>
          <p className="text-xl font-bold text-white">{totalNew.toLocaleString()}</p>
          <p className="text-xs text-white/40">Period total</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 rounded-xl p-3 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-1">
            <ChartLineUp size={14} className="text-indigo-400" />
            <p className="text-[10px] uppercase tracking-wider text-white/40">Daily Average</p>
          </div>
          <p className="text-xl font-bold text-white">{avgNewPerDay.toFixed(1)}</p>
          <p className="text-xs text-white/40">New per day</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 rounded-xl p-3 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-1">
            {isGrowing ? (
              <TrendUp size={14} className="text-emerald-400" />
            ) : (
              <TrendDown size={14} className="text-red-400" />
            )}
            <p className="text-[10px] uppercase tracking-wider text-white/40">Growth Rate</p>
          </div>
          <p className={`text-xl font-bold ${isGrowing ? 'text-emerald-400' : 'text-red-400'}`}>
            {isGrowing ? '+' : ''}{growthRate.toFixed(1)}%
          </p>
          <p className="text-xs text-white/40">vs. previous period</p>
        </motion.div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <ResponsiveContainer width="100%" height={height - 180}>
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient id="colorNewCustomers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#34d399" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTotalCustomers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#818cf8" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
              {/* Glow filters */}
              <filter id="glowEmerald" height="300%" width="300%" x="-100%" y="-100%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span className="text-white/60 text-sm">{value}</span>}
              iconType="circle"
            />
            <Area
              type="linear"
              dataKey="totalCustomers"
              name="Total Customers"
              stroke="#818cf8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorTotalCustomers)"
              animationDuration={1500}
              animationEasing="ease-out"
            />
            <Area
              type="linear"
              dataKey="newCustomers"
              name="New Customers"
              stroke="#34d399"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorNewCustomers)"
              animationDuration={1500}
              animationEasing="ease-out"
              style={{ filter: 'url(#glowEmerald)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Bottom insight */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5"
      >
        <Users size={16} className="text-indigo-400" />
        <span className="text-sm text-white/60">
          Total customer base: <span className="font-semibold text-white">{latestTotal.toLocaleString()}</span>
        </span>
      </motion.div>
    </motion.div>
  );
}
