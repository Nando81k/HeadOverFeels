// components/admin/dashboard/HeroTimeRangePills.tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { TIME_RANGES, type TimeRange } from '@/lib/admin/dashboard'
import { cn } from '@/lib/utils'

interface Props {
  active: TimeRange
}

const LABEL: Record<TimeRange, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

export function HeroTimeRangePills({ active }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const onPick = (range: TimeRange) => {
    if (range === active) return
    const params = new URLSearchParams(searchParams ?? undefined)
    params.set('range', range)
    try {
      localStorage.setItem('admin.dashboard.range', range)
    } catch {
      // localStorage unavailable (private mode, SSR fallback) — ignore
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
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
            className={cn(
              'text-[10px] px-2 py-1 rounded-[4px] font-semibold transition-colors',
              isActive
                ? 'bg-white/6 text-white shadow-[inset_0_0_0_1px_rgba(255,49,49,0.2)]'
                : 'bg-white/2 text-white/40 hover:text-white/70 hover:bg-white/4',
            )}
          >
            {LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}
