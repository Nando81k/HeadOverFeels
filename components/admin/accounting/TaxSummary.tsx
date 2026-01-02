'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Download,
  PieChart
} from 'lucide-react'

interface TaxSummaryData {
  totalRevenue: number
  totalExpenses: number
  taxableIncome: number
  estimatedTax: number
  taxDeductibleExpenses: number
  nonDeductibleExpenses: number
  effectiveTaxRate: number
  expensesByCategory: Array<{
    category: string
    amount: number
    isDeductible: boolean
  }>
  quarterlyBreakdown: Array<{
    quarter: string
    revenue: number
    expenses: number
    taxableIncome: number
  }>
}

export function TaxSummary() {
  const [summary, setSummary] = useState<TaxSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [taxRate, setTaxRate] = useState(25)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/accounting/summary?year=${year}`)
      if (res.ok) {
        const data = await res.json()
        // Calculate tax-specific metrics
        const taxableIncome = Math.max(0, data.totalRevenue - data.taxDeductibleExpenses)
        const estimatedTax = taxableIncome * (taxRate / 100)
        
        setSummary({
          ...data,
          taxableIncome,
          estimatedTax,
          effectiveTaxRate: data.totalRevenue > 0 
            ? (estimatedTax / data.totalRevenue * 100) 
            : 0
        })
      }
    } catch (error) {
      console.error('Error fetching tax summary:', error)
    } finally {
      setLoading(false)
    }
  }, [year, taxRate])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
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

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Tax Summary</h3>
          <p className="text-sm text-white/50">Estimated tax obligations and deductions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/70">Year:</label>
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
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/70">Tax Rate:</label>
            <select
              value={taxRate}
              onChange={(e) => setTaxRate(parseInt(e.target.value))}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-fuchsia-500/50 [&>option]:bg-neutral-900 [&>option]:text-white"
            >
              <option value={15}>15%</option>
              <option value={20}>20%</option>
              <option value={25}>25%</option>
              <option value={30}>30%</option>
              <option value={35}>35%</option>
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

      {/* Main Tax Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border border-emerald-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-300 text-sm font-medium">Total Revenue</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary?.totalRevenue || 0)}</p>
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
              <p className="text-rose-300 text-sm font-medium">Tax Deductible</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary?.taxDeductibleExpenses || 0)}</p>
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
          className="bg-gradient-to-br from-violet-600/20 to-violet-700/20 border border-violet-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-300 text-sm font-medium">Taxable Income</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary?.taxableIncome || 0)}</p>
            </div>
            <div className="bg-violet-500/20 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-violet-400" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Estimated Tax Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-neutral-900 border border-white/10 rounded-xl p-6"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="bg-amber-500/20 p-4 rounded-xl">
              <Calculator className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Estimated Tax Liability</h4>
              <p className="text-sm text-white/50 mt-1">Based on {taxRate}% tax rate</p>
              <p className="text-4xl font-bold text-white mt-3">{formatCurrency(summary?.estimatedTax || 0)}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="px-3 py-1.5 bg-amber-500/20 rounded-lg inline-block">
              <p className="text-sm font-medium text-amber-400">
                Effective Rate: {formatPercentage(summary?.effectiveTaxRate || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Tax Breakdown */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <p className="text-sm text-white/70">Deductible Expenses</p>
              </div>
              <p className="text-xl font-semibold text-white">{formatCurrency(summary?.taxDeductibleExpenses || 0)}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <p className="text-sm text-white/70">Non-Deductible</p>
              </div>
              <p className="text-xl font-semibold text-white">{formatCurrency(summary?.nonDeductibleExpenses || 0)}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="h-4 w-4 text-fuchsia-400" />
                <p className="text-sm text-white/70">Tax Savings</p>
              </div>
              <p className="text-xl font-semibold text-emerald-400">
                {formatCurrency((summary?.taxDeductibleExpenses || 0) * (taxRate / 100))}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quarterly Breakdown */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-white/50" />
            <h4 className="font-medium text-white">Quarterly Breakdown</h4>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => {
              const qData = summary?.quarterlyBreakdown?.[index] || {
                revenue: 0,
                expenses: 0,
                taxableIncome: 0
              }
              return (
                <motion.div
                  key={quarter}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="p-4 bg-white/5 rounded-lg"
                >
                  <p className="text-sm font-medium text-white/50 mb-3">{quarter} {year}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/40">Revenue</span>
                      <span className="text-sm font-medium text-emerald-400">{formatCurrency(qData.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/40">Expenses</span>
                      <span className="text-sm font-medium text-rose-400">{formatCurrency(qData.expenses)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/10">
                      <span className="text-xs text-white/40">Taxable</span>
                      <span className="text-sm font-medium text-white">{formatCurrency(qData.taxableIncome)}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tax Tips */}
      <div className="bg-gradient-to-r from-blue-600/10 to-violet-600/10 border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-500/20 p-3 rounded-lg flex-shrink-0">
            <FileText className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">Tax Planning Tips</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                Mark expenses as tax-deductible to maximize your deductions
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                Review quarterly breakdowns to plan estimated tax payments
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                Keep receipts for all deductible expenses for audit protection
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                These estimates are for planning only. Consult a tax professional.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
