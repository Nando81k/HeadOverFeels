'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  Download,
  FileSpreadsheet,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Wallet
} from 'lucide-react'

interface FinancialReport {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
  revenueGrowth: number
  expenseGrowth: number
  monthlyTrend: Array<{
    month: string
    revenue: number
    expenses: number
    profit: number
  }>
  expensesByCategory: Array<{
    category: string
    amount: number
    percentage: number
    color: string
  }>
  topExpenses: Array<{
    description: string
    amount: number
    category: string
    date: string
  }>
}

type ReportPeriod = 'month' | 'quarter' | 'year'

export function FinancialReports() {
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const [year, setYear] = useState(new Date().getFullYear())

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/accounting/summary?year=${year}&period=${period}`)
      if (res.ok) {
        const data = await res.json()
        
        // Calculate additional metrics
        const netProfit = data.totalRevenue - data.totalExpenses
        const profitMargin = data.totalRevenue > 0 
          ? (netProfit / data.totalRevenue * 100) 
          : 0
        
        setReport({
          ...data,
          netProfit,
          profitMargin,
          revenueGrowth: data.revenueGrowth || 0,
          expenseGrowth: data.expenseGrowth || 0
        })
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }, [year, period])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const currentYear = new Date().getFullYear()
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-white/20 border-t-fuchsia-500 rounded-full animate-spin" />
      </div>
    )
  }

  const maxMonthlyValue = Math.max(
    ...(report?.monthlyTrend || []).flatMap(m => [m.revenue, m.expenses])
  ) || 1

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Financial Reports</h3>
          <p className="text-sm text-white/50">Comprehensive P&L and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-fuchsia-500/50 [&>option]:bg-neutral-900 [&>option]:text-white"
            >
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-fuchsia-500/50 [&>option]:bg-neutral-900 [&>option]:text-white"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border border-emerald-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-300 text-sm font-medium">Revenue</p>
              <p className="text-2xl font-bold mt-1 text-white">{formatCurrency(report?.totalRevenue || 0)}</p>
              <div className="flex items-center gap-1 mt-2">
                {(report?.revenueGrowth || 0) >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-400" />
                )}
                <span className={`text-sm ${(report?.revenueGrowth || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPercentage(report?.revenueGrowth || 0)}
                </span>
              </div>
            </div>
            <div className="bg-emerald-500/20 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-rose-600/20 to-rose-700/20 border border-rose-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-300 text-sm font-medium">Expenses</p>
              <p className="text-2xl font-bold mt-1 text-white">{formatCurrency(report?.totalExpenses || 0)}</p>
              <div className="flex items-center gap-1 mt-2">
                {(report?.expenseGrowth || 0) <= 0 ? (
                  <ArrowDownRight className="h-4 w-4 text-emerald-400" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-red-400" />
                )}
                <span className={`text-sm ${(report?.expenseGrowth || 0) <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPercentage(report?.expenseGrowth || 0)}
                </span>
              </div>
            </div>
            <div className="bg-rose-500/20 p-3 rounded-lg">
              <TrendingDown className="h-6 w-6 text-rose-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`bg-gradient-to-br ${(report?.netProfit || 0) >= 0 ? 'from-blue-600/20 to-blue-700/20 border-blue-500/20' : 'from-amber-600/20 to-amber-700/20 border-amber-500/20'} border rounded-xl p-6`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`${(report?.netProfit || 0) >= 0 ? 'text-blue-300' : 'text-amber-300'} text-sm font-medium`}>Net Profit</p>
              <p className="text-2xl font-bold mt-1 text-white">{formatCurrency(report?.netProfit || 0)}</p>
              <p className="text-sm text-white/50 mt-2">
                {(report?.profitMargin || 0).toFixed(1)}% margin
              </p>
            </div>
            <div className={`${(report?.netProfit || 0) >= 0 ? 'bg-blue-500/20' : 'bg-amber-500/20'} p-3 rounded-lg`}>
              <Wallet className={`h-6 w-6 ${(report?.netProfit || 0) >= 0 ? 'text-blue-400' : 'text-amber-400'}`} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-violet-600/20 to-violet-700/20 border border-violet-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-300 text-sm font-medium">Profit Margin</p>
              <p className="text-2xl font-bold mt-1 text-white">{(report?.profitMargin || 0).toFixed(1)}%</p>
              <p className="text-sm text-white/50 mt-2">
                of total revenue
              </p>
            </div>
            <div className="bg-violet-500/20 p-3 rounded-lg">
              <PieChart className="h-6 w-6 text-violet-400" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Chart and Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expenses Chart */}
        <div className="lg:col-span-2 bg-neutral-900 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-white/50" />
              <h4 className="font-medium text-white">Revenue vs Expenses</h4>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-white/50">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-white/50">Expenses</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-end gap-2 h-64">
            {(report?.monthlyTrend || Array(12).fill({ month: '', revenue: 0, expenses: 0 })).map((month, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-1 items-end h-48">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(month.revenue / maxMonthlyValue) * 100}%` }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className="flex-1 bg-gradient-to-t from-emerald-600 to-emerald-500 rounded-t"
                  />
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(month.expenses / maxMonthlyValue) * 100}%` }}
                    transition={{ duration: 0.5, delay: index * 0.05 + 0.1 }}
                    className="flex-1 bg-gradient-to-t from-rose-600 to-rose-500 rounded-t"
                  />
                </div>
                <span className="text-xs text-white/40">{month.month || ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][index]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="h-5 w-5 text-white/50" />
            <h4 className="font-medium text-white">Expense Breakdown</h4>
          </div>
          
          <div className="space-y-4">
            {(report?.expensesByCategory || []).slice(0, 6).map((cat, index) => (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/70">{cat.category || 'Uncategorized'}</span>
                  <span className="text-sm font-medium text-white">{formatCurrency(cat.amount)}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.percentage}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: cat.color || '#8b5cf6' }}
                  />
                </div>
                <p className="text-xs text-white/40 mt-1">{cat.percentage.toFixed(1)}% of total</p>
              </motion.div>
            ))}

            {(!report?.expensesByCategory || report.expensesByCategory.length === 0) && (
              <div className="text-center py-8">
                <PieChart className="h-8 w-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-sm">No expense data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Expenses */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-white/50" />
            <h4 className="font-medium text-white">Top Expenses</h4>
          </div>
          <span className="text-sm text-white/50">Highest value transactions</span>
        </div>
        
        <div className="divide-y divide-white/5">
          {(report?.topExpenses || []).slice(0, 5).map((expense, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{expense.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-white/50">
                    <span>{expense.category || 'Uncategorized'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
                <p className="text-lg font-semibold text-white">{formatCurrency(expense.amount)}</p>
              </div>
            </motion.div>
          ))}

          {(!report?.topExpenses || report.topExpenses.length === 0) && (
            <div className="p-8 text-center">
              <DollarSign className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-white/40">No expenses recorded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
