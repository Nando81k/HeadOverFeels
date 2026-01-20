'use client'

import { Bell, MagnifyingGlass, Gear } from '@phosphor-icons/react'
import { useState } from 'react'
import RefreshButton from './RefreshButton'

interface AdminHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  onSearchClick?: () => void
}

export function AdminHeader({ title, subtitle, actions, onSearchClick }: AdminHeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick()
    } else {
      // Trigger Cmd+K programmatically
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      })
      document.dispatchEvent(event)
    }
  }

  return (
    <header className="h-14 sm:h-16 bg-black border-b border-white/10 sticky top-0 z-30 px-3 sm:px-6">
      <div className="h-full flex items-center justify-between gap-2">
        {/* Title Section */}
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-lg font-bold text-white tracking-tight uppercase truncate">{title}</h1>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-white/40 mt-0.5 tracking-wide hidden sm:block">{subtitle}</p>
          )}
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Custom Actions - Hidden on very small screens, show on sm+ */}
          <div className="hidden sm:flex items-center gap-2">
            {actions}
          </div>

          {/* Refresh Button */}
          <RefreshButton />

          {/* Search with Keyboard Hint */}
          <button 
            onClick={handleSearchClick}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <MagnifyingGlass size={14} weight="bold" />
            <span className="text-xs text-white/30 group-hover:text-white/50">
              Search
            </span>
            <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-white/30 bg-white/5 border border-white/10">
              ⌘K
            </kbd>
          </button>
          
          {/* Mobile Search Icon */}
          <button 
            onClick={handleSearchClick}
            className="lg:hidden p-1.5 sm:p-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <MagnifyingGlass size={16} weight="bold" className="sm:w-[18px] sm:h-[18px]" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-1.5 sm:p-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors relative"
            >
              <Bell size={16} weight="bold" className="sm:w-[18px] sm:h-[18px]" />
              <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 w-1.5 h-1.5 bg-[#FF3131]"></span>
            </button>
          </div>

          {/* Settings - Hide on mobile */}
          <button className="hidden sm:block p-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors">
            <Gear size={18} weight="bold" />
          </button>

          {/* Profile */}
          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-white/10">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white flex items-center justify-center text-black font-bold text-[10px] sm:text-xs">
              A
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-medium text-white tracking-wide">ADMIN</p>
              <p className="text-[10px] text-white/40 tracking-wide">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
