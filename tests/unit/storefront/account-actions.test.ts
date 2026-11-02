// @vitest-environment node
// tests/unit/storefront/account-actions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

type JarEntry = { name: string; value: string; options?: Record<string, unknown> }
const jarStore = new Map<string, JarEntry>()
const jar = {
  get: vi.fn((name: string) => {
    const entry = jarStore.get(name)
    return entry ? { name: entry.name, value: entry.value } : undefined
  }),
  set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => {
    jarStore.set(name, { name, value, options })
  }),
  delete: vi.fn((name: string) => {
    jarStore.delete(name)
  }),
}
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => jar) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((location: string) => {
    throw new Error(`NEXT_REDIRECT ${location}`)
  }),
}))

vi.mock('@/lib/shopify/customer/env', () => ({
  hasCustomerAccountEnv: vi.fn(() => true),
  getCustomerAccountEnv: vi.fn(() => ({
    storeDomain: 'tgqucm-qg.myshopify.com',
    clientId: 'shp_client',
    shopId: '85215183073',
    baseUrl: 'https://hof-preview.vercel.app',
    issuerOverride: null,
  })),
  getCustomerSessionSecret: vi.fn(() => 'unit-test-secret'),
}))
vi.mock('@/lib/shopify/customer/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/session')>()
  return {
    ...actual,
    getCustomerSession: vi.fn(),
    writeCustomerSession: vi.fn(),
    clearCustomerSession: vi.fn(),
  }
})
vi.mock('@/lib/shopify/customer/oauth', () => ({
  discover: vi.fn(),
  refreshTokens: vi.fn(),
}))
vi.mock('@/lib/shopify/customer/queries', () => ({
  getCustomerSummary: vi.fn(),
  updateCustomer: vi.fn(),
  getCustomerOrders: vi.fn(),
  getCustomerAddresses: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
}))
vi.mock('@/lib/loyalty/shopify-bridge', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/loyalty/service', () => ({ getCustomerLoyaltyStats: vi.fn() }))

import {
  createAddressAction,
  deleteAddressAction,
  getCustomerSummaryAction,
  loadMoreOrdersAction,
  updateAddressAction,
  updateProfileAction,
} from '@/app/(storefront)/_actions/account'
import { resolveCustomer } from '@/lib/loyalty/shopify-bridge'
import { getCustomerLoyaltyStats } from '@/lib/loyalty/service'
import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { CustomerAccountError } from '@/lib/shopify/customer/errors'
import { discover, refreshTokens } from '@/lib/shopify/customer/oauth'
import {
  createAddress,
  deleteAddress,
  getCustomerAddresses,
  getCustomerOrders,
  getCustomerSummary,
  updateAddress,
  updateCustomer,
} from '@/lib/shopify/customer/queries'
import {
  clearCustomerSession,
  getCustomerSession,
  writeCustomerSession,
  type CustomerSession,
} from '@/lib/shopify/customer/session'
import type { CustomerAddress, CustomerSummary } from '@/lib/shopify/types'

const HOUR = 60 * 60 * 1000
const CUSTOMER_ID = 'gid://shopify/Customer/8123456789'
const ADDRESS_ID = 'gid://shopify/CustomerAddress/9312345690?model_name=CustomerAddress'

function session(overrides: Partial<CustomerSession> = {}): CustomerSession {
  return {
    tokens: { accessToken: 'atkn', refreshToken: 'rtkn', idToken: 'idtkn', expiresAt: Date.now() + 2 * HOUR },
    customerId: CUSTOMER_ID,
    email: 'nando@example.com',
    firstName: 'Nando',
    lastName: 'Alvarez',
    ...overrides,
  }
}

function staleSession(overrides: Partial<CustomerSession> = {}): CustomerSession {
  const base = session(overrides)
  return { ...base, tokens: { ...base.tokens, expiresAt: Date.now() - HOUR } }
}

const summary: CustomerSummary = {
  id: CUSTOMER_ID,
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: 'Alvarez',
  displayName: 'Nando Alvarez',
  phone: null,
  defaultAddress: null,
}

const address: CustomerAddress = {
  id: ADDRESS_ID,
  firstName: 'Nando',
  lastName: 'Alvarez',
  company: null,
  address1: '47 Greenpoint Ave',
  address2: null,
  city: 'Brooklyn',
  zoneCode: 'NY',
  territoryCode: 'US',
  zip: '11222',
  phone: null,
  formatted: ['Nando Alvarez', '47 Greenpoint Ave', 'Brooklyn NY 11222', 'United States'],
  isDefault: false,
}

const DISCOVERY = {
  authorizationEndpoint: 'https://shopify.com/authentication/85215183073/oauth/authorize',
  tokenEndpoint: 'https://shopify.com/authentication/85215183073/oauth/token',
  logoutEndpoint: 'https://shopify.com/authentication/85215183073/logout',
  graphqlEndpoint: 'https://shopify.com/85215183073/account/customer/api/2026-07/graphql',
}

const unauthenticated = () =>
  new CustomerAccountError('Customer Account API rejected the access token', {
    status: 401,
    code: 'UNAUTHENTICATED',
  })

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const queryMocks = [
  getCustomerSummary,
  updateCustomer,
  getCustomerOrders,
  getCustomerAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
]

beforeEach(() => {
  jarStore.clear()
  vi.mocked(hasCustomerAccountEnv).mockReturnValue(true)
  vi.mocked(getCustomerSession).mockReset()
  vi.mocked(writeCustomerSession).mockReset()
  vi.mocked(clearCustomerSession).mockReset()
  vi.mocked(discover).mockReset().mockResolvedValue(DISCOVERY)
  vi.mocked(refreshTokens).mockReset()
  vi.mocked(resolveCustomer).mockReset()
  vi.mocked(getCustomerLoyaltyStats).mockReset()
  for (const mock of queryMocks) vi.mocked(mock).mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('getCustomerSummaryAction', () => {
  it('is unavailable without the customer account env and never fetches', async () => {
    vi.mocked(hasCustomerAccountEnv).mockReturnValue(false)

    await expect(getCustomerSummaryAction()).resolves.toEqual({
      status: 'unavailable',
      customer: null,
      loyalty: null,
    })
    expect(getCustomerSession).not.toHaveBeenCalled()
    expect(getCustomerSummary).not.toHaveBeenCalled()
  })

  it('is signed-out without a session cookie', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(null)
    await expect(getCustomerSummaryAction()).resolves.toEqual({
      status: 'signed-out',
      customer: null,
      loyalty: null,
    })
    expect(getCustomerSummary).not.toHaveBeenCalled()
  })

  it('returns the summary and the loyalty slice when ready', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    vi.mocked(getCustomerSummary).mockResolvedValue(summary)
    vi.mocked(resolveCustomer).mockResolvedValue({ id: 'cus_1', created: false })
    vi.mocked(getCustomerLoyaltyStats).mockResolvedValue({
      currentPoints: 1250,
      lifetimePoints: 4000,
      annualPointsEarned: 1250,
      annualSpend: 300,
      currentTier: { name: 'Friend', slug: 'friend' },
      nextTier: { name: 'Bestie', slug: 'bestie', minAnnualPoints: 3000 },
      pointsToNextTier: 1750,
      recentTransactions: [],
      recentRedemptions: [],
    } as unknown as Awaited<ReturnType<typeof getCustomerLoyaltyStats>>)

    const result = await getCustomerSummaryAction()

    expect(result).toEqual({
      status: 'ready',
      customer: summary,
      loyalty: { points: 1250, tierName: 'Friend', nextTierName: 'Bestie', pointsToNext: 1750, multiplier: 1 },
    })
    expect(getCustomerSummary).toHaveBeenCalledWith('atkn')
    expect(resolveCustomer).toHaveBeenCalledWith({
      shopifyCustomerId: CUSTOMER_ID,
      email: 'nando@example.com',
      firstName: 'Nando',
      lastName: 'Alvarez',
    })
    expect(getCustomerLoyaltyStats).toHaveBeenCalledWith('cus_1')
  })

  it('still reports ready with loyalty null when the loyalty lookup fails', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    vi.mocked(getCustomerSummary).mockResolvedValue(summary)
    vi.mocked(resolveCustomer).mockRejectedValue(new Error('db down'))

    await expect(getCustomerSummaryAction()).resolves.toEqual({
      status: 'ready',
      customer: summary,
      loyalty: null,
    })
  })

  it('refreshes a stale token inline, rewrites the cookie and uses the new token', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(staleSession())
    const fresh = { accessToken: 'atkn2', refreshToken: 'rtkn2', idToken: null, expiresAt: Date.now() + HOUR }
    vi.mocked(refreshTokens).mockResolvedValue(fresh)
    vi.mocked(getCustomerSummary).mockResolvedValue(summary)
    vi.mocked(resolveCustomer).mockRejectedValue(new Error('skip'))

    const result = await getCustomerSummaryAction()

    expect(result.status).toBe('ready')
    expect(refreshTokens).toHaveBeenCalledWith(DISCOVERY, 'rtkn')
    expect(writeCustomerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        // a refresh answer without id_token keeps the one from sign-in
        tokens: { accessToken: 'atkn2', refreshToken: 'rtkn2', idToken: 'idtkn', expiresAt: fresh.expiresAt },
      })
    )
    expect(getCustomerSummary).toHaveBeenCalledWith('atkn2')
  })

  it('is expired when the refresh fails or there is no refresh token', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(staleSession())
    vi.mocked(refreshTokens).mockRejectedValue(
      new CustomerAccountError('token request failed', { status: 400, code: 'invalid_grant' })
    )
    await expect(getCustomerSummaryAction()).resolves.toEqual({
      status: 'expired',
      customer: null,
      loyalty: null,
    })
    expect(getCustomerSummary).not.toHaveBeenCalled()

    vi.mocked(getCustomerSession).mockResolvedValue(
      staleSession({ tokens: { ...staleSession().tokens, refreshToken: null } })
    )
    await expect(getCustomerSummaryAction()).resolves.toMatchObject({ status: 'expired' })
    expect(refreshTokens).toHaveBeenCalledTimes(1)
  })

  it('is expired when the API rejects the token', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    vi.mocked(getCustomerSummary).mockRejectedValue(unauthenticated())
    await expect(getCustomerSummaryAction()).resolves.toMatchObject({ status: 'expired', customer: null })
  })

  it('never throws on an unexpected failure', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    vi.mocked(getCustomerSummary).mockRejectedValue(new Error('network'))
    await expect(getCustomerSummaryAction()).resolves.toMatchObject({ customer: null, loyalty: null })
  })
})

describe('updateProfileAction', () => {
  it('answers Accounts unavailable without the env', async () => {
    vi.mocked(hasCustomerAccountEnv).mockReturnValue(false)
    await expect(updateProfileAction(null, form({ firstName: 'N', lastName: 'A' }))).resolves.toEqual({
      ok: false,
      error: 'Accounts unavailable',
      code: 'UNAVAILABLE',
    })
    expect(updateCustomer).not.toHaveBeenCalled()
  })

  it('asks to sign in without a session', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(null)
    await expect(updateProfileAction(null, form({ firstName: 'N', lastName: 'A' }))).resolves.toEqual({
      ok: false,
      error: 'Please sign in.',
      code: 'SIGNED_OUT',
    })
  })

  it('rejects an empty first name before calling Shopify', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    const result = await updateProfileAction(null, form({ firstName: '   ', lastName: 'Alvarez' }))
    expect(result).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    expect(updateCustomer).not.toHaveBeenCalled()
  })

  it('updates the names, refreshes the cookie names and returns the summary', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    const updated = { ...summary, firstName: 'Fernando', displayName: 'Fernando Alvarez' }
    vi.mocked(updateCustomer).mockResolvedValue(updated)

    const result = await updateProfileAction(null, form({ firstName: ' Fernando ', lastName: 'Alvarez' }))

    expect(result).toEqual({ ok: true, data: updated })
    expect(updateCustomer).toHaveBeenCalledWith('atkn', { firstName: 'Fernando', lastName: 'Alvarez' })
    expect(writeCustomerSession).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Fernando', lastName: 'Alvarez', customerId: CUSTOMER_ID })
    )
  })

  it('maps userErrors to { ok: false, error, code }', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    vi.mocked(updateCustomer).mockRejectedValue(
      new CustomerAccountError('Last name is too long', {
        code: 'TOO_LONG',
        userErrors: [{ field: ['input', 'lastName'], message: 'Last name is too long', code: 'TOO_LONG' }],
      })
    )
    await expect(updateProfileAction(null, form({ firstName: 'N', lastName: 'A' }))).resolves.toEqual({
      ok: false,
      error: 'Last name is too long',
      code: 'TOO_LONG',
    })
    expect(writeCustomerSession).not.toHaveBeenCalled()
  })

  it('maps a 401 to "Please sign in again." / UNAUTHENTICATED', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    vi.mocked(updateCustomer).mockRejectedValue(unauthenticated())
    await expect(updateProfileAction(null, form({ firstName: 'N', lastName: 'A' }))).resolves.toEqual({
      ok: false,
      error: 'Please sign in again.',
      code: 'UNAUTHENTICATED',
    })
  })

  it('maps any other failure to the generic error and logs the message only', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    vi.mocked(updateCustomer).mockRejectedValue(new Error('boom atkn'))

    await expect(updateProfileAction(null, form({ firstName: 'N', lastName: 'A' }))).resolves.toEqual({
      ok: false,
      error: 'Something went wrong. Please try again.',
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(String(spy.mock.calls[0][0])).toContain('boom')
    spy.mockRestore()
  })

  it('refreshes a stale token before the mutation', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(staleSession())
    vi.mocked(refreshTokens).mockResolvedValue({
      accessToken: 'atkn2',
      refreshToken: 'rtkn2',
      idToken: null,
      expiresAt: Date.now() + HOUR,
    })
    vi.mocked(updateCustomer).mockResolvedValue(summary)

    await updateProfileAction(null, form({ firstName: 'N', lastName: 'A' }))

    expect(updateCustomer).toHaveBeenCalledWith('atkn2', { firstName: 'N', lastName: 'A' })
  })
})

describe('address actions', () => {
  beforeEach(() => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
  })

  it('createAddressAction maps the form to CustomerAddressInput and returns the list', async () => {
    vi.mocked(createAddress).mockResolvedValue([address])

    const result = await createAddressAction(
      null,
      form({
        firstName: 'Nando',
        lastName: 'Alvarez',
        company: '',
        address1: '47 Greenpoint Ave',
        address2: '',
        city: 'Brooklyn',
        zoneCode: 'ny',
        territoryCode: 'us',
        zip: ' 11222 ',
        phone: '',
        defaultAddress: 'on',
      })
    )

    expect(result).toEqual({ ok: true, data: [address] })
    expect(createAddress).toHaveBeenCalledWith('atkn', {
      firstName: 'Nando',
      lastName: 'Alvarez',
      company: null,
      address1: '47 Greenpoint Ave',
      address2: null,
      city: 'Brooklyn',
      zoneCode: 'NY',
      territoryCode: 'US',
      zip: '11222',
      phone: null,
      defaultAddress: true,
    })
  })

  it('createAddressAction omits defaultAddress when the box is unchecked and surfaces userErrors', async () => {
    vi.mocked(createAddress).mockRejectedValue(
      new CustomerAccountError('Zip is invalid', { code: 'INVALID', userErrors: [{ message: 'Zip is invalid' }] })
    )

    const result = await createAddressAction(null, form({ address1: '1 Main', territoryCode: 'US', zip: 'x' }))

    expect(result).toEqual({ ok: false, error: 'Zip is invalid', code: 'INVALID' })
    expect(vi.mocked(createAddress).mock.calls[0][1]).not.toHaveProperty('defaultAddress')
  })

  it('updateAddressAction requires a CustomerAddress gid', async () => {
    const result = await updateAddressAction(null, form({ addressId: 'nope', address1: '1 Main' }))
    expect(result).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    expect(updateAddress).not.toHaveBeenCalled()
  })

  it('updateAddressAction forwards the id and the input', async () => {
    vi.mocked(updateAddress).mockResolvedValue([address])

    const result = await updateAddressAction(
      null,
      form({ addressId: ADDRESS_ID, firstName: 'Nando', address1: '47 Greenpoint Ave', city: 'Brooklyn', defaultAddress: 'true' })
    )

    expect(result).toEqual({ ok: true, data: [address] })
    expect(updateAddress).toHaveBeenCalledWith('atkn', ADDRESS_ID, expect.objectContaining({
      firstName: 'Nando',
      address1: '47 Greenpoint Ave',
      city: 'Brooklyn',
      defaultAddress: true,
    }))
  })

  it('deleteAddressAction deletes then re-reads the list', async () => {
    vi.mocked(deleteAddress).mockResolvedValue(ADDRESS_ID)
    vi.mocked(getCustomerAddresses).mockResolvedValue([])

    await expect(deleteAddressAction(null, form({ addressId: ADDRESS_ID }))).resolves.toEqual({ ok: true, data: [] })
    expect(deleteAddress).toHaveBeenCalledWith('atkn', ADDRESS_ID)
    expect(getCustomerAddresses).toHaveBeenCalledWith('atkn')
  })

  it('deleteAddressAction maps a 401', async () => {
    vi.mocked(deleteAddress).mockRejectedValue(unauthenticated())
    await expect(deleteAddressAction(null, form({ addressId: ADDRESS_ID }))).resolves.toEqual({
      ok: false,
      error: 'Please sign in again.',
      code: 'UNAUTHENTICATED',
    })
  })

  it('address actions are unavailable without the env', async () => {
    vi.mocked(hasCustomerAccountEnv).mockReturnValue(false)
    await expect(deleteAddressAction(null, form({ addressId: ADDRESS_ID }))).resolves.toEqual({
      ok: false,
      error: 'Accounts unavailable',
      code: 'UNAVAILABLE',
    })
  })
})

describe('loadMoreOrdersAction', () => {
  it('loads the next page after the cursor', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    const page = { orders: [], hasNextPage: false, endCursor: null }
    vi.mocked(getCustomerOrders).mockResolvedValue(page)

    await expect(loadMoreOrdersAction('cursor-1')).resolves.toEqual({ ok: true, data: page })
    expect(getCustomerOrders).toHaveBeenCalledWith('atkn', { first: 10, after: 'cursor-1' })
  })

  it('rejects an empty cursor and answers signed-out without a session', async () => {
    vi.mocked(getCustomerSession).mockResolvedValue(session())
    await expect(loadMoreOrdersAction('')).resolves.toMatchObject({ ok: false, code: 'INVALID_INPUT' })

    vi.mocked(getCustomerSession).mockResolvedValue(null)
    await expect(loadMoreOrdersAction('cursor-1')).resolves.toEqual({
      ok: false,
      error: 'Please sign in.',
      code: 'SIGNED_OUT',
    })
    expect(getCustomerOrders).not.toHaveBeenCalled()
  })
})
