'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Filter, 
  Receipt, 
  Calendar, 
  DollarSign,
  Tag,
  Trash2,
  Edit2,
  X,
  Check,
  Building,
  AlertCircle
} from 'lucide-react'

type ExpenseStatus = 'RECORDED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAID'

interface ExpenseCategory {
  id: string
  name: string
  color: string
  icon?: string
}

interface Expense {
  id: string
  description: string
  amount: number
  date: string
  vendor?: string
  categoryId?: string
  category?: ExpenseCategory
  status: ExpenseStatus
  isTaxDeductible: boolean
  isRecurring: boolean
  receiptUrl?: string
  notes?: string
}

interface ExpensesSummary {
  totalExpenses: number
  expenseCount: number
}

const statusColors = {
  RECORDED: 'bg-white/10 text-white/70',
  PENDING_APPROVAL: 'bg-amber-500/20 text-amber-400',
  APPROVED: 'bg-blue-500/20 text-blue-400',
  REJECTED: 'bg-red-500/20 text-red-400',
  PAID: 'bg-emerald-500/20 text-emerald-400'
}

const statusLabels = {
  RECORDED: 'Recorded',
  PENDING_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAID: 'Paid'
}

export function ExpenseTracker() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [summary, setSummary] = useState<ExpensesSummary>({ totalExpenses: 0, expenseCount: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const fetchExpenses = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter) params.append('status', statusFilter)
      if (categoryFilter) params.append('categoryId', categoryFilter)

      const res = await fetch(`/api/admin/accounting/expenses?${params}`)
      if (res.ok) {
        const data = await res.json()
        setExpenses(data.expenses || [])
        setSummary(data.summary || { totalExpenses: 0, expenseCount: 0 })
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, statusFilter, categoryFilter])

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
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      const res = await fetch(`/api/admin/accounting/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchExpenses()
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-rose-600/20 to-rose-700/20 border border-rose-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-300 text-sm font-medium">Total Expenses</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary.totalExpenses)}</p>
            </div>
            <div className="bg-rose-500/20 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-rose-400" />
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
              <p className="text-blue-300 text-sm font-medium">Expense Count</p>
              <p className="text-3xl font-bold mt-1 text-white">{summary.expenseCount}</p>
            </div>
            <div className="bg-blue-500/20 p-3 rounded-lg">
              <Receipt className="h-6 w-6 text-blue-400" />
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
              <p className="text-violet-300 text-sm font-medium">Categories</p>
              <p className="text-3xl font-bold mt-1 text-white">{categories.length}</p>
            </div>
            <div className="bg-violet-500/20 p-3 rounded-lg">
              <Tag className="h-6 w-6 text-violet-400" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showFilters || statusFilter || categoryFilter 
                ? 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-300' 
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {(statusFilter || categoryFilter) && (
              <span className="bg-fuchsia-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {[statusFilter, categoryFilter].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white rounded-lg hover:from-fuchsia-500 hover:to-violet-500 transition-all shadow-lg shadow-fuchsia-500/25"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-white/70">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-fuchsia-500/50 [&>option]:bg-neutral-900 [&>option]:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="RECORDED">Recorded</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-white/70">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-fuchsia-500/50 [&>option]:bg-neutral-900 [&>option]:text-white"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              {(statusFilter || categoryFilter) && (
                <button
                  onClick={() => { setStatusFilter(''); setCategoryFilter(''); }}
                  className="self-end px-3 py-2 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expenses List */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/50">
            <div className="w-6 h-6 border-2 border-white/20 border-t-fuchsia-500 rounded-full animate-spin mx-auto mb-3" />
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="h-12 w-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50">No expenses found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-fuchsia-400 hover:text-fuchsia-300 font-medium transition-colors"
            >
              Add your first expense
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {expenses.map((expense, index) => (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: (expense.category?.color || '#6b7280') + '30' }}
                    >
                      <Receipt 
                        className="h-5 w-5" 
                        style={{ color: expense.category?.color || '#9ca3af' }} 
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{expense.description}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-white/50">
                        {expense.vendor && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {expense.vendor}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(expense.date)}
                        </span>
                        {expense.category && (
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ 
                              backgroundColor: expense.category.color + '30',
                              color: expense.category.color 
                            }}
                          >
                            {expense.category.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[expense.status]}`}>
                          {statusLabels[expense.status]}
                        </span>
                        {expense.isTaxDeductible && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            Tax Deductible
                          </span>
                        )}
                        {expense.isRecurring && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-500/20 text-violet-400">
                            Recurring
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-white">
                      {formatCurrency(expense.amount)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingExpense(expense)}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || editingExpense) && (
          <ExpenseModal
            expense={editingExpense}
            categories={categories}
            onClose={() => { setShowAddModal(false); setEditingExpense(null); }}
            onSave={() => { setShowAddModal(false); setEditingExpense(null); fetchExpenses(); }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

interface ExpenseModalProps {
  expense: Expense | null
  categories: ExpenseCategory[]
  onClose: () => void
  onSave: () => void
}

function ExpenseModal({ expense, categories, onClose, onSave }: ExpenseModalProps) {
  // Find the Uncategorized category to use as default
  const uncategorizedCategory = categories.find(c => c.name === 'Uncategorized' || c.name.toLowerCase() === 'uncategorized')
  const defaultCategoryId = expense?.categoryId || uncategorizedCategory?.id || categories[0]?.id || ''

  const [formData, setFormData] = useState({
    description: expense?.description || '',
    amount: expense?.amount?.toString() || '',
    date: expense?.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
    vendor: expense?.vendor || '',
    categoryId: defaultCategoryId,
    status: expense?.status || 'RECORDED',
    isTaxDeductible: expense?.isTaxDeductible || false,
    isRecurring: expense?.isRecurring || false,
    notes: expense?.notes || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.description || !formData.amount) {
      setError('Description and amount are required')
      return
    }
    if (!formData.categoryId) {
      setError('Please select a category')
      return
    }

    setSaving(true)
    setError('')

    try {
      const url = expense 
        ? `/api/admin/accounting/expenses/${expense.id}`
        : '/api/admin/accounting/expenses'
      
      const res = await fetch(url, {
        method: expense ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          categoryId: formData.categoryId
        })
      })

      if (res.ok) {
        onSave()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save expense')
      }
    } catch {
      setError('Failed to save expense')
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
              {expense ? 'Edit Expense' : 'Add New Expense'}
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
            <label className={labelClass}>Description *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={inputClass}
              placeholder="What was this expense for?"
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
              <label className={labelClass}>Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Vendor</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className={inputClass}
              placeholder="Company or person paid"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category *</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className={selectClass}
                required
              >
                {categories.length === 0 ? (
                  <option value="">No categories available</option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ExpenseStatus })}
                className={selectClass}
              >
                <option value="RECORDED">Recorded</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={formData.isTaxDeductible}
                onChange={(e) => setFormData({ ...formData, isTaxDeductible: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-fuchsia-500 focus:ring-fuchsia-500/50"
              />
              <span className="text-sm text-white/70 group-hover:text-white transition-colors">Tax Deductible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-fuchsia-500 focus:ring-fuchsia-500/50"
              />
              <span className="text-sm text-white/70 group-hover:text-white transition-colors">Recurring</span>
            </label>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Additional details..."
            />
          </div>

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
                  {expense ? 'Update' : 'Add'} Expense
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
