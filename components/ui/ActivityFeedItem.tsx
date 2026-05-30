// components/ui/ActivityFeedItem.tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Status = 'success' | 'live' | 'info' | 'warning'

const statusStyles: Record<Status, string> = {
  success: 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]',
  live: 'bg-red-500 shadow-[0_0_6px_rgba(255,49,49,0.7)]',
  info: 'bg-white/40',
  warning: 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]',
}

export interface ActivityFeedItemProps {
  status: Status
  title: string
  description?: string
  timestamp: string
  href?: string
  className?: string
}

export function ActivityFeedItem({
  status,
  title,
  description,
  timestamp,
  href,
  className,
}: ActivityFeedItemProps) {
  const content = (
    <div className={cn('flex items-center gap-2 py-1.5 text-xs', className)}>
      <div
        data-status={status}
        className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusStyles[status])}
      />
      <span className="text-white font-semibold">{title}</span>
      {description && (
        <>
          <span className="text-white/40">·</span>
          <span className="text-white/70 truncate">{description}</span>
        </>
      )}
      <span className="ml-auto text-white/40 flex-shrink-0">{timestamp}</span>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:bg-white/[0.02] rounded px-1 -mx-1">
        {content}
      </Link>
    )
  }

  return content
}
