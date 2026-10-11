// tests/unit/storefront/account-overview.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('next/image', async () => {
  const react = await import('react')
  const nextOnly = new Set(['fill', 'priority', 'quality', 'loader', 'placeholder', 'blurDataURL', 'unoptimized', 'sizes'])
  return {
    default: (props: Record<string, unknown>) => {
      const attrs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(props)) if (!nextOnly.has(key)) attrs[key] = value
      return react.createElement('img', attrs)
    },
  }
})

const { env, session, queries, prisma, loyalty } = vi.hoisted(() => ({
  env: { hasCustomerAccountEnv: vi.fn(() => true) },
  session: { requireFreshSession: vi.fn(), getCustomerSession: vi.fn() },
  queries: { getCustomerSummary: vi.fn(), getCustomerOrders: vi.fn() },
  prisma: { order: { findMany: vi.fn() } },
  loyalty: { getLoyaltyOverviewAction: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/account',
  redirect: (...args: unknown[]) => {
    throw new Error(`NEXT_REDIRECT ${String(args[0])}`)
  },
}))
vi.mock('@/lib/shopify/customer/env', () => env)
vi.mock('@/lib/shopify/customer/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/session')>()
  return { ...actual, ...session }
})
vi.mock('@/lib/shopify/customer/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/queries')>()
  return { ...actual, ...queries }
})
vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('@/app/(storefront)/_actions/loyalty', () => loyalty)
vi.mock('@/app/(storefront)/_actions/account', () => ({ getCustomerSummaryAction: vi.fn() }))

import AccountLoading from '@/app/(storefront)/account/loading'
import AccountRoute, { dynamic, metadata } from '@/app/(storefront)/account/page'
import {
  normalizeCustomerSummary,
  normalizeOrdersPage,
  type RawCustomerSummary,
  type RawOrdersResponse,
} from '@/lib/shopify/customer/queries'
import { SignedOutError } from '@/lib/shopify/customer/errors'
import type { CustomerSession } from '@/lib/shopify/customer/session'
import type { LoyaltyOverview } from '@/lib/loyalty/shopify-bridge'
import customerFixture from '@/tests/fixtures/shopify/customer/customer.json'
import ordersFixture from '@/tests/fixtures/shopify/customer/orders.json'

const CUSTOMER = normalizeCustomerSummary(customerFixture as unknown as RawCustomerSummary)
const ORDERS = normalizeOrdersPage(ordersFixture as unknown as RawOrdersResponse)

const SESSION: CustomerSession = {
  tokens: { accessToken: 'token-1', refreshToken: 'rt', idToken: 'id', expiresAt: Date.now() + 3_600_000 },
  customerId: CUSTOMER.id,
  email: CUSTOMER.email,
  firstName: 'Nando',
  lastName: 'Alvarez',
}

const TIER = { id: 't2', name: 'Gold', slug: 'gold', minAnnualPoints: 1000, pointMultiplier: 1.5, perks: [], current: true }
const OVERVIEW: LoyaltyOverview = {
  points: 1240,
  lifetimePoints: 3400,
  annualPoints: 1500,
  tier: TIER,
  nextTier: { ...TIER, id: 't3', name: 'Platinum', slug: 'platinum', minAnnualPoints: 2500, current: false },
  pointsToNext: 1000,
  progressRatio: 0.33,
  multiplier: 1.5,
  expiringSoon: null,
  rewards: [],
  tiers: [TIER],
  referral: { code: 'NANDO10', url: 'https://example.com/?ref=NANDO10', joined: 0, ordered: 0, pointsEarned: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
  env.hasCustomerAccountEnv.mockReturnValue(true)
  session.requireFreshSession.mockResolvedValue(SESSION)
  queries.getCustomerSummary.mockResolvedValue(CUSTOMER)
  queries.getCustomerOrders.mockResolvedValue(ORDERS)
  loyalty.getLoyaltyOverviewAction.mockResolvedValue({ ok: true, data: OVERVIEW })
  prisma.order.findMany.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

describe('app/(storefront)/account (overview)', () => {
  it('is dynamic and noindex', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(metadata.robots).toMatchObject({ index: false })
  })

  it('greets by first name with the Care Points chip and renders the four cards', async () => {
    render(await AccountRoute({ searchParams: Promise.resolve({}) }))

    expect(session.requireFreshSession).toHaveBeenCalledWith('/account')
    expect(queries.getCustomerSummary).toHaveBeenCalledWith('token-1')
    expect(queries.getCustomerOrders).toHaveBeenCalledWith('token-1', { first: 2 })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hey, Nando.')

    const chip = document.querySelector('[data-points-chip]')
    expect(chip).toHaveAttribute('href', '/loyalty')
    expect(chip).toHaveTextContent('1,240')
    expect(chip).toHaveTextContent('Gold')
    expect(chip?.querySelector('.num')).toHaveTextContent('1,240')

    const orders = within(screen.getByRole('region', { name: 'Recent orders' }))
    expect(orders.getAllByRole('article')).toHaveLength(2)
    expect(orders.getByRole('link', { name: 'All orders' })).toHaveAttribute('href', '/account/orders')

    const points = screen.getByRole('region', { name: 'Care Points' })
    expect(within(points).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
    expect(points).toHaveTextContent('1,000 points to Platinum')
    expect(within(points).getByRole('link', { name: 'Redeem rewards' })).toHaveAttribute('href', '/loyalty')

    const address = screen.getByRole('region', { name: 'Default address' })
    expect(address).toHaveTextContent('221 Bowery')
    expect(within(address).getByRole('link', { name: 'Manage addresses' })).toHaveAttribute('href', '/account/addresses')

    const profile = screen.getByRole('region', { name: 'Profile' })
    expect(profile).toHaveTextContent('Nando Alvarez')
    expect(profile).toHaveTextContent('nando@example.com')
    expect(within(profile).getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/account/profile')

    expect(screen.queryByRole('region', { name: 'Earlier orders' })).toBeNull()
  })

  it('degrades the Care Points card and drops the chip when loyalty fails', async () => {
    loyalty.getLoyaltyOverviewAction.mockResolvedValue({ ok: false, error: 'Something went wrong.' })
    render(await AccountRoute({ searchParams: Promise.resolve({}) }))
    expect(document.querySelector('[data-points-chip]')).toBeNull()
    const points = screen.getByRole('region', { name: 'Care Points' })
    expect(within(points).queryByRole('progressbar')).toBeNull()
    expect(within(points).getByRole('link', { name: 'Care Points hub' })).toHaveAttribute('href', '/loyalty')
  })

  it('shows the empty states and the top-tier copy', async () => {
    queries.getCustomerOrders.mockResolvedValue({ orders: [], hasNextPage: false, endCursor: null })
    queries.getCustomerSummary.mockResolvedValue({ ...CUSTOMER, defaultAddress: null })
    loyalty.getLoyaltyOverviewAction.mockResolvedValue({
      ok: true,
      data: { ...OVERVIEW, nextTier: null, pointsToNext: null, progressRatio: 1 },
    })
    render(await AccountRoute({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('region', { name: 'Recent orders' })).toHaveTextContent(/no orders yet/i)
    expect(screen.getByRole('region', { name: 'Default address' })).toHaveTextContent(/no default address/i)
    expect(screen.getByRole('link', { name: 'Add an address' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Care Points' })).toHaveTextContent(/top tier/i)
  })

  it('renders the earlier-orders strip (3 rows max) by email with a link to the full section', async () => {
    prisma.order.findMany.mockResolvedValue([
      { id: 'o1', orderNumber: 'HOF-2041', createdAt: new Date('2025-03-02T10:00:00Z'), status: 'DELIVERED', total: 64.5, items: [] },
    ])
    render(await AccountRoute({ searchParams: Promise.resolve({}) }))
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerEmail: { equals: CUSTOMER.email, mode: 'insensitive' } },
        take: 3,
      })
    )
    const strip = screen.getByRole('region', { name: 'Earlier orders' })
    expect(strip).toHaveAttribute('data-earlier-orders', 'strip')
    expect(strip).toHaveTextContent('HOF-2041')
    expect(screen.getByRole('link', { name: 'All earlier orders' })).toHaveAttribute('href', '/account/orders#earlier')
  })

  it('renders the gate with a notice from ?error= when signed out', async () => {
    session.requireFreshSession.mockRejectedValue(new SignedOutError())
    render(await AccountRoute({ searchParams: Promise.resolve({ error: 'expired' }) }))
    expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/account/login?return_to=%2Faccount')
    expect(queries.getCustomerSummary).not.toHaveBeenCalled()
    expect(loyalty.getLoyaltyOverviewAction).not.toHaveBeenCalled()
  })

  it('ignores an unknown ?error= value', async () => {
    session.requireFreshSession.mockRejectedValue(new SignedOutError())
    render(await AccountRoute({ searchParams: Promise.resolve({ error: 'weird' }) }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders the unconfigured notice when accounts are off', async () => {
    env.hasCustomerAccountEnv.mockReturnValue(false)
    render(await AccountRoute({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('status')).toHaveAttribute('data-account', 'unconfigured')
    expect(session.requireFreshSession).not.toHaveBeenCalled()
  })
})

describe('app/(storefront)/account/loading', () => {
  it('renders a busy placeholder region', () => {
    const { container } = render(<AccountLoading />)
    expect(screen.getByLabelText('Loading your account')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('[data-skeleton]').length).toBeGreaterThan(3)
  })
})
