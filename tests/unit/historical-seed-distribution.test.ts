import { describe, expect, it } from 'vitest'
import {
  allocateWeightedCounts,
  applyGrowthAndSeasonality,
  buildMonthBuckets,
} from '@/lib/seed/historical/distribution'
import {
  DEFAULT_HISTORICAL_FROM,
  DEFAULT_HISTORICAL_TO,
  resolveHistoricalDateRange,
} from '@/lib/seed/historical/config'

describe('historical distribution helpers', () => {
  it('builds bounded month buckets over the full seed range', () => {
    const buckets = buildMonthBuckets(DEFAULT_HISTORICAL_FROM, DEFAULT_HISTORICAL_TO)

    expect(buckets.length).toBeGreaterThanOrEqual(36)
    expect(buckets[0].start.getTime()).toBeGreaterThanOrEqual(DEFAULT_HISTORICAL_FROM.getTime())
    expect(buckets[buckets.length - 1].end.getTime()).toBeLessThanOrEqual(DEFAULT_HISTORICAL_TO.getTime())
  })

  it('allocates exact total counts with weighted rounding', () => {
    const total = 42000
    const weights = [1, 2, 3, 4, 5, 6]
    const allocation = allocateWeightedCounts(total, weights)

    expect(allocation.length).toBe(weights.length)
    expect(allocation.reduce((sum, count) => sum + count, 0)).toBe(total)
    expect(allocation[allocation.length - 1]).toBeGreaterThan(allocation[0])
  })

  it('applies growth and seasonality weights', () => {
    const buckets = buildMonthBuckets(new Date('2023-01-01T00:00:00.000Z'), new Date('2024-12-31T23:59:59.999Z'))
    const weighted = applyGrowthAndSeasonality(buckets)

    expect(weighted.length).toBe(buckets.length)
    expect(weighted.some((bucket) => bucket.weight > 1)).toBe(true)
    expect(weighted.every((bucket) => bucket.weight > 0)).toBe(true)
  })

  it('validates date range inputs', () => {
    expect(() =>
      resolveHistoricalDateRange({
        from: '2026-03-21',
        to: '2023-03-21',
      })
    ).toThrow()
  })
})
