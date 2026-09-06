// tests/unit/storefront/footer.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))
vi.mock('@/lib/shopify/queries/shop', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/queries/shop')>()
  return { ...actual, getShopLayout: vi.fn() }
})

import { Footer } from '@/components/storefront/layout/Footer'
import {
  FALLBACK_LAYOUT,
  StorefrontShell,
} from '@/components/storefront/layout/StorefrontShell'
import { getShopLayout, normalizeMenu, type RawMenuItem } from '@/lib/shopify/queries/shop'
import { ShopifyError } from '@/lib/shopify/errors'
import type { ShopLayoutData } from '@/lib/shopify/types'
import shopLayoutFixture from '@/tests/fixtures/shopify/shop-layout.json'

const MENU = normalizeMenu(shopLayoutFixture.menu.items as unknown as RawMenuItem[], {
  storeDomain: 'tgqucm-qg.myshopify.com',
  primaryDomain: 'https://tgqucm-qg.myshopify.com',
})

const POLICIES = [
  { handle: 'privacy-policy', title: 'Privacy Policy' },
  { handle: 'terms-of-service', title: 'Terms of Service' },
  { handle: 'refund-policy', title: 'Refund Policy' },
  { handle: 'shipping-policy', title: 'Shipping Policy' },
]

const LAYOUT: ShopLayoutData = {
  name: 'Head Over Feels',
  description: shopLayoutFixture.shop.description,
  menu: MENU,
  policies: POLICIES,
}

afterEach(cleanup)

describe('Footer', () => {
  it('renders the four columns', () => {
    render(<Footer menu={MENU} policies={POLICIES} />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Shop', 'Help', 'Company', 'Newsletter'])
  })

  it('lists the top-level menu items in the Shop column', () => {
    render(<Footer menu={MENU} policies={POLICIES} />)
    const shop = within(screen.getByRole('navigation', { name: 'Shop' }))

    expect(shop.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/collections/all')
    expect(shop.getByRole('link', { name: 'Collections' })).toHaveAttribute('href', '/collections')
    expect(shop.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/pages/about')
  })

  it('renders the static Help and Company links', () => {
    render(<Footer menu={MENU} policies={POLICIES} />)
    const help = within(screen.getByRole('navigation', { name: 'Help' }))
    const company = within(screen.getByRole('navigation', { name: 'Company' }))

    expect(help.getByRole('link', { name: 'Shipping & returns' })).toHaveAttribute(
      'href',
      '/policies/shipping-policy'
    )
    expect(help.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/pages/faq')
    expect(help.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/pages/contact')
    expect(help.getByRole('link', { name: 'Track order' })).toHaveAttribute('href', '/account/orders')

    expect(company.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/pages/about')
    expect(company.getByRole('link', { name: 'Loyalty' })).toHaveAttribute('href', '/loyalty')
    expect(company.getByRole('link', { name: 'Drops' })).toHaveAttribute('href', '/collections/drops')
  })

  it('renders the newsletter form posting to /api/newsletter', () => {
    const { container } = render(<Footer menu={MENU} policies={POLICIES} />)
    const form = container.querySelector('form')

    expect(form).toHaveAttribute('action', '/api/newsletter')
    expect(form).toHaveAttribute('method', 'post')

    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('name', 'email')
    expect(email).toBeRequired()
    expect(screen.getByRole('button', { name: 'Join' })).toHaveAttribute('type', 'submit')
  })

  it('links every policy to /policies/<handle>', () => {
    render(<Footer menu={MENU} policies={POLICIES} />)
    const policies = within(screen.getByRole('navigation', { name: 'Policies' }))

    for (const policy of POLICIES) {
      expect(policies.getByRole('link', { name: policy.title })).toHaveAttribute(
        'href',
        `/policies/${policy.handle}`
      )
    }
  })

  it('renders the copyright with the current year and shop name', () => {
    const year = new Date().getFullYear()
    const { rerender } = render(<Footer menu={MENU} policies={POLICIES} />)
    expect(screen.getByText(`© ${year} Head Over Feels`)).toBeInTheDocument()

    rerender(<Footer menu={MENU} policies={POLICIES} shopName="HOF Studio" />)
    expect(screen.getByText(`© ${year} HOF Studio`)).toBeInTheDocument()
  })

  it('renders no policy nav when the shop has no published policies', () => {
    render(<Footer menu={MENU} policies={[]} />)
    expect(screen.queryByRole('navigation', { name: 'Policies' })).toBeNull()
  })
})

describe('StorefrontShell', () => {
  const mocked = () => vi.mocked(getShopLayout)

  beforeEach(() => {
    mocked().mockReset()
  })

  it('renders the Shopify layout around the page content', async () => {
    mocked().mockResolvedValue(LAYOUT)
    const { container } = render(await StorefrontShell({ children: <p>hi</p> }))

    const surface = container.querySelector('[data-surface="storefront"]')
    expect(surface).not.toBeNull()
    expect(surface).toHaveAttribute('data-layout-source', 'shopify')

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveTextContent('hi')

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    // Menu and policies both come from the layout.
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Shop',
      })
    ).toHaveAttribute('href', '/collections/all')
    expect(
      within(screen.getByRole('navigation', { name: 'Policies' })).getAllByRole('link')
    ).toHaveLength(4)
  })

  it('falls back to FALLBACK_LAYOUT when Shopify is unreachable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocked().mockRejectedValue(new ShopifyError('Missing SHOPIFY_STORE_DOMAIN'))

    const { container } = render(await StorefrontShell({ children: <p>hi</p> }))

    expect(container.querySelector('[data-surface="storefront"]')).toHaveAttribute(
      'data-layout-source',
      'fallback'
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Missing SHOPIFY_STORE_DOMAIN'))

    const nav = within(screen.getByRole('navigation', { name: 'Primary' }))
    for (const item of FALLBACK_LAYOUT.menu) {
      expect(nav.getByRole('link', { name: new RegExp(`^${item.title}`) })).toHaveAttribute(
        'href',
        item.url
      )
    }
    expect(screen.queryByRole('navigation', { name: 'Policies' })).toBeNull()
    warn.mockRestore()
  })

  it('exposes the documented fallback menu', () => {
    expect(FALLBACK_LAYOUT.menu.map((item) => [item.title, item.url])).toEqual([
      ['Shop', '/collections/all'],
      ['Collections', '/collections'],
      ['Drops', '/collections/drops'],
      ['Loyalty', '/loyalty'],
      ['About', '/pages/about'],
    ])
    expect(FALLBACK_LAYOUT.policies).toEqual([])
    expect(FALLBACK_LAYOUT.name).toBe('Head Over Feels')
    expect(FALLBACK_LAYOUT.description).toBeNull()
  })

  it('passes the cart count and announcement through to the header', async () => {
    mocked().mockResolvedValue(LAYOUT)
    render(
      await StorefrontShell({
        children: <p>hi</p>,
        cartCount: 3,
        announcement: 'Free US shipping over $75',
      })
    )

    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Cart, 3 items' })
    ).toBeInTheDocument()
    expect(screen.getByText('Free US shipping over $75')).toBeInTheDocument()
  })
})
