// tests/unit/storefront/loyalty-public.test.ts — lib/storefront/loyalty-public.ts (Task 6)
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { prisma, cache } = vi.hoisted(() => ({
  prisma: {
    loyaltyTier: { findMany: vi.fn() },
    reward: { findMany: vi.fn() },
  },
  cache: { calls: [] as { keyParts?: string[]; options?: Record<string, unknown> }[] },
}))

vi.mock('@/lib/prisma', () => ({ prisma }))
// `unstable_cache` needs the Next request store; record the wiring and run the loader as-is.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown, keyParts?: string[], options?: Record<string, unknown>) => {
    cache.calls.push({ keyParts, options })
    return fn
  },
}))

import { getLoyaltyPublicData, LOYALTY_PUBLIC_CACHE_KEY, LOYALTY_PUBLIC_REVALIDATE } from '@/lib/storefront/loyalty-public'

const tierRows = [
  {
    id: 'tier-member',
    name: 'Member',
    slug: 'member',
    minAnnualPoints: 0,
    pointMultiplier: 1,
    freeShipping: false,
    earlyDropAccess: false,
    perks: JSON.stringify({ birthdayGift: true }),
    sortOrder: 0,
  },
  {
    id: 'tier-insider',
    name: 'Insider',
    slug: 'insider',
    minAnnualPoints: 500,
    pointMultiplier: 1.25,
    freeShipping: true,
    earlyDropAccess: true,
    perks: null,
    sortOrder: 1,
  },
]

const rewardRows = [
  {
    id: 'reward-5',
    name: '$5 off',
    description: 'Five off.',
    pointsCost: 500,
    rewardType: 'DISCOUNT',
    value: 5,
    minTierRequired: null,
    sortOrder: 0,
  },
  {
    id: 'reward-ship',
    name: 'Free shipping',
    description: null,
    pointsCost: 750,
    rewardType: 'FREE_SHIPPING',
    value: null,
    minTierRequired: 'insider',
    sortOrder: 1,
  },
  {
    id: 'reward-perk',
    name: 'Signed tee',
    description: 'A perk.',
    pointsCost: 900,
    rewardType: 'PHYSICAL_PERK',
    value: null,
    minTierRequired: null,
    sortOrder: 2,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  prisma.loyaltyTier.findMany.mockResolvedValue(tierRows)
  prisma.reward.findMany.mockResolvedValue(rewardRows)
})

describe('getLoyaltyPublicData', () => {
  it('is wrapped in unstable_cache keyed loyalty-public for five minutes', () => {
    expect(LOYALTY_PUBLIC_CACHE_KEY).toBe('loyalty-public')
    expect(LOYALTY_PUBLIC_REVALIDATE).toBe(300)
    expect(cache.calls).toContainEqual({
      keyParts: ['loyalty-public'],
      options: expect.objectContaining({ revalidate: 300 }),
    })
  })

  it('reads active, public tiers in order and maps them to the TierView shape', async () => {
    const data = await getLoyaltyPublicData()
    expect(prisma.loyaltyTier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, isInviteOnly: false },
        orderBy: [{ sortOrder: 'asc' }, { minAnnualPoints: 'asc' }],
      })
    )
    expect(data.tiers.map((tier) => tier.slug)).toEqual(['member', 'insider'])
    expect(data.tiers[0]).toEqual({
      id: 'tier-member',
      name: 'Member',
      slug: 'member',
      minAnnualPoints: 0,
      pointMultiplier: 1,
      perks: ['Birthday gift'],
    })
    expect(data.tiers[1].perks).toEqual(['1.25x points on every order', 'Free shipping', 'Early drop access'])
  })

  it('reads active rewards and keeps the public copy fields', async () => {
    const data = await getLoyaltyPublicData()
    expect(prisma.reward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { pointsCost: 'asc' }],
      })
    )
    expect(data.rewards).toEqual([
      {
        id: 'reward-5',
        name: '$5 off',
        description: 'Five off.',
        pointsCost: 500,
        type: 'DISCOUNT',
        value: 5,
        minTierRequired: null,
      },
      {
        id: 'reward-ship',
        name: 'Free shipping',
        description: null,
        pointsCost: 750,
        type: 'FREE_SHIPPING',
        value: null,
        minTierRequired: 'insider',
      },
    ])
  })
})
