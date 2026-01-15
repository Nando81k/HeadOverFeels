'use client';

import { useState, useEffect } from 'react';
import { TrendUp, Clock, Users, Target, Lightning, Medal, Calendar, Bag } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

interface DropAnalytics {
  dropId: string;
  dropName: string;
  releaseDate: Date;
  dropEndDate: Date;
  status: 'past' | 'live' | 'upcoming';
  
  // Sales metrics
  totalInventory: number;
  unitsSold: number;
  sellThroughRate: number;
  revenue: number;
  
  // Time metrics
  timeToSellOut: number | null; // minutes
  hoursLive: number;
  
  // Customer metrics
  uniqueCustomers: number;
  waitlistSignups: number;
  waitlistConversionRate: number;
  
  // Performance indicators
  averageOrderValue: number;
  unitsPerOrder: number;
}

interface DropPerformanceAnalyticsProps {
  refreshInterval?: number;
}

export default function DropPerformanceAnalytics({
  refreshInterval = 60000, // 1 minute
}: DropPerformanceAnalyticsProps) {
  const [drops, setDrops] = useState<DropAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('month');

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/admin/analytics/drops?period=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setDrops(
          data.drops.map((drop: DropAnalytics) => ({
            ...drop,
            releaseDate: new Date(drop.releaseDate),
            dropEndDate: new Date(drop.dropEndDate),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching drop analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const formatTimeToSellOut = (minutes: number | null) => {
    if (minutes === null) return 'Still available';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 90) return 'text-emerald-400';
    if (rate >= 70) return 'text-blue-400';
    if (rate >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getPerformanceBg = (rate: number) => {
    if (rate >= 90) return 'bg-emerald-500/10 border border-emerald-500/20';
    if (rate >= 70) return 'bg-blue-500/10 border border-blue-500/20';
    if (rate >= 50) return 'bg-amber-500/10 border border-amber-500/20';
    return 'bg-red-500/10 border border-red-500/20';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full inline-flex items-center gap-1.5"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />LIVE</span>;
      case 'past':
        return <span className="px-3 py-1 bg-neutral-700 text-neutral-400 text-xs font-semibold rounded-full">Ended</span>;
      case 'upcoming':
        return <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full">Upcoming</span>;
      default:
        return null;
    }
  };

  const getOverallMetrics = () => {
    if (drops.length === 0) return null;

    const totalRevenue = drops.reduce((sum, d) => sum + d.revenue, 0);
    const avgSellThrough = drops.reduce((sum, d) => sum + d.sellThroughRate, 0) / drops.length;
    const avgWaitlistConversion = drops.reduce((sum, d) => sum + d.waitlistConversionRate, 0) / drops.length;
    const soldOutDrops = drops.filter(d => d.sellThroughRate >= 100).length;

    return {
      totalRevenue,
      avgSellThrough,
      avgWaitlistConversion,
      soldOutDrops,
    };
  };

  const overallMetrics = getOverallMetrics();

  if (loading) {
    return (
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-800 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-neutral-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-neutral-800 bg-gradient-to-r from-purple-950/50 to-fuchsia-950/30">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl shadow-lg shadow-purple-500/20">
              <Lightning size={22} weight="bold" className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Drop Performance</h3>
              <p className="text-sm text-neutral-400">Limited edition analytics & metrics</p>
            </div>
          </div>
        </div>

        {/* Overall Metrics */}
        {overallMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-neutral-900/80 backdrop-blur rounded-xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2 uppercase tracking-wider">
                <TrendUp size={14} weight="bold" />
                <span>Total Revenue</span>
              </div>
              <div className="text-2xl font-black text-white">
                ${overallMetrics.totalRevenue.toLocaleString()}
              </div>
            </div>
            <div className="bg-neutral-900/80 backdrop-blur rounded-xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2 uppercase tracking-wider">
                <Target size={14} weight="bold" />
                <span>Avg Sell-Through</span>
              </div>
              <div className="text-2xl font-black text-blue-400">
                {overallMetrics.avgSellThrough.toFixed(1)}%
              </div>
            </div>
            <div className="bg-neutral-900/80 backdrop-blur rounded-xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2 uppercase tracking-wider">
                <Medal size={14} weight="bold" />
                <span>Sold Out</span>
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {overallMetrics.soldOutDrops}<span className="text-neutral-500 font-normal">/{drops.length}</span>
              </div>
            </div>
            <div className="bg-neutral-900/80 backdrop-blur rounded-xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2 uppercase tracking-wider">
                <Users size={14} weight="bold" />
                <span>Waitlist Conv.</span>
              </div>
              <div className="text-2xl font-black text-purple-400">
                {overallMetrics.avgWaitlistConversion.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Period Filter */}
      <div className="flex gap-2 px-6 py-4 border-b border-neutral-800 bg-neutral-950/50">
        {[
          { value: 'week', label: 'Last 7 Days' },
          { value: 'month', label: 'Last 30 Days' },
          { value: 'all', label: 'All Time' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedPeriod(value as typeof selectedPeriod)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              selectedPeriod === value
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            <Calendar size={16} weight="bold" />
            {label}
          </button>
        ))}
      </div>

      {/* Drops List */}
      <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
        {drops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <div className="p-4 bg-neutral-800 rounded-full mb-4">
              <Bag size={48} weight="bold" className="text-neutral-600" />
            </div>
            <p className="text-lg font-semibold text-neutral-300">No drops in this period</p>
            <p className="text-sm text-neutral-500 mt-1">Create your first limited edition drop!</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {drops.map((drop, index) => (
              <motion.div
                key={drop.dropId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-5 hover:border-purple-500/50 hover:bg-neutral-800 transition-all"
              >
                {/* Drop Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h4 className="font-bold text-white text-lg">{drop.dropName}</h4>
                      {getStatusBadge(drop.status)}
                    </div>
                    <p className="text-sm text-neutral-500">
                      {drop.releaseDate.toLocaleDateString()} – {drop.dropEndDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-black text-white">
                      ${drop.revenue.toLocaleString()}
                    </div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wider">Revenue</div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {/* Sell-Through Rate */}
                  <div className={`rounded-xl p-3 ${getPerformanceBg(drop.sellThroughRate)}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className={`w-4 h-4 ${getPerformanceColor(drop.sellThroughRate)}`} />
                      <span className="text-xs text-neutral-400">Sell-Through</span>
                    </div>
                    <div className={`text-xl font-bold ${getPerformanceColor(drop.sellThroughRate)}`}>
                      {drop.sellThroughRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-neutral-500">
                      {drop.unitsSold}/{drop.totalInventory} units
                    </div>
                  </div>

                  {/* Time to Sell Out */}
                  <div className="bg-neutral-700/30 border border-neutral-700 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock size={16} weight="bold" className="text-neutral-400" />
                      <span className="text-xs text-neutral-400">Sell Out Time</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {formatTimeToSellOut(drop.timeToSellOut)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {drop.hoursLive.toFixed(1)}h live
                    </div>
                  </div>

                  {/* Waitlist Conversion */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users size={16} weight="bold" className="text-blue-400" />
                      <span className="text-xs text-neutral-400">Waitlist Conv.</span>
                    </div>
                    <div className="text-xl font-bold text-blue-400">
                      {drop.waitlistConversionRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-neutral-500">
                      {drop.waitlistSignups} signups
                    </div>
                  </div>

                  {/* Customer Metrics */}
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bag size={16} weight="bold" className="text-purple-400" />
                      <span className="text-xs text-neutral-400">Customers</span>
                    </div>
                    <div className="text-xl font-bold text-purple-400">
                      {drop.uniqueCustomers}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {drop.unitsPerOrder.toFixed(1)} per order
                    </div>
                  </div>
                </div>

                {/* Performance Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-400">Sales Progress</span>
                    <span className={`font-bold ${getPerformanceColor(drop.sellThroughRate)}`}>
                      {drop.sellThroughRate >= 100 ? 'SOLD OUT 🔥' : `${drop.sellThroughRate.toFixed(1)}% sold`}
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, drop.sellThroughRate)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`h-full ${
                        drop.sellThroughRate >= 90
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : drop.sellThroughRate >= 70
                          ? 'bg-gradient-to-r from-blue-500 to-blue-400'
                          : drop.sellThroughRate >= 50
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-gradient-to-r from-red-500 to-red-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Additional Insights */}
                <div className="mt-4 pt-4 border-t border-neutral-700 flex items-center justify-between text-xs">
                  <div className="text-neutral-500">
                    Avg Order Value: <span className="font-bold text-white">${drop.averageOrderValue.toFixed(2)}</span>
                  </div>
                  <div className="text-neutral-500">
                    Units/Order: <span className="font-bold text-white">{drop.unitsPerOrder.toFixed(1)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Tips */}
      {drops.length > 0 && (
        <div className="px-6 py-5 bg-gradient-to-r from-purple-950/50 to-fuchsia-950/30 border-t border-neutral-800">
          <div className="text-center">
            <p className="text-sm font-medium text-neutral-300">
              💡 Best performing drops sell out in under 24 hours with 80%+ waitlist conversion
            </p>
            <p className="text-xs text-neutral-500 mt-1.5">
              Use these insights to optimize future drop timing, pricing, and inventory levels
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
