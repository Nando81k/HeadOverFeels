// components/ui/NeedsAttentionCard.tsx
import Link from 'next/link'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  'rounded-md p-2.5 flex items-center gap-2 transition-colors',
  {
    variants: {
      urgency: {
        critical: 'bg-red-500/6 border border-red-500/20',
        high: 'bg-red-500/4 border border-red-500/15',
        medium: 'bg-white/[0.03] border border-white/8',
        low: 'bg-white/[0.02] border border-white/6',
      },
    },
    defaultVariants: { urgency: 'medium' },
  },
)

const iconBgVariants = cva(
  'w-6 h-6 rounded flex items-center justify-center text-[11px] flex-shrink-0',
  {
    variants: {
      urgency: {
        critical: 'bg-red-500/15',
        high: 'bg-red-500/10',
        medium: 'bg-white/5',
        low: 'bg-white/5',
      },
    },
    defaultVariants: { urgency: 'medium' },
  },
)

export interface NeedsAttentionCardProps extends VariantProps<typeof cardVariants> {
  icon: React.ReactNode
  title: string
  description?: string
  href?: string
  className?: string
}

export function NeedsAttentionCard({
  icon,
  title,
  description,
  urgency,
  href,
  className,
}: NeedsAttentionCardProps) {
  const arrowColor = urgency === 'critical' || urgency === 'high' ? 'text-red-500' : 'text-white/40'

  const content = (
    <>
      <div className={iconBgVariants({ urgency })}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white font-semibold text-[10px]">{title}</div>
        {description && (
          <div
            className={cn(
              'text-[9px] mt-0.5',
              urgency === 'critical' || urgency === 'high' ? 'text-red-300/70' : 'text-white/40',
            )}
          >
            {description}
          </div>
        )}
      </div>
      {href && <div className={cn('text-sm', arrowColor)}>→</div>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cn(cardVariants({ urgency }), className, 'hover:scale-[1.01]')}>
        {content}
      </Link>
    )
  }

  return <div className={cn(cardVariants({ urgency }), className)}>{content}</div>
}
