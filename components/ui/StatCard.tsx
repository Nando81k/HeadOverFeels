// components/ui/StatCard.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const statCardVariants = cva(
  'rounded-lg border p-3 backdrop-blur-sm transition-all',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-surface-elevated)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-emphasis)]',
        success:
          'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/8',
        warning:
          'bg-red-500/5 border-red-500/20 hover:bg-red-500/8 shadow-[var(--shadow-glow-warning)]',
        glow: 'bg-red-500/8 border-red-500/30 shadow-[var(--shadow-glow-primary)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface StatCardProps extends VariantProps<typeof statCardVariants> {
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down' | 'flat'; text: string }
  href?: string
  className?: string
}

export function StatCard({ label, value, trend, variant, href, className }: StatCardProps) {
  const trendColor =
    trend?.direction === 'up'
      ? 'text-emerald-400'
      : trend?.direction === 'down'
      ? 'text-red-400'
      : 'text-white/40'

  const content = (
    <>
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/45 font-semibold">
        {label}
      </div>
      <div className="text-base font-bold text-white mt-1">{value}</div>
      {trend && <div className={cn('text-[10px] mt-0.5', trendColor)}>{trend.text}</div>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cn(statCardVariants({ variant }), className, 'block')}>
        {content}
      </Link>
    )
  }

  return <div className={cn(statCardVariants({ variant }), className)}>{content}</div>
}
