'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { TIME_RANGES, type TimeRange } from '@/lib/admin/customers'

const LABEL: Record<TimeRange, string> = {
  today: 'Today', '7d': '7 days', '30d': '30 days', '90d': '90 days', year: 'Year',
}

export interface CustomersRangePillsProps {
  active: TimeRange
}

export function CustomersRangePills({ active }: CustomersRangePillsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams?.get('tab') ?? 'all'
  const [isPending, startTransition] = useTransition()

  const onPick = (range: TimeRange) => {
    if (range === active) return
    startTransition(() => router.push(`?tab=${tab}&range=${range}`))
  }

  return (
    <div className="flex gap-1" data-pending={isPending}>
      {TIME_RANGES.map((r) => {
        const isActive = r === active
        return (
          <button
            key={r}
            type="button"
            onClick={() => onPick(r)}
            aria-pressed={isActive}
            className={`text-[10px] px-2 py-1 rounded-[4px] font-semibold transition-colors ${
              isActive
                ? 'bg-white/6 text-white shadow-[inset_0_0_0_1px_rgba(255,49,49,0.2)]'
                : 'bg-white/2 text-white/40 hover:text-white/70 hover:bg-white/4'
            }`}
          >
            {LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}
