'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  TrendUp, 
  TrendDown, 
  Warning, 
  CheckCircle,
  ArrowRight,
  Sparkle,
  ChartLineUp,
  Target,
  Confetti
} from '@phosphor-icons/react';

interface Insight {
  type: 'positive' | 'negative' | 'neutral' | 'warning' | 'celebration';
  title: string;
  description: string;
  metric?: string;
  change?: number;
  recommendation?: string;
}

interface DataInsightsProps {
  revenueChange?: number;
  ordersChange?: number;
  customersChange?: number;
  avgOrderValue?: number;
  previousAvgOrderValue?: number;
  topProductName?: string;
  topProductRevenue?: number;
  pendingOrders?: number;
  totalOrders?: number;
}

export default function DataInsights({
  revenueChange = 0,
  ordersChange = 0,
  customersChange = 0,
  avgOrderValue = 0,
  previousAvgOrderValue = 0,
  topProductName = '',
  topProductRevenue = 0,
  pendingOrders = 0,
  totalOrders = 0,
}: DataInsightsProps) {
  // Generate insights based on data
  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];

    // Revenue insight
    if (revenueChange > 20) {
      insights.push({
        type: 'celebration',
        title: 'Outstanding Revenue Growth!',
        description: `Your revenue is up ${revenueChange.toFixed(1)}% compared to the previous period.`,
        metric: 'Revenue',
        change: revenueChange,
        recommendation: 'Keep the momentum going with targeted marketing campaigns.',
      });
    } else if (revenueChange > 0) {
      insights.push({
        type: 'positive',
        title: 'Revenue Growing',
        description: `Revenue increased by ${revenueChange.toFixed(1)}% from the previous period.`,
        metric: 'Revenue',
        change: revenueChange,
        recommendation: 'Consider A/B testing promotions to accelerate growth.',
      });
    } else if (revenueChange < -10) {
      insights.push({
        type: 'warning',
        title: 'Revenue Declining',
        description: `Revenue decreased by ${Math.abs(revenueChange).toFixed(1)}% from the previous period.`,
        metric: 'Revenue',
        change: revenueChange,
        recommendation: 'Review pricing strategy and promotional offers.',
      });
    }

    // Orders insight
    if (ordersChange > 15) {
      insights.push({
        type: 'positive',
        title: 'Order Volume Surge',
        description: `Orders increased by ${ordersChange.toFixed(1)}%. Demand is strong!`,
        metric: 'Orders',
        change: ordersChange,
        recommendation: 'Ensure inventory levels can meet the increased demand.',
      });
    } else if (ordersChange < -15) {
      insights.push({
        type: 'negative',
        title: 'Order Volume Drop',
        description: `Orders decreased by ${Math.abs(ordersChange).toFixed(1)}%.`,
        metric: 'Orders',
        change: ordersChange,
        recommendation: 'Consider running flash sales or limited-time offers.',
      });
    }

    // Customer acquisition insight
    if (customersChange > 25) {
      insights.push({
        type: 'celebration',
        title: 'Customer Acquisition Boom!',
        description: `New customer signups increased by ${customersChange.toFixed(1)}%.`,
        metric: 'Customers',
        change: customersChange,
        recommendation: 'Focus on retention strategies for new customers.',
      });
    } else if (customersChange > 0) {
      insights.push({
        type: 'positive',
        title: 'Growing Customer Base',
        description: `${customersChange.toFixed(1)}% more new customers this period.`,
        metric: 'Customers',
        change: customersChange,
      });
    }

    // Average order value insight
    const aovChange = previousAvgOrderValue > 0 
      ? ((avgOrderValue - previousAvgOrderValue) / previousAvgOrderValue) * 100 
      : 0;
    
    if (aovChange > 10) {
      insights.push({
        type: 'positive',
        title: 'Higher Cart Values',
        description: `Average order value increased by ${aovChange.toFixed(1)}% to $${avgOrderValue.toFixed(2)}.`,
        metric: 'AOV',
        change: aovChange,
        recommendation: 'Your upselling strategies are working well.',
      });
    } else if (aovChange < -10 && previousAvgOrderValue > 0) {
      insights.push({
        type: 'neutral',
        title: 'Lower Cart Values',
        description: `Average order value decreased by ${Math.abs(aovChange).toFixed(1)}%.`,
        metric: 'AOV',
        change: aovChange,
        recommendation: 'Consider bundle deals or free shipping thresholds.',
      });
    }

    // Top product insight
    if (topProductName && topProductRevenue > 0) {
      insights.push({
        type: 'neutral',
        title: 'Top Performer',
        description: `"${topProductName}" is leading with $${topProductRevenue.toLocaleString()} in sales.`,
        metric: 'Product',
        recommendation: 'Feature this product prominently in your marketing.',
      });
    }

    // Pending orders alert
    if (pendingOrders > 0 && totalOrders > 0) {
      const pendingPercentage = (pendingOrders / totalOrders) * 100;
      if (pendingPercentage > 30) {
        insights.push({
          type: 'warning',
          title: 'High Pending Orders',
          description: `${pendingOrders} orders (${pendingPercentage.toFixed(0)}%) are pending processing.`,
          metric: 'Operations',
          recommendation: 'Prioritize order fulfillment to improve customer satisfaction.',
        });
      }
    }

    // If no significant insights, add a neutral one
    if (insights.length === 0) {
      insights.push({
        type: 'neutral',
        title: 'Steady Performance',
        description: 'Your metrics are stable with no significant changes.',
        recommendation: 'Consider testing new strategies to drive growth.',
      });
    }

    return insights.slice(0, 4); // Limit to 4 insights
  };

  const insights = generateInsights();

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'celebration':
        return <Confetti weight="fill" className="w-5 h-5" />;
      case 'positive':
        return <TrendUp weight="bold" className="w-5 h-5" />;
      case 'negative':
        return <TrendDown weight="bold" className="w-5 h-5" />;
      case 'warning':
        return <Warning weight="fill" className="w-5 h-5" />;
      default:
        return <Lightbulb weight="fill" className="w-5 h-5" />;
    }
  };

  const getInsightColors = (type: Insight['type']) => {
    switch (type) {
      case 'celebration':
        return {
          bg: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20',
          border: 'border-amber-500/30',
          icon: 'text-amber-400',
          glow: '0 0 20px rgba(251,191,36,0.3)',
        };
      case 'positive':
        return {
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          icon: 'text-emerald-400',
          glow: '0 0 15px rgba(16,185,129,0.2)',
        };
      case 'negative':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          icon: 'text-red-400',
          glow: '0 0 15px rgba(239,68,68,0.2)',
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          icon: 'text-amber-400',
          glow: '0 0 15px rgba(245,158,11,0.2)',
        };
      default:
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          icon: 'text-blue-400',
          glow: '0 0 15px rgba(59,130,246,0.2)',
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <Sparkle weight="fill" className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">AI Insights</h3>
          <p className="text-sm text-white/50">Smart analysis of your data</p>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {insights.map((insight, index) => {
            const colors = getInsightColors(insight.type);
            return (
              <motion.div
                key={insight.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className={`${colors.bg} ${colors.border} border rounded-xl p-4 group cursor-pointer`}
                style={{ boxShadow: colors.glow }}
                whileHover={{ scale: 1.02, boxShadow: colors.glow.replace('0.2', '0.4').replace('0.3', '0.5') }}
              >
                <div className="flex items-start gap-3">
                  <div className={`${colors.icon} mt-0.5`}>
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">{insight.title}</h4>
                      {insight.change !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          insight.change >= 0 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {insight.change >= 0 ? '+' : ''}{insight.change.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/60 mt-1">{insight.description}</p>
                    {insight.recommendation && (
                      <motion.div 
                        className="flex items-center gap-1 mt-2 text-xs text-white/40 group-hover:text-white/60 transition-colors"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <Target weight="bold" className="w-3 h-3" />
                        <span>{insight.recommendation}</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <motion.div 
        className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <span className="text-xs text-white/30">Based on current filters</span>
        <div className="flex items-center gap-1 text-xs text-purple-400">
          <ChartLineUp weight="bold" className="w-3 h-3" />
          <span>{insights.length} insights generated</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
