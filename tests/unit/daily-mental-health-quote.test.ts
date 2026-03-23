import { describe, expect, it } from 'vitest'
import {
  MENTAL_HEALTH_QUOTES,
  getDailyMentalHealthQuote,
  getMsUntilNextLocalMidnight,
} from '@/lib/profile/daily-mental-health-quote'

describe('daily mental health quote helper', () => {
  it('returns the same quote for the same local calendar day', () => {
    const morning = new Date(2026, 2, 21, 9, 30, 0)
    const evening = new Date(2026, 2, 21, 22, 15, 0)

    expect(getDailyMentalHealthQuote(morning)).toEqual(getDailyMentalHealthQuote(evening))
  })

  it('rotates quote index predictably across consecutive days', () => {
    const dayOne = new Date(2026, 0, 5, 12, 0, 0)
    const dayTwo = new Date(2026, 0, 6, 12, 0, 0)

    const firstQuote = getDailyMentalHealthQuote(dayOne)
    const secondQuote = getDailyMentalHealthQuote(dayTwo)
    const firstIndex = MENTAL_HEALTH_QUOTES.findIndex((quote) => quote === firstQuote)
    const secondIndex = MENTAL_HEALTH_QUOTES.findIndex((quote) => quote === secondQuote)

    expect(firstIndex).toBeGreaterThanOrEqual(0)
    expect(secondIndex).toBeGreaterThanOrEqual(0)
    expect(secondIndex).toBe((firstIndex + 1) % MENTAL_HEALTH_QUOTES.length)
  })

  it('always resolves to an in-range quote from the curated list', () => {
    const start = new Date(2026, 0, 1, 12, 0, 0)

    for (let offset = 0; offset < 400; offset += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + offset)

      const quote = getDailyMentalHealthQuote(date)
      expect(MENTAL_HEALTH_QUOTES).toContain(quote)
    }
  })

  it('returns a positive duration to the next local midnight within one day', () => {
    const midday = new Date(2026, 2, 21, 13, 25, 10, 500)
    const nearMidnight = new Date(2026, 2, 21, 23, 59, 59, 900)

    const middayDuration = getMsUntilNextLocalMidnight(midday)
    const nearMidnightDuration = getMsUntilNextLocalMidnight(nearMidnight)
    const oneDay = 24 * 60 * 60 * 1000

    expect(middayDuration).toBeGreaterThan(0)
    expect(middayDuration).toBeLessThanOrEqual(oneDay)
    expect(nearMidnightDuration).toBeGreaterThan(0)
    expect(nearMidnightDuration).toBeLessThanOrEqual(oneDay)
  })
})
