'use client'

import { useTransition } from 'react'
import {
  exportOverviewCsv,
  exportSalesCsv,
  exportCustomersCsv,
  exportProductsCsv,
  exportFinancialCsv,
  exportExpensesCsv,
  type TimeRange,
  type ExpenseCsvFilters,
} from '@/app/admin/analytics/actions'
import { toast } from '@/lib/toast'

export type ExportableTab = 'overview' | 'sales' | 'customers' | 'products' | 'financial' | 'expenses'

export interface ExportButtonProps {
  tab: ExportableTab
  range: TimeRange
  filters?: ExpenseCsvFilters
  className?: string
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function ExportButton({ tab, range, filters, className }: ExportButtonProps) {
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      let res
      switch (tab) {
        case 'overview':   res = await exportOverviewCsv(range); break
        case 'sales':      res = await exportSalesCsv(range); break
        case 'customers':  res = await exportCustomersCsv(range); break
        case 'products':   res = await exportProductsCsv(range); break
        case 'financial':  res = await exportFinancialCsv(range); break
        case 'expenses':   res = await exportExpensesCsv(range, filters); break
      }
      if (res.ok && res.data?.csv) {
        const datestamp = formatDate(new Date())
        downloadCsv(res.data.csv, `analytics-${tab}-${range}-${datestamp}.csv`)
        toast.success('CSV downloaded')
      } else if (!res.ok) {
        toast.error(res.error)
      }
    })
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className={`text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white disabled:opacity-50 ${className ?? ''}`}
    >
      {pending ? 'Exporting…' : 'Export CSV'}
    </button>
  )
}
