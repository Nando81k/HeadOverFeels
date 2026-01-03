"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendUp,
  TrendDown,
  CurrencyDollar,
  Warning,
  Package,
  PencilSimple,
  ArrowClockwise,
  Check,
  X,
  Export,
  MagnifyingGlass,
  Funnel,
  CaretDown,
  CaretUp,
  ChartBar,
  ListBullets,
  Sparkle,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from "recharts";

interface ProductProfit {
  productId: string;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice: number | null;
  profitMargin: number | null;
  profitPerUnit: number | null;
  totalInventory: number;
  potentialProfit: number | null;
  category: string | null;
  status: string;
  isLimitedEdition: boolean;
  hasVariants: boolean;
  variants?: VariantProfit[];
}

interface VariantProfit {
  variantId: string;
  sku: string;
  size: string | null;
  color: string | null;
  sellingPrice: number;
  costPrice: number | null;
  profitMargin: number | null;
  profitPerUnit: number | null;
  inventory: number;
  potentialProfit: number | null;
}

interface SummaryStats {
  totalProducts: number;
  productsWithCosts: number;
  avgProfitMargin: number;
  totalPotentialProfit: number;
  lowMarginCount: number;
  negativeProfitCount: number;
}

type SortField = "name" | "margin" | "profit" | "potential" | "inventory";
type SortDirection = "asc" | "desc";
type ViewMode = "table" | "chart";
type MarginFilter = "all" | "negative" | "low" | "good" | "excellent";

const MARGIN_COLORS = {
  negative: "#ef4444",
  low: "#f97316",
  good: "#eab308",
  excellent: "#22c55e",
};

interface ProfitMarginCalculatorProps {
  refreshInterval?: number;
}

export default function ProfitMarginCalculator({
  refreshInterval = 60000,
}: ProfitMarginCalculatorProps) {
  const [products, setProducts] = useState<ProductProfit[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [sortField, setSortField] = useState<SortField>("margin");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [marginFilter, setMarginFilter] = useState<MarginFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState("");
  const [savingCost, setSavingCost] = useState(false);

  const fetchProfitData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/financial/profit-margins");
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setSummary(data.summary || null);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch profit data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfitData();
    const interval = setInterval(fetchProfitData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchProfitData]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [products]);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p => p.name.toLowerCase().includes(query) || 
             p.sku.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    // Margin filter
    switch (marginFilter) {
      case "negative":
        filtered = filtered.filter(p => p.profitMargin !== null && p.profitMargin < 0);
        break;
      case "low":
        filtered = filtered.filter(p => p.profitMargin !== null && p.profitMargin >= 0 && p.profitMargin < 20);
        break;
      case "good":
        filtered = filtered.filter(p => p.profitMargin !== null && p.profitMargin >= 20 && p.profitMargin < 40);
        break;
      case "excellent":
        filtered = filtered.filter(p => p.profitMargin !== null && p.profitMargin >= 40);
        break;
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "margin":
          aValue = a.profitMargin ?? -Infinity;
          bValue = b.profitMargin ?? -Infinity;
          break;
        case "profit":
          aValue = a.profitPerUnit ?? -Infinity;
          bValue = b.profitPerUnit ?? -Infinity;
          break;
        case "potential":
          aValue = a.potentialProfit ?? -Infinity;
          bValue = b.potentialProfit ?? -Infinity;
          break;
        case "inventory":
          aValue = a.totalInventory;
          bValue = b.totalInventory;
          break;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [products, searchQuery, categoryFilter, marginFilter, sortField, sortDirection]);

  // Chart data for margin distribution
  const marginDistributionData = useMemo(() => {
    const distribution = { negative: 0, low: 0, good: 0, excellent: 0 };
    products.forEach(p => {
      if (p.profitMargin === null) return;
      if (p.profitMargin < 0) distribution.negative++;
      else if (p.profitMargin < 20) distribution.low++;
      else if (p.profitMargin < 40) distribution.good++;
      else distribution.excellent++;
    });
    return [
      { name: "Negative (<0%)", value: distribution.negative, color: MARGIN_COLORS.negative },
      { name: "Low (0-20%)", value: distribution.low, color: MARGIN_COLORS.low },
      { name: "Good (20-40%)", value: distribution.good, color: MARGIN_COLORS.good },
      { name: "Excellent (40%+)", value: distribution.excellent, color: MARGIN_COLORS.excellent },
    ];
  }, [products]);

  // Scatter plot data
  const scatterData = useMemo(() => {
    return filteredAndSortedProducts
      .filter(p => p.profitMargin !== null && p.totalInventory > 0)
      .map(p => ({
        name: p.name,
        margin: p.profitMargin,
        inventory: p.totalInventory,
        potential: p.potentialProfit || 0,
        color: getMarginColorHex(p.profitMargin),
      }));
  }, [filteredAndSortedProducts]);

  // Top products for chart
  const topProducts = useMemo(() => {
    const withMargins = products.filter(p => p.profitMargin !== null);
    const sorted = [...withMargins].sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0));
    return sorted.slice(0, 5).map(p => ({
      name: p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name,
      margin: p.profitMargin,
      fill: MARGIN_COLORS.excellent,
    }));
  }, [products]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleEditCost = (productId: string, currentCost: number | null) => {
    setEditingCost(productId);
    setEditCostValue(currentCost?.toString() || "");
  };

  const handleSaveCost = async (productId: string) => {
    const newCost = parseFloat(editCostValue);
    if (isNaN(newCost) || newCost < 0) {
      alert("Please enter a valid cost");
      return;
    }
    setSavingCost(true);
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costPrice: newCost }),
      });
      if (response.ok) {
        setProducts(prev => 
          prev.map(p => {
            if (p.productId === productId) {
              const newMargin = p.sellingPrice > 0 
                ? ((p.sellingPrice - newCost) / p.sellingPrice) * 100 
                : null;
              const newProfitPerUnit = p.sellingPrice - newCost;
              return {
                ...p,
                costPrice: newCost,
                profitMargin: newMargin,
                profitPerUnit: newProfitPerUnit,
                potentialProfit: newProfitPerUnit * p.totalInventory,
              };
            }
            return p;
          })
        );
        setEditingCost(null);
      }
    } catch (error) {
      console.error("Error saving cost:", error);
    } finally {
      setSavingCost(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Product", "SKU", "Category", "Selling Price", "Cost Price", "Margin %", "Profit/Unit", "Inventory", "Potential Profit"];
    const rows = filteredAndSortedProducts.map(p => [
      p.name,
      p.sku,
      p.category || "Uncategorized",
      p.sellingPrice.toFixed(2),
      p.costPrice?.toFixed(2) || "N/A",
      p.profitMargin?.toFixed(1) || "N/A",
      p.profitPerUnit?.toFixed(2) || "N/A",
      p.totalInventory,
      p.potentialProfit?.toFixed(2) || "N/A",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-margins-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function getMarginColorHex(margin: number | null): string {
    if (margin === null) return "#6b7280";
    if (margin < 0) return MARGIN_COLORS.negative;
    if (margin < 20) return MARGIN_COLORS.low;
    if (margin < 40) return MARGIN_COLORS.good;
    return MARGIN_COLORS.excellent;
  }

  const getMarginColor = (margin: number | null) => {
    if (margin === null) return "text-white/40";
    if (margin < 0) return "text-red-400";
    if (margin < 20) return "text-orange-400";
    if (margin < 40) return "text-yellow-400";
    return "text-green-400";
  };

  const getMarginBg = (margin: number | null) => {
    if (margin === null) return "bg-white/5";
    if (margin < 0) return "bg-red-500/10";
    if (margin < 20) return "bg-orange-500/10";
    if (margin < 40) return "bg-yellow-500/10";
    return "bg-green-500/10";
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Custom tooltip for scatter chart
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; margin: number; inventory: number; potential: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-neutral-800 border border-white/10 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-sm text-white/70">Margin: {data.margin?.toFixed(1)}%</p>
          <p className="text-sm text-white/70">Inventory: {data.inventory}</p>
          <p className="text-sm text-white/70">Potential: {formatCurrency(data.potential)}</p>
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
        <div className="h-64 bg-white/5 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/20">
            <TrendUp size={24} weight="bold" className="text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Profit Margin Analysis</h2>
            <p className="text-sm text-white/50">
              Real-time profitability by product • {products.length} products
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-all"
          >
            <Export size={16} weight="bold" />
            Export CSV
          </button>
          <button
            onClick={() => fetchProfitData()}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-all"
          >
            <ArrowClockwise size={16} weight="bold" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-blue-400/80 mb-1">Avg Margin</p>
                <p className="text-2xl font-bold text-blue-300">
                  {summary.avgProfitMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-blue-400/60 mt-1">
                  {summary.productsWithCosts}/{summary.totalProducts} tracked
                </p>
              </div>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <ChartBar size={20} className="text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-gradient-to-br from-green-500/10 to-emerald-600/5 border border-green-500/20 rounded-xl p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-green-400/80 mb-1">Total Potential</p>
                <p className="text-2xl font-bold text-green-300">
                  {formatCurrency(summary.totalPotentialProfit)}
                </p>
                <p className="text-xs text-green-400/60 mt-1">From current inventory</p>
              </div>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CurrencyDollar size={20} className="text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-yellow-500/10 to-orange-600/5 border border-yellow-500/20 rounded-xl p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-yellow-400/80 mb-1">Low Margin</p>
                <p className="text-2xl font-bold text-yellow-300">{summary.lowMarginCount}</p>
                <p className="text-xs text-yellow-400/60 mt-1">Under 20% margin</p>
              </div>
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Warning size={20} className="text-yellow-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-xl p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-red-400/80 mb-1">Negative Profit</p>
                <p className="text-2xl font-bold text-red-300">{summary.negativeProfitCount}</p>
                <p className="text-xs text-red-400/60 mt-1">Losing money</p>
              </div>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <TrendDown size={20} className="text-red-400" />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* View Toggle & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* View Mode Toggle */}
        <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === "table"
                ? "bg-fuchsia-500/20 text-fuchsia-400"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            <ListBullets size={16} />
            Table
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === "chart"
                ? "bg-fuchsia-500/20 text-fuchsia-400"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            <ChartBar size={16} />
            Charts
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-fuchsia-500/50"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-fuchsia-500/50"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Margin Filter */}
        <select
          value={marginFilter}
          onChange={(e) => setMarginFilter(e.target.value as MarginFilter)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-fuchsia-500/50"
        >
          <option value="all">All Margins</option>
          <option value="negative">Negative (&lt;0%)</option>
          <option value="low">Low (0-20%)</option>
          <option value="good">Good (20-40%)</option>
          <option value="excellent">Excellent (40%+)</option>
        </select>
      </div>

      {/* Charts View */}
      {viewMode === "chart" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Margin Distribution Pie */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Funnel size={18} className="text-fuchsia-400" />
              Margin Distribution
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={marginDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ value }) => value > 0 ? `${value}` : ""}
                  >
                    {marginDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#262626",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px" }}
                    formatter={(value) => <span className="text-white/70">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products Bar Chart */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Sparkle size={18} className="text-green-400" />
              Top 5 Margins
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={100} stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#262626",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Margin"]}
                  />
                  <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Margin vs Inventory Scatter */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 lg:col-span-2">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Package size={18} className="text-blue-400" />
              Margin vs Inventory (Bubble = Potential Profit)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    type="number" 
                    dataKey="inventory" 
                    name="Inventory" 
                    stroke="rgba(255,255,255,0.5)" 
                    fontSize={12}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="margin" 
                    name="Margin" 
                    tickFormatter={(v) => `${v}%`}
                    stroke="rgba(255,255,255,0.5)" 
                    fontSize={12}
                  />
                  <ZAxis type="number" dataKey="potential" range={[50, 500]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter data={scatterData} fill="#8b5cf6">
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-white/5 border-b border-white/10 text-sm font-medium text-white/70">
            <button
              onClick={() => handleSort("name")}
              className="col-span-3 flex items-center gap-1 hover:text-white transition-colors text-left"
            >
              Product
              {sortField === "name" && (sortDirection === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />)}
            </button>
            <div className="col-span-2 text-right">Cost / Price</div>
            <button
              onClick={() => handleSort("margin")}
              className="col-span-2 flex items-center justify-end gap-1 hover:text-white transition-colors"
            >
              Margin
              {sortField === "margin" && (sortDirection === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />)}
            </button>
            <button
              onClick={() => handleSort("profit")}
              className="col-span-2 flex items-center justify-end gap-1 hover:text-white transition-colors"
            >
              Profit/Unit
              {sortField === "profit" && (sortDirection === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />)}
            </button>
            <button
              onClick={() => handleSort("inventory")}
              className="col-span-1 flex items-center justify-end gap-1 hover:text-white transition-colors"
            >
              Stock
              {sortField === "inventory" && (sortDirection === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />)}
            </button>
            <button
              onClick={() => handleSort("potential")}
              className="col-span-2 flex items-center justify-end gap-1 hover:text-white transition-colors"
            >
              Potential
              {sortField === "potential" && (sortDirection === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />)}
            </button>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {filteredAndSortedProducts.length === 0 ? (
              <div className="px-4 py-12 text-center text-white/50">
                <Package size={48} className="mx-auto mb-3 opacity-50" />
                <p>No products match your filters</p>
              </div>
            ) : (
              filteredAndSortedProducts.map((product) => (
                <motion.div
                  key={product.productId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`${getMarginBg(product.profitMargin)} hover:bg-white/5 transition-colors`}
                >
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
                    {/* Product Info */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium truncate">{product.name}</p>
                        {product.isLimitedEdition && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-fuchsia-500/20 text-fuchsia-400 rounded">
                            LIMITED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40">{product.sku}</p>
                      {product.category && (
                        <p className="text-xs text-white/30">{product.category}</p>
                      )}
                    </div>

                    {/* Cost / Price with Edit */}
                    <div className="col-span-2 text-right">
                      {editingCost === product.productId ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-white/40 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editCostValue}
                            onChange={(e) => setEditCostValue(e.target.value)}
                            className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-sm text-white text-right focus:outline-none focus:border-fuchsia-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveCost(product.productId)}
                            disabled={savingCost}
                            className="p-1 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditingCost(null)}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <div>
                            <p className="text-white/50 text-sm">
                              {product.costPrice !== null ? formatCurrency(product.costPrice) : "No cost"}
                            </p>
                            <p className="text-white text-sm">{formatCurrency(product.sellingPrice)}</p>
                          </div>
                          <button
                            onClick={() => handleEditCost(product.productId, product.costPrice)}
                            className="p-1 text-white/30 hover:text-white/70 hover:bg-white/10 rounded transition-colors"
                            title="Edit cost"
                          >
                            <PencilSimple size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Margin */}
                    <div className="col-span-2 text-right">
                      <span className={`text-lg font-semibold ${getMarginColor(product.profitMargin)}`}>
                        {product.profitMargin !== null ? `${product.profitMargin.toFixed(1)}%` : "N/A"}
                      </span>
                    </div>

                    {/* Profit Per Unit */}
                    <div className="col-span-2 text-right">
                      <span className={getMarginColor(product.profitPerUnit)}>
                        {formatCurrency(product.profitPerUnit)}
                      </span>
                    </div>

                    {/* Inventory */}
                    <div className="col-span-1 text-right text-white/70">
                      {product.totalInventory}
                    </div>

                    {/* Potential Profit */}
                    <div className="col-span-2 text-right">
                      <span className={`font-medium ${getMarginColor(product.potentialProfit)}`}>
                        {formatCurrency(product.potentialProfit)}
                      </span>
                    </div>
                  </div>

                  {/* Variants Expansion */}
                  {product.hasVariants && product.variants && product.variants.length > 0 && (
                    <>
                      <button
                        onClick={() => setExpandedProduct(
                          expandedProduct === product.productId ? null : product.productId
                        )}
                        className="w-full px-4 py-1.5 text-xs text-white/50 hover:text-white/70 hover:bg-white/5 flex items-center justify-center gap-1 transition-colors"
                      >
                        {expandedProduct === product.productId ? (
                          <>Hide {product.variants.length} variants <CaretUp size={12} /></>
                        ) : (
                          <>Show {product.variants.length} variants <CaretDown size={12} /></>
                        )}
                      </button>

                      <AnimatePresence>
                        {expandedProduct === product.productId && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-black/20 divide-y divide-white/5">
                              {product.variants.map((variant) => (
                                <div
                                  key={variant.variantId}
                                  className="grid grid-cols-12 gap-4 px-4 py-2 items-center text-sm"
                                >
                                  <div className="col-span-3 pl-4">
                                    <p className="text-white/70">
                                      {variant.size && variant.color
                                        ? `${variant.size} / ${variant.color}`
                                        : variant.size || variant.color || variant.sku}
                                    </p>
                                  </div>
                                  <div className="col-span-2 text-right text-white/50">
                                    {variant.costPrice !== null ? formatCurrency(variant.costPrice) : "—"} / {formatCurrency(variant.sellingPrice)}
                                  </div>
                                  <div className={`col-span-2 text-right ${getMarginColor(variant.profitMargin)}`}>
                                    {variant.profitMargin !== null ? `${variant.profitMargin.toFixed(1)}%` : "—"}
                                  </div>
                                  <div className={`col-span-2 text-right ${getMarginColor(variant.profitPerUnit)}`}>
                                    {formatCurrency(variant.profitPerUnit)}
                                  </div>
                                  <div className="col-span-1 text-right text-white/50">
                                    {variant.inventory}
                                  </div>
                                  <div className={`col-span-2 text-right ${getMarginColor(variant.potentialProfit)}`}>
                                    {formatCurrency(variant.potentialProfit)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="flex items-center justify-end gap-2 text-xs text-white/40">
        <ArrowClockwise size={12} />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
}
