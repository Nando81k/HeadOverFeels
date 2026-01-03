/**
 * Customer Activity Chart Component
 * 
 * Displays customer activity distribution over time with:
 * - Stacked bar chart showing active/at-risk/inactive
 * - Monthly breakdown
 * - Animated transitions
 * - Glass morphism dark theme
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightning, TrendUp, TrendDown } from '@phosphor-icons/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ActivityData {
  month: string;
  active: number;
  atRisk: number;
  inactive: number;
}

interface CustomerActivityChartProps {
  data: ActivityData[];
  loading?: boolean;
  height?: number;
}

// Activity colors
const ACTIVITY_COLORS = {
  active: '#34d399',
  atRisk: '#fbbf24',
  inactive: '#6b7280'
};

// Custom tooltip
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ 
  active, 
  payload, 
  label 
}: { 
  active?: boolean; 
  payload?: TooltipPayload[]; 
  label?: string;
}) {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, item) => sum + item.value, 0);
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-4 py-3 border border-white/20 rounded-xl shadow-2xl"
      >
        <p className="text-sm font-semibold text-white mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((item: TooltipPayload) => (
            <div key={item.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-white/60 capitalize">{item.name}</span>
              </div>
              <span className="text-sm font-medium text-white">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Total</span>
            <span className="text-sm font-bold text-white">{total}</span>
          </div>
        </div>
      </motion.div>
    );
  }
  return null;
}

// Custom legend
function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  const labels: Record<string, string> = {
    active: 'Active Customers',
    atRisk: 'At-Risk Customers',
    inactive: 'Inactive Customers'
  };

  return (
    <div className="flex items-center justify-center gap-6 mt-4">
      {payload?.map((entry: { value: string; color: string }) => (
        <motion.div 
          key={entry.value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <div 
            className="w-3 h-3 rounded"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-white/60">{labels[entry.value] || entry.value}</span>
        </motion.div>
      ))}
    </div>
  );
}

export default function CustomerActivityChart({
  data,
  loading = false,
  height = 350
}: CustomerActivityChartProps) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // Calculate activity change
  const calculateChange = () => {
    if (data.length < 2) return { change: 0, trend: 'neutral' };
    
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    const currentActive = current.active;
    const previousActive = previous.active;
    
    if (previousActive === 0) return { change: 0, trend: 'neutral' };
    
    const change = ((currentActive - previousActive) / previousActive) * 100;
    return { 
      change: Math.abs(Math.round(change)), 
      trend: change >= 0 ? 'up' : 'down' 
    };
  };

  const activityChange = calculateChange();

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
      >
        <div className="h-6 bg-white/10 rounded w-1/3 animate-pulse mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-end gap-2" style={{ height: `${Math.random() * 100 + 50}px` }}>
              <div className="w-full bg-white/5 rounded-t animate-pulse" style={{ height: '100%' }} />
            </div>
          ))}
        </div>
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
            className="p-2 rounded-xl bg-emerald-500/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Lightning size={24} weight="bold" className="text-emerald-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-white">Activity Trends</h3>
            <p className="text-sm text-white/40">Monthly activity breakdown</p>
          </div>
        </div>

        {/* Activity Change Indicator */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            activityChange.trend === 'up' 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : activityChange.trend === 'down'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-white/10 text-white/60'
          }`}
        >
          {activityChange.trend === 'up' ? (
            <TrendUp size={16} weight="bold" />
          ) : activityChange.trend === 'down' ? (
            <TrendDown size={16} weight="bold" />
          ) : null}
          <span className="text-sm font-medium">
            {activityChange.change}% {activityChange.trend === 'up' ? 'more' : activityChange.trend === 'down' ? 'less' : ''} active
          </span>
        </motion.div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - 100}>
        <BarChart 
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          onMouseMove={(state) => {
            if (state.activeLabel) {
              setHoveredBar(String(state.activeLabel));
            }
          }}
          onMouseLeave={() => setHoveredBar(null)}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="rgba(255,255,255,0.05)" 
            vertical={false}
          />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Legend content={<CustomLegend />} />
          <Bar 
            dataKey="active" 
            stackId="a" 
            fill={ACTIVITY_COLORS.active}
            radius={[0, 0, 0, 0]}
            animationBegin={0}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <Bar 
            dataKey="atRisk" 
            stackId="a" 
            fill={ACTIVITY_COLORS.atRisk}
            radius={[0, 0, 0, 0]}
            animationBegin={200}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <Bar 
            dataKey="inactive" 
            stackId="a" 
            fill={ACTIVITY_COLORS.inactive}
            radius={[4, 4, 0, 0]}
            animationBegin={400}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
