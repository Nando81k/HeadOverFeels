import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/storefront/cn'

export const badgeVariants = cva(
  'inline-flex text-[10px] font-semibold uppercase tracking-eyebrow leading-none px-2 py-1.5 rounded-sharp',
  {
    variants: {
      variant: {
        sale: 'bg-signal text-signal-ink',
        drop: 'bg-ink text-bone',
        new: 'bg-paper text-ink border border-line',
        soldout: 'bg-ink-mute text-bone',
        neutral: 'bg-rose-tint text-ink',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
)

/** Copy shown when a badge is rendered without children. */
const DEFAULT_LABEL: Record<NonNullable<VariantProps<typeof badgeVariants>['variant']>, string> = {
  sale: 'Sale',
  drop: 'Drop',
  new: 'New',
  soldout: 'Sold out',
  neutral: '',
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children?: React.ReactNode
}

/** Uppercase eyebrow chip for merchandising state (spec §5.2). */
export function Badge({ className, variant, children, ...props }: BadgeProps) {
  const resolved = variant ?? 'neutral'

  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children ?? DEFAULT_LABEL[resolved]}
    </span>
  )
}
