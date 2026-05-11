'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, PencilSimple, Trash, X, Receipt, Tag, Stack } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/admin/DashboardCard'
import { toast } from '@/lib/toast'

// Local type definition for ExpenseCategory until Prisma schema is updated
type ExpenseCategory =
  | 'MANUFACTURING'
  | 'SHIPPING'
  | 'MARKETING'
  | 'PACKAGING'
  | 'PLATFORM_FEES'
  | 'HOSTING'
  | 'LABOR'
  | 'UTILITIES'
  | 'SUPPLIES'
  | 'RETURNS_REFUNDS'
  | 'OTHER'

interface Expense {
  id: string
  category: ExpenseCategory
  subcategory?: string | null
  amount: number
  description: string
  date: string
  vendor?: string | null
  invoiceNumber?: string | null
  notes?: string | null
  product?: { id: string; name: string; slug: string } | null
  order?: { id: string; orderNumber: string } | null
  createdAt: string
}

interface ExpenseSummary {
  byCategory: Array<{
    category: ExpenseCategory
    _sum: { amount: number | null }
    _count: { id: number }
  }>
  total: number
}

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; tone: string }[] = [
  { value: 'MANUFACTURING', label: 'Manufacturing', tone: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
  { value: 'SHIPPING', label: 'Shipping', tone: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
  { value: 'MARKETING', label: 'Marketing', tone: 'bg-pink-500/15 text-pink-300 border-pink-500/25' },
  { value: 'PACKAGING', label: 'Packaging', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  { value: 'PLATFORM_FEES', label: 'Platform Fees', tone: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' },
  { value: 'HOSTING', label: 'Hosting', tone: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' },
  { value: 'LABOR', label: 'Labor', tone: 'bg-red-500/15 text-red-300 border-red-500/25' },
  { value: 'UTILITIES', label: 'Utilities', tone: 'bg-teal-500/15 text-teal-300 border-teal-500/25' },
  { value: 'SUPPLIES', label: 'Supplies', tone: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
  { value: 'RETURNS_REFUNDS', label: 'Returns & Refunds', tone: 'bg-rose-500/15 text-rose-300 border-rose-500/25' },
  { value: 'OTHER', label: 'Other', tone: 'bg-white/5 text-white/65 border-white/15' },
]

const API_BASE = '/api/admin/accounting/expenses'

const EMPTY_FORM = {
  category: 'MANUFACTURING' as ExpenseCategory,
  subcategory: '',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  vendor: '',
  invoiceNumber: '',
  notes: '',
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [formData, setFormData] = useState(EMPTY_FORM)

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterCategory) params.append('category', filterCategory)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`${API_BASE}?${params}`)
      const data = await response.json()
      if (data.data) {
        setExpenses(data.data)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, startDate, endDate])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingId(null)
  }

  const startEdit = (expense: Expense) => {
    setFormData({
      category: expense.category,
      subcategory: expense.subcategory ?? '',
      amount: String(expense.amount),
      description: expense.description,
      date: expense.date.split('T')[0],
      vendor: expense.vendor ?? '',
      invoiceNumber: expense.invoiceNumber ?? '',
      notes: expense.notes ?? '',
    })
    setEditingId(expense.id)
    setShowForm(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const isEdit = !!editingId
      const url = isEdit ? `${API_BASE}/${editingId}` : API_BASE
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          subcategory: formData.subcategory || null,
          vendor: formData.vendor || null,
          invoiceNumber: formData.invoiceNumber || null,
          notes: formData.notes || null,
        }),
      })

      if (response.ok) {
        toast.success(isEdit ? 'Expense updated' : 'Expense added')
        setShowForm(false)
        resetForm()
        fetchExpenses()
      } else {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error ?? `Failed to ${isEdit ? 'update' : 'add'} expense`)
      }
    } catch (error) {
      console.error('Error saving expense:', error)
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Expense deleted')
        if (editingId === id) {
          setShowForm(false)
          resetForm()
        }
        fetchExpenses()
      } else {
        toast.error('Failed to delete expense')
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Something went wrong')
    }
  }

  const getCategoryInfo = (category: ExpenseCategory) => {
    return EXPENSE_CATEGORIES.find((c) => c.value === category) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const transactionCount = summary?.byCategory.reduce((sum, cat) => sum + cat._count.id, 0) ?? 0

  return (
    <AdminLayout title="Expenses" subtitle="Track and manage all store expenses">
      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard
          title="Total Expenses"
          value={summary ? formatCurrency(summary.total) : '—'}
          icon={<Receipt weight="bold" />}
        />
        <StatCard
          title="Transactions"
          value={summary ? transactionCount : '—'}
          icon={<Stack weight="bold" />}
        />
        <StatCard
          title="Categories"
          value={summary ? summary.byCategory.length : '—'}
          icon={<Tag weight="bold" />}
        />
      </div>

      {/* Category breakdown */}
      {summary && summary.byCategory.length > 0 && (
        <div className="bg-neutral-900 border border-white/10 mb-6 sm:mb-8">
          <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/10">
            <h3 className="text-[10px] sm:text-xs font-medium tracking-[0.15em] text-white/70 uppercase">
              Expenses by category
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3 sm:p-5">
            {summary.byCategory.map((cat) => {
              const info = getCategoryInfo(cat.category)
              return (
                <div key={cat.category} className="border border-white/10 p-3">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2 border ${info.tone}`}>
                    {info.label}
                  </span>
                  <p className="text-base font-bold text-white">{formatCurrency(cat._sum.amount || 0)}</p>
                  <p className="text-xs text-white/40">{cat._count.id} transactions</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions + filters */}
      <div className="bg-neutral-900 border border-white/10 mb-6 sm:mb-8 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <button
            type="button"
            onClick={() => {
              if (showForm && !editingId) {
                setShowForm(false)
              } else {
                resetForm()
                setShowForm(true)
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-10 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-colors"
          >
            {showForm && !editingId ? (
              <>
                <X size={14} weight="bold" />
                Cancel
              </>
            ) : (
              <>
                <Plus size={14} weight="bold" />
                Add expense
              </>
            )}
          </button>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>

        {/* Add / edit form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="border-t border-white/10 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/70">
                {editingId ? 'Edit expense' : 'New expense'}
              </h4>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Category *">
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as ExpenseCategory })
                  }
                  required
                  className="w-full px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Amount *">
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  placeholder="0.00"
                  className="w-full px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </FormField>

              <FormField label="Description *">
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  placeholder="Brief description"
                  className="w-full px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </FormField>

              <FormField label="Date *">
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </FormField>

              <FormField label="Vendor">
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="Company or person paid"
                  className="w-full px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </FormField>

              <FormField label="Invoice #">
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  placeholder="Reference number"
                  className="w-full px-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </FormField>

              <div className="md:col-span-2">
                <FormField label="Notes">
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    placeholder="Additional details"
                    className="w-full px-3 py-2 bg-neutral-950 border border-white/15 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                </FormField>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 h-10 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add expense'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Expenses table */}
      <div className="bg-neutral-900 border border-white/10 overflow-hidden">
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/10">
          <h3 className="text-[10px] sm:text-xs font-medium tracking-[0.15em] text-white/70 uppercase">
            Recent expenses
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-white/40">Loading expenses…</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/40">No expenses found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/40">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/40">Category</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/40">Description</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/40 hidden md:table-cell">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/40">Amount</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {expenses.map((expense) => {
                  const info = getCategoryInfo(expense.category)
                  return (
                    <tr key={expense.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-white/85">{formatDate(expense.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${info.tone}`}>
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/85">
                        {expense.description}
                        {expense.invoiceNumber && (
                          <span className="block text-[10px] text-white/40">#{expense.invoiceNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-white/65 hidden md:table-cell">
                        {expense.vendor || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-right text-white">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(expense)}
                            className="inline-flex items-center justify-center w-7 h-7 text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                            aria-label="Edit expense"
                            title="Edit"
                          >
                            <PencilSimple size={13} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(expense.id)}
                            className="inline-flex items-center justify-center w-7 h-7 text-white/55 hover:text-rose-400 hover:bg-white/10 transition-colors"
                            aria-label="Delete expense"
                            title="Delete"
                          >
                            <Trash size={13} weight="bold" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1">{label}</label>
      {children}
    </div>
  )
}
