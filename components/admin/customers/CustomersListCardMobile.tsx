'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CustomerRow } from '@/lib/admin/customers'

// ── formatters ─────────────────────────────────────────────────────────────

const $Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const nFmt = new Intl.NumberFormat('en-US')

// ── constants ───────────────────────────────────────────────────────────────

const LONG_PRESS_MS = 500
const SWIPE_THRESHOLD_PX = 60

// ── types ───────────────────────────────────────────────────────────────────

export interface CustomersListCardMobileProps {
  row: CustomerRow
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
  isSuperAdmin: boolean
  onGiftPoints?: (id: string) => void
}

// ── component ───────────────────────────────────────────────────────────────

export function CustomersListCardMobile({
  row,
  selectedIds,
  onToggleSelection,
  isSuperAdmin,
  onGiftPoints,
}: CustomersListCardMobileProps) {
  const router = useRouter()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const swipeStartX = useRef<number | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const inMultiSelect = selectedIds.size > 0
  const isSelected = selectedIds.has(row.id)

  const handleTap = () => {
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    if (inMultiSelect) onToggleSelection(row.id)
    else router.push(`/admin/customers/${row.id}`)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    longPressed.current = false
    swipeStartX.current = e.touches[0]?.clientX ?? null
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true
      onToggleSelection(row.id)
    }, LONG_PRESS_MS)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return
    const dx = (e.touches[0]?.clientX ?? 0) - swipeStartX.current
    if (Math.abs(dx) > 5 && longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (dx < 0) setSwipeOffset(Math.max(dx, -120))
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (Math.abs(swipeOffset) >= SWIPE_THRESHOLD_PX && isSuperAdmin && onGiftPoints) {
      setRevealed(true)
    } else {
      setSwipeOffset(0)
    }
    swipeStartX.current = null
  }

  return (
    <div className="md:hidden relative overflow-hidden rounded-md border border-white/8 bg-neutral-900/60">
      {revealed && isSuperAdmin && onGiftPoints && (
        <button
          type="button"
          onClick={() => {
            onGiftPoints(row.id)
            setRevealed(false)
            setSwipeOffset(0)
          }}
          className="absolute right-0 top-0 h-full px-4 bg-[#FF3131] text-white text-xs font-semibold"
        >
          Gift
        </button>
      )}
      <button
        type="button"
        aria-label={`Open ${row.email}`}
        aria-pressed={isSelected}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        className={`block w-full text-left p-3 transition-transform ${
          isSelected ? 'bg-white/[0.06]' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{row.email}</div>
            {row.name && <div className="text-xs text-white/40 truncate">{row.name}</div>}
          </div>
          {row.tierName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0"
              style={{
                background: `${row.tierColor ?? '#64748B'}26`,
                color: row.tierColor ?? '#94A3B8',
              }}
            >
              {row.tierName}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/60">
          <div>{nFmt.format(row.totalOrders)} orders</div>
          <div>{$Fmt.format(row.totalSpent)}</div>
          <div>{nFmt.format(row.currentPoints)} pts</div>
        </div>
      </button>
    </div>
  )
}
