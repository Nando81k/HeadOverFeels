'use client'

import { Sparkle } from '@phosphor-icons/react'

interface FreeShippingProgressProps {
  subtotal: number
  threshold?: number
  /**
   * Hex color for the progress bar fill. Defaults to pure black for guests;
   * checkout / cart pass the customer's loyalty tier color so the bar reads
   * as a personal milestone rather than generic chrome.
   */
  accentColor?: string
}

export function FreeShippingProgress({
  subtotal,
  threshold = 100,
  accentColor = '#000000',
}: FreeShippingProgressProps) {
  const remaining = Math.max(0, threshold - subtotal)
  const pct = Math.min(100, (subtotal / threshold) * 100)
  const unlocked = remaining === 0

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-black/60">
        {unlocked ? (
          <span
            className="flex items-center gap-1 font-semibold"
            style={{ color: accentColor }}
          >
            <Sparkle size={12} weight="fill" />
            Free shipping unlocked!
          </span>
        ) : (
          <>
            <span className="font-semibold text-black">${remaining.toFixed(2)}</span> away from free shipping
          </>
        )}
      </p>
      <div className="h-1.5 w-full overflow-hidden bg-black/10">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: accentColor }}
        />
      </div>
    </div>
  )
}
