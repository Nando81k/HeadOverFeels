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
