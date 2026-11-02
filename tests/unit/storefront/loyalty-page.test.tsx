// tests/unit/storefront/loyalty-page.test.tsx — app/(storefront)/loyalty/page.tsx wiring (Task 6)
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

vi.mock('server-only', () => ({}))

const { env, session, actions, publicData, hub } = vi.hoisted(() => ({
  env: { hasCustomerAccountEnv: vi.fn(() => true) },
  session: { getCustomerSession: vi.fn() },
  actions: {
    getLoyaltyOverviewAction: vi.fn(),
    redeemRewardAction: vi.fn(),
    loadLedgerAction: vi.fn(),
  },
  publicData: {
    getLoyaltyPublicData: vi.fn(),
    EMPTY_LOYALTY_PUBLIC_DATA: { tiers: [], rewards: [] },
  },
  hub: { props: null as null | Record<string, unknown> },
}))

vi.mock('@/lib/shopify/customer/env', () => env)
vi.mock('@/lib/shopify/customer/session', () => session)
vi.mock('@/app/(storefront)/_actions/loyalty', () => actions)
vi.mock('@/lib/storefront/loyalty-public', () => publicData)
vi.mock('@/components/storefront/loyalty/LoyaltyHub', () => ({
  LoyaltyHub: (props: Record<string, unknown>) => {
    hub.props = props
    return <div data-loyalty-hub />
  },
}))

import LoyaltyRoute, { dynamic, metadata } from '@/app/(storefront)/loyalty/page'
import { LEDGER_PAGE, OVERVIEW, PUBLIC_DATA } from './loyalty-fixture'

const signedIn = {
  tokens: { accessToken: 'at', refreshToken: null, idToken: null, expiresAt: Date.now() + 60_000 },
  customerId: 'gid://shopify/Customer/1',
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  hub.props = null
  env.hasCustomerAccountEnv.mockReturnValue(true)
  session.getCustomerSession.mockResolvedValue(null)
  publicData.getLoyaltyPublicData.mockResolvedValue(PUBLIC_DATA)
  actions.getLoyaltyOverviewAction.mockResolvedValue({ ok: true, data: OVERVIEW })
  actions.loadLedgerAction.mockResolvedValue({ ok: true, data: LEDGER_PAGE })
})
afterEach(() => cleanup())

describe('app/(storefront)/loyalty', () => {
  it('is dynamic and titled Care Points', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(metadata.title).toBe('Care Points')
  })

  it('renders the public hub for signed-out visitors without calling the loyalty actions', async () => {
    render(await LoyaltyRoute())
    expect(document.querySelector('[data-loyalty-hub]')).not.toBeNull()
    expect(hub.props).toMatchObject({
      publicData: PUBLIC_DATA,
      available: true,
      signedIn: false,
      initialOverview: null,
      initialLedger: null,
    })
    expect(actions.getLoyaltyOverviewAction).not.toHaveBeenCalled()
    expect(actions.loadLedgerAction).not.toHaveBeenCalled()
  })

  it('loads the overview and the first ledger page through the actions when signed in', async () => {
    session.getCustomerSession.mockResolvedValue(signedIn)
    render(await LoyaltyRoute())
    expect(actions.getLoyaltyOverviewAction).toHaveBeenCalledTimes(1)
    expect(actions.loadLedgerAction).toHaveBeenCalledWith({ filter: 'all', limit: 10 })
    expect(hub.props).toMatchObject({
      signedIn: true,
      initialOverview: OVERVIEW,
      initialLedger: LEDGER_PAGE,
      overviewError: null,
    })
  })

  it('passes the action error through instead of throwing', async () => {
    session.getCustomerSession.mockResolvedValue(signedIn)
    actions.getLoyaltyOverviewAction.mockResolvedValue({ ok: false, error: 'Something went wrong. Please try again.' })
    actions.loadLedgerAction.mockResolvedValue({ ok: false, error: 'nope' })
    render(await LoyaltyRoute())
    expect(hub.props).toMatchObject({
      signedIn: true,
      initialOverview: null,
      initialLedger: null,
      overviewError: 'Something went wrong. Please try again.',
    })
  })

  it('renders the public sections (HTTP 200) when accounts are unconfigured, never reading the session', async () => {
    env.hasCustomerAccountEnv.mockReturnValue(false)
    render(await LoyaltyRoute())
    expect(session.getCustomerSession).not.toHaveBeenCalled()
    expect(hub.props).toMatchObject({ available: false, signedIn: false, initialOverview: null })
  })

  it('degrades to an empty catalogue when the public data cannot be read', async () => {
    publicData.getLoyaltyPublicData.mockRejectedValue(new Error('db down'))
    render(await LoyaltyRoute())
    expect(hub.props).toMatchObject({ publicData: { tiers: [], rewards: [] } })
  })
})
