import { describe, expect, it } from 'vitest'
import { createSeedRng, randomDateBetween, sampleWithoutReplacement } from '@/lib/seed/historical/random'

describe('historical random helpers', () => {
  it('is deterministic for same seed', () => {
    const rngA = createSeedRng(12345)
    const rngB = createSeedRng(12345)

    const valuesA = Array.from({ length: 20 }, () => rngA.int(1, 1000))
    const valuesB = Array.from({ length: 20 }, () => rngB.int(1, 1000))

    expect(valuesA).toEqual(valuesB)
  })

  it('samples without replacement', () => {
    const rng = createSeedRng(101)
    const values = ['a', 'b', 'c', 'd', 'e']
    const sampled = sampleWithoutReplacement(rng, values, 4)

    expect(sampled.length).toBe(4)
    expect(new Set(sampled).size).toBe(4)
  })

  it('returns bounded date ranges', () => {
    const rng = createSeedRng(2026)
    const from = new Date('2023-03-21T00:00:00.000Z')
    const to = new Date('2026-03-21T23:59:59.999Z')
    const date = randomDateBetween(rng, from, to)

    expect(date.getTime()).toBeGreaterThanOrEqual(from.getTime())
    expect(date.getTime()).toBeLessThanOrEqual(to.getTime())
  })
})
