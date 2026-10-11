// tests/unit/storefront/sitemap.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))
vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: vi.fn() }))
vi.mock('@/lib/shopify/queries/sitemap', () => ({ getSitemapEntries: vi.fn() }))

import sitemap from '@/app/sitemap'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getSitemapEntries } from '@/lib/shopify/queries/sitemap'

const hasEnv = vi.mocked(hasShopifyEnv)
const entries = vi.mocked(getSitemapEntries)

const BASE = 'https://headoverfeels.com'

const STATIC_URLS = [
  `${BASE}/`,
  `${BASE}/collections`,
  `${BASE}/collections/all`,
  `${BASE}/drops`,
  `${BASE}/about`,
  `${BASE}/contact`,
  `${BASE}/loyalty`,
  `${BASE}/policies/privacy-policy`,
  `${BASE}/policies/terms-of-service`,
  `${BASE}/policies/refund-policy`,
  `${BASE}/policies/shipping-policy`,
]

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NEXT_PUBLIC_BASE_URL
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_BASE_URL
})

describe('app/sitemap', () => {
  it('returns only the static routes when the store is not configured', async () => {
    hasEnv.mockReturnValue(false)

    const result = await sitemap()

    expect(entries).not.toHaveBeenCalled()
    expect(result.map((entry) => entry.url)).toEqual(STATIC_URLS)
  })

  it('gives the home page priority 1 and the policies the lowest priority', async () => {
    hasEnv.mockReturnValue(false)

    const result = await sitemap()
    const byUrl = new Map(result.map((entry) => [entry.url, entry]))

    expect(byUrl.get(`${BASE}/`)?.priority).toBe(1.0)
    expect(byUrl.get(`${BASE}/collections/all`)?.priority).toBe(0.9)
    expect(byUrl.get(`${BASE}/collections`)?.priority).toBe(0.8)
    expect(byUrl.get(`${BASE}/drops`)?.priority).toBe(0.8)
    expect(byUrl.get(`${BASE}/about`)?.priority).toBe(0.5)
    expect(byUrl.get(`${BASE}/contact`)?.priority).toBe(0.5)
    expect(byUrl.get(`${BASE}/loyalty`)?.priority).toBe(0.6)
    expect(byUrl.get(`${BASE}/policies/refund-policy`)?.priority).toBe(0.3)
    expect(byUrl.get(`${BASE}/policies/refund-policy`)?.changeFrequency).toBe('yearly')
  })

  it('honours NEXT_PUBLIC_BASE_URL and never emits a double slash', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://staging.headoverfeels.com'
    hasEnv.mockReturnValue(false)

    const result = await sitemap()

    expect(result[0].url).toBe('https://staging.headoverfeels.com/')
    expect(result.every((entry) => !entry.url.slice('https://'.length).includes('//'))).toBe(true)
  })

  it('appends Shopify product and collection URLs when configured', async () => {
    hasEnv.mockReturnValue(true)
    entries.mockResolvedValue({
      products: [
        { handle: 'heavyweight-hoodie', updatedAt: '2026-08-01T10:00:00Z' },
        { handle: 'boxy-tee', updatedAt: '2026-08-02T10:00:00Z' },
      ],
      collections: [
        { handle: 'all', updatedAt: '2026-08-03T10:00:00Z' },
        { handle: 'frontpage', updatedAt: '2026-08-04T10:00:00Z' },
        { handle: 'drops', updatedAt: '2026-08-05T10:00:00Z' },
      ],
    })

    const result = await sitemap()
    const byUrl = new Map(result.map((entry) => [entry.url, entry]))

    const product = byUrl.get(`${BASE}/products/heavyweight-hoodie`)
    expect(product).toBeDefined()
    expect(product?.priority).toBe(0.7)
    expect(product?.lastModified).toEqual(new Date('2026-08-01T10:00:00Z'))
    expect(byUrl.has(`${BASE}/products/boxy-tee`)).toBe(true)

    const collection = byUrl.get(`${BASE}/collections/drops`)
    expect(collection).toBeDefined()
    expect(collection?.priority).toBe(0.8)
    expect(collection?.lastModified).toEqual(new Date('2026-08-05T10:00:00Z'))
  })

  it('skips the frontpage collection and does not duplicate /collections/all', async () => {
    hasEnv.mockReturnValue(true)
    entries.mockResolvedValue({
      products: [],
      collections: [
        { handle: 'all', updatedAt: '2026-08-03T10:00:00Z' },
        { handle: 'frontpage', updatedAt: '2026-08-04T10:00:00Z' },
      ],
    })

    const result = await sitemap()
    const urls = result.map((entry) => entry.url)

    expect(urls).not.toContain(`${BASE}/collections/frontpage`)
    expect(urls.filter((url) => url === `${BASE}/collections/all`)).toHaveLength(1)
  })

  it('falls back to the static routes and warns when Shopify throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    hasEnv.mockReturnValue(true)
    entries.mockRejectedValue(new Error('Storefront 429'))

    const result = await sitemap()

    expect(result.map((entry) => entry.url)).toEqual(STATIC_URLS)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('Storefront 429')
  })
})
