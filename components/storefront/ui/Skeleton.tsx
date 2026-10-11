import * as React from 'react'
import { cn } from '@/lib/storefront/cn'

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

/**
 * Loading placeholder (spec §5.2).
 *
 * Always `aria-hidden` — a skeleton is decoration, the loading state itself is
 * announced by the surrounding region. The pulse is `motion-safe:` only, so
 * `prefers-reduced-motion` leaves a flat block.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-skeleton=""
      className={cn('motion-safe:animate-pulse rounded-sharp bg-line', className)}
      {...props}
    />
  )
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of placeholder lines. The last one is short, like real copy. */
  lines?: number
}

/** A stack of `Skeleton` bars standing in for a paragraph. */
export function SkeletonText({ lines = 3, className, ...props }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-2', className)} {...props}>
      {Array.from({ length: Math.max(0, lines) }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  )
}
