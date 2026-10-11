import * as React from 'react'
import Link from 'next/link'
import type { RewardView, RewardViewType } from '@/lib/loyalty/shopify-bridge'
import { Badge, type BadgeProps } from '@/components/storefront/ui/Badge'
import { Button } from '@/components/storefront/ui/Button'
import { Display } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'
import { formatPoints, LOYALTY_SIGN_IN_HREF } from './format'

/** Who is looking: drives the card's call to action. */
export type RewardCardMode = 'signed-in' | 'signed-out' | 'unavailable'

const TYPE_LABEL: Record<RewardViewType, string> = {
  DISCOUNT: 'Discount',
  FREE_SHIPPING: 'Shipping',
  EARLY_ACCESS: 'Drop',
  OTHER: 'Perk',
}

const TYPE_BADGE: Record<RewardViewType, NonNullable<BadgeProps['variant']>> = {
  DISCOUNT: 'neutral',
  FREE_SHIPPING: 'new',
  EARLY_ACCESS: 'drop',
  OTHER: 'neutral',
}

/** The disabled button's label for a locked reward. */
export function lockedLabel(reward: RewardView): string {
  switch (reward.reason) {
    case 'points':
      return `Need ${formatPoints(reward.pointsShort)} more`
    case 'tier':
      return 'Higher tier required'
    case 'limit':
      return 'Already redeemed'
    case 'soldout':
      return 'Sold out'
    default:
      return 'Redeem'
  }
}

export interface RewardCardProps {
  reward: RewardView
  mode: RewardCardMode
  onRedeem?: (reward: RewardView) => void
  className?: string
}

/** One catalogue tile (board 06): pill, big title, description, cost, action. */
export function RewardCard({ reward, mode, onRedeem, className }: RewardCardProps) {
  const titleId = React.useId()
  const locked = !reward.canRedeem

  return (
    <article
      aria-labelledby={titleId}
      data-reward={reward.id}
      data-reason={mode === 'signed-in' ? reward.reason : undefined}
      className={cn(
        'flex flex-col gap-4 rounded-sharp border border-line bg-paper p-5',
        mode === 'signed-in' && locked && 'opacity-80',
        className
      )}
    >
      <Badge variant={TYPE_BADGE[reward.type]} className="self-start">
        {TYPE_LABEL[reward.type]}
      </Badge>
      <div className="flex flex-1 flex-col gap-2">
        <Display as="h3" size="md" id={titleId}>
          {reward.name}
        </Display>
        {reward.description ? <p className="m-0 text-sm text-ink-soft">{reward.description}</p> : null}
      </div>
      <p className="m-0 text-sm text-ink">
        <span className="num text-lg font-semibold">{formatPoints(reward.pointsCost)}</span> pts
      </p>
      {mode === 'signed-in' ? (
        <Button
          variant={locked ? 'outline' : 'ink'}
          disabled={locked}
          onClick={() => onRedeem?.(reward)}
          className="w-full"
        >
          {locked ? lockedLabel(reward) : 'Redeem'}
        </Button>
      ) : mode === 'signed-out' ? (
        <Button asChild variant="outline" className="w-full">
          <Link href={LOYALTY_SIGN_IN_HREF}>Sign in to redeem</Link>
        </Button>
      ) : null}
    </article>
  )
}
