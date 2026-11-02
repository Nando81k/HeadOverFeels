// tests/unit/storefront/redirects.test.ts
import { describe, expect, it } from 'vitest'

import nextConfig from '@/next.config'

type Redirect = { source: string; destination: string; permanent?: boolean }

async function getRedirects(): Promise<Redirect[]> {
  expect(typeof nextConfig.redirects).toBe('function')
  const result = await nextConfig.redirects!()
  return result as Redirect[]
}

function find(rules: Redirect[], source: string): Redirect | undefined {
  return rules.find((rule) => rule.source === source)
}

describe('next.config redirects', () => {
  it('sends the legacy policy pages to /policies/*', async () => {
    const rules = await getRedirects()

    expect(find(rules, '/privacy')).toMatchObject({
      destination: '/policies/privacy-policy',
      permanent: true,
    })
    expect(find(rules, '/terms')).toMatchObject({
      destination: '/policies/terms-of-service',
      permanent: true,
    })
  })

  it('sends /products to /collections/all without capturing /products/:handle', async () => {
    const rules = await getRedirects()

    expect(find(rules, '/products')).toMatchObject({
      destination: '/collections/all',
      permanent: true,
    })
    expect(rules.some((rule) => rule.source.startsWith('/products/'))).toBe(false)
  })

  it('sends the legacy checkout and confirmation pages to /cart and /account/orders', async () => {
    const rules = await getRedirects()

    expect(find(rules, '/checkout')).toMatchObject({
      destination: '/cart',
      permanent: true,
    })
    // Phase 4: order history moved from `/orders` to `/account/orders`.
    expect(find(rules, '/order/confirmation')).toMatchObject({
      destination: '/account/orders',
      permanent: true,
    })
    // `/cart` is the new Shopify cart page; it must never redirect.
    expect(find(rules, '/cart')).toBeUndefined()
  })

  it('keeps the admin order redirects', async () => {
    const rules = await getRedirects()

    expect(find(rules, '/admin/orders/:id')).toMatchObject({
      destination: '/admin/fulfillment?orderId=:id',
      permanent: true,
    })
    expect(find(rules, '/admin/orders')).toMatchObject({
      destination: '/admin/fulfillment',
      permanent: true,
    })
    expect(find(rules, '/admin/fulfillment/details')).toMatchObject({
      destination: '/admin/fulfillment',
      permanent: true,
    })
  })
})

describe('next.config redirects — Phase 4 legacy account surface', () => {
  it('sends the legacy password/verification pages to /account/login', async () => {
    const rules = await getRedirects()

    for (const source of ['/forgot-password', '/reset-password', '/verify-email']) {
      expect(find(rules, source), source).toMatchObject({
        destination: '/account/login',
        permanent: true,
      })
    }
  })

  it('sends /profile and every /profile/* page to /account', async () => {
    const rules = await getRedirects()

    expect(find(rules, '/profile')).toMatchObject({
      destination: '/account',
      permanent: true,
    })
    expect(find(rules, '/profile/:path*')).toMatchObject({
      destination: '/account',
      permanent: true,
    })
  })

  it('sends the legacy order list and tracking pages to /account/orders', async () => {
    const rules = await getRedirects()

    expect(find(rules, '/orders')).toMatchObject({
      destination: '/account/orders',
      permanent: true,
    })
    // Replaces the old `order-track-legacy-redirect` test: both tracking URL
    // shapes land on the account order detail, keeping the id.
    expect(find(rules, '/orders/:id/track')).toMatchObject({
      destination: '/account/orders/:id',
      permanent: true,
    })
    expect(find(rules, '/order/track/:id')).toMatchObject({
      destination: '/account/orders/:id',
      permanent: true,
    })
  })

  it('sends the legacy loyalty sub-pages to the matching /loyalty anchor', async () => {
    const rules = await getRedirects()

    const expected: Record<string, string> = {
      '/loyalty/rewards': '/loyalty#rewards',
      '/loyalty/tiers': '/loyalty#tiers',
      '/loyalty/points': '/loyalty#history',
      '/loyalty/history': '/loyalty#history',
      '/loyalty/referrals': '/loyalty#refer',
    }
    for (const [source, destination] of Object.entries(expected)) {
      expect(find(rules, source), source).toMatchObject({ destination, permanent: true })
    }
    // The hub itself is a real page now; it must never redirect.
    expect(find(rules, '/loyalty')).toBeUndefined()
  })

  it('never redirects /signin (admin login) or the new account routes', async () => {
    const rules = await getRedirects()

    expect(find(rules, '/signin')).toBeUndefined()
    expect(rules.some((rule) => rule.source.startsWith('/account'))).toBe(false)
    expect(rules.some((rule) => rule.source.startsWith('/wishlist'))).toBe(false)
    expect(rules.some((rule) => rule.source.startsWith('/about'))).toBe(false)
    expect(rules.some((rule) => rule.source.startsWith('/contact'))).toBe(false)
  })

  it('marks every Phase 4 redirect permanent', async () => {
    const rules = await getRedirects()
    const PHASE4_SOURCES = [
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/profile',
      '/profile/:path*',
      '/orders',
      '/orders/:id/track',
      '/order/track/:id',
      '/loyalty/rewards',
      '/loyalty/tiers',
      '/loyalty/points',
      '/loyalty/history',
      '/loyalty/referrals',
    ]
    for (const source of PHASE4_SOURCES) {
      expect(find(rules, source)?.permanent, source).toBe(true)
    }
  })
})
