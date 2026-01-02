/**
 * Customer Segment Chart Component
 * 
 * Displays customer segment distribution with:
 * - Animated donut chart
 * - Interactive legend
 * - Segment details on hover
 * - Glass morphism dark theme
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Crown, UserPlus, Warning, Clock, UserMinus, IconProps } from '@phosphor-icons/react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  CellProps
} from 'recharts';

// Type for Phosphor icons
type PhosphorIcon = React.ComponentType<IconProps>;

interface SegmentData {
  segment: string;
  count: number;
  color: string;
}

interface CustomerSegmentChartProps {
  data: SegmentData[];
  loading?: boolean;
  height?: number;
}

// Segment configuration with icons and colors
const SEGMENT_CONFIG: Record<string, { 
  icon: PhosphorIcon; 
  color: string; 
  gradient: string;
  description: string;
}> = {
  'VIP': { 
    icon: Crown, 
    color: '#a78bfa', 
    gradient: 'from-purple-500 to-violet-500',
    description: 'High-value customers (>$500 or >5 orders)'
  },
  'Active': { 
    icon: Users, 
    color: '#34d399', 
    gradient: 'from-emerald-500 to-green-500',
    description: 'Ordered in the last 30 days'
  },
  'New': { 
    icon: UserPlus, 
    color: '#60a5fa', 
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Registered in the last 30 days'
  },
  'At-Risk': { 
    icon: Warning, 
    color: '#fbbf24', 
    gradient: 'from-amber-500 to-orange-500',
    description: 'No orders in 30-90 days'
  },
  'Inactive': { 
    icon: UserMinus, 
    color: '#6b7280', 
    gradient: 'from-gray-500 to-slate-500',
    description: 'No orders in 90+ days'
  },
};

// Custom tooltip
interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: SegmentData & { percentage?: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (active && payload && payload.length) {
    const data = payload[0];
    const config = SEGMENT_CONFIG[data.payload?.segment || ''] || SEGMENT_CONFIG['Active'];
    const IconComponent = config.icon;
    const iconColor = data.payload?.color || config.color;
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900/95 backdrop-blur-md px-4 py-3 border border-white/20 rounded-xl shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            <IconComponent size={16} weight="bold" color={iconColor} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{data.payload?.segment}</p>
            <p className="text-xs text-white/60">{data.value} customers</p>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-2 max-w-[200px]">{config.description}</p>
      </motion.div>
    );
  }
  return null;
}

export default function CustomerSegmentChart({
  data,
  loading = false,
  height = 350
}: CustomerSegmentChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Calculate total
  const total = data.reduce((sum, item) => sum + item.count, 0);

  // Add percentage to data
  const chartData = data.map(item => ({
    ...item,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
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
          {[1, 2, 3, 4, 5].map(i => (
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
          <Users size={24} weight="bold" className="text-purple-400" />
        </motion.div>
        <div>
          <h3 className="text-lg font-semibold text-white">Customer Segments</h3>
          <p className="text-sm text-white/40">{total} total customers</p>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={height - 200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={activeIndex !== null ? 85 : 80}
              paddingAngle={3}
              dataKey="count"
              nameKey="segment"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              animationBegin={0}
              animationDuration={1200}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => {
                const cellProps: Partial<CellProps> = {
                  fill: entry.color,
                  stroke: "rgba(0,0,0,0.2)",
                  strokeWidth: 2,
                  style: {
                    filter: activeIndex === index ? `drop-shadow(0 0 8px ${entry.color}60)` : 'none',
                    transition: 'all 0.3s ease-out',
                    cursor: 'pointer'
                  }
                };
                return <Cell key={`cell-${index}`} {...cellProps as CellProps} />;
              })}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label */}
        <AnimatePresence>
          {activeIndex === null ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ top: '-100px' }}
            >
              <span className="text-3xl font-bold text-white">{total}</span>
              <span className="text-xs text-white/50 uppercase tracking-wider">Total</span>
            </motion.div>
          ) : (
            <motion.div 
              key="active"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ top: '-100px' }}
            >
              <span className="text-3xl font-bold text-white">{chartData[activeIndex]?.count}</span>
              <span className="text-sm text-white/60">{chartData[activeIndex]?.segment}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {chartData.map((item, index) => {
          const config = SEGMENT_CONFIG[item.segment] || SEGMENT_CONFIG['Active'];
          const IconComponent = config.icon;
          
          return (
            <motion.div
              key={item.segment}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`group p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all cursor-pointer ${
                activeIndex === index ? 'border-white/30 bg-white/10' : ''
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    <IconComponent size={16} weight="bold" color={item.color} />
                  </div>
                  <span className="text-sm font-medium text-white">{item.segment}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/60">{item.count}</span>
                  <span className="text-sm font-semibold text-white">{item.percentage}%</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
