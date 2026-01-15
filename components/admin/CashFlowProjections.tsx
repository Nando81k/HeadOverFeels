"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendUp,
  TrendDown,
  CurrencyDollar,
  Calendar,
  Warning,
  ArrowClockwise,
  Wallet,
  ChartLineUp,
  Gauge,
  Export,
  Lightning,
  Scales,
  Target,
} from "@phosphor-icons/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DailyData {
  date: string;
  revenue: number;
  expenses: number;
  netCashFlow: number;
  orders: number;
  avgOrderValue: number;
}

interface Projection {
  period: string;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedNetCashFlow: number;
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
    last30DaysExpenses: number;
    last60DaysRevenue: number;
    last90DaysRevenue: number;
    growthRate: number;
    avgDailyRevenue: number;
    avgDailyExpenses: number;
    trendDirection: "up" | "down" | "stable";
    currentBalance: number;
    monthlyBurnRate: number;
    runwayMonths: number;
  };
}

type ScenarioType = "conservative" | "moderate" | "optimistic";

interface CashFlowProjectionsProps {
  refreshInterval?: number;
}

export default function CashFlowProjections({
  refreshInterval = 60000,
}: CashFlowProjectionsProps) {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(90);
  const [scenario, setScenario] = useState<ScenarioType>("moderate");
  const [showExpenses, setShowExpenses] = useState(true);

  const fetchCashFlowData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/financial/cash-flow");
      if (response.ok) {
        const fetchedData = await response.json();
        // Enhance data with calculated fields if not present
        const enhanced: CashFlowData = {
          ...fetchedData,
          historical: (fetchedData.historical || []).map((d: DailyData) => ({
            ...d,
            expenses: d.expenses || d.revenue * 0.65,
            netCashFlow: d.netCashFlow || d.revenue - (d.expenses || d.revenue * 0.65),
          })),
          summary: {
            ...fetchedData.summary,
            avgDailyExpenses: fetchedData.summary?.avgDailyExpenses || fetchedData.summary?.avgDailyRevenue * 0.65 || 0,
            currentBalance: fetchedData.summary?.currentBalance || 50000,
            monthlyBurnRate: fetchedData.summary?.monthlyBurnRate || fetchedData.summary?.avgDailyRevenue * 30 * 0.1 || 0,
            runwayMonths: fetchedData.summary?.runwayMonths || 12,
            last30DaysExpenses: fetchedData.summary?.last30DaysExpenses || fetchedData.summary?.last30DaysRevenue * 0.65 || 0,
          },
          projections: {
            next30Days: {
              ...fetchedData.projections?.next30Days,
              projectedExpenses: fetchedData.projections?.next30Days?.projectedExpenses || fetchedData.projections?.next30Days?.projectedRevenue * 0.65 || 0,
              projectedNetCashFlow: fetchedData.projections?.next30Days?.projectedNetCashFlow || fetchedData.projections?.next30Days?.projectedRevenue * 0.35 || 0,
            },
            next60Days: {
              ...fetchedData.projections?.next60Days,
              projectedExpenses: fetchedData.projections?.next60Days?.projectedExpenses || fetchedData.projections?.next60Days?.projectedRevenue * 0.65 || 0,
              projectedNetCashFlow: fetchedData.projections?.next60Days?.projectedNetCashFlow || fetchedData.projections?.next60Days?.projectedRevenue * 0.35 || 0,
            },
            next90Days: {
              ...fetchedData.projections?.next90Days,
              projectedExpenses: fetchedData.projections?.next90Days?.projectedExpenses || fetchedData.projections?.next90Days?.projectedRevenue * 0.65 || 0,
              projectedNetCashFlow: fetchedData.projections?.next90Days?.projectedNetCashFlow || fetchedData.projections?.next90Days?.projectedRevenue * 0.35 || 0,
            },
          },
        };
        setData(enhanced);
      }
    } catch (error) {
      console.error("Failed to fetch cash flow data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCashFlowData();
    const interval = setInterval(fetchCashFlowData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchCashFlowData]);

  // Scenario multipliers - typed constant
  const scenarioMultipliers: Record<ScenarioType, { revenue: number; expenses: number }> = {
    conservative: { revenue: 0.85, expenses: 1.1 },
    moderate: { revenue: 1.0, expenses: 1.0 },
    optimistic: { revenue: 1.2, expenses: 0.9 },
  };

  // Chart data with scenario applied
  const chartData = useMemo(() => {
    if (!data) return [];
    const historicalSlice = data.historical.slice(-selectedPeriod);
    const mult = scenarioMultipliers[scenario];
    
    return historicalSlice.map(d => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullDate: d.date,
      revenue: d.revenue,
      expenses: d.expenses,
      netCashFlow: d.revenue - d.expenses,
      projectedRevenue: d.revenue * mult.revenue,
      projectedExpenses: d.expenses * mult.expenses,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedPeriod, scenario]);

  // Cash runway indicator
  const cashRunway = useMemo(() => {
    if (!data?.summary) return { months: 0, status: "critical" as const };
    const months = data.summary.runwayMonths;
    const status = months >= 12 ? "healthy" : months >= 6 ? "warning" : "critical";
    return { months, status };
  }, [data]);

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
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[confidence]}`}>
        {confidence.toUpperCase()}
      </span>
    );
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ["Date", "Revenue", "Expenses", "Net Cash Flow"];
    const rows = data.historical.map(d => [
      d.date,
      d.revenue.toFixed(2),
      d.expenses.toFixed(2),
      (d.revenue - d.expenses).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-flow-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neutral-800 border border-white/10 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-white/10 rounded w-1/3"></div>
          <div className="h-8 bg-white/10 rounded w-24"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-xl"></div>
          ))}
        </div>
        <div className="h-72 bg-white/5 rounded-xl"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-white/50">
        <Warning size={48} weight="bold" className="mx-auto mb-3 opacity-30" />
        <p>Unable to load cash flow data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/20">
            <ChartLineUp size={24} weight="bold" className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Cash Flow Projections</h2>
            <p className="text-sm text-white/50">
              Revenue forecasts & runway analysis • {selectedPeriod} day view
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-all"
          >
            <Export size={16} weight="bold" />
            Export
          </button>
          <button
            onClick={() => fetchCashFlowData()}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-all"
          >
            <ArrowClockwise size={16} weight="bold" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-green-500/10 to-emerald-600/5 border border-green-500/20 rounded-xl p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-green-400/80 mb-1">Avg Daily Revenue</p>
              <p className="text-2xl font-bold text-green-300">
                {formatCurrency(data.summary.avgDailyRevenue)}
              </p>
              <p className="text-xs text-green-400/60 mt-1">
                {formatPercent(data.summary.growthRate)} growth
              </p>
            </div>
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CurrencyDollar size={20} className="text-green-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-blue-400/80 mb-1">Last 30 Days</p>
              <p className="text-2xl font-bold text-blue-300">
                {formatCurrency(data.summary.last30DaysRevenue)}
              </p>
              <p className="text-xs text-blue-400/60 mt-1">
                Expenses: {formatCurrency(data.summary.last30DaysExpenses)}
              </p>
            </div>
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Calendar size={20} className="text-blue-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-purple-400/80 mb-1">Current Balance</p>
              <p className="text-2xl font-bold text-purple-300">
                {formatCurrency(data.summary.currentBalance)}
              </p>
              <p className="text-xs text-purple-400/60 mt-1">
                Available funds
              </p>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Wallet size={20} className="text-purple-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`bg-gradient-to-br ${
            cashRunway.status === "healthy" 
              ? "from-green-500/10 to-emerald-600/5 border-green-500/20" 
              : cashRunway.status === "warning"
              ? "from-yellow-500/10 to-orange-600/5 border-yellow-500/20"
              : "from-red-500/10 to-red-600/5 border-red-500/20"
          } border rounded-xl p-4`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm mb-1 ${
                cashRunway.status === "healthy" ? "text-green-400/80" 
                : cashRunway.status === "warning" ? "text-yellow-400/80"
                : "text-red-400/80"
              }`}>Cash Runway</p>
              <p className={`text-2xl font-bold ${
                cashRunway.status === "healthy" ? "text-green-300" 
                : cashRunway.status === "warning" ? "text-yellow-300"
                : "text-red-300"
              }`}>
                {cashRunway.months} months
              </p>
              <p className={`text-xs mt-1 ${
                cashRunway.status === "healthy" ? "text-green-400/60" 
                : cashRunway.status === "warning" ? "text-yellow-400/60"
                : "text-red-400/60"
              }`}>
                {cashRunway.status === "healthy" ? "Healthy position" : cashRunway.status === "warning" ? "Monitor closely" : "Action needed"}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${
              cashRunway.status === "healthy" ? "bg-green-500/20" 
              : cashRunway.status === "warning" ? "bg-yellow-500/20"
              : "bg-red-500/20"
            }`}>
              <Gauge size={20} className={
                cashRunway.status === "healthy" ? "text-green-400" 
                : cashRunway.status === "warning" ? "text-yellow-400"
                : "text-red-400"
              } />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/50 mr-2">Period:</span>
          {[30, 60, 90].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period as 30 | 60 | 90)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedPeriod === period
                  ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                  : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
              }`}
            >
              {period} Days
            </button>
          ))}
        </div>

        {/* Scenario Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/50 mr-2">Scenario:</span>
          <button
            onClick={() => setScenario("conservative")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              scenario === "conservative"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
            }`}
          >
            <Scales size={14} weight="bold" />
            Conservative
          </button>
          <button
            onClick={() => setScenario("moderate")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              scenario === "moderate"
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
            }`}
          >
            <Target size={14} weight="bold" />
            Moderate
          </button>
          <button
            onClick={() => setScenario("optimistic")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              scenario === "optimistic"
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
            }`}
          >
            <Lightning size={14} weight="bold" />
            Optimistic
          </button>
        </div>

        {/* Toggle Expenses */}
        <button
          onClick={() => setShowExpenses(!showExpenses)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            showExpenses
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
          }`}
        >
          {showExpenses ? "Hide Expenses" : "Show Expenses"}
        </button>
      </div>

      {/* Recharts Area Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Historical Cash Flow
          </h3>
          <div className="text-sm text-white/50">
            {scenario.charAt(0).toUpperCase() + scenario.slice(1)} scenario • {scenarioMultipliers[scenario].revenue}x revenue multiplier
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorNetCashFlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: "20px" }}
              formatter={(value) => <span className="text-white/70 text-sm">{value}</span>}
            />
            <Area
              type="linear"
              dataKey="revenue"
              name="Revenue"
              stroke="#10B981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
            {showExpenses && (
              <Area
                type="linear"
                dataKey="expenses"
                name="Expenses"
                stroke="#EF4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExpenses)"
              />
            )}
            <Area
              type="linear"
              dataKey="netCashFlow"
              name="Net Cash Flow"
              stroke="#8B5CF6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorNetCashFlow)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Projections */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Revenue Projections
          </h3>
          <div className="text-sm text-white/50">
            Based on {scenario} growth scenario
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 30 Days */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-white/10 bg-gradient-to-br from-white/5 to-transparent rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-white">Next 30 Days</h4>
              {getConfidenceBadge(data.projections.next30Days.confidence)}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-white/50">Projected Revenue</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(data.projections.next30Days.projectedRevenue * scenarioMultipliers[scenario].revenue)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-white/40">Expected Orders</p>
                  <p className="text-lg font-semibold text-white/70">
                    {Math.round(data.projections.next30Days.projectedOrders * scenarioMultipliers[scenario].revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Est. Expenses</p>
                  <p className="text-lg font-semibold text-red-400/70">
                    {formatCurrency((data.projections.next30Days.projectedExpenses || data.projections.next30Days.projectedRevenue * 0.3) * scenarioMultipliers[scenario].expenses)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-white/10">
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
          </motion.div>

          {/* 60 Days */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border border-white/10 bg-gradient-to-br from-white/5 to-transparent rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-white">Next 60 Days</h4>
              {getConfidenceBadge(data.projections.next60Days.confidence)}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-white/50">Projected Revenue</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(data.projections.next60Days.projectedRevenue * scenarioMultipliers[scenario].revenue)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-white/40">Expected Orders</p>
                  <p className="text-lg font-semibold text-white/70">
                    {Math.round(data.projections.next60Days.projectedOrders * scenarioMultipliers[scenario].revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Est. Expenses</p>
                  <p className="text-lg font-semibold text-red-400/70">
                    {formatCurrency((data.projections.next60Days.projectedExpenses || data.projections.next60Days.projectedRevenue * 0.3) * scenarioMultipliers[scenario].expenses)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-white/10">
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
          </motion.div>

          {/* 90 Days */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="border border-white/10 bg-gradient-to-br from-white/5 to-transparent rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-white">Next 90 Days</h4>
              {getConfidenceBadge(data.projections.next90Days.confidence)}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-white/50">Projected Revenue</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(data.projections.next90Days.projectedRevenue * scenarioMultipliers[scenario].revenue)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-white/40">Expected Orders</p>
                  <p className="text-lg font-semibold text-white/70">
                    {Math.round(data.projections.next90Days.projectedOrders * scenarioMultipliers[scenario].revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Est. Expenses</p>
                  <p className="text-lg font-semibold text-red-400/70">
                    {formatCurrency((data.projections.next90Days.projectedExpenses || data.projections.next90Days.projectedRevenue * 0.3) * scenarioMultipliers[scenario].expenses)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-white/10">
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
          </motion.div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex items-start gap-3 text-sm text-white/70 bg-white/5 border border-white/10 rounded-xl p-4">
          <Warning size={20} weight="bold" className="mt-0.5 shrink-0 text-yellow-400/60" />
          <div>
            <p className="font-medium mb-1 text-white">
              About These Projections
            </p>
            <p className="text-xs text-white/50 leading-relaxed">
              Forecasts are based on linear regression analysis of your historical sales data. 
              The {scenario} scenario applies a {scenarioMultipliers[scenario].revenue}x revenue / {scenarioMultipliers[scenario].expenses}x expense multiplier. 
              Confidence levels reflect data consistency and sample size. Actual results may vary 
              based on seasonality, marketing campaigns, and market conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
