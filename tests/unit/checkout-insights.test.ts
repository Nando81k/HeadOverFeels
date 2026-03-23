import { describe, expect, it } from 'vitest'
import { calculateCheckoutLoyaltyPreview, calculateCheckoutSavings } from '@/lib/checkout/insights'

describe('checkout insights', () => {
  it('calculates points preview with no multipliers', () => {
    const result = calculateCheckoutLoyaltyPreview({
      orderTotal: 118.42,
      currentPoints: 250,
      annualPointsEarned: 900,
      pointMultiplier: 1,
      activeEventMultiplier: 1,
      currentTierSlug: 'newcomer',
    })

    expect(result.basePoints).toBe(118)
    expect(result.totalPoints).toBe(118)
    expect(result.eventBonusPoints).toBe(0)
    expect(result.tierBonusPoints).toBe(0)
    expect(result.projectedCurrentPoints).toBe(368)
    expect(result.projectedAnnualPoints).toBe(1018)
    expect(result.projectedTier.slug).toBe('friend')
    expect(result.willUpgradeTier).toBe(true)
  })

  it('matches backend floor order for event and tier multipliers', () => {
    const result = calculateCheckoutLoyaltyPreview({
      orderTotal: 5.99,
      currentPoints: 0,
      annualPointsEarned: 0,
      pointMultiplier: 1.25,
      activeEventMultiplier: 1.5,
      currentTierSlug: 'newcomer',
    })

    expect(result.basePoints).toBe(5)
    expect(result.eventBonusPoints).toBe(2) // floor(5 * 1.5) = 7
    expect(result.totalPoints).toBe(8) // floor(7 * 1.25) = 8
    expect(result.tierBonusPoints).toBe(1)
  })

  it('projects tier and post-purchase next-tier distance', () => {
    const result = calculateCheckoutLoyaltyPreview({
      orderTotal: 200,
      currentPoints: 1500,
      annualPointsEarned: 2900,
      pointMultiplier: 1.5,
      activeEventMultiplier: 1,
      currentTierSlug: 'friend',
      tiers: [
        { name: 'Newcomer', slug: 'newcomer', minAnnualPoints: 0, pointMultiplier: 1 },
        { name: 'Friend', slug: 'friend', minAnnualPoints: 1000, pointMultiplier: 1.25 },
        { name: 'Bestie', slug: 'bestie', minAnnualPoints: 3000, pointMultiplier: 1.5 },
        { name: 'Soulmate', slug: 'soulmate', minAnnualPoints: 7500, pointMultiplier: 2 },
      ],
    })

    expect(result.totalPoints).toBe(300)
    expect(result.projectedAnnualPoints).toBe(3200)
    expect(result.projectedTier.slug).toBe('bestie')
    expect(result.willUpgradeTier).toBe(true)
    expect(result.nextTierAfterPurchase?.slug).toBe('soulmate')
    expect(result.pointsToNextTierAfterPurchase).toBe(4300)
  })

  it('calculates combined savings from discount, shipping, and tax deltas', () => {
    const savings = calculateCheckoutSavings({
      subtotal: 120,
      discount: 20,
      shipping: 0,
      baseShippingPrice: 10,
      tax: 8,
      taxRate: 0.08,
    })

    expect(savings.discountSavings).toBe(20)
    expect(savings.shippingSavings).toBe(10)
    expect(savings.taxSavings).toBe(1.6) // 120*0.08 - 8
    expect(savings.totalSavings).toBe(31.6)
  })
})
