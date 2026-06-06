'use client'

import { useState, useTransition } from 'react'
import { ExpenseCategoryDonut } from '@/components/admin/analytics/charts/ExpenseCategoryDonut'
import { ExpenseMonthlyBar } from '@/components/admin/analytics/charts/ExpenseMonthlyBar'
import { ExpenseInspector } from '@/components/admin/analytics/inspectors/ExpenseInspector'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import type { ExpenseCategoryOption } from '@/components/admin/analytics/inspectors/ExpenseInspector'
import type { ExpensesData, TimeRange, ExpenseDetailFull } from '@/lib/admin/analytics'
import { getExpenseDetailForInspector } from '@/app/admin/analytics/actions'

export interface ExpensesTabProps {
  data: ExpensesData
  range: TimeRange
  categories: ExpenseCategoryOption[]
  isSuperAdmin: boolean
}

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export function ExpensesTab({ data, range, categories, isSuperAdmin }: ExpensesTabProps) {
  const [open, setOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [detail, setDetail] = useState<ExpenseDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openCreate = () => {
    setDetail(null)
    setCreateMode(true)
    setOpen(true)
  }

  const openRow = (id: string) => {
    setCreateMode(false)
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getExpenseDetailForInspector(id)
      setDetail(d)
    })
  }

  return (
    <div className="space-y-4">
      {/* Header row — New Expense + Export */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={openCreate}
          className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] transition-colors"
        >
          + New Expense
        </button>
        <ExportButton tab="expenses" range={range} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/[0.08] rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">By Category</h3>
          <ExpenseCategoryDonut data={data.categoryBreakdown} />
        </div>
        <div className="bg-neutral-900/60 border border-white/[0.08] rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Monthly</h3>
          <ExpenseMonthlyBar data={data.monthlyBars} />
        </div>
      </div>

      {/* Expense table */}
      <div className="bg-neutral-900/60 border border-white/[0.08] rounded-md overflow-hidden">
        <h3 className="text-xs uppercase tracking-wide text-white/40 px-3 py-2 border-b border-white/[0.08]">
          Expenses ({data.table.total})
        </h3>
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.table.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-white/30">
                  No expenses for this range
                </td>
              </tr>
            ) : (
              data.table.items.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-white/[0.08] hover:bg-white/[0.04] cursor-pointer transition-colors"
                  onClick={() => openRow(e.id)}
                >
                  <td className="px-3 py-2">
                    {new Date(e.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2 max-w-[160px] truncate">{e.description}</td>
                  <td className="px-3 py-2">{e.vendor ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: e.categoryColor }}
                      />
                      {e.categoryName}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmt.format(e.amount)}</td>
                  <td className="px-3 py-2">
                    <span className="text-white/50">{e.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inspector */}
      <ExpenseInspector
        open={open}
        detail={detail}
        createMode={createMode}
        categories={categories}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
        onDeleted={() => setOpen(false)}
      />
    </div>
  )
}
