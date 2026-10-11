import 'server-only'

import { unstable_cache } from 'next/cache'

import { tierPerks, type RewardViewType, type TierView } from '@/lib/loyalty/shopify-bridge'
import { prisma } from '@/lib/prisma'

/**
 * The public half of the Care Points hub (Phase 4, Task 6): the active tiers
 * and the reward catalogue, readable by anyone. Signed-in state (balance,
 * gating, history, referral) comes from `getLoyaltyOverviewAction` instead.
 *
 * Cached for five minutes under one key — the catalogue changes from the admin
 * a few times a year, and the hub is public, so a per-request Prisma read
 * would be waste. Nothing per-customer is read here.
 */

export const LOYALTY_PUBLIC_CACHE_KEY = 'loyalty-public'
export const LOYALTY_PUBLIC_REVALIDATE = 300

/** A tier as shown to everyone: `TierView` without the per-customer `current` flag. */
export type PublicTier = Omit<TierView, 'current'>

export type PublicReward = {
  id: string
  name: string
  description: string | null
  pointsCost: number
  type: RewardViewType
  value: number | null
  /** Slug or id of the lowest tier that may redeem it; `null` = everyone. */
  minTierRequired: string | null
}

export type LoyaltyPublicData = { tiers: PublicTier[]; rewards: PublicReward[] }

export const EMPTY_LOYALTY_PUBLIC_DATA: LoyaltyPublicData = { tiers: [], rewards: [] }

/** Reward types the bridge can mint; anything else never reaches the storefront. */
const STOREFRONT_REWARD_TYPES = new Set<RewardViewType>(['DISCOUNT', 'FREE_SHIPPING', 'EARLY_ACCESS'])

function toRewardType(type: string): RewardViewType {
  return type === 'DISCOUNT' || type === 'FREE_SHIPPING' || type === 'EARLY_ACCESS' ? type : 'OTHER'
}

async function loadLoyaltyPublicData(): Promise<LoyaltyPublicData> {
  const [tierRows, rewardRows] = await Promise.all([
    prisma.loyaltyTier.findMany({
      where: { isActive: true, isInviteOnly: false },
      orderBy: [{ sortOrder: 'asc' }, { minAnnualPoints: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        minAnnualPoints: true,
        pointMultiplier: true,
        freeShipping: true,
        earlyDropAccess: true,
        perks: true,
      },
    }),
    prisma.reward.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { pointsCost: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        pointsCost: true,
        rewardType: true,
        value: true,
        minTierRequired: true,
      },
    }),
  ])

  return {
    tiers: tierRows.map((tier) => ({
      id: tier.id,
      name: tier.name,
      slug: tier.slug,
      minAnnualPoints: tier.minAnnualPoints,
      pointMultiplier: tier.pointMultiplier,
      perks: tierPerks(tier),
    })),
    rewards: rewardRows
      .map((reward) => ({
        id: reward.id,
        name: reward.name,
        description: reward.description,
        pointsCost: reward.pointsCost,
        type: toRewardType(reward.rewardType),
        value: reward.value,
        minTierRequired: reward.minTierRequired,
      }))
      .filter((reward) => STOREFRONT_REWARD_TYPES.has(reward.type)),
  }
}

export const getLoyaltyPublicData = unstable_cache(loadLoyaltyPublicData, [LOYALTY_PUBLIC_CACHE_KEY], {
  revalidate: LOYALTY_PUBLIC_REVALIDATE,
  tags: [LOYALTY_PUBLIC_CACHE_KEY],
})
