'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  DollarSign,
  User,
  Trash2,
  Edit2,
  X,
  Check,
  Send,
  Download,
  Eye,
  AlertCircle,
  Mail
} from 'lucide-react'

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'

interface Invoice {
  id: string
  invoiceNumber: string
  customerId?: string
  customerName: string
  customerEmail?: string
  amount: number
  tax: number
  total: number
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  paidDate?: string
  notes?: string
  lineItems?: string
}

interface InvoiceSummary {
  totalInvoices: number
  totalAmount: number
  paidAmount: number
  pendingAmount: number
}

const statusColors = {
  DRAFT: 'bg-white/10 text-white/70',
  SENT: 'bg-blue-500/20 text-blue-400',
  PAID: 'bg-emerald-500/20 text-emerald-400',
  OVERDUE: 'bg-red-500/20 text-red-400',
  CANCELLED: 'bg-neutral-500/20 text-neutral-400'
}

const statusLabels = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled'
}

export function InvoiceManager() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<InvoiceSummary>({ totalInvoices: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter) params.append('status', statusFilter)

      const res = await fetch(`/api/admin/accounting/invoices?${params}`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
        setSummary(data.summary || { totalInvoices: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 })
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, statusFilter])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return

    try {
      const res = await fetch(`/api/admin/accounting/invoices/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchInvoices()
      }
    } catch (error) {
      console.error('Error deleting invoice:', error)
    }
  }

  const handleStatusChange = async (invoice: Invoice, newStatus: InvoiceStatus) => {
    try {
      const res = await fetch(`/api/admin/accounting/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          paidDate: newStatus === 'PAID' ? new Date().toISOString() : null
        })
      })
      if (res.ok) {
        fetchInvoices()
      }
    } catch (error) {
      console.error('Error updating invoice:', error)
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

  const isOverdue = (invoice: Invoice) => {
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') return false
    return new Date(invoice.dueDate) < new Date()
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 border border-blue-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Total Invoices</p>
              <p className="text-3xl font-bold mt-1 text-white">{summary.totalInvoices}</p>
            </div>
            <div className="bg-blue-500/20 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-violet-600/20 to-violet-700/20 border border-violet-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-300 text-sm font-medium">Total Amount</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary.totalAmount)}</p>
            </div>
            <div className="bg-violet-500/20 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-violet-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border border-emerald-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-300 text-sm font-medium">Paid</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary.paidAmount)}</p>
            </div>
            <div className="bg-emerald-500/20 p-3 rounded-lg">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-amber-600/20 to-amber-700/20 border border-amber-500/20 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-300 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold mt-1 text-white">{formatCurrency(summary.pendingAmount)}</p>
            </div>
            <div className="bg-amber-500/20 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-amber-400" />
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
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showFilters || statusFilter 
                ? 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-300' 
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {statusFilter && (
              <span className="bg-fuchsia-500 text-white text-xs px-1.5 py-0.5 rounded-full">1</span>
            )}
          </button>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white rounded-lg hover:from-fuchsia-500 hover:to-violet-500 transition-all shadow-lg shadow-fuchsia-500/25"
        >
          <Plus className="h-4 w-4" />
          Create Invoice
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
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter('')}
                  className="self-end px-3 py-2 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoices List */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/50">
            <div className="w-6 h-6 border-2 border-white/20 border-t-fuchsia-500 rounded-full animate-spin mx-auto mb-3" />
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50">No invoices found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-fuchsia-400 hover:text-fuchsia-300 font-medium transition-colors"
            >
              Create your first invoice
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {invoices.map((invoice, index) => (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white">{invoice.invoiceNumber}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isOverdue(invoice) ? statusColors.OVERDUE : statusColors[invoice.status]
                        }`}>
                          {isOverdue(invoice) ? 'Overdue' : statusLabels[invoice.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-white/50">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {invoice.customerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {formatDate(invoice.dueDate)}
                        </span>
                        {invoice.customerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {invoice.customerEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{formatCurrency(invoice.total)}</p>
                      {invoice.tax > 0 && (
                        <p className="text-xs text-white/40">Tax: {formatCurrency(invoice.tax)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewingInvoice(invoice)}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {invoice.status === 'DRAFT' && (
                        <button
                          onClick={() => handleStatusChange(invoice, 'SENT')}
                          className="p-2 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Send"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
                        <button
                          onClick={() => handleStatusChange(invoice, 'PAID')}
                          className="p-2 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Mark as Paid"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingInvoice(invoice)}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
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
        {(showAddModal || editingInvoice) && (
          <InvoiceModal
            invoice={editingInvoice}
            onClose={() => { setShowAddModal(false); setEditingInvoice(null); }}
            onSave={() => { setShowAddModal(false); setEditingInvoice(null); fetchInvoices(); }}
          />
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewingInvoice && (
          <InvoiceViewModal
            invoice={viewingInvoice}
            onClose={() => setViewingInvoice(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

interface InvoiceModalProps {
  invoice: Invoice | null
  onClose: () => void
  onSave: () => void
}

function InvoiceModal({ invoice, onClose, onSave }: InvoiceModalProps) {
  const [formData, setFormData] = useState({
    customerName: invoice?.customerName || '',
    customerEmail: invoice?.customerEmail || '',
    amount: invoice?.amount?.toString() || '',
    tax: invoice?.tax?.toString() || '0',
    issueDate: invoice?.issueDate ? invoice.issueDate.split('T')[0] : new Date().toISOString().split('T')[0],
    dueDate: invoice?.dueDate ? invoice.dueDate.split('T')[0] : '',
    notes: invoice?.notes || '',
    status: invoice?.status || 'DRAFT'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const calculateTotal = () => {
    const amount = parseFloat(formData.amount) || 0
    const tax = parseFloat(formData.tax) || 0
    return amount + tax
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customerName || !formData.amount) {
      setError('Customer name and amount are required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const url = invoice 
        ? `/api/admin/accounting/invoices/${invoice.id}`
        : '/api/admin/accounting/invoices'
      
      const res = await fetch(url, {
        method: invoice ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          tax: parseFloat(formData.tax) || 0,
          total: calculateTotal()
        })
      })

      if (res.ok) {
        onSave()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save invoice')
      }
    } catch {
      setError('Failed to save invoice')
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
              {invoice ? 'Edit Invoice' : 'Create New Invoice'}
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
            <label className={labelClass}>Customer Name *</label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className={inputClass}
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label className={labelClass}>Customer Email</label>
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              className={inputClass}
              placeholder="customer@example.com"
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
              <label className={labelClass}>Tax</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tax}
                  onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                  className={`${inputClass} pl-10`}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-white/70">Total Amount</span>
              <span className="text-xl font-semibold text-white">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTotal())}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Issue Date</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          {invoice && (
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as InvoiceStatus })}
                className={selectClass}
              >
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Payment terms, additional details..."
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
                  {invoice ? 'Update' : 'Create'} Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

interface InvoiceViewModalProps {
  invoice: Invoice
  onClose: () => void
}

function InvoiceViewModal({ invoice, onClose }: InvoiceViewModalProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

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
            <div>
              <h3 className="text-lg font-semibold text-white">{invoice.invoiceNumber}</h3>
              <span className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[invoice.status]}`}>
                {statusLabels[invoice.status]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {}}
                className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Download PDF"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-white/50">Customer</p>
              <p className="font-medium text-white">{invoice.customerName}</p>
              {invoice.customerEmail && (
                <p className="text-sm text-white/60">{invoice.customerEmail}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-white/50">Issue Date</p>
              <p className="font-medium text-white">{formatDate(invoice.issueDate)}</p>
            </div>
          </div>

          <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
            <div className="flex justify-between">
              <span className="text-white/70">Subtotal</span>
              <span className="text-white">{formatCurrency(invoice.amount)}</span>
            </div>
            {invoice.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-white/70">Tax</span>
                <span className="text-white">{formatCurrency(invoice.tax)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-white/10">
              <span className="font-semibold text-white">Total</span>
              <span className="text-xl font-bold text-white">{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-white/50">Due Date</p>
              <p className="font-medium text-white">{formatDate(invoice.dueDate)}</p>
            </div>
            {invoice.paidDate && (
              <div className="text-right">
                <p className="text-sm text-white/50">Paid Date</p>
                <p className="font-medium text-emerald-400">{formatDate(invoice.paidDate)}</p>
              </div>
            )}
          </div>

          {invoice.notes && (
            <div>
              <p className="text-sm text-white/50 mb-1">Notes</p>
              <p className="text-white/80 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
