import type { ReactNode } from 'react'
import Link from 'next/link'

interface EmptyStateAction {
  label: string
  /** Either an internal route (uses Next `<Link>`) or an external URL. */
  href?: string
  /** Or a click handler when the action isn't navigation. */
  onClick?: () => void
}

interface EmptyStateProps {
  /** Phosphor icon (or any ReactNode). Rendered ~28px in a circle. */
  icon: ReactNode
  /** Headline. Keep it brief — sentence case. */
  title: string
  /** Optional description below the title. */
  description?: string
  /** Optional CTA button. */
  action?: EmptyStateAction
  /** Layout sizing — `compact` for inside cards/tables, `comfortable` (default) for full-page emptiness. */
  size?: 'compact' | 'comfortable'
  /** Extra classes for the outer wrapper. */
  className?: string
}

/**
 * Canonical empty-state card for the admin dashboard.
 *
 * Replaces the half-dozen ad-hoc variations of
 * `bg-neutral-900 border border-white/10 p-8 text-center` you'll find
 * scattered across list pages.
 *
 * Used standalone or as the empty slot inside `<DataTable>`.
 *
 * Example:
 * ```tsx
 * <EmptyState
 *   icon={<Ticket size={28} className="text-white/30" weight="fill" />}
 *   title="No redemptions yet"
 *   description="Redemptions will appear here once customers cash in points."
 *   action={{ label: 'Browse rewards', href: '/admin/loyalty/rewards' }}
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'comfortable',
  className = '',
}: EmptyStateProps) {
  const padding = size === 'compact' ? 'p-6' : 'p-10 sm:p-14'

  return (
    <div
      className={`flex flex-col items-center text-center bg-neutral-900 border border-white/10 ${padding} ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm sm:text-base font-bold text-white">{title}</p>
      {description && (
        <p className="text-xs sm:text-sm text-white/45 mt-1.5 max-w-md">{description}</p>
      )}
      {action && <EmptyStateActionButton action={action} />}
    </div>
  )
}

function EmptyStateActionButton({ action }: { action: EmptyStateAction }) {
  const className =
    'mt-5 inline-flex items-center justify-center px-5 h-10 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-colors'

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  )
}
