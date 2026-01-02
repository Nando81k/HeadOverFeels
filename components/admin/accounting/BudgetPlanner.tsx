'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Target, 
  TrendingUp, 
  Calendar, 
  DollarSign,
  Trash2,
  Edit2,
  X,
  Check,
  AlertCircle,
  PieChart,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

type BudgetPeriod = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

interface ExpenseCategory {
  id: string
  name: string
  color: string
}

interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  period: BudgetPeriod
  startDate: string
  endDate: string
  categoryId?: string
  category?: ExpenseCategory
  isActive: boolean
  alertThreshold: number
}

interface BudgetSummary {
  totalBudgets: number
  totalAllocated: number
  totalSpent: number
  overBudgetCount: number
}

const periodLabels = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly'
}

export function BudgetPlanner() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [summary, setSummary] = useState<BudgetSummary>({ totalBudgets: 0, totalAllocated: 0, totalSpent: 0, overBudgetCount: 0 })
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accounting/budgets')
      if (res.ok) {
        const data = await res.json()
        setBudgets(data.budgets || [])
        setSummary(data.summary || { totalBudgets: 0, totalAllocated: 0, totalSpent: 0, overBudgetCount: 0 })
      }
    } catch (error) {
      console.error('Error fetching budgets:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/accounting/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchBudgets()
  }, [fetchBudgets])

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return

    try {
      const res = await fetch(`/api/admin/accounting/budgets/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchBudgets()
      }
    } catch (error) {
      console.error('Error deleting budget:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getProgressPercentage = (budget: Budget) => {
    if (budget.amount === 0) return 0
    return Math.min((budget.spent / budget.amount) * 100, 100)
  }

  const isOverBudget = (budget: Budget) => budget.spent > budget.amount
  const isNearLimit = (budget: Budget) => {
    const percentage = (budget.spent / budget.amount) * 100
    return percentage >= budget.alertThreshold && percentage < 100
  }

  const getProgressColor = (budget: Budget) => {
    if (isOverBudget(budget)) return 'from-red-500 to-red-600'
    if (isNearLimit(budget)) return 'from-amber-500 to-amber-600'
    return 'from-emerald-500 to-emerald-600'
  }

  const remainingBudget = summary.totalAllocated - summary.totalSpent
  const utilizationPercentage = summary.totalAllocated > 0 
    ? ((summary.totalSpent / summary.totalAllocated) * 100).toFixed(1) 
    : 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-violet-600/20 to-violet-700/20 border border-violet-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-300 text-sm font-medium">Total Allocated</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary.totalAllocated)}</p>
            </div>
            <div className="bg-violet-500/20 p-3 rounded-lg">
              <Target className="h-6 w-6 text-violet-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 border border-blue-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Total Spent</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary.totalSpent)}</p>
            </div>
            <div className="bg-blue-500/20 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`bg-gradient-to-br ${remainingBudget >= 0 ? 'from-emerald-600/20 to-emerald-700/20 border-emerald-500/20' : 'from-red-600/20 to-red-700/20 border-red-500/20'} border rounded-xl p-6`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`${remainingBudget >= 0 ? 'text-emerald-300' : 'text-red-300'} text-sm font-medium`}>Remaining</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(Math.abs(remainingBudget))}</p>
            </div>
            <div className={`${remainingBudget >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'} p-3 rounded-lg`}>
              {remainingBudget >= 0 ? (
                <ArrowDown className="h-6 w-6 text-emerald-400" />
              ) : (
                <ArrowUp className="h-6 w-6 text-red-400" />
              )}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-fuchsia-600/20 to-fuchsia-700/20 border border-fuchsia-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-fuchsia-300 text-sm font-medium">Utilization</p>
              <p className="text-3xl font-bold mt-1 text-white">{utilizationPercentage}%</p>
            </div>
            <div className="bg-fuchsia-500/20 p-3 rounded-lg">
              <PieChart className="h-6 w-6 text-fuchsia-400" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Budget Categories</h3>
          <p className="text-sm text-white/50">{summary.totalBudgets} active budgets</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white rounded-lg hover:from-fuchsia-500 hover:to-violet-500 transition-all shadow-lg shadow-fuchsia-500/25"
        >
          <Plus className="h-4 w-4" />
          Add Budget
        </button>
      </div>

      {/* Over Budget Alert */}
      {summary.overBudgetCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
        >
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400">
            <span className="font-semibold">{summary.overBudgetCount} budget{summary.overBudgetCount > 1 ? 's' : ''}</span> exceeded the allocated amount
          </p>
        </motion.div>
      )}

      {/* Budgets List */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/50">
            <div className="w-6 h-6 border-2 border-white/20 border-t-fuchsia-500 rounded-full animate-spin mx-auto mb-3" />
            Loading budgets...
          </div>
        ) : budgets.length === 0 ? (
          <div className="p-8 text-center">
            <Target className="h-12 w-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50">No budgets created yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-fuchsia-400 hover:text-fuchsia-300 font-medium transition-colors"
            >
              Create your first budget
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {budgets.map((budget, index) => (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: (budget.category?.color || '#8b5cf6') + '30' }}
                    >
                      <Target 
                        className="h-5 w-5" 
                        style={{ color: budget.category?.color || '#8b5cf6' }} 
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{budget.name}</h4>
                      <div className="flex items-center gap-2 mt-1 text-sm text-white/50">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {periodLabels[budget.period]}
                        </span>
                        {budget.category && (
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ 
                              backgroundColor: budget.category.color + '30',
                              color: budget.category.color 
                            }}
                          >
                            {budget.category.name}
                          </span>
                        )}
                        {isOverBudget(budget) && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                            Over Budget
                          </span>
                        )}
                        {isNearLimit(budget) && !isOverBudget(budget) && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                            Near Limit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">
                        {formatCurrency(budget.spent)} <span className="text-white/40 text-sm">/ {formatCurrency(budget.amount)}</span>
                      </p>
                      <p className="text-xs text-white/40">
                        {formatCurrency(Math.max(0, budget.amount - budget.spent))} remaining
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingBudget(budget)}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBudget(budget.id)}
                        className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-white/40 mb-1">
                    <span>{getProgressPercentage(budget).toFixed(0)}% used</span>
                    <span>Alert at {budget.alertThreshold}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(getProgressPercentage(budget), 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`h-full bg-gradient-to-r ${getProgressColor(budget)} rounded-full`}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || editingBudget) && (
          <BudgetModal
            budget={editingBudget}
            categories={categories}
            onClose={() => { setShowAddModal(false); setEditingBudget(null); }}
            onSave={() => { setShowAddModal(false); setEditingBudget(null); fetchBudgets(); }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

interface BudgetModalProps {
  budget: Budget | null
  categories: ExpenseCategory[]
  onClose: () => void
  onSave: () => void
}

function BudgetModal({ budget, categories, onClose, onSave }: BudgetModalProps) {
  const [formData, setFormData] = useState({
    name: budget?.name || '',
    amount: budget?.amount?.toString() || '',
    period: budget?.period || 'MONTHLY',
    startDate: budget?.startDate ? budget.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
    endDate: budget?.endDate ? budget.endDate.split('T')[0] : '',
    categoryId: budget?.categoryId || '',
    alertThreshold: budget?.alertThreshold?.toString() || '80',
    isActive: budget?.isActive ?? true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.amount) {
      setError('Name and amount are required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const url = budget 
        ? `/api/admin/accounting/budgets/${budget.id}`
        : '/api/admin/accounting/budgets'
      
      const res = await fetch(url, {
        method: budget ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          alertThreshold: parseInt(formData.alertThreshold),
          categoryId: formData.categoryId || null
        })
      })

      if (res.ok) {
        onSave()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save budget')
      }
    } catch {
      setError('Failed to save budget')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all"
  const selectClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all [&>option]:bg-neutral-900 [&>option]:text-white"
  const labelClass = "block text-sm font-medium text-white/70 mb-1.5"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-neutral-900 border border-white/10 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              {budget ? 'Edit Budget' : 'Create New Budget'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Budget Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
              placeholder="e.g., Marketing Budget Q1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amount *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className={`${inputClass} pl-10`}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Period</label>
              <select
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value as BudgetPeriod })}
                className={selectClass}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category (Optional)</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className={selectClass}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Alert Threshold %</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.alertThreshold}
                onChange={(e) => setFormData({ ...formData, alertThreshold: e.target.value })}
                className={inputClass}
                placeholder="80"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-fuchsia-500 focus:ring-fuchsia-500/50"
            />
            <span className="text-sm text-white/70 group-hover:text-white transition-colors">Active Budget</span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white rounded-lg hover:from-fuchsia-500 hover:to-violet-500 disabled:opacity-50 transition-all shadow-lg shadow-fuchsia-500/25"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {budget ? 'Update' : 'Create'} Budget
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
