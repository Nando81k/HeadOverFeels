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
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-blue-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBg = (rate: number) => {
    if (rate >= 90) return 'bg-green-100';
    if (rate >= 70) return 'bg-blue-100';
    if (rate >= 50) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">🔴 LIVE</span>;
      case 'past':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">Ended</span>;
      case 'upcoming':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Upcoming</span>;
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-linear-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Lightning size={20} weight="bold" className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Drop Performance</h3>
              <p className="text-sm text-gray-500">Limited edition analytics</p>
            </div>
          </div>
        </div>

        {/* Overall Metrics */}
        {overallMetrics && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <TrendUp size={16} weight="bold" />
                <span>Total Revenue</span>
              </div>
              <div className="text-xl font-bold text-gray-900">
                ${overallMetrics.totalRevenue.toFixed(0)}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Target size={16} weight="bold" />
                <span>Avg Sell-Through</span>
              </div>
              <div className="text-xl font-bold text-blue-600">
                {overallMetrics.avgSellThrough.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Medal size={16} weight="bold" />
                <span>Sold Out</span>
              </div>
              <div className="text-xl font-bold text-green-600">
                {overallMetrics.soldOutDrops}/{drops.length}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Users size={16} weight="bold" />
                <span>Waitlist Conv.</span>
              </div>
              <div className="text-xl font-bold text-purple-600">
                {overallMetrics.avgWaitlistConversion.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Period Filter */}
      <div className="flex gap-2 px-6 py-3 border-b border-gray-200 bg-gray-50">
        {[
          { value: 'week', label: 'Last 7 Days' },
          { value: 'month', label: 'Last 30 Days' },
          { value: 'all', label: 'All Time' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedPeriod(value as typeof selectedPeriod)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedPeriod === value
                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Calendar size={16} weight="bold" />
            {label}
          </button>
        ))}
      </div>

      {/* Drops List */}
      <div className="max-h-[600px] overflow-y-auto">
        {drops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Bag size={64} weight="bold" className="mb-4 opacity-30" />
            <p className="text-lg font-medium">No drops in this period</p>
            <p className="text-sm">Create your first limited edition drop!</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {drops.map((drop, index) => (
              <motion.div
                key={drop.dropId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all"
              >
                {/* Drop Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 text-lg">{drop.dropName}</h4>
                      {getStatusBadge(drop.status)}
                    </div>
                    <p className="text-sm text-gray-500">
                      {drop.releaseDate.toLocaleDateString()} - {drop.dropEndDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      ${drop.revenue.toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-500">Revenue</div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {/* Sell-Through Rate */}
                  <div className={`rounded-lg p-3 ${getPerformanceBg(drop.sellThroughRate)}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <Target className={`w-4 h-4 ${getPerformanceColor(drop.sellThroughRate)}`} />
                      <span className="text-xs text-gray-600">Sell-Through</span>
                    </div>
                    <div className={`text-xl font-bold ${getPerformanceColor(drop.sellThroughRate)}`}>
                      {drop.sellThroughRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">
                      {drop.unitsSold}/{drop.totalInventory} units
                    </div>
                  </div>

                  {/* Time to Sell Out */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock size={16} weight="bold" className="text-gray-600" />
                      <span className="text-xs text-gray-600">Sell Out Time</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatTimeToSellOut(drop.timeToSellOut)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {drop.hoursLive.toFixed(1)}h live
                    </div>
                  </div>

                  {/* Waitlist Conversion */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Users size={16} weight="bold" className="text-blue-600" />
                      <span className="text-xs text-gray-600">Waitlist Conv.</span>
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      {drop.waitlistConversionRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">
                      {drop.waitlistSignups} signups
                    </div>
                  </div>

                  {/* Customer Metrics */}
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Bag size={16} weight="bold" className="text-purple-600" />
                      <span className="text-xs text-gray-600">Customers</span>
                    </div>
                    <div className="text-xl font-bold text-purple-600">
                      {drop.uniqueCustomers}
                    </div>
                    <div className="text-xs text-gray-600">
                      {drop.unitsPerOrder.toFixed(1)} per order
                    </div>
                  </div>
                </div>

                {/* Performance Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-600">Sales Progress</span>
                    <span className={`font-bold ${getPerformanceColor(drop.sellThroughRate)}`}>
                      {drop.sellThroughRate >= 100 ? 'SOLD OUT 🔥' : `${drop.sellThroughRate.toFixed(1)}% sold`}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, drop.sellThroughRate)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`h-full ${
                        drop.sellThroughRate >= 90
                          ? 'bg-green-500'
                          : drop.sellThroughRate >= 70
                          ? 'bg-blue-500'
                          : drop.sellThroughRate >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Additional Insights */}
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
                  <div className="text-gray-600">
                    Avg Order Value: <span className="font-bold text-gray-900">${drop.averageOrderValue.toFixed(2)}</span>
                  </div>
                  <div className="text-gray-600">
                    Units/Order: <span className="font-bold text-gray-900">{drop.unitsPerOrder.toFixed(1)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Tips */}
      {drops.length > 0 && (
        <div className="px-6 py-4 bg-linear-to-r from-purple-50 to-blue-50 border-t border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              💡 Best performing drops sell out in under 24 hours with 80%+ waitlist conversion
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Use these insights to optimize future drop timing, pricing, and inventory levels
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
