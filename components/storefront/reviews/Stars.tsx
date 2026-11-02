import * as React from 'react'
import { cn } from '@/lib/storefront/cn'

export interface StarsProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** 0–5, fractions allowed (rendered as a partial fill). */
  rating: number
  size?: 'sm' | 'md' | 'lg'
  /** Override the announced text ("4.5 out of 5 stars" by default). */
  label?: string
}

const SIZE = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const

/** Five-star glyph row, server-safe. Fill is a clipped overlay so 4.3 reads as 4.3. */
export function Stars({ rating, size = 'md', label, className, ...props }: StarsProps) {
  const clamped = Math.min(5, Math.max(0, rating))
  const text = label ?? `${Number(clamped.toFixed(1))} out of 5 stars`
  return (
    <span
      role="img"
      aria-label={text}
      data-stars={clamped}
      className={cn('relative inline-flex shrink-0 gap-0.5 text-line-strong', className)}
      {...props}
    >
      <span className="inline-flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={SIZE[size]} />
        ))}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 inline-flex gap-0.5 overflow-hidden text-signal"
        style={{ width: `${Math.round((clamped / 5) * 1000) / 10}%` }}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn(SIZE[size], 'shrink-0')} />
        ))}
      </span>
    </span>
  )
}

export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={cn('block', className)}>
      <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7L10 1.5z" />
    </svg>
  )
}
