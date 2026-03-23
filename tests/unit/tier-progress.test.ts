import { describe, expect, it } from 'vitest'
import { calculateTierProgressWithTiers } from '@/lib/loyalty/tier-progress'

describe('tier progress', () => {
  it('does not report max tier when a higher tier exists for current slug', () => {
    const progress = calculateTierProgressWithTiers({
      currentTierSlug: 'friend',
      annualPointsEarned: 1450,
      tiers: [
        { name: 'Newcomer', slug: 'newcomer', minAnnualPoints: 0, pointMultiplier: 1 },
        { name: 'Friend', slug: 'friend', minAnnualPoints: 1000, pointMultiplier: 1.25 },
        { name: 'Bestie', slug: 'bestie', minAnnualPoints: 3000, pointMultiplier: 1.5 },
      ],
    })

    expect(progress.currentTier.slug).toBe('friend')
    expect(progress.isMaxTier).toBe(false)
    expect(progress.nextTier?.slug).toBe('bestie')
    expect(progress.pointsNeeded).toBe(1550)
  })

  it('reports max tier only when current tier is highest configured tier', () => {
    const progress = calculateTierProgressWithTiers({
      currentTierSlug: 'bestie',
      annualPointsEarned: 9000,
      tiers: [
        { name: 'Newcomer', slug: 'newcomer', minAnnualPoints: 0, pointMultiplier: 1 },
        { name: 'Friend', slug: 'friend', minAnnualPoints: 1000, pointMultiplier: 1.25 },
        { name: 'Bestie', slug: 'bestie', minAnnualPoints: 3000, pointMultiplier: 1.5 },
      ],
    })

    expect(progress.currentTier.slug).toBe('bestie')
    expect(progress.isMaxTier).toBe(true)
    expect(progress.nextTier).toBeNull()
    expect(progress.pointsNeeded).toBe(0)
  })

  it('falls back to inferred tier when current slug is missing', () => {
    const progress = calculateTierProgressWithTiers({
      currentTierSlug: 'unknown-tier',
      annualPointsEarned: 3200,
      tiers: [
        { name: 'Mind', slug: 'mind', minAnnualPoints: 0, pointMultiplier: 1 },
        { name: 'Heart', slug: 'heart', minAnnualPoints: 2000, pointMultiplier: 1.25 },
        { name: 'Bestie', slug: 'bestie', minAnnualPoints: 5000, pointMultiplier: 1.5 },
      ],
    })

    expect(progress.currentTier.slug).toBe('heart')
    expect(progress.isMaxTier).toBe(false)
    expect(progress.nextTier?.slug).toBe('bestie')
  })
})
