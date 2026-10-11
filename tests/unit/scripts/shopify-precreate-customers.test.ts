// tests/unit/scripts/shopify-precreate-customers.test.ts
import { describe, it, expect, vi } from 'vitest'

import { ShopifyError } from '@/lib/shopify/errors'
import {
  CUSTOMER_BY_EMAIL_QUERY,
  CUSTOMER_PRECREATE_MUTATION,
  buildCustomerInput,
  buildCustomerSearchQuery,
  formatCustomerTable,
  isThrottledError,
  matchCustomerByEmail,
  precreateCustomers,
  splitName,
  withThrottleRetry,
  type CustomerByEmailResponse,
  type CustomerPrecreateResponse,
  type PrecreateCustomerRow,
} from '@/scripts/shopify/lib/precreate-customers'

const row = (overrides: Partial<PrecreateCustomerRow> = {}): PrecreateCustomerRow => ({
  id: 'cus_1',
  email: 'ana@example.com',
  name: 'Ana Maria Lopez',
  newsletter: true,
  ...overrides,
})

const found = (id: string, email: string): CustomerByEmailResponse => ({
  customers: { nodes: [{ id, defaultEmailAddress: { emailAddress: email } }] },
})
const notFound: CustomerByEmailResponse = { customers: { nodes: [] } }
const created = (id: string, email: string): CustomerPrecreateResponse => ({
  customerCreate: {
    customer: { id, defaultEmailAddress: { emailAddress: email } },
    userErrors: [],
  },
})

/** Builds an `adminRequest` double that answers by document name. */
function makeRequest(handlers: {
  lookup?: (variables: Record<string, unknown>) => CustomerByEmailResponse
  create?: (variables: Record<string, unknown>) => CustomerPrecreateResponse
}) {
  return vi.fn(async (query: string, variables?: Record<string, unknown>) => {
    if (query === CUSTOMER_BY_EMAIL_QUERY) return handlers.lookup?.(variables ?? {}) ?? notFound
    if (query === CUSTOMER_PRECREATE_MUTATION) {
      if (!handlers.create) throw new Error('unexpected mutation')
      return handlers.create(variables ?? {})
    }
    throw new Error(`unexpected document: ${query.slice(0, 40)}`)
  }) as unknown as <T>(query: string, variables?: Record<string, unknown>) => Promise<T>
}

const calls = (request: unknown) => (request as ReturnType<typeof vi.fn>).mock.calls as [string, Record<string, unknown>?][]

describe('GraphQL documents', () => {
  it('match the validated Admin documents verbatim', () => {
    expect(CUSTOMER_PRECREATE_MUTATION).toBe(
      'mutation CustomerPrecreate($input: CustomerInput!) { customerCreate(input: $input) { customer { id defaultEmailAddress { emailAddress } } userErrors { field message } } }'
    )
    expect(CUSTOMER_BY_EMAIL_QUERY).toBe(
      'query CustomerByEmail($query: String!) { customers(first: 1, query: $query) { nodes { id defaultEmailAddress { emailAddress } } } }'
    )
  })
})

describe('splitName', () => {
  it('splits on the first space only', () => {
    expect(splitName('Ana Maria Lopez')).toEqual({ firstName: 'Ana', lastName: 'Maria Lopez' })
  })
  it('keeps a single word as the first name', () => {
    expect(splitName('Ana')).toEqual({ firstName: 'Ana', lastName: null })
  })
  it('trims and collapses blank names to nulls', () => {
    expect(splitName('  Ana   Lopez ')).toEqual({ firstName: 'Ana', lastName: 'Lopez' })
    expect(splitName(null)).toEqual({ firstName: null, lastName: null })
    expect(splitName('   ')).toEqual({ firstName: null, lastName: null })
  })
})

describe('buildCustomerSearchQuery', () => {
  it('wraps the email in an exact email: filter', () => {
    expect(buildCustomerSearchQuery('ana@example.com')).toBe('email:"ana@example.com"')
  })
  it('lower-cases and escapes quotes and backslashes', () => {
    expect(buildCustomerSearchQuery('Ana"Q\\@Example.com')).toBe('email:"ana\\"q\\\\@example.com"')
  })
})

describe('buildCustomerInput', () => {
  it('maps a newsletter subscriber to SUBSCRIBED single opt-in', () => {
    expect(buildCustomerInput(row())).toEqual({
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Maria Lopez',
      emailMarketingConsent: { marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN' },
    })
  })
  it('maps a non-subscriber to NOT_SUBSCRIBED and omits empty names', () => {
    expect(buildCustomerInput(row({ name: null, newsletter: false, email: ' Bo@Example.com ' }))).toEqual({
      email: 'bo@example.com',
      emailMarketingConsent: {
        marketingState: 'NOT_SUBSCRIBED',
        marketingOptInLevel: 'SINGLE_OPT_IN',
      },
    })
  })
})

describe('matchCustomerByEmail', () => {
  it('returns the gid when the first node has the same email (case-insensitive)', () => {
    expect(matchCustomerByEmail(found('gid://shopify/Customer/1', 'ANA@example.com'), 'ana@example.com')).toBe(
      'gid://shopify/Customer/1'
    )
  })
  it('returns null for no nodes or a different email', () => {
    expect(matchCustomerByEmail(notFound, 'ana@example.com')).toBeNull()
    expect(matchCustomerByEmail(found('gid://shopify/Customer/2', 'other@example.com'), 'ana@example.com')).toBeNull()
    expect(matchCustomerByEmail({ customers: { nodes: [{ id: 'gid://shopify/Customer/3', defaultEmailAddress: null }] } }, 'ana@example.com')).toBeNull()
  })
})

describe('throttling', () => {
  it('recognises a THROTTLED GraphQL error, a 429 and a throttled message', () => {
    expect(isThrottledError(new ShopifyError('x', { graphqlErrors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }] }))).toBe(true)
    expect(isThrottledError(new ShopifyError('rate', { status: 429 }))).toBe(true)
    expect(isThrottledError(new ShopifyError('Throttled'))).toBe(true)
    expect(isThrottledError(new ShopifyError('boom'))).toBe(false)
    expect(isThrottledError(new Error('Throttled'))).toBe(false)
  })

  it('withThrottleRetry sleeps and retries on THROTTLED, then rethrows after the budget', async () => {
    const sleep = vi.fn(async () => {})
    const throttled = new ShopifyError('Throttled', { status: 429 })
    let attempts = 0
    const result = await withThrottleRetry(
      async () => {
        attempts += 1
        if (attempts < 3) throw throttled
        return 'ok'
      },
      { sleep, delayMs: 100, maxAttempts: 5 }
    )
    expect(result).toBe('ok')
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenNthCalledWith(1, 100)
    expect(sleep).toHaveBeenNthCalledWith(2, 200)

    await expect(
      withThrottleRetry(async () => { throw throttled }, { sleep, delayMs: 1, maxAttempts: 2 })
    ).rejects.toBe(throttled)
  })

  it('withThrottleRetry does not retry other errors', async () => {
    const sleep = vi.fn(async () => {})
    await expect(
      withThrottleRetry(async () => { throw new Error('nope') }, { sleep, delayMs: 1, maxAttempts: 3 })
    ).rejects.toThrow('nope')
    expect(sleep).not.toHaveBeenCalled()
  })
})

describe('precreateCustomers', () => {
  it('dry run looks up by email but never mutates Shopify or Prisma', async () => {
    const request = makeRequest({
      lookup: (v) => (v.query === 'email:"ana@example.com"' ? found('gid://shopify/Customer/1', 'ana@example.com') : notFound),
    })
    const link = vi.fn(async () => {})
    const entries = await precreateCustomers(
      [row(), row({ id: 'cus_2', email: 'bo@example.com', name: 'Bo', newsletter: false })],
      { request, apply: false, link, sleep: async () => {} }
    )
    expect(entries).toEqual([
      { prismaCustomerId: 'cus_1', email: 'ana@example.com', shopifyCustomerId: 'gid://shopify/Customer/1', action: 'would-link' },
      { prismaCustomerId: 'cus_2', email: 'bo@example.com', shopifyCustomerId: null, action: 'would-create' },
    ])
    expect(calls(request).every(([query]) => query === CUSTOMER_BY_EMAIL_QUERY)).toBe(true)
    expect(calls(request)).toHaveLength(2)
    expect(link).not.toHaveBeenCalled()
  })

  it('dry run without a reachable store reports every row as would-create (lookup skipped)', async () => {
    const link = vi.fn(async () => {})
    const entries = await precreateCustomers([row()], { request: null, apply: false, link })
    expect(entries).toEqual([
      { prismaCustomerId: 'cus_1', email: 'ana@example.com', shopifyCustomerId: null, action: 'would-create', note: 'lookup skipped' },
    ])
    expect(link).not.toHaveBeenCalled()
  })

  it('found-by-email path writes only the gid (no customerCreate)', async () => {
    const request = makeRequest({ lookup: () => found('gid://shopify/Customer/1', 'ana@example.com') })
    const link = vi.fn(async () => {})
    const entries = await precreateCustomers([row()], { request, apply: true, link })
    expect(entries).toEqual([
      { prismaCustomerId: 'cus_1', email: 'ana@example.com', shopifyCustomerId: 'gid://shopify/Customer/1', action: 'linked' },
    ])
    expect(calls(request).map(([query]) => query)).toEqual([CUSTOMER_BY_EMAIL_QUERY])
    expect(link).toHaveBeenCalledExactlyOnceWith('cus_1', 'gid://shopify/Customer/1')
  })

  it('creates with the derived CustomerInput when not found, then links the gid', async () => {
    const request = makeRequest({
      lookup: () => notFound,
      create: () => created('gid://shopify/Customer/9', 'ana@example.com'),
    })
    const link = vi.fn(async () => {})
    const entries = await precreateCustomers([row()], { request, apply: true, link })
    expect(entries[0]).toEqual({
      prismaCustomerId: 'cus_1', email: 'ana@example.com', shopifyCustomerId: 'gid://shopify/Customer/9', action: 'created',
    })
    const mutation = calls(request).find(([query]) => query === CUSTOMER_PRECREATE_MUTATION)
    expect(mutation?.[1]).toEqual({ input: buildCustomerInput(row()) })
    expect(link).toHaveBeenCalledExactlyOnceWith('cus_1', 'gid://shopify/Customer/9')
  })

  it('an idempotent re-run (every row already in Shopify) creates nothing', async () => {
    const request = makeRequest({
      lookup: (v) => found(`gid://shopify/Customer/${String(v.query).length}`, String(v.query).slice(7, -1)),
    })
    const link = vi.fn(async () => {})
    const rows = [row(), row({ id: 'cus_2', email: 'bo@example.com' }), row({ id: 'cus_3', email: 'cy@example.com' })]
    const entries = await precreateCustomers(rows, { request, apply: true, link })
    expect(entries.map((e) => e.action)).toEqual(['linked', 'linked', 'linked'])
    expect(calls(request).some(([query]) => query === CUSTOMER_PRECREATE_MUTATION)).toBe(false)
    expect(link).toHaveBeenCalledTimes(3)
  })

  it('records userErrors as an error entry and keeps going', async () => {
    const request = makeRequest({
      lookup: () => notFound,
      create: (v) =>
        (v.input as { email: string }).email === 'ana@example.com'
          ? { customerCreate: { customer: null, userErrors: [{ field: ['input', 'email'], message: 'Email has already been taken' }] } }
          : created('gid://shopify/Customer/2', 'bo@example.com'),
    })
    const link = vi.fn(async () => {})
    const entries = await precreateCustomers([row(), row({ id: 'cus_2', email: 'bo@example.com' })], { request, apply: true, link })
    expect(entries[0]).toEqual({
      prismaCustomerId: 'cus_1', email: 'ana@example.com', shopifyCustomerId: null, action: 'error',
      note: 'input.email: Email has already been taken',
    })
    expect(entries[1].action).toBe('created')
    expect(link).toHaveBeenCalledExactlyOnceWith('cus_2', 'gid://shopify/Customer/2')
  })

  it('skips rows without a usable email and never calls Shopify for them', async () => {
    const request = makeRequest({})
    const link = vi.fn(async () => {})
    const entries = await precreateCustomers([row({ email: 'not-an-email' })], { request, apply: true, link })
    expect(entries[0]).toEqual({
      prismaCustomerId: 'cus_1', email: 'not-an-email', shopifyCustomerId: null, action: 'skipped', note: 'invalid email',
    })
    expect(calls(request)).toHaveLength(0)
  })

  it('sleeps and retries the lookup when Shopify answers THROTTLED', async () => {
    let lookups = 0
    const request = vi.fn(async (query: string) => {
      if (query === CUSTOMER_BY_EMAIL_QUERY) {
        lookups += 1
        if (lookups === 1) throw new ShopifyError('Throttled', { graphqlErrors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }] })
        return found('gid://shopify/Customer/1', 'ana@example.com')
      }
      throw new Error('unexpected')
    }) as unknown as <T>(query: string, variables?: Record<string, unknown>) => Promise<T>
    const sleep = vi.fn(async () => {})
    const entries = await precreateCustomers([row()], { request, apply: true, link: async () => {}, sleep })
    expect(entries[0].action).toBe('linked')
    expect(sleep).toHaveBeenCalledTimes(1)
  })
})

describe('formatCustomerTable', () => {
  it('renders one aligned line per entry with a header', () => {
    const table = formatCustomerTable([
      { prismaCustomerId: 'cus_1', email: 'ana@example.com', shopifyCustomerId: 'gid://shopify/Customer/1', action: 'linked' },
      { prismaCustomerId: 'cus_2', email: 'bo@example.com', shopifyCustomerId: null, action: 'error', note: 'boom' },
    ])
    const lines = table.split('\n')
    expect(lines[0]).toMatch(/^action\s+email\s+prisma id\s+shopify id\s+note$/)
    expect(lines[1]).toMatch(/^linked\s+ana@example\.com\s+cus_1\s+gid:\/\/shopify\/Customer\/1\s*$/)
    expect(lines[2]).toMatch(/^error\s+bo@example\.com\s+cus_2\s+-\s+boom$/)
  })
})
