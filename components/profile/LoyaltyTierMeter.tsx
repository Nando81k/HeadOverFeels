'use client'

import { Lightning, TrendUp } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface LoyaltyTierMeterProps {
  isMaxTier: boolean
  nextTierName?: string | null
  pointsNeeded: number
  progressPercentage: number
  title?: string
  statusLabel?: string
  maxTierLabel?: string
  className?: string
  isAnimating?: boolean
  showShimmer?: boolean
  compact?: boolean
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function LoyaltyTierMeter({
  isMaxTier,
  nextTierName,
  pointsNeeded,
  progressPercentage,
  title,
  statusLabel,
  maxTierLabel = "Maximum tier achieved! You're earning the highest rewards.",
  className = '',
  isAnimating = false,
  showShimmer = false,
  compact = false,
}: LoyaltyTierMeterProps) {
  const containerPadding = compact
    ? 'px-3 py-2.5 md:px-3.5 md:py-3'
    : 'px-3 py-3 md:px-4 md:py-4'

  if (isMaxTier) {
    return (
      <div className={className}>
        <div className={`rounded-xl border border-white/25 bg-black/20 backdrop-blur-sm ${containerPadding}`}>
          <div className="flex items-center gap-2 text-white/90">
            <Lightning size={compact ? 14 : 16} weight="fill" />
            <span className={compact ? 'text-[11px] md:text-xs font-semibold uppercase tracking-[0.12em]' : 'text-sm md:text-[15px] font-medium'}>
              {maxTierLabel}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const safeProgress = clampPercentage(progressPercentage)
  const heading = title || `Progress to ${nextTierName || 'Next Tier'}`
  const label = statusLabel || `${pointsNeeded.toLocaleString()} pts away`

  return (
    <div className={className}>
      <div className={`rounded-xl border border-white/25 bg-black/20 backdrop-blur-sm ${containerPadding}`}>
        <div className={compact ? 'flex items-center justify-between gap-2 mb-2' : 'flex items-center justify-between gap-2 text-sm mb-2.5 md:mb-3'}>
          <span className={compact ? 'text-white/80 flex items-center gap-1.5 text-[11px] md:text-xs font-semibold uppercase tracking-[0.12em]' : 'text-white/80 flex items-center gap-1.5 font-medium'}>
            <TrendUp size={compact ? 12 : 14} weight="bold" />
            {heading}
          </span>
          <motion.span
            animate={isAnimating ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={compact ? 'text-white font-semibold text-[11px] md:text-xs uppercase tracking-[0.12em]' : 'text-white font-bold text-xs md:text-sm'}
          >
            {label}
          </motion.span>
        </div>

        <div
          className={compact ? 'h-2 md:h-2.5 rounded-full bg-white/25 overflow-hidden relative' : 'h-2.5 md:h-3 rounded-full bg-white/25 overflow-hidden relative'}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(safeProgress)}
          aria-label={heading}
        >
          {isAnimating && (
            <motion.div
              initial={{ opacity: 0.2 }}
              animate={{ opacity: [0.2, 0.45, 0.2] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-0 bg-white/15"
            />
          )}
          <motion.div
            initial={false}
            animate={{ width: `${safeProgress}%` }}
            transition={{ duration: isAnimating ? 0.9 : 0.45, ease: 'easeOut' }}
            className="h-full rounded-full bg-white relative overflow-hidden"
          >
            {showShimmer && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '220%' }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 w-1/2 bg-linear-to-r from-transparent via-black/15 to-transparent"
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
