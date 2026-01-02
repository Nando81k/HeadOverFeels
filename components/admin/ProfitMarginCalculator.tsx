"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendUp,
  CurrencyDollar,
  Warning,
  Package,
  ArrowsDownUp,
  PencilSimple,
  ArrowClockwise,
} from "@phosphor-icons/react";

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

type SortField = "name" | "margin" | "profit" | "potential";
type SortDirection = "asc" | "desc";

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

  const fetchProfitData = async () => {
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
  };

  useEffect(() => {
    fetchProfitData();
    const interval = setInterval(fetchProfitData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedProducts = () => {
    const sorted = [...products].sort((a, b) => {
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

    return sorted;
  };

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

  const formatPercent = (value: number | null) => {
    if (value === null) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/3 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="h-24 bg-white/5 rounded"></div>
          <div className="h-24 bg-white/5 rounded"></div>
          <div className="h-24 bg-white/5 rounded"></div>
        </div>
        <div className="space-y-4">
          <div className="h-16 bg-white/5 rounded"></div>
          <div className="h-16 bg-white/5 rounded"></div>
          <div className="h-16 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  const sortedProducts = getSortedProducts();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <TrendUp size={24} weight="bold" className="text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Profit Margin Calculator
            </h2>
            <p className="text-sm text-white/50">
              Real-time profitability analysis per product
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <ArrowClockwise size={16} weight="bold" />
          <span>Updated {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-400 mb-1">Average Margin</p>
                <p className="text-2xl font-bold text-blue-300">
                  {formatPercent(summary.avgProfitMargin)}
                </p>
              </div>
              <CurrencyDollar
                size={32}
                weight="bold"
                className="text-blue-400 opacity-50"
              />
            </div>
            <p className="text-xs text-blue-400/70 mt-2">
              {summary.productsWithCosts} of {summary.totalProducts} products
              tracked
            </p>
          </div>

          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-400 mb-1">Total Potential</p>
                <p className="text-2xl font-bold text-green-300">
                  {formatCurrency(summary.totalPotentialProfit)}
                </p>
              </div>
              <Package
                size={32}
                weight="bold"
                className="text-green-400 opacity-50"
              />
            </div>
            <p className="text-xs text-green-400/70 mt-2">
              From current inventory
            </p>
          </div>

          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-400 mb-1">Low Margin</p>
                <p className="text-2xl font-bold text-yellow-300">
                  {summary.lowMarginCount}
                </p>
              </div>
              <Warning
                size={32}
                weight="bold"
                className="text-yellow-400 opacity-50"
              />
            </div>
            <p className="text-xs text-yellow-400/70 mt-2">
              Products under 20% margin
            </p>
          </div>

          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-400 mb-1">Negative Profit</p>
                <p className="text-2xl font-bold text-red-300">
                  {summary.negativeProfitCount}
                </p>
              </div>
              <Warning
                size={32}
                weight="bold"
                className="text-red-400 opacity-50"
              />
            </div>
            <p className="text-xs text-red-400/70 mt-2">Products losing money</p>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-white/50">Sort by:</span>
        <button
          onClick={() => handleSort("name")}
          className={`px-3 py-1 rounded flex items-center gap-1 transition-colors ${
            sortField === "name"
              ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
              : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
          }`}
        >
          Name
          {sortField === "name" && <ArrowsDownUp className="w-3 h-3" />}
        </button>
        <button
          onClick={() => handleSort("margin")}
          className={`px-3 py-1 rounded flex items-center gap-1 transition-colors ${
            sortField === "margin"
              ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
              : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
          }`}
        >
          Margin %
          {sortField === "margin" && <ArrowsDownUp className="w-3 h-3" />}
        </button>
        <button
          onClick={() => handleSort("profit")}
          className={`px-3 py-1 rounded flex items-center gap-1 transition-colors ${
            sortField === "profit"
              ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
              : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
          }`}
        >
          Profit/Unit
          {sortField === "profit" && <ArrowsDownUp className="w-3 h-3" />}
        </button>
        <button
          onClick={() => handleSort("potential")}
          className={`px-3 py-1 rounded flex items-center gap-1 transition-colors ${
            sortField === "potential"
              ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
              : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
          }`}
        >
          Potential Profit
          {sortField === "potential" && <ArrowsDownUp className="w-3 h-3" />}
        </button>
      </div>

      {/* Products Table */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {sortedProducts.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <Package
              size={48}
              weight="bold"
              className="mx-auto mb-3 opacity-30"
            />
            <p>No products with cost tracking yet</p>
            <p className="text-sm mt-1">
              Add cost prices to products to see profit analysis
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {sortedProducts.map((product) => (
              <motion.div
                key={product.productId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`rounded-lg border transition-all ${getMarginBg(
                  product.profitMargin
                )} border-white/10`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white truncate">
                          {product.name}
                        </h3>
                        {product.isLimitedEdition && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/30">
                            Limited
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/50">
                        SKU: {product.sku} · {product.category || "Uncategorized"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Profit Margin */}
                      <div className="text-right">
                        <p className="text-xs text-white/50">Margin</p>
                        <p
                          className={`text-lg font-bold ${getMarginColor(
                            product.profitMargin
                          )}`}
                        >
                          {formatPercent(product.profitMargin)}
                        </p>
                      </div>

                      {/* Profit Per Unit */}
                      <div className="text-right">
                        <p className="text-xs text-white/50">Profit/Unit</p>
                        <p
                          className={`text-lg font-bold ${getMarginColor(
                            product.profitMargin
                          )}`}
                        >
                          {formatCurrency(product.profitPerUnit)}
                        </p>
                      </div>

                      {/* Potential Profit */}
                      <div className="text-right">
                        <p className="text-xs text-white/50">Potential</p>
                        <p className="text-lg font-bold text-white">
                          {formatCurrency(product.potentialProfit)}
                        </p>
                        <p className="text-xs text-white/50">
                          ({product.totalInventory} units)
                        </p>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() =>
                          setExpandedProduct(
                            expandedProduct === product.productId
                              ? null
                              : product.productId
                          )
                        }
                        className="p-2 hover:bg-white/10 rounded transition-colors"
                      >
                        <PencilSimple
                          size={16}
                          weight="bold"
                          className="text-white/70"
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Variant Details */}
                  {expandedProduct === product.productId &&
                    product.hasVariants &&
                    product.variants && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-sm font-medium text-white/70 mb-2">
                          Variant Breakdown:
                        </p>
                        <div className="space-y-2">
                          {product.variants.map((variant) => (
                            <div
                              key={variant.variantId}
                              className="flex items-center justify-between text-sm bg-white/5 rounded p-2"
                            >
                              <div>
                                <span className="font-medium text-white">
                                  {variant.size} {variant.color}
                                </span>
                                <span className="text-white/50 ml-2">
                                  ({variant.sku})
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <span
                                  className={getMarginColor(variant.profitMargin)}
                                >
                                  {formatPercent(variant.profitMargin)}
                                </span>
                                <span className="text-white/70">
                                  {formatCurrency(variant.profitPerUnit)}/unit
                                </span>
                                <span className="text-white/70">
                                  {variant.inventory} in stock
                                </span>
                                <span className="font-medium text-white">
                                  {formatCurrency(variant.potentialProfit)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Tips */}
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex items-start gap-2 text-sm text-white/70">
          <Warning size={16} weight="bold" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-1 text-white">
              Profitability Guidelines:
            </p>
            <ul className="space-y-1 text-xs">
              <li>
                <span className="text-green-400 font-medium">40%+</span> =
                Excellent margin
              </li>
              <li>
                <span className="text-yellow-400 font-medium">20-40%</span> =
                Good margin
              </li>
              <li>
                <span className="text-orange-400 font-medium">&lt;20%</span> =
                Low margin - consider price increase
              </li>
              <li>
                <span className="text-red-400 font-medium">Negative</span> =
                Losing money - adjust pricing or costs
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
