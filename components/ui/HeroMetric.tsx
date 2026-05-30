// components/ui/HeroMetric.tsx
import { cn } from '@/lib/utils'
import { Sparkline } from './Sparkline'

export interface HeroMetricProps {
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down' | 'flat'; text: string }
  sparklineData?: number[]
  actions?: React.ReactNode
  className?: string
}

export function HeroMetric({
  label,
  value,
  trend,
  sparklineData,
  actions,
  className,
}: HeroMetricProps) {
  const trendColor =
    trend?.direction === 'up'
      ? 'text-emerald-400'
      : trend?.direction === 'down'
      ? 'text-red-400'
      : 'text-white/40'

  return (
    <div
      className={cn(
        'rounded-xl border border-red-500/20 p-5 backdrop-blur-md',
        'bg-gradient-to-br from-red-500/8 to-red-500/[0.01]',
        'shadow-[0_0_60px_rgba(255,49,49,0.05)]',
        'flex items-center gap-6',
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.15em] text-red-300 font-semibold mb-1">
          {label}
        </div>
        <div className="text-3xl font-extrabold text-white tracking-[-0.02em]">
          {value}
        </div>
        {trend && <div className={cn('text-xs mt-1', trendColor)}>{trend.text}</div>}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="flex-[1.2] hidden sm:block">
          <Sparkline data={sparklineData} height={64} />
        </div>
      )}
      {actions && <div className="flex gap-1">{actions}</div>}
    </div>
  )
}
