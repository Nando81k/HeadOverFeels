/**
 * MetricCard Component - Modernized
 * 
 * Displays a single metric with:
 * - Animated counter on value
 * - Framer Motion entrance animations
 * - Interactive hover states
 * - Mini sparkline with gradient
 * - Trend indicators with context
 * - Glass morphism dark theme
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { TrendUp, TrendDown, Minus, Info } from '@phosphor-icons/react';
import { ResponsiveContainer, Area, AreaChart } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  sparklineData?: number[];
  loading?: boolean;
  format?: 'currency' | 'number' | 'percentage';
  subtitle?: string;
  tooltip?: string;
  accentColor?: 'purple' | 'emerald' | 'blue' | 'amber';
  delay?: number;
}

// Animated counter component
function AnimatedCounter({ 
  value, 
  format = 'number',
  duration = 1.5
}: { 
  value: number; 
  format?: 'currency' | 'number' | 'percentage';
  duration?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (current) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(Math.round(current));
      case 'percentage':
        return `${current.toFixed(1)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('en-US').format(Math.round(current));
    }
  });

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return (
    <motion.span ref={ref}>
      {display}
    </motion.span>
  );
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
  subtitle,
  tooltip,
  accentColor = 'purple',
  delay = 0
}: MetricCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine trend if not explicitly provided
  const determinedTrend = trend || (change !== undefined 
    ? change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    : 'neutral'
  );

  // Accent color mappings
  const accentColors = {
    purple: {
      gradient: 'from-purple-500/20 to-transparent',
      border: 'group-hover:border-purple-500/30',
      icon: 'text-purple-400',
      sparkline: '#a855f7',
      sparklineGradient: ['rgba(168,85,247,0.3)', 'rgba(168,85,247,0)']
    },
    emerald: {
      gradient: 'from-emerald-500/20 to-transparent',
      border: 'group-hover:border-emerald-500/30',
      icon: 'text-emerald-400',
      sparkline: '#34d399',
      sparklineGradient: ['rgba(52,211,153,0.3)', 'rgba(52,211,153,0)']
    },
    blue: {
      gradient: 'from-blue-500/20 to-transparent',
      border: 'group-hover:border-blue-500/30',
      icon: 'text-blue-400',
      sparkline: '#60a5fa',
      sparklineGradient: ['rgba(96,165,250,0.3)', 'rgba(96,165,250,0)']
    },
    amber: {
      gradient: 'from-amber-500/20 to-transparent',
      border: 'group-hover:border-amber-500/30',
      icon: 'text-amber-400',
      sparkline: '#fbbf24',
      sparklineGradient: ['rgba(251,191,36,0.3)', 'rgba(251,191,36,0)']
    }
  };

  const colors = accentColors[accentColor];

  // Trend colors
  const trendColors = {
    up: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      icon: TrendUp
    },
    down: {
      text: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      icon: TrendDown
    },
    neutral: {
      text: 'text-white/50',
      bg: 'bg-white/5 border-white/10',
      icon: Minus
    }
  };

  const trendStyle = trendColors[determinedTrend];
  const TrendIcon = trendStyle.icon;

  // Format sparkline data
  const chartData = sparklineData?.map((val, index) => ({
    index,
    value: val
  })) || [];

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="relative bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6 overflow-hidden"
      >
        <div className="animate-pulse space-y-4">
          <div className="flex justify-between">
            <div className="h-3 bg-white/10 rounded w-24"></div>
            <div className="h-8 w-8 bg-white/10 rounded-lg"></div>
          </div>
          <div className="h-10 bg-white/10 rounded w-32"></div>
          <div className="flex justify-between items-end">
            <div className="h-6 bg-white/10 rounded-full w-20"></div>
            <div className="h-8 bg-white/10 rounded w-24"></div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`group relative bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6 overflow-hidden transition-colors duration-300 ${colors.border}`}
    >
      {/* Gradient accent on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-medium">
                {title}
              </p>
              {tooltip && (
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="text-white/30 hover:text-white/50 transition-colors"
                  >
                    <Info size={14} />
                  </button>
                  {showTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-0 top-6 z-50 w-48 p-2 bg-neutral-800 border border-white/20 rounded-lg shadow-xl text-xs text-white/70"
                    >
                      {tooltip}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-white/30 mt-1">{subtitle}</p>
            )}
          </div>
          {icon && (
            <motion.div 
              className={`p-2 rounded-xl bg-white/5 ${colors.icon}`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {icon}
            </motion.div>
          )}
        </div>

        {/* Value */}
        <div className="mb-4">
          <p className="text-4xl font-bold text-white tracking-tight">
            {typeof value === 'number' ? (
              <AnimatedCounter value={value} format={format} />
            ) : (
              value
            )}
          </p>
        </div>

        {/* Footer: Change indicator and Sparkline */}
        <div className="flex items-end justify-between gap-4">
          {/* Change Badge */}
          {change !== undefined && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: delay + 0.3, duration: 0.3 }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${trendStyle.bg} ${trendStyle.text}`}
            >
              <TrendIcon size={16} weight="bold" />
              <span>{Math.abs(change).toFixed(1)}%</span>
            </motion.div>
          )}

          {/* Sparkline with gradient fill */}
          {sparklineData && sparklineData.length > 1 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.4, duration: 0.5 }}
              className="flex-1 max-w-[120px]" 
              style={{ height: '40px' }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.sparklineGradient[0]} />
                      <stop offset="100%" stopColor={colors.sparklineGradient[1]} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors.sparkline}
                    strokeWidth={2}
                    fill={`url(#gradient-${title.replace(/\s/g, '')})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
