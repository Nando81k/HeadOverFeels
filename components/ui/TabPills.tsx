'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface TabPillsTab {
  id: string
  label: string
  count?: number
  variant?: 'default' | 'live'
}

export interface TabPillsProps {
  tabs: TabPillsTab[]
  active: string
  onChange: (id: string) => void
  className?: string
  /** Show ⌘1–6 keyboard shortcut hints (desktop). Default true. */
  showShortcutHints?: boolean
}

export function TabPills({
  tabs,
  active,
  onChange,
  className,
  showShortcutHints = true,
}: TabPillsProps) {
  // Keyboard shortcut handler: ⌘1 ... ⌘6 jumps to tabs[0...5]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      const num = parseInt(e.key, 10)
      if (!num || num < 1 || num > 9) return
      const target = tabs[num - 1]
      if (target) {
        e.preventDefault()
        onChange(target.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabs, onChange])

  return (
    <div className={cn('flex items-center', className)}>
      <div role="tablist" className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all',
                isActive
                  ? 'bg-red-500/10 text-white shadow-[inset_0_0_0_1px_rgba(255,49,49,0.2)]'
                  : 'text-white/55 hover:text-white/80 hover:bg-white/[0.03]',
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={cn(
                    'ml-1.5 text-[10px]',
                    tab.variant === 'live' ? 'text-red-500' : 'text-white/40',
                  )}
                >
                  {tab.variant === 'live' ? `●${tab.count}` : tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {showShortcutHints && (
        <span className="hidden md:block ml-auto text-[10px] text-white/30 pl-3">
          ⌘1–{Math.min(tabs.length, 9)} to switch
        </span>
      )}
    </div>
  )
}
