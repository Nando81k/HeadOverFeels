/**
 * ProductPerformanceChart Component - Modernized
 * 
 * Displays top products by revenue or units sold with:
 * - Animated horizontal bar chart with entrance effects
 * - Gradient bars with glow effects
 * - Interactive hover states with product details
 * - Glass morphism dark theme
 * - Smooth animations and micro-interactions
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TShirt, CurrencyDollar, Hash, Medal, Trophy, Crown } from '@phosphor-icons/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
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

// Rank icons and colors
const RANK_CONFIG = [
  { icon: Crown, color: '#fbbf24', gradient: 'from-amber-500 to-yellow-400' },
  { icon: Trophy, color: '#94a3b8', gradient: 'from-slate-400 to-gray-300' },
  { icon: Medal, color: '#cd7f32', gradient: 'from-orange-600 to-amber-500' },
];

// Custom tooltip - dark theme with enhanced styling
function CustomTooltip({ 
  active, 
  payload,
  metric 
}: { 
  active?: boolean; 
  payload?: Array<{ value?: number; payload?: { name: string; fullName: string; rank: number } }>;
  metric: 'revenue' | 'units';
}) {
  if (active && payload && payload.length) {
    const data = payload[0];
    const value = data.value || 0;
    const rank = data.payload?.rank || 0;
    const RankIcon = RANK_CONFIG[rank]?.icon || Medal;
    
    return (
      <motion.div 
        initial={{ opacity: 0, x: -10, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-5 py-4 border border-white/20 rounded-xl shadow-2xl"
      >
        <div className="flex items-start gap-3">
          {rank < 3 && (
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${RANK_CONFIG[rank]?.color}20` }}
            >
              <RankIcon size={20} weight="fill" style={{ color: RANK_CONFIG[rank]?.color }} />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-white mb-1">{data.payload?.fullName}</p>
            <div className="flex items-center gap-2">
              {metric === 'revenue' ? (
                <CurrencyDollar size={14} className="text-emerald-400" />
              ) : (
                <Hash size={14} className="text-blue-400" />
              )}
              <p className="text-lg font-bold text-white">
                {metric === 'revenue'
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0
                    }).format(value)
                  : `${value.toLocaleString()} units`
                }
              </p>
            </div>
          </div>
        </div>
      </motion.div>
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-32 h-4 bg-white/5 rounded animate-pulse" />
              <div className="flex-1 h-8 bg-white/5 rounded-lg animate-pulse" style={{ width: `${100 - i * 15}%` }} />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Calculate max value for percentage calculations
  const values = data.map(item => metric === 'revenue' ? item.revenue || 0 : item.unitsSold || 0);
  const maxValue = Math.max(...values, 1);
  const totalValue = values.reduce((sum, v) => sum + v, 0);

  // Format data for the selected metric
  const chartData = data.map((item, index) => ({
    name: item.productName.length > 20 
      ? item.productName.substring(0, 20) + '...'
      : item.productName,
    fullName: item.productName,
    value: metric === 'revenue' ? item.revenue || 0 : item.unitsSold || 0,
    rank: index,
    percentage: totalValue > 0 ? ((metric === 'revenue' ? item.revenue || 0 : item.unitsSold || 0) / totalValue * 100) : 0
  }));

  // Gradient colors for bars
  const getBarColor = (index: number) => {
    if (index === 0) return '#fbbf24'; // Gold
    if (index === 1) return '#94a3b8'; // Silver  
    if (index === 2) return '#cd7f32'; // Bronze
    return '#60a5fa'; // Blue for rest
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <motion.div 
            className="p-2 rounded-xl bg-blue-500/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <TShirt size={24} weight="bold" className="text-blue-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Top Products
            </h3>
            <p className="text-sm text-white/40">
              By {metric === 'revenue' ? 'Revenue' : 'Units Sold'}
            </p>
          </div>
        </div>

        {/* Total Summary */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
          {metric === 'revenue' ? (
            <CurrencyDollar size={18} className="text-emerald-400" />
          ) : (
            <Hash size={18} className="text-blue-400" />
          )}
          <span className="text-sm text-white/60">Total:</span>
          <span className="text-sm font-bold text-white">
            {metric === 'revenue'
              ? new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0
                }).format(totalValue)
              : totalValue.toLocaleString()
            }
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          barCategoryGap="20%"
        >
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="silverGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <linearGradient id="bronzeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#cd7f32" />
              <stop offset="100%" stopColor="#b8860b" />
            </linearGradient>
            <linearGradient id="blueGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickFormatter={(value) =>
              metric === 'revenue'
                ? `$${(value / 1000).toFixed(0)}k`
                : value.toString()
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            width={140}
          />
          <Tooltip 
            content={<CustomTooltip metric={metric} />}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar
            dataKey="value"
            radius={[0, 8, 8, 0]}
            animationDuration={1500}
            animationEasing="ease-out"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === 0 ? 'url(#goldGradient)' : 
                      index === 1 ? 'url(#silverGradient)' :
                      index === 2 ? 'url(#bronzeGradient)' : 
                      'url(#blueGradient)'}
                style={{
                  filter: activeIndex === index ? `drop-shadow(0 0 8px ${getBarColor(index)}60)` : 'none',
                  transition: 'filter 0.3s ease-out'
                }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Bottom Ranking Pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        {chartData.slice(0, 3).map((item, index) => {
          const RankIcon = RANK_CONFIG[index]?.icon || Medal;
          return (
            <motion.div
              key={item.fullName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
            >
              <RankIcon size={14} weight="fill" style={{ color: RANK_CONFIG[index]?.color }} />
              <span className="text-xs text-white/70 truncate max-w-[100px]">{item.name}</span>
              <span className="text-xs font-semibold text-white">{item.percentage.toFixed(0)}%</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
