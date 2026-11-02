import * as React from 'react'
import Link from 'next/link'
import type { LoyaltyOverview, RewardView } from '@/lib/loyalty/shopify-bridge'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { formatDate, formatDollars, formatPoints } from './format'
import { TierProgress } from './TierProgress'

/** The richest discount reward the customer can redeem right now, if any. */
function bestAffordableDiscount(overview: LoyaltyOverview): RewardView | null {
  let best: RewardView | null = null
  for (const reward of overview.rewards) {
    if (reward.type !== 'DISCOUNT' || reward.value === null || !reward.canRedeem) continue
    if (!best || reward.value > (best.value ?? 0)) best = reward
  }
  return best
}

/** The cheapest discount reward locked only by the balance. */
function nearestDiscount(overview: LoyaltyOverview): RewardView | null {
  let nearest: RewardView | null = null
  for (const reward of overview.rewards) {
    if (reward.type !== 'DISCOUNT' || reward.value === null || reward.reason !== 'points') continue
    if (!nearest || reward.pointsCost < nearest.pointsCost) nearest = reward
  }
  return nearest
}

/**
 * "Worth $X off right now, or hold out N more for <next tier>" (board 06),
 * with honest fallbacks when either half is missing.
 */
export function heroCopy(overview: LoyaltyOverview): string {
  const best = bestAffordableDiscount(overview)
  const worth = best && best.value !== null ? `Worth ${formatDollars(best.value)} off right now` : null
  const next =
    overview.nextTier && overview.pointsToNext !== null
      ? `hold out ${formatPoints(overview.pointsToNext)} more for ${overview.nextTier.name}`
      : null

  if (worth && next) return `${worth}, or ${next}.`
  if (worth) return `${worth}. You're at the top tier.`

  const nearest = nearestDiscount(overview)
  const unlock =
    nearest && nearest.value !== null
      ? `${formatPoints(nearest.pointsShort)} more unlocks ${formatDollars(nearest.value)} off`
      : null
  if (unlock && next) return `${unlock}, or ${next}.`
  if (unlock) return `${unlock}.`
  if (next) return `${next.charAt(0).toUpperCase()}${next.slice(1)}.`
  return 'Every order adds up.'
}

export interface PointsHeroProps {
  overview: LoyaltyOverview
}

/** The signed-in hero: balance in huge mono digits, the worth line, Redeem / Shop, the tier card. */
export function PointsHero({ overview }: PointsHeroProps) {
  return (
    <Section tone="ink" aria-label="Your balance">
      <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="flex flex-col items-start gap-6">
          <h1 className="m-0 text-[11px] font-semibold uppercase tracking-eyebrow text-bone/70">Care Points</h1>
          <p className="num m-0 text-[clamp(4rem,14vw,10rem)] font-semibold leading-none tracking-tight">
            {formatPoints(overview.points)}
          </p>
          <p className="m-0 max-w-[36rem] text-base text-bone/80">{heroCopy(overview)}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="signal" size="lg">
              <a href="#rewards">Redeem</a>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-bone text-bone hover:bg-bone hover:text-ink">
              <Link href="/collections/all">Shop</Link>
            </Button>
          </div>
          {overview.expiringSoon ? (
            <p role="status" className="m-0 rounded-sharp border border-bone/30 px-4 py-3 text-sm text-bone">
              <span className="num font-semibold">{formatPoints(overview.expiringSoon.points)}</span> points expire on{' '}
              {formatDate(overview.expiringSoon.at)}. Spend them first.
            </p>
          ) : null}
        </div>
        <TierProgress overview={overview} />
      </div>
    </Section>
  )
}
