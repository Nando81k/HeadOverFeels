/**
 * OrderStatusChart Component - Modernized
 * 
 * Displays order status distribution with:
 * - Animated pie/donut chart with entrance effects
 * - Interactive segments with hover states
 * - Status legends with percentage bars
 * - Glass morphism dark theme
 * - Smooth transitions and micro-interactions
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, CheckCircle, Truck, Clock, XCircle, ArrowCounterClockwise, IconProps } from '@phosphor-icons/react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
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

type PhosphorIcon = React.ComponentType<IconProps>;

// Status color mapping with gradients
const STATUS_COLORS: Record<string, { color: string; gradient: string; icon: PhosphorIcon }> = {
  pending: { color: '#fbbf24', gradient: 'from-amber-500 to-orange-500', icon: Clock },
  processing: { color: '#60a5fa', gradient: 'from-blue-500 to-cyan-500', icon: Package },
  shipped: { color: '#a78bfa', gradient: 'from-purple-500 to-pink-500', icon: Truck },
  delivered: { color: '#34d399', gradient: 'from-emerald-500 to-green-500', icon: CheckCircle },
  cancelled: { color: '#f87171', gradient: 'from-red-500 to-rose-500', icon: XCircle },
  refunded: { color: '#9ca3af', gradient: 'from-gray-500 to-slate-500', icon: ArrowCounterClockwise },
};

// Custom tooltip
interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: {
    status: string;
    percentage: number;
    color: string;
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (active && payload && payload.length) {
    const data = payload[0];
    const statusConfig = STATUS_COLORS[data.payload?.status.toLowerCase() || ''] || STATUS_COLORS.pending;
    const Icon = statusConfig.icon;
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-4 py-3 border border-white/20 rounded-xl shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${data.payload?.color}20` }}
          >
            <Icon size={16} weight="bold" style={{ color: data.payload?.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white capitalize">{data.payload?.status}</p>
            <p className="text-xs text-white/60">{data.value} orders ({data.payload?.percentage}%)</p>
          </div>
        </div>
      </motion.div>
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Calculate total
  const total = data.reduce((sum, item) => sum + item.count, 0);

  // Prepare chart data with colors
  const chartData = data.map(item => ({
    ...item,
    color: STATUS_COLORS[item.status.toLowerCase()]?.color || '#9ca3af'
  }));

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
      >
        <div className="h-6 bg-white/10 rounded w-1/3 animate-pulse mb-6"></div>
        <div className="flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-white/5 animate-pulse flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-neutral-800" />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
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
      <div className="flex items-center gap-3 mb-6">
        <motion.div 
          className="p-2 rounded-xl bg-purple-500/20"
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <Package size={24} weight="bold" className="text-purple-400" />
        </motion.div>
        <div>
          <h3 className="text-lg font-semibold text-white">Order Status Distribution</h3>
          <p className="text-sm text-white/40">{total} total orders</p>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={height - 140}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={type === 'donut' ? 60 : 0}
              outerRadius={activeIndex !== null ? 105 : 100}
              paddingAngle={3}
              dataKey="count"
              nameKey="status"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              animationBegin={0}
              animationDuration={1200}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth={2}
                  style={{
                    filter: activeIndex === index ? `drop-shadow(0 0 8px ${entry.color}60)` : 'none',
                    transition: 'all 0.3s ease-out',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label (only for donut) */}
        {type === 'donut' && (
          <AnimatePresence>
            {activeIndex === null ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ top: '-70px' }}
              >
                <span className="text-3xl font-bold text-white">{total}</span>
                <span className="text-xs text-white/50 uppercase tracking-wider">Total Orders</span>
              </motion.div>
            ) : (
              <motion.div 
                key="active"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ top: '-70px' }}
              >
                <span className="text-3xl font-bold text-white capitalize">{chartData[activeIndex]?.status}</span>
                <span className="text-sm text-white/60">{chartData[activeIndex]?.count} orders ({chartData[activeIndex]?.percentage}%)</span>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Legend with Progress Bars */}
      <div className="mt-4 space-y-2">
        {chartData.map((item, index) => {
          const statusConfig = STATUS_COLORS[item.status.toLowerCase()] || STATUS_COLORS.pending;
          const Icon = statusConfig.icon;
          
          return (
            <motion.div
              key={item.status}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`group p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all cursor-pointer ${
                activeIndex === index ? 'border-white/30 bg-white/10' : ''
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    <Icon size={16} weight="bold" style={{ color: item.color }} />
                  </div>
                  <span className="text-sm font-medium text-white capitalize">{item.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/60">{item.count}</span>
                  <span className="text-sm font-semibold text-white">{item.percentage}%</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 1, delay: 0.3 + index * 0.1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ 
                    backgroundColor: item.color,
                    boxShadow: `0 0 8px ${item.color}60`
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
