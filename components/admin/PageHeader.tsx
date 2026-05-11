import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** Small caps eyebrow above the title. Optional context label like "Loyalty" or "Reports". */
  eyebrow?: string
  /** Section heading — bigger than `AdminLayout` title, used inside content. */
  title: string
  /** Optional subtitle / description line. */
  subtitle?: string
  /** Right-aligned actions (buttons, dropdowns). */
  actions?: ReactNode
  /** Optional icon rendered next to the title. */
  icon?: ReactNode
  /** Extra classes on the wrapper. */
  className?: string
}

/**
 * Section heading block for use INSIDE `<AdminLayout>` content.
 *
 * `AdminLayout` already renders the page-level title in `<AdminHeader>`. This
 * component is for sub-section headings within long pages (e.g. "Recent
 * redemptions" above a table), or for top-of-content branded blocks pages
 * sometimes need beyond the header.
 *
 * Standardizes the various ad-hoc title `<div>`s you'll find in pages like
 * redemptions and support today.
 *
 * Example:
 * ```tsx
 * <PageHeader
 *   eyebrow="Loyalty"
 *   title="Redemptions"
 *   subtitle="Manage reward fulfillment and track redemption status."
 *   icon={<Ticket size={24} weight="fill" />}
 *   actions={<button className="...">Export</button>}
 * />
 * ```
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  icon,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">
            {eyebrow}
          </p>
        )}
        <h2 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white tracking-tight">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-white/55 mt-1">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}
