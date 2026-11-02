// tests/unit/storefront/shipping.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'

const usd = (amount: string) => ({ amount, currencyCode: 'USD' })

async function loadShipping() {
  vi.resetModules()
  return import('@/lib/storefront/shipping')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('FREE_SHIPPING_THRESHOLD', () => {
  it('defaults to 75', async () => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', '')
    const { FREE_SHIPPING_THRESHOLD, FREE_SHIPPING_COPY } = await loadShipping()

    expect(FREE_SHIPPING_THRESHOLD).toBe(75)
    expect(FREE_SHIPPING_COPY).toBe('Free US shipping over $75')
  })

  it('reads the env override', async () => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', '100')
    const { FREE_SHIPPING_THRESHOLD, FREE_SHIPPING_COPY } = await loadShipping()

    expect(FREE_SHIPPING_THRESHOLD).toBe(100)
    expect(FREE_SHIPPING_COPY).toBe('Free US shipping over $100')
  })

  it.each(['abc', '0', '-20', 'Infinity'])('falls back to 75 for %j', async (raw) => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', raw)
    const { FREE_SHIPPING_THRESHOLD } = await loadShipping()

    expect(FREE_SHIPPING_THRESHOLD).toBe(75)
  })
})

describe('freeShippingProgress', () => {
  it('reports the remaining amount and ratio below the threshold', async () => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', '')
    const { freeShippingProgress } = await loadShipping()

    expect(freeShippingProgress(usd('50.00'))).toEqual({
      remaining: 25,
      ratio: 50 / 75,
      unlocked: false,
    })
  })

  it('rounds the remaining amount to cents', async () => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', '')
    const { freeShippingProgress } = await loadShipping()

    expect(freeShippingProgress(usd('74.99')).remaining).toBe(0.01)
    expect(freeShippingProgress(usd('33.333')).remaining).toBe(41.67)
  })

  it('unlocks at the threshold', async () => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', '')
    const { freeShippingProgress } = await loadShipping()

    expect(freeShippingProgress(usd('75.00'))).toEqual({ remaining: 0, ratio: 1, unlocked: true })
  })

  it('clamps the ratio at 1 and the remaining amount at 0 above the threshold', async () => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', '')
    const { freeShippingProgress } = await loadShipping()

    expect(freeShippingProgress(usd('112.00'))).toEqual({ remaining: 0, ratio: 1, unlocked: true })
  })

  it('clamps the ratio at 0 for an empty, negative or unparseable subtotal', async () => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', '')
    const { freeShippingProgress } = await loadShipping()

    expect(freeShippingProgress(usd('0'))).toEqual({ remaining: 75, ratio: 0, unlocked: false })
    expect(freeShippingProgress(usd('-5'))).toEqual({ remaining: 75, ratio: 0, unlocked: false })
    expect(freeShippingProgress(usd('nope'))).toEqual({ remaining: 75, ratio: 0, unlocked: false })
  })

  it('uses the env threshold', async () => {
    vi.stubEnv('NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD', '100')
    const { freeShippingProgress } = await loadShipping()

    expect(freeShippingProgress(usd('75.00'))).toEqual({
      remaining: 25,
      ratio: 0.75,
      unlocked: false,
    })
  })
})
