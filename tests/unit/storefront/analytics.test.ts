// tests/unit/storefront/analytics.test.ts — lib/storefront/analytics.ts (Phase 5, Task 4)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANALYTICS_DOM_EVENT, onAnalyticsEvent, track, type AnalyticsEvent } from '@/lib/storefront/analytics'

type DataLayerWindow = Window & { dataLayer?: unknown[] }

beforeEach(() => {
  delete (window as DataLayerWindow).dataLayer
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('track', () => {
  it('creates the dataLayer and pushes a copy of the event', () => {
    const event: AnalyticsEvent = { event: 'add_to_cart', variantId: 'gid://shopify/ProductVariant/1', quantity: 2 }
    track(event)

    const layer = (window as DataLayerWindow).dataLayer
    expect(layer).toEqual([event])
    expect(layer?.[0]).not.toBe(event)
  })

  it('appends to an existing dataLayer (gtag / GTM own it too)', () => {
    ;(window as DataLayerWindow).dataLayer = [{ event: 'gtm.js' }]
    track({ event: 'page_view', path: '/' })

    expect((window as DataLayerWindow).dataLayer).toHaveLength(2)
  })

  it('dispatches the DOM event with the payload as detail', () => {
    const seen: AnalyticsEvent[] = []
    const off = onAnalyticsEvent((event) => seen.push(event))
    const listener = vi.fn()
    window.addEventListener(ANALYTICS_DOM_EVENT, listener)

    track({ event: 'begin_checkout', value: 88, currency: 'USD', items: 1 })
    off()
    track({ event: 'page_view', path: '/cart' })

    expect(seen).toEqual([{ event: 'begin_checkout', value: 88, currency: 'USD', items: 1 }])
    expect(listener).toHaveBeenCalledTimes(2)
    window.removeEventListener(ANALYTICS_DOM_EVENT, listener)
  })

  it('never throws when the sink is broken', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(window, 'dataLayer', {
      configurable: true,
      get() {
        throw new Error('sealed')
      },
    })

    expect(() => track({ event: 'page_view', path: '/' })).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sealed'))
    // Restore a plain property for the other tests.
    Object.defineProperty(window, 'dataLayer', { configurable: true, writable: true, value: undefined })
  })
})
