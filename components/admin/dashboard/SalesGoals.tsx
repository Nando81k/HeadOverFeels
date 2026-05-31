// components/admin/dashboard/SalesGoals.tsx
import Link from 'next/link'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { SalesGoalsData, GoalPace, GoalSlice } from '@/lib/admin/dashboard'

interface Props {
  data: SalesGoalsData
}

const PACE_STATE: Record<GoalPace, 'glow' | 'success' | 'warning' | 'danger' | 'default'> = {
  ahead: 'glow',
  'on-track': 'success',
  behind: 'warning',
  critical: 'danger',
  unset: 'default',
}

function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function GoalRow({ label, slice }: { label: string; slice: GoalSlice }) {
  const pct = slice.goal !== null ? (slice.current / slice.goal) * 100 : 0
  const remaining = slice.goal !== null ? slice.goal - slice.current : 0
  return (
    <div>
      <ProgressBar
        value={pct}
        label={label}
        detail={slice.goal !== null ? `${fmtUSD(slice.current)} / ${fmtUSD(slice.goal)}` : undefined}
        state={PACE_STATE[slice.pace]}
      />
      <div className="text-[9px] text-white/45 mt-0.5">
        {pct >= 100
          ? `${(pct - 100).toFixed(0)}% over goal`
          : `${pct.toFixed(0)}% · ${fmtUSD(remaining)} to go`}
      </div>
    </div>
  )
}

export function SalesGoals({ data }: Props) {
  const bothUnset = data.today.goal === null && data.monthToDate.goal === null

  return (
    <div className="rounded-[10px] bg-white/[0.025] border border-white/6 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-bold text-white text-[11px]">Sales goals</span>
        <Link href="/admin/settings/goals" className="text-white/40 text-[9px] hover:text-white/70">
          → Edit in settings
        </Link>
      </div>
      {bothUnset ? (
        <div className="text-[10px] text-white/55 py-1">
          No goal set ·{' '}
          <Link href="/admin/settings/goals" className="text-white/70 underline hover:text-white">
            Set in settings →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <GoalRow label="Today" slice={data.today} />
          <GoalRow label="Month-to-date" slice={data.monthToDate} />
        </div>
      )}
    </div>
  )
}
