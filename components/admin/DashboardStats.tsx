'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import DateRangePicker from './DateRangePicker';

type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

interface StatsData {
  currentOrders: number;
  currentRevenue: number;
  previousRevenue: number;
  activeProducts: number;
  totalCustomers: number;
}

interface CustomRangeStats extends StatsData {
  startDate?: Date;
  endDate?: Date;
}

interface DashboardStatsProps {
  todayStats: StatsData;
  weekStats: StatsData;
  monthStats: StatsData;
  yearStats: StatsData;
  onCustomRangeSelect?: (startDate: Date, endDate: Date) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function calculateTrend(current: number, previous: number): { percentage: number; isPositive: boolean } {
  if (previous === 0) {
    return { percentage: current > 0 ? 100 : 0, isPositive: current > 0 };
  }
  const percentage = ((current - previous) / previous) * 100;
  return { percentage: Math.abs(percentage), isPositive: percentage >= 0 };
}

export default function DashboardStats({ 
  todayStats, 
  weekStats, 
  monthStats, 
  yearStats,
  onCustomRangeSelect 
}: DashboardStatsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [customStats, setCustomStats] = useState<CustomRangeStats | null>(null);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);

  const statsMap: Record<Exclude<TimePeriod, 'custom'>, StatsData> = {
    today: todayStats,
    week: weekStats,
    month: monthStats,
    year: yearStats,
  };

  // Get current stats - fallback to month if custom is selected but no data yet
  const currentStats = selectedPeriod === 'custom' && customStats 
    ? customStats 
    : statsMap[selectedPeriod === 'custom' ? 'month' : selectedPeriod as Exclude<TimePeriod, 'custom'>];
  
  const trend = calculateTrend(currentStats.currentRevenue, currentStats.previousRevenue);

  const periodLabels: Record<TimePeriod, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    custom: 'Custom Range',
  };

  const handleCustomRangeApply = async (startDate: Date, endDate: Date) => {
    if (!onCustomRangeSelect) return;
    
    setIsLoadingCustom(true);
    setSelectedPeriod('custom');
    
    try {
      // Call the parent callback to fetch custom range data
      await onCustomRangeSelect(startDate, endDate);
      
      // For now, we'll just use placeholder data
      // The parent component should pass updated stats via a new prop
      setCustomStats({
        currentOrders: 0,
        currentRevenue: 0,
        previousRevenue: 0,
        activeProducts: todayStats.activeProducts,
        totalCustomers: todayStats.totalCustomers,
        startDate,
        endDate,
      });
    } catch (error) {
      console.error('Failed to fetch custom range data:', error);
    } finally {
      setIsLoadingCustom(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Time Period Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Store Performance</h3>
          <div className="flex gap-2">
            {(['today', 'week', 'month', 'year'] as Array<Exclude<TimePeriod, 'custom'>>).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedPeriod === period
                    ? 'bg-black text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setSelectedPeriod('custom')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedPeriod === 'custom'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
              }`}
            >
              Custom
            </button>
          </div>
        </div>
        
        {/* Custom Date Range Picker */}
        {selectedPeriod === 'custom' && (
          <DateRangePicker 
            onRangeChange={handleCustomRangeApply}
            disabled={isLoadingCustom}
          />
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Orders</h3>
          <p className="text-3xl font-bold">{currentStats.currentOrders}</p>
          <p className="text-sm text-gray-500">
            {currentStats.currentOrders === 0 ? 'No orders yet' : 
              selectedPeriod === 'custom' && customStats?.startDate && customStats?.endDate 
                ? `${customStats.startDate.toLocaleDateString()} - ${customStats.endDate.toLocaleDateString()}`
                : periodLabels[selectedPeriod]
            }
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Revenue</h3>
          <p className="text-3xl font-bold">{formatCurrency(currentStats.currentRevenue)}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">
              {selectedPeriod === 'custom' && customStats?.startDate && customStats?.endDate 
                ? `${customStats.startDate.toLocaleDateString()} - ${customStats.endDate.toLocaleDateString()}`
                : periodLabels[selectedPeriod]
              }
            </p>
            {currentStats.previousRevenue > 0 && (
              <div className={`flex items-center gap-1 text-xs font-medium ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend.isPositive ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                <span>{trend.percentage.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Products</h3>
          <p className="text-3xl font-bold">{currentStats.activeProducts}</p>
          <p className="text-sm text-gray-500">Active products</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Customers</h3>
          <p className="text-3xl font-bold">{currentStats.totalCustomers}</p>
          <p className="text-sm text-gray-500">Total customers</p>
        </div>
      </div>
    </div>
  );
}
