// components/admin/v2/AdminHeaderV2.tsx
'use client'

import { Bell, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

export interface AdminHeaderV2Props {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  onOpenSearch?: () => void
  className?: string
}

export function AdminHeaderV2({
  title,
  subtitle,
  actions,
  onOpenSearch,
  className,
}: AdminHeaderV2Props) {
  return (
    <header
      className={cn(
        'h-14 flex items-center px-5 gap-3 border-b border-[var(--color-border-subtle)]',
        'bg-white/[0.01] backdrop-blur-md',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-bold text-white tracking-[-0.01em] truncate">{title}</h1>
        {subtitle && (
          <div className="text-[10px] text-white/45 mt-px truncate">{subtitle}</div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] border border-[var(--color-border-subtle)] text-white/45 text-[10px] hover:bg-white/[0.06] hover:text-white/65 transition-colors"
      >
        <MagnifyingGlass size={12} />
        <span>Search anything</span>
        <span className="ml-6 px-1.5 py-0.5 bg-white/[0.05] rounded text-[9px]">⌘K</span>
      </button>

      <button
        type="button"
        aria-label="Notifications"
        className="w-8 h-8 rounded-md bg-white/[0.04] border border-[var(--color-border-subtle)] text-white/55 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
      >
        <Bell size={14} weight="duotone" />
      </button>

      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  )
}
