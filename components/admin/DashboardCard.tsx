import Link from 'next/link'
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'

interface DashboardCardProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  action?: {
    label: string
    href: string
  }
  className?: string
  noPadding?: boolean
}

export function DashboardCard({ 
  title, 
  icon,
  children, 
  action,
  className = '',
  noPadding = false
}: DashboardCardProps) {
  return (
    <div className={`bg-neutral-900 border border-white/10 hover:border-white/20 transition-colors ${className}`}>
      {/* Card Header */}
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {icon && (
              <div className="p-1.5 sm:p-2 bg-white/5 flex-shrink-0">
                {icon}
              </div>
            )}
            <h3 className="text-[10px] sm:text-xs font-medium tracking-[0.1em] sm:tracking-[0.15em] text-white/70 uppercase truncate">{title}</h3>
          </div>
          {action && (
            <Link
              href={action.href}
              className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-white/40 hover:text-white transition-colors group flex-shrink-0"
            >
              <span className="hidden sm:inline">{action.label}</span>
              <span className="sm:hidden">View</span>
              <ArrowUpRight size={12} weight="bold" className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className={noPadding ? '' : 'p-3 sm:p-5'}>
        {children}
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    label: string
  }
  icon: React.ReactNode
  href?: string
  badge?: number
}

export function StatCard({ title, value, change, icon, href, badge }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <div className="p-1.5 sm:p-2.5 bg-white/5">
          <div className="[&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-6 sm:[&>svg]:h-6">
            {icon}
          </div>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 sm:px-2 py-0.5 bg-[#FF3131] text-white text-[9px] sm:text-[10px] font-bold">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-0.5 sm:space-y-1">
        <p className="text-[9px] sm:text-[10px] font-medium tracking-[0.1em] sm:tracking-[0.15em] text-white/40 uppercase">{title}</p>
        <p className="text-lg sm:text-2xl font-bold text-white tracking-tight">{value}</p>
        {change && (
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs">
            <span className={`font-medium ${change.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change.value >= 0 ? '+' : ''}{typeof change.value === 'number' && !isNaN(change.value) ? change.value.toFixed(0) : 0}%
            </span>
            <span className="text-white/30 truncate">{change.label}</span>
          </div>
        )}
      </div>
    </>
  )

  if (href) {
    return (
      <Link 
        href={href}
        className="block bg-neutral-900 p-3 sm:p-5 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="bg-neutral-900 p-3 sm:p-5 border border-white/10">
      {content}
    </div>
  )
}
