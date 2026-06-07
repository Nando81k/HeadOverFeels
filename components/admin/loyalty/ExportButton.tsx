'use client'

import { useTransition } from 'react'
import {
  exportOverviewCsv,
  exportMembersCsv,
  exportRewardsCsv,
  exportRedemptionsCsv,
  exportEventsCsv,
  type TimeRange,
  type MembersCsvFilters,
  type RewardsCsvFilters,
  type RedemptionsCsvFilters,
  type EventsCsvFilters,
} from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export type LoyaltyExportableTab = 'overview' | 'members' | 'rewards' | 'redemptions' | 'events'

export type ExportButtonFilters =
  | MembersCsvFilters
  | RewardsCsvFilters
  | RedemptionsCsvFilters
  | EventsCsvFilters

export interface ExportButtonProps {
  tab: LoyaltyExportableTab
  range?: TimeRange
  filters?: any
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
        case 'overview':
          res = await exportOverviewCsv(range as TimeRange)
          break
        case 'members':
          res = await exportMembersCsv(filters as MembersCsvFilters | undefined)
          break
        case 'rewards':
          res = await exportRewardsCsv(filters as RewardsCsvFilters | undefined)
          break
        case 'redemptions':
          res = await exportRedemptionsCsv(range as TimeRange, filters as RedemptionsCsvFilters | undefined)
          break
        case 'events':
          res = await exportEventsCsv(filters as EventsCsvFilters | undefined)
          break
      }
      if (res.ok && res.data?.csv) {
        const datestamp = formatDate(new Date())
        downloadCsv(res.data.csv, `loyalty-${tab}-${range ?? 'all'}-${datestamp}.csv`)
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
