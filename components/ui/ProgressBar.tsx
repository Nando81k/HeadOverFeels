// components/ui/ProgressBar.tsx
import { cn } from '@/lib/utils'

type State = 'default' | 'success' | 'warning' | 'danger' | 'glow'

const fillStyles: Record<State, string> = {
  default: 'bg-white/40',
  success: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  warning: 'bg-gradient-to-r from-amber-500 to-amber-400',
  danger: 'bg-gradient-to-r from-red-500 to-red-400',
  glow: 'bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_8px_rgba(255,49,49,0.4)]',
}

export interface ProgressBarProps {
  value: number // 0-100, clamped
  label?: string
  detail?: string
  state?: State
  className?: string
}

export function ProgressBar({
  value,
  label,
  detail,
  state = 'glow',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('w-full', className)}>
      {(label || detail) && (
        <div className="flex justify-between mb-1 text-[10px]">
          {label && <span className="text-white/70 font-semibold">{label}</span>}
          {detail && <span className="text-white">{detail}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 bg-white/6 rounded-full overflow-hidden"
      >
        <div
          data-fill
          className={cn('h-full rounded-full transition-all duration-500', fillStyles[state])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
