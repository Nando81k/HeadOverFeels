/**
 * Customer Metric Cards Component
 * 
 * Displays key customer metrics with:
 * - Animated stat cards
 * - Growth/change indicators
 * - Glass morphism dark theme
 * - Stagger animations on load
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Crown, 
  Warning, 
  Lightning,
  TrendUp,
  TrendDown,
  UserMinus
} from '@phosphor-icons/react';

interface MetricData {
  total: number;
  totalChange: number;
  newCustomers: number;
  newCustomersChange: number;
  vip: number;
  vipChange: number;
  active: number;
  activeChange: number;
  atRisk: number;
  atRiskChange: number;
  inactive: number;
  inactiveChange: number;
  avgOrderValue: number;
  avgOrderValueChange: number;
  retentionRate: number;
  retentionRateChange: number;
}

interface CustomerMetricCardsProps {
  data: MetricData;
  loading?: boolean;
}

// Metric card configuration
const METRICS = [
  {
    key: 'total',
    label: 'Total Customers',
    icon: Users,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400'
  },
  {
    key: 'newCustomers',
    label: 'New Customers',
    sublabel: 'Last 30 days',
    icon: UserPlus,
    color: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400'
  },
  {
    key: 'vip',
    label: 'VIP Customers',
    sublabel: '>$500 or >5 orders',
    icon: Crown,
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400'
  },
  {
    key: 'active',
    label: 'Active Customers',
    sublabel: 'Ordered recently',
    icon: Lightning,
    color: 'from-teal-500 to-cyan-500',
    bgColor: 'bg-teal-500/20',
    textColor: 'text-teal-400'
  },
  {
    key: 'atRisk',
    label: 'At-Risk',
    sublabel: '30-90 days inactive',
    icon: Warning,
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400'
  },
  {
    key: 'inactive',
    label: 'Inactive',
    sublabel: '90+ days inactive',
    icon: UserMinus,
    color: 'from-gray-500 to-slate-500',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400'
  }
];

// Secondary metrics
const SECONDARY_METRICS = [
  {
    key: 'avgOrderValue',
    label: 'Avg Order Value',
    format: 'currency'
  },
  {
    key: 'retentionRate',
    label: 'Retention Rate',
    format: 'percentage'
  }
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }
  }
};

// Format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Format currency
function formatCurrency(num: number): string {
  return `$${num.toFixed(2)}`;
}

export default function CustomerMetricCards({
  data,
  loading = false
}: CustomerMetricCardsProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div 
            key={i}
            className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl animate-pulse" />
              <div className="w-12 h-5 bg-white/10 rounded-full animate-pulse" />
            </div>
            <div className="h-8 bg-white/10 rounded w-16 animate-pulse mb-2" />
            <div className="h-4 bg-white/5 rounded w-24 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {METRICS.map((metric) => {
          const value = data[metric.key as keyof MetricData] as number;
          const change = data[`${metric.key}Change` as keyof MetricData] as number || 0;
          const Icon = metric.icon;
          const isPositive = change >= 0;
          // For at-risk and inactive, positive growth is actually bad
          const isGood = (metric.key === 'atRisk' || metric.key === 'inactive') 
            ? !isPositive 
            : isPositive;

          return (
            <motion.div
              key={metric.key}
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              className="group bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <motion.div 
                  className={`p-2.5 rounded-xl ${metric.bgColor}`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <Icon size={20} weight="bold" className={metric.textColor} />
                </motion.div>
                
                {/* Change Indicator */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  isGood 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {isPositive ? (
                    <TrendUp size={12} weight="bold" />
                  ) : (
                    <TrendDown size={12} weight="bold" />
                  )}
                  {Math.abs(change)}%
                </div>
              </div>

              <div className="space-y-1">
                <motion.h3 
                  className="text-2xl font-bold text-white"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {formatNumber(value)}
                </motion.h3>
                <p className="text-sm text-white/60">{metric.label}</p>
                {metric.sublabel && (
                  <p className="text-xs text-white/40">{metric.sublabel}</p>
                )}
              </div>

              {/* Hover gradient effect */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${metric.color} opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none`} />
            </motion.div>
          );
        })}
      </div>

      {/* Secondary Metrics */}
      <motion.div 
        variants={cardVariants}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {SECONDARY_METRICS.map((metric) => {
          const value = data[metric.key as keyof MetricData] as number;
          const change = data[`${metric.key}Change` as keyof MetricData] as number || 0;
          const isPositive = change >= 0;
          const formattedValue = metric.format === 'currency' 
            ? formatCurrency(value) 
            : `${value}%`;

          return (
            <motion.div
              key={metric.key}
              whileHover={{ scale: 1.01 }}
              className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-5 flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-white/60 mb-1">{metric.label}</p>
                <p className="text-3xl font-bold text-white">{formattedValue}</p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                isPositive 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-red-500/10 text-red-400'
              }`}>
                {isPositive ? (
                  <TrendUp size={16} weight="bold" />
                ) : (
                  <TrendDown size={16} weight="bold" />
                )}
                {Math.abs(change)}% vs last period
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
