'use client'

import { GridFour, Gift, ClockCounterClockwise, Gear } from '@phosphor-icons/react'

export type ProfileSection = 'overview' | 'loyalty' | 'activity' | 'settings'

const SECTIONS: ReadonlyArray<{
  id: ProfileSection
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
}> = [
  { id: 'overview', label: 'Overview', icon: GridFour },
  { id: 'loyalty', label: 'Loyalty', icon: Gift },
  { id: 'activity', label: 'Activity', icon: ClockCounterClockwise },
  { id: 'settings', label: 'Settings', icon: Gear },
]

interface ProfileSectionNavProps {
  activeSection: ProfileSection
  onSectionChange: (section: ProfileSection) => void
  pendingRedemptionCount?: number
  variant: 'sidebar' | 'chips'
}

export function ProfileSectionNav({
  activeSection,
  onSectionChange,
  pendingRedemptionCount = 0,
  variant,
}: ProfileSectionNavProps) {
  if (variant === 'sidebar') {
    return (
      <nav aria-label="Profile sections" className="flex flex-col gap-1">
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = activeSection === id
          const showBadge = id === 'loyalty' && pendingRedemptionCount > 0
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSectionChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${
                isActive
                  ? 'bg-black text-white shadow-sm'
                  : 'text-black/55 hover:text-black hover:bg-black/3'
              }`}
            >
              <Icon size={16} weight={isActive ? 'fill' : 'bold'} />
              <span className="flex-1 text-left">{label}</span>
              {showBadge && (
                <span
                  className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${
                    isActive ? 'bg-white text-black' : 'bg-amber-400 text-white'
                  }`}
                >
                  {pendingRedemptionCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    )
  }

  // chips variant — mobile horizontal scroll
  return (
    <nav
      aria-label="Profile sections"
      className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3"
    >
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = activeSection === id
        const showBadge = id === 'loyalty' && pendingRedemptionCount > 0
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              isActive
                ? 'bg-black text-white shadow-sm'
                : 'bg-white text-black/60 border border-black/10 hover:border-black/30 hover:text-black'
            }`}
          >
            <Icon size={13} weight={isActive ? 'fill' : 'bold'} />
            <span>{label}</span>
            {showBadge && (
              <span
                className={`ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                  isActive ? 'bg-white text-black' : 'bg-amber-400 text-white'
                }`}
              >
                {pendingRedemptionCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
