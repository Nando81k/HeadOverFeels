import * as React from 'react'
import type { LoyaltyOverview } from '@/lib/loyalty/shopify-bridge'
import { cn } from '@/lib/storefront/cn'
import { formatMultiplier, formatPoints } from './format'

export interface TierProgressProps {
  overview: LoyaltyOverview
  className?: string
}

/**
 * The tier card in the hero (board 06): current tier, progress to the next
 * one, and the Lifetime / Multiplier / Expiring stats. Sits on the ink hero,
 * so it paints its own paper surface.
 */
export function TierProgress({ overview, className }: TierProgressProps) {
  const { tier, nextTier, pointsToNext, progressRatio, lifetimePoints, multiplier, expiringSoon } = overview
  const percent = Math.round(Math.min(1, Math.max(0, progressRatio)) * 100)
  const labelId = React.useId()

  const stats: { label: string; value: string }[] = [
    { label: 'Lifetime', value: formatPoints(lifetimePoints) },
    { label: 'Multiplier', value: formatMultiplier(multiplier) },
    { label: 'Expiring', value: formatPoints(expiringSoon?.points ?? 0) },
  ]

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn('flex flex-col gap-5 rounded-sharp bg-paper p-6 text-ink', className)}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute">Your tier</p>
        <p id={labelId} className="m-0 font-display text-xl font-black uppercase tracking-display">
          {tier.name}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-label={nextTier ? `Progress to ${nextTier.name}` : 'Tier progress'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 w-full overflow-hidden rounded-pill bg-line"
        >
          <div className="h-full bg-signal transition-[width] duration-sf-slow ease-sf-out" style={{ width: `${percent}%` }} />
        </div>
        <p className="m-0 text-xs text-ink-soft">
          {nextTier && pointsToNext !== null ? (
            <>
              <span className="num font-semibold text-ink">{formatPoints(pointsToNext)}</span> more this year
              for {nextTier.name}
            </>
          ) : (
            "Top tier — you've earned every perk."
          )}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute">{stat.label}</dt>
            <dd className="num m-0 text-lg font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
