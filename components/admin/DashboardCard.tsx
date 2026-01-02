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
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 bg-white/5">
                {icon}
              </div>
            )}
            <h3 className="text-xs font-medium tracking-[0.15em] text-white/70 uppercase">{title}</h3>
          </div>
          {action && (
            <Link
              href={action.href}
              className="flex items-center gap-1 text-xs font-medium text-white/40 hover:text-white transition-colors group"
            >
              {action.label}
              <ArrowUpRight size={12} weight="bold" className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className={noPadding ? '' : 'p-5'}>
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
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-white/5">
          {icon}
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 bg-[#FF3131] text-white text-[10px] font-bold">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-medium tracking-[0.15em] text-white/40 uppercase">{title}</p>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {change && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`font-medium ${change.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change.value >= 0 ? '+' : ''}{change.value}%
            </span>
            <span className="text-white/30">{change.label}</span>
          </div>
        )}
      </div>
    </>
  )

  if (href) {
    return (
      <Link 
        href={href}
        className="block bg-neutral-900 p-5 border border-white/10 hover:border-white/20 hover:bg-neutral-900/80 transition-all group"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="bg-neutral-900 p-5 border border-white/10">
      {content}
    </div>
  )
}
