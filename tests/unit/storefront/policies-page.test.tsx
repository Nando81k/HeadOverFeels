// tests/unit/storefront/policies-page.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

const getPolicy = vi.fn()
vi.mock('@/lib/shopify/queries', () => ({ getPolicy: (handle: string) => getPolicy(handle) }))

const hasShopifyEnv = vi.fn(() => true)
vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: () => hasShopifyEnv() }))

/** `notFound()` throws in Next; the mock keeps that contract testable. */
class NotFoundError extends Error {}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundError('NEXT_NOT_FOUND')
  },
}))

import policiesFixture from '@/tests/fixtures/shopify/policies.json'
import PolicyPage, {
  generateMetadata,
  generateStaticParams,
  POLICY_HANDLES,
  revalidate,
} from '@/app/(storefront)/policies/[handle]/page'
import type { Policy } from '@/lib/shopify/types'

const PRIVACY: Policy = policiesFixture.shop.privacyPolicy
const REFUND: Policy = policiesFixture.shop.refundPolicy

function params(handle: string) {
  return { params: Promise.resolve({ handle }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  hasShopifyEnv.mockReturnValue(true)
  getPolicy.mockImplementation(async (handle: string) =>
    handle === PRIVACY.handle ? PRIVACY : handle === REFUND.handle ? REFUND : null
  )
})

afterEach(() => {
  cleanup()
})

describe('app/(storefront)/policies/[handle] — static params', () => {
  it('prerenders exactly the four Shopify policy handles', () => {
    expect(generateStaticParams()).toEqual([
      { handle: 'privacy-policy' },
      { handle: 'terms-of-service' },
      { handle: 'refund-policy' },
      { handle: 'shipping-policy' },
    ])
    expect(POLICY_HANDLES).toHaveLength(4)
  })

  it('revalidates hourly', () => {
    expect(revalidate).toBe(3600)
  })
})

describe('app/(storefront)/policies/[handle] — rendering', () => {
  it('renders the policy title and body prose for a known handle', async () => {
    const { container } = render(await PolicyPage(params('privacy-policy')))

    expect(screen.getByRole('heading', { name: PRIVACY.title })).toBeInTheDocument()
    expect(screen.getByText(/^policy$/i)).toBeInTheDocument()

    const prose = container.querySelector('.prose-sf')
    expect(prose).not.toBeNull()
    expect(prose?.textContent).toContain(PRIVACY.body)
    expect(getPolicy).toHaveBeenCalledWith('privacy-policy')
  })

  it('renders each of the other configured policies', async () => {
    render(await PolicyPage(params('refund-policy')))
    expect(screen.getByRole('heading', { name: REFUND.title })).toBeInTheDocument()
  })

  it('404s on a handle outside the policy set, without fetching', async () => {
    await expect(PolicyPage(params('cookie-policy'))).rejects.toBeInstanceOf(NotFoundError)
    expect(getPolicy).not.toHaveBeenCalled()
  })

  it('404s when Shopify has no such policy published', async () => {
    getPolicy.mockResolvedValueOnce(null)
    await expect(PolicyPage(params('shipping-policy'))).rejects.toBeInstanceOf(NotFoundError)
  })

  it('shows the unconfigured notice (never fetches) when Shopify env is missing', async () => {
    hasShopifyEnv.mockReturnValue(false)

    const { container } = render(await PolicyPage(params('refund-policy')))

    expect(container.querySelector('[data-catalog="unconfigured"]')).not.toBeNull()
    expect(screen.getByText(/policies are on their way/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /refund policy/i })).toBeInTheDocument()
    expect(getPolicy).not.toHaveBeenCalled()
  })
})

describe('app/(storefront)/policies/[handle] — metadata', () => {
  it('uses the Shopify policy title', async () => {
    await expect(generateMetadata(params('privacy-policy'))).resolves.toMatchObject({
      title: PRIVACY.title,
    })
  })

  it('falls back to the humanised handle when the store is unconfigured', async () => {
    hasShopifyEnv.mockReturnValue(false)

    await expect(generateMetadata(params('shipping-policy'))).resolves.toMatchObject({
      title: 'Shipping Policy',
    })
    expect(getPolicy).not.toHaveBeenCalled()
  })
})
