import type { ReactNode } from 'react'

export type StatusTone = 'emerald' | 'amber' | 'blue' | 'rose' | 'violet' | 'neutral'

interface StatusPillProps {
  /** Visual tone — maps to the canonical tinted-pill palette in the design system. */
  tone?: StatusTone
  /** Pill content — usually a short status label like "Paid" or "Pending". */
  children: ReactNode
  /** Optional leading icon. Should be a Phosphor icon, sized 11–12px to match the type scale. */
  icon?: ReactNode
  /** Size variant — defaults to `sm` matching most table/badge usage. */
  size?: 'sm' | 'md'
  /** Extra classes for one-off positioning (e.g. `mt-1`). */
  className?: string
}

const TONES: Record<StatusTone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  neutral: 'bg-white/5 text-white/65 border-white/15',
}

const SIZES: Record<NonNullable<StatusPillProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-[11px] gap-1.5',
}

/**
 * Canonical tinted status pill for the admin dashboard.
 *
 * Replaces the per-page `STATUS_TONE` maps that pages like expenses,
 * redemptions, dashboard home, and reviews each rebuilt independently.
 *
 * Example:
 * ```tsx
 * <StatusPill tone="emerald">Fulfilled</StatusPill>
 * <StatusPill tone="amber" icon={<Clock size={11} weight="bold" />}>Pending</StatusPill>
 * ```
 */
export function StatusPill({
  tone = 'neutral',
  children,
  icon,
  size = 'sm',
  className = '',
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider border ${SIZES[size]} ${TONES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}
