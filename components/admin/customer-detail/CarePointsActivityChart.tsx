/**
 * Care Points Activity Chart Component
 * 
 * Displays customer's care points activity with:
 * - Bar chart showing earned vs redeemed points
 * - Monthly breakdown
 * - Transaction type distribution
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, TrendUp, TrendDown, Plus, Minus, IconProps } from '@phosphor-icons/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';

type PhosphorIcon = React.ComponentType<IconProps>;

interface PointsActivityData {
  month: string;
  earned: number;
  redeemed: number;
}

interface CarePointsActivityChartProps {
  data: PointsActivityData[];
  currentBalance: number;
  lifetimePoints: number;
  loading?: boolean;
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: { 
  active?: boolean; 
  payload?: Array<{ value: number; dataKey: string; fill: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    const earned = payload.find(p => p.dataKey === 'earned')?.value || 0;
    const redeemed = Math.abs(payload.find(p => p.dataKey === 'redeemed')?.value || 0);
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-4 py-3 border border-white/20 rounded-xl shadow-2xl"
      >
        <p className="text-sm font-semibold text-white mb-2">{label}</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-xs text-white/60">Earned</span>
            <span className="text-sm font-semibold text-amber-400">+{earned}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-purple-400" />
            <span className="text-xs text-white/60">Redeemed</span>
            <span className="text-sm font-semibold text-purple-400">-{redeemed}</span>
          </div>
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Net Change</span>
              <span className={`text-sm font-bold ${earned - redeemed >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {earned - redeemed >= 0 ? '+' : ''}{earned - redeemed}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
  return null;
}

export default function CarePointsActivityChart({
  data,
  currentBalance,
  lifetimePoints,
  loading = false
}: CarePointsActivityChartProps) {
  // Calculate totals
  const totalEarned = data.reduce((sum, item) => sum + item.earned, 0);
  const totalRedeemed = data.reduce((sum, item) => sum + Math.abs(item.redeemed), 0);
  const redemptionRate = totalEarned > 0 ? (totalRedeemed / totalEarned) * 100 : 0;

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
      >
        <div className="h-6 bg-white/10 rounded w-1/3 animate-pulse mb-6"></div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="h-16 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-16 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="h-[200px] bg-white/5 rounded-lg animate-pulse" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div 
            className="p-2 rounded-xl bg-amber-500/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Star size={24} weight="fill" className="text-amber-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-white">Care Points Activity</h3>
            <p className="text-sm text-white/40">Last {data.length} months</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
          <p className="text-xs text-amber-400/60 mb-1">Current Balance</p>
          <p className="text-lg font-bold text-amber-400">{currentBalance.toLocaleString()}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-white/40 mb-1">Lifetime Earned</p>
          <p className="text-lg font-bold text-white">{lifetimePoints.toLocaleString()}</p>
        </div>
        <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
          <div className="flex items-center gap-1 text-emerald-400 mb-1">
            <Plus size={12} weight="bold" />
            <span className="text-xs">Earned (Period)</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">+{totalEarned.toLocaleString()}</p>
        </div>
        <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
          <div className="flex items-center gap-1 text-purple-400 mb-1">
            <Minus size={12} weight="bold" />
            <span className="text-xs">Redeemed (Period)</span>
          </div>
          <p className="text-lg font-bold text-purple-400">-{totalRedeemed.toLocaleString()}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="earned" 
              fill="#fbbf24" 
              radius={[4, 4, 0, 0]}
              animationBegin={0}
              animationDuration={1200}
            />
            <Bar 
              dataKey="redeemed" 
              fill="#a78bfa" 
              radius={[4, 4, 0, 0]}
              animationBegin={200}
              animationDuration={1200}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-xs text-white/60">Points Earned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-400" />
          <span className="text-xs text-white/60">Points Redeemed</span>
        </div>
      </div>

      {/* Redemption rate */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/40">Redemption Rate</span>
          <span className="text-white font-medium">{redemptionRate.toFixed(1)}%</span>
        </div>
        <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(redemptionRate, 100)}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            className="h-full bg-gradient-to-r from-purple-500 to-amber-500 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
}
