"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendUp,
  TrendDown,
  CurrencyDollar,
  Calendar,
  Warning,
  ArrowClockwise,
} from "@phosphor-icons/react";

interface DailyData {
  date: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
}

interface Projection {
  period: string;
  projectedRevenue: number;
  projectedOrders: number;
  confidence: "high" | "medium" | "low";
  trend: "up" | "down" | "stable";
  changePercent: number;
}

interface CashFlowData {
  historical: DailyData[];
  projections: {
    next30Days: Projection;
    next60Days: Projection;
    next90Days: Projection;
  };
  summary: {
    last30DaysRevenue: number;
    last60DaysRevenue: number;
    last90DaysRevenue: number;
    growthRate: number;
    avgDailyRevenue: number;
    trendDirection: "up" | "down" | "stable";
  };
}

interface CashFlowProjectionsProps {
  refreshInterval?: number;
}

export default function CashFlowProjections({
  refreshInterval = 60000,
}: CashFlowProjectionsProps) {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(90);

  const fetchCashFlowData = async () => {
    try {
      const response = await fetch("/api/admin/financial/cash-flow");
      if (response.ok) {
        const fetchedData = await response.json();
        setData(fetchedData);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch cash flow data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashFlowData();
    const interval = setInterval(fetchCashFlowData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    if (trend === "up")
      return <TrendUp size={20} weight="bold" className="text-green-400" />;
    if (trend === "down")
      return <TrendDown size={20} weight="bold" className="text-red-400" />;
    return <TrendUp size={20} weight="bold" className="text-white/40" />;
  };

  const getTrendColor = (trend: "up" | "down" | "stable") => {
    if (trend === "up") return "text-green-400";
    if (trend === "down") return "text-red-400";
    return "text-white/70";
  };

  const getConfidenceBadge = (confidence: "high" | "medium" | "low") => {
    const colors = {
      high: "bg-green-500/20 text-green-400 border border-green-500/30",
      medium: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
      low: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[confidence]}`}
      >
        {confidence.toUpperCase()} confidence
      </span>
    );
  };

  const getHistoricalChartData = () => {
    if (!data) return [];
    return data.historical.slice(-selectedPeriod);
  };

  const getMaxRevenue = () => {
    const chartData = getHistoricalChartData();
    if (chartData.length === 0) return 1000;
    return Math.max(...chartData.map((d) => d.revenue));
  };

  if (loading) {
    return (
      <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="h-32 bg-white/5 rounded"></div>
            <div className="h-32 bg-white/5 rounded"></div>
            <div className="h-32 bg-white/5 rounded"></div>
          </div>
          <div className="h-64 bg-white/5 rounded"></div>
        </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-white/50">
          <Warning
            size={48}
            weight="bold"
            className="mx-auto mb-3 opacity-30"
          />
          <p>Unable to load cash flow data</p>
        </div>
    );
  }

  const chartData = getHistoricalChartData();
  const maxRevenue = getMaxRevenue();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <CurrencyDollar size={24} weight="bold" className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Cash Flow Projections
            </h2>
            <p className="text-sm text-white/50">
              Revenue forecasts based on historical trends
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <ArrowClockwise size={16} weight="bold" />
          <span>Updated {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-400 mb-1">Avg Daily Revenue</p>
              <p className="text-2xl font-bold text-blue-300">
                {formatCurrency(data.summary.avgDailyRevenue)}
              </p>
            </div>
            <Calendar
              size={32}
              weight="bold"
              className="text-blue-400 opacity-50"
            />
          </div>
        </div>

        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-400 mb-1">Last 30 Days</p>
              <p className="text-2xl font-bold text-green-300">
                {formatCurrency(data.summary.last30DaysRevenue)}
              </p>
            </div>
            <CurrencyDollar
              size={32}
              weight="bold"
              className="text-green-400 opacity-50"
            />
          </div>
        </div>

        <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-400 mb-1">Growth Rate</p>
              <p
                className={`text-2xl font-bold ${getTrendColor(
                  data.summary.trendDirection
                )}`}
              >
                {formatPercent(data.summary.growthRate)}
              </p>
            </div>
            {getTrendIcon(data.summary.trendDirection)}
          </div>
        </div>

        <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-400 mb-1">Last 90 Days</p>
              <p className="text-2xl font-bold text-orange-300">
                {formatCurrency(data.summary.last90DaysRevenue)}
              </p>
            </div>
            <TrendUp
              size={32}
              weight="bold"
              className="text-orange-400 opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Historical Chart */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Historical Revenue
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPeriod(30)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedPeriod === 30
                  ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                  : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setSelectedPeriod(60)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedPeriod === 60
                  ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                  : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
              }`}
            >
              60 Days
            </button>
            <button
              onClick={() => setSelectedPeriod(90)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedPeriod === 90
                  ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                  : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
              }`}
            >
              90 Days
            </button>
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-end gap-1 h-48">
            {chartData.map((day, index) => {
              const height = (day.revenue / maxRevenue) * 100;
              return (
                <motion.div
                  key={day.date}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.5, delay: index * 0.01 }}
                  className="flex-1 bg-fuchsia-500 rounded-t hover:bg-fuchsia-400 transition-colors relative group"
                  style={{ minHeight: "2px" }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-neutral-800 border border-white/10 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    <div className="font-semibold">
                      {formatCurrency(day.revenue)}
                    </div>
                    <div className="text-white/50">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/50">
            <span>
              {chartData[0] &&
                new Date(chartData[0].date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
            </span>
            <span>
              {chartData[chartData.length - 1] &&
                new Date(
                  chartData[chartData.length - 1].date
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
            </span>
          </div>
        </div>
      </div>

      {/* Projections */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          Revenue Projections
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 30 Days */}
          <div className="border border-white/10 bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white">Next 30 Days</h4>
              {getConfidenceBadge(data.projections.next30Days.confidence)}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-white/50">Projected Revenue</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(data.projections.next30Days.projectedRevenue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/50">Expected Orders</p>
                <p className="text-lg font-semibold text-white/70">
                  {data.projections.next30Days.projectedOrders}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                {getTrendIcon(data.projections.next30Days.trend)}
                <span
                  className={`font-medium ${getTrendColor(
                    data.projections.next30Days.trend
                  )}`}
                >
                  {formatPercent(data.projections.next30Days.changePercent)}
                </span>
                <span className="text-sm text-white/50">vs last period</span>
              </div>
            </div>
          </div>

          {/* 60 Days */}
          <div className="border border-white/10 bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white">Next 60 Days</h4>
              {getConfidenceBadge(data.projections.next60Days.confidence)}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-white/50">Projected Revenue</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(data.projections.next60Days.projectedRevenue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/50">Expected Orders</p>
                <p className="text-lg font-semibold text-white/70">
                  {data.projections.next60Days.projectedOrders}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                {getTrendIcon(data.projections.next60Days.trend)}
                <span
                  className={`font-medium ${getTrendColor(
                    data.projections.next60Days.trend
                  )}`}
                >
                  {formatPercent(data.projections.next60Days.changePercent)}
                </span>
                <span className="text-sm text-white/50">vs last period</span>
              </div>
            </div>
          </div>

          {/* 90 Days */}
          <div className="border border-white/10 bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white">Next 90 Days</h4>
              {getConfidenceBadge(data.projections.next90Days.confidence)}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-white/50">Projected Revenue</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(data.projections.next90Days.projectedRevenue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/50">Expected Orders</p>
                <p className="text-lg font-semibold text-white/70">
                  {data.projections.next90Days.projectedOrders}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                {getTrendIcon(data.projections.next90Days.trend)}
                <span
                  className={`font-medium ${getTrendColor(
                    data.projections.next90Days.trend
                  )}`}
                >
                  {formatPercent(data.projections.next90Days.changePercent)}
                </span>
                <span className="text-sm text-white/50">vs last period</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex items-start gap-2 text-sm text-white/70">
          <Warning size={16} weight="bold" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-1 text-white">
              About These Projections:
            </p>
            <p className="text-xs">
              Forecasts are based on linear regression analysis of your
              historical sales data. Confidence levels reflect data consistency
              and sample size. Actual results may vary based on seasonality,
              marketing campaigns, and market conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
