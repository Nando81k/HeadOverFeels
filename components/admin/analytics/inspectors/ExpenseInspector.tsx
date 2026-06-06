'use client'

/**
 * ExpenseInspector — full-edit slide-out drawer for a single expense.
 *
 * Phase 6 Task 13 (Wave 3):
 *  - Props: open, detail (ExpenseDetailFull | null), createMode, categories,
 *    isSuperAdmin, onClose, onSaved, onDeleted
 *  - Full form: category select, amount, date, description, vendor,
 *    paymentMethod (free-text + datalist), isTaxDeductible checkbox,
 *    taxCategory (shown when isTaxDeductible), notes textarea, receiptUrl,
 *    status dropdown (5 ExpenseStatus values).
 *  - Save calls createExpense (createMode) or updateExpense (edit mode).
 *  - Delete: SUPER_ADMIN-gated; disabled with tooltip when isSuperAdmin=false.
 *  - window.confirm used before delete.
 *  - Toast feedback via lib/toast.ts (Sonner).
 *  - No dark: Tailwind modifiers (V2 always-dark).
 */

import { useEffect, useState, useTransition } from 'react'
import type { ExpenseDetailFull } from '@/app/admin/analytics/actions'
import {
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/app/admin/analytics/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpenseCategoryOption {
  id: string
  name: string
  color: string
}

const STATUSES = ['RECORDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID'] as const
type Status = typeof STATUSES[number]

export interface ExpenseInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** Expense to display and edit. `null` in create mode. */
  detail: ExpenseDetailFull | null
  /** When true, renders an empty form for creating a new expense. */
  createMode?: boolean
  /** Category options from parent (populated from ExpenseCategory table). */
  categories: ExpenseCategoryOption[]
  /** Whether the current user has SUPER_ADMIN role (gates Delete button). */
  isSuperAdmin: boolean
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: (id: string) => void
  /** Called after a successful delete so the parent can remove the row. */
  onDeleted?: (id: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

const INPUT_CLASS = [
  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
  'px-3 py-2 text-sm text-white placeholder:text-white/25',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
].join(' ')

const LABEL_CLASS = 'block text-xs font-medium uppercase tracking-wider text-white/50'

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpenseInspector({
  open,
  detail,
  createMode = false,
  categories,
  isSuperAdmin,
  onClose,
  onSaved,
  onDeleted,
}: ExpenseInspectorProps) {
  const [pending, startTransition] = useTransition()

  // Form state
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
  const [taxCategory, setTaxCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [status, setStatus] = useState<Status>('RECORDED')

  // Sync form when detail / open changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    if (detail) {
      setCategoryId(detail.category.id)
      setAmount(detail.amount)
      setDate(toIsoDate(detail.date))
      setDescription(detail.description)
      setVendor(detail.vendor ?? '')
      setPaymentMethod(detail.paymentMethod ?? '')
      setIsTaxDeductible(detail.isTaxDeductible)
      setTaxCategory(detail.taxCategory ?? '')
      setNotes(detail.notes ?? '')
      setReceiptUrl(detail.receiptUrl ?? '')
      setStatus(detail.status as Status)
    } else if (createMode) {
      setCategoryId(categories[0]?.id ?? '')
      setAmount(0)
      setDate(new Date().toISOString().slice(0, 10))
      setDescription('')
      setVendor('')
      setPaymentMethod('')
      setIsTaxDeductible(false)
      setTaxCategory('')
      setNotes('')
      setReceiptUrl('')
      setStatus('RECORDED')
    }
  }, [open, detail, createMode, categories])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSave() {
    const dateObj = new Date(date)
    if (Number.isNaN(dateObj.getTime())) {
      toast.error('Invalid date')
      return
    }
    if (!description.trim()) {
      toast.error('Description is required')
      return
    }
    startTransition(async () => {
      if (createMode || !detail) {
        const r = await createExpense({
          categoryId,
          amount,
          date: dateObj,
          description: description.trim(),
          vendor: vendor.trim() || null,
          paymentMethod: paymentMethod.trim() || null,
          isTaxDeductible,
          taxCategory: taxCategory.trim() || null,
          notes: notes.trim() || null,
          receiptUrl: receiptUrl.trim() || null,
          status,
        })
        if (r.ok) {
          toast.success('Expense created')
          onSaved?.(r.data?.id ?? '')
          onClose()
        } else {
          toast.error((r as { ok: false; error: string }).error ?? 'Failed to create expense')
        }
      } else {
        const r = await updateExpense(detail.id, {
          categoryId,
          amount,
          date: dateObj,
          description: description.trim(),
          vendor: vendor.trim() || null,
          paymentMethod: paymentMethod.trim() || null,
          isTaxDeductible,
          taxCategory: taxCategory.trim() || null,
          notes: notes.trim() || null,
          receiptUrl: receiptUrl.trim() || null,
          status,
        })
        if (r.ok) {
          toast.success('Expense updated')
          onSaved?.(detail.id)
          onClose()
        } else {
          toast.error((r as { ok: false; error: string }).error ?? 'Failed to update expense')
        }
      }
    })
  }

  function handleDelete() {
    if (!detail) return
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    startTransition(async () => {
      const r = await deleteExpense(detail.id)
      if (r.ok) {
        toast.success('Expense deleted')
        onDeleted?.(detail.id)
        onClose()
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to delete expense')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const title = detail ? 'Edit Expense' : 'New Expense'

  return (
    <Inspector open={open} onClose={onClose} title={title} width={460}>
      <div className="space-y-4 text-sm">

        {/* ── Description ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="expense-inspector-description" className={LABEL_CLASS}>
            Description
          </label>
          <input
            id="expense-inspector-description"
            aria-label="Description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
            placeholder="e.g. Facebook ad campaign"
            className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Category ─────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="expense-inspector-category" className={LABEL_CLASS}>
            Category
          </label>
          <select
            id="expense-inspector-category"
            aria-label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={pending}
            className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* ── Amount + Date ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="expense-inspector-amount" className={LABEL_CLASS}>
              Amount ($)
            </label>
            <input
              id="expense-inspector-amount"
              aria-label="Amount"
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={pending}
              className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expense-inspector-date" className={LABEL_CLASS}>
              Date
            </label>
            <input
              id="expense-inspector-date"
              aria-label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={pending}
              className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
        </div>

        {/* ── Vendor ───────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="expense-inspector-vendor" className={LABEL_CLASS}>
            Vendor
          </label>
          <input
            id="expense-inspector-vendor"
            aria-label="Vendor"
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            disabled={pending}
            placeholder="e.g. Meta, AWS, Shopify"
            className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Payment Method ───────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="expense-inspector-payment-method" className={LABEL_CLASS}>
            Payment Method
          </label>
          <input
            id="expense-inspector-payment-method"
            aria-label="Payment Method"
            list="expense-inspector-payment-method-list"
            type="text"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={pending}
            placeholder="e.g. card, cash, ach"
            className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
          <datalist id="expense-inspector-payment-method-list">
            <option value="card" />
            <option value="cash" />
            <option value="ach" />
            <option value="paypal" />
            <option value="stripe" />
            <option value="check" />
          </datalist>
        </div>

        {/* ── Tax Deductible ───────────────────────────────────────── */}
        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              aria-label="Tax deductible"
              checked={isTaxDeductible}
              onChange={(e) => setIsTaxDeductible(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-sm text-white/70">Tax deductible</span>
          </label>
        </div>

        {/* ── Tax Category (conditional) ───────────────────────────── */}
        {isTaxDeductible && (
          <div className="space-y-1.5">
            <label htmlFor="expense-inspector-tax-category" className={LABEL_CLASS}>
              Tax Category
            </label>
            <input
              id="expense-inspector-tax-category"
              aria-label="Tax Category"
              type="text"
              value={taxCategory}
              onChange={(e) => setTaxCategory(e.target.value)}
              disabled={pending}
              placeholder="e.g. Advertising, Office Supplies"
              className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
            />
          </div>
        )}

        {/* ── Status ───────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="expense-inspector-status" className={LABEL_CLASS}>
            Status
          </label>
          <select
            id="expense-inspector-status"
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            disabled={pending}
            className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* ── Notes ────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="expense-inspector-notes" className={LABEL_CLASS}>
            Notes
          </label>
          <textarea
            id="expense-inspector-notes"
            aria-label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder="Additional context…"
            className={[
              'w-full rounded-lg border border-white/10 bg-neutral-900/60',
              'px-3 py-2 text-sm text-white placeholder:text-white/25',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
              'resize-none',
              pending ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          />
        </div>

        {/* ── Receipt URL ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="expense-inspector-receipt-url" className={LABEL_CLASS}>
            Receipt URL
          </label>
          <input
            id="expense-inspector-receipt-url"
            aria-label="Receipt URL"
            type="url"
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            disabled={pending}
            placeholder="https://…"
            className={[INPUT_CLASS, pending ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
          />
        </div>

        {/* ── Footer actions ───────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          {/* Delete (SUPER_ADMIN-gated, edit mode only) */}
          {detail ? (
            <button
              type="button"
              aria-label="Delete expense"
              disabled={!isSuperAdmin || pending}
              title={isSuperAdmin ? 'Delete this expense' : 'SUPER_ADMIN only'}
              onClick={handleDelete}
              className={[
                'text-xs font-medium text-rose-400 hover:text-rose-300',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40',
                !isSuperAdmin || pending ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              Delete
            </button>
          ) : (
            <span />
          )}

          {/* Cancel + Save */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={[
                'rounded-lg border border-white/10 px-4 py-2',
                'text-sm font-medium text-white/60 hover:text-white/90',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className={[
                'rounded-lg px-4 py-2',
                'text-sm font-semibold text-white',
                'bg-[#FF3131] hover:bg-[#e02020]',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Inspector>
  )
}
