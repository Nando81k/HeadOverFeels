// tests/unit/shopify/shop-query.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import { storefrontFetch } from '@/lib/shopify/client'
import { resetShopifyEnvCache } from '@/lib/shopify/env'
import {
  POLICIES_QUERY,
  SHOP_LAYOUT_QUERY,
  getPolicy,
  getShopLayout,
  normalizeMenu,
  type RawMenuItem,
} from '@/lib/shopify/queries/shop'
import policiesFixture from '@/tests/fixtures/shopify/policies.json'
import shopLayoutFixture from '@/tests/fixtures/shopify/shop-layout.json'

const rawItems = shopLayoutFixture.menu.items as unknown as RawMenuItem[]
const DOMAINS = {
  storeDomain: 'tgqucm-qg.myshopify.com',
  primaryDomain: 'https://tgqucm-qg.myshopify.com',
}
const mocked = () => vi.mocked(storefrontFetch)

beforeEach(() => {
  mocked().mockReset()
  // `getShopLayout` reads the store domain from the env so it can rewrite menu
  // urls even when the shop's primary domain is a custom one.
  process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
  process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = 'private-token'
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN = 'public-token'
  resetShopifyEnvCache()
})

afterEach(() => {
  delete process.env.SHOPIFY_STORE_DOMAIN
  delete process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN
  delete process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN
  resetShopifyEnvCache()
})

describe('SHOP_LAYOUT_QUERY / POLICIES_QUERY', () => {
  it('are the validated 2026-07 documents', () => {
    expect(SHOP_LAYOUT_QUERY).toContain('query ShopLayout')
    expect(SHOP_LAYOUT_QUERY).toContain('primaryDomain { url }')
    expect(SHOP_LAYOUT_QUERY).toContain('menu(handle: "main-menu")')
    expect(SHOP_LAYOUT_QUERY).not.toContain('body')
    expect(POLICIES_QUERY).toContain('query Policies')
    expect(POLICIES_QUERY).toContain('privacyPolicy { handle title body }')
    expect(POLICIES_QUERY).toContain('shippingPolicy { handle title body }')
  })
})

describe('normalizeMenu', () => {
  it('rewrites absolute myshopify urls to relative paths', () => {
    const menu = normalizeMenu(rawItems, DOMAINS)
    expect(menu.map((i) => [i.title, i.url])).toEqual([
      ['Shop', '/collections/all'],
      ['Collections', '/collections'],
      ['Drops', '/collections/drops'],
      ['Loyalty', '/loyalty'],
      ['About', '/pages/about'],
    ])
  })

  it('rewrites urls on the primary (custom) domain too', () => {
    const menu = normalizeMenu(
      [{ id: '1', title: 'Shop', url: 'https://headoverfeels.com/collections/all?sort=new#top' }],
      { storeDomain: 'tgqucm-qg.myshopify.com', primaryDomain: 'https://headoverfeels.com' }
    )
    expect(menu[0].url).toBe('/collections/all?sort=new#top')
  })

  it('keeps external urls untouched', () => {
    const menu = normalizeMenu(rawItems, DOMAINS)
    const about = menu[4]
    expect(about.items).toEqual([
      { id: 'gid://shopify/MenuItem/501234567809', title: 'Journal', url: 'https://journal.headoverfeels.com', items: [] },
    ])
  })

  it('keeps already-relative and non-url values as they are', () => {
    const menu = normalizeMenu(
      [
        { id: '1', title: 'Loyalty', url: '/loyalty' },
        { id: '2', title: 'Email', url: 'mailto:hi@headoverfeels.com' },
        { id: '3', title: 'Broken', url: null },
      ],
      DOMAINS
    )
    expect(menu.map((i) => i.url)).toEqual(['/loyalty', 'mailto:hi@headoverfeels.com', '/'])
  })

  it('nests exactly one level of children', () => {
    const menu = normalizeMenu(rawItems, DOMAINS)
    expect(menu[1].items.map((i) => i.url)).toEqual([
      '/collections/hoodies',
      '/collections/tees',
      '/collections/best-sellers',
    ])
    expect(menu[1].items.every((i) => i.items.length === 0)).toBe(true)
    expect(menu[0].items).toEqual([])
  })

  it('tolerates a missing items array', () => {
    expect(normalizeMenu(null, DOMAINS)).toEqual([])
  })
})

describe('getShopLayout', () => {
  it('returns the shop, menu and policies with the shop and menu cache tags', async () => {
    mocked().mockResolvedValue(shopLayoutFixture)

    const layout = await getShopLayout()

    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(SHOP_LAYOUT_QUERY)
    expect(opts).toMatchObject({ tags: ['shop', 'menu'], revalidate: 300 })
    expect(layout.name).toBe('Head Over Feels')
    expect(layout.description).toBe('Heavyweight basics and limited drops, made in small runs.')
    expect(layout.menu[0]).toMatchObject({ title: 'Shop', url: '/collections/all' })
    expect(layout.policies).toEqual([
      { handle: 'privacy-policy', title: 'Privacy Policy' },
      { handle: 'terms-of-service', title: 'Terms of Service' },
      { handle: 'refund-policy', title: 'Refund Policy' },
      { handle: 'shipping-policy', title: 'Shipping Policy' },
    ])
  })

  it('rewrites myshopify menu urls even when the shop has a custom primary domain', async () => {
    mocked().mockResolvedValue({
      shop: { ...shopLayoutFixture.shop, primaryDomain: { url: 'https://headoverfeels.com' } },
      menu: shopLayoutFixture.menu,
    })

    const layout = await getShopLayout()
    expect(layout.menu.map((i) => i.url)).toEqual([
      '/collections/all',
      '/collections',
      '/collections/drops',
      '/loyalty',
      '/pages/about',
    ])
  })

  it('skips policies that are not published', async () => {
    mocked().mockResolvedValue({
      shop: {
        ...shopLayoutFixture.shop,
        termsOfService: null,
        shippingPolicy: null,
      },
      menu: null,
    })

    const layout = await getShopLayout()
    expect(layout.policies.map((p) => p.handle)).toEqual(['privacy-policy', 'refund-policy'])
    expect(layout.menu).toEqual([])
  })
})

describe('getPolicy', () => {
  it('returns the matching policy with the shop cache tag', async () => {
    mocked().mockResolvedValue(policiesFixture)

    const policy = await getPolicy('refund-policy')

    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(POLICIES_QUERY)
    expect(opts).toMatchObject({ tags: ['shop'], revalidate: 300 })
    expect(policy).toEqual({
      handle: 'refund-policy',
      title: 'Refund Policy',
      body: policiesFixture.shop.refundPolicy.body,
    })
  })

  it('returns null for an unknown handle', async () => {
    mocked().mockResolvedValue(policiesFixture)
    await expect(getPolicy('cookies')).resolves.toBeNull()
  })

  it('returns null when the policy is not published', async () => {
    mocked().mockResolvedValue({ shop: { ...policiesFixture.shop, privacyPolicy: null } })
    await expect(getPolicy('privacy-policy')).resolves.toBeNull()
  })
})
