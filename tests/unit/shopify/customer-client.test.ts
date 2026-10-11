// tests/unit/shopify/customer-client.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/customer/oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/oauth')>()
  return {
    ...actual,
    discover: vi.fn(async () => ({
      authorizationEndpoint: 'https://shopify.com/authentication/85215183073/oauth/authorize',
      tokenEndpoint: 'https://shopify.com/authentication/85215183073/oauth/token',
      logoutEndpoint: 'https://shopify.com/authentication/85215183073/logout',
      graphqlEndpoint: 'https://shopify.com/85215183073/account/customer/api/2026-07/graphql',
    })),
  }
})

import { customerFetch } from '@/lib/shopify/customer/client'
import { CustomerAccountError } from '@/lib/shopify/customer/errors'
import { USER_AGENT } from '@/lib/shopify/customer/oauth'

const QUERY = 'query CustomerSummary { customer { id } }'
const ENDPOINT = 'https://shopify.com/85215183073/account/customer/api/2026-07/graphql'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

const mockFetch = () => vi.mocked(fetch)

beforeEach(() => {
  mockFetch().mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('customerFetch', () => {
  it('POSTs to the discovered GraphQL endpoint with the raw token as Authorization and no-store', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { customer: { id: 'gid://shopify/Customer/1' } } }))

    const data = await customerFetch<{ customer: { id: string } }>(QUERY, {
      accessToken: 'atkn',
      variables: { first: 10 },
    })

    expect(data).toEqual({ customer: { id: 'gid://shopify/Customer/1' } })
    const [url, init] = mockFetch().mock.calls[0]
    expect(url).toBe(ENDPOINT)
    expect(init?.method).toBe('POST')
    expect(init?.cache).toBe('no-store')
    expect(init?.headers).toMatchObject({
      Authorization: 'atkn',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    })
    expect((init?.headers as Record<string, string>).Authorization.startsWith('Bearer')).toBe(false)
    expect(JSON.parse(String(init?.body))).toEqual({ query: QUERY, variables: { first: 10 } })
    expect((init as { next?: unknown }).next).toBeUndefined()
  })

  it('omits variables from the body when none are given', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))
    await customerFetch(QUERY, { accessToken: 'atkn' })
    expect(JSON.parse(String(mockFetch().mock.calls[0][1]?.body))).toEqual({ query: QUERY })
  })

  it('maps a 401 to CustomerAccountError { status: 401, code: UNAUTHENTICATED }', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ errors: [{ message: 'Unauthorized' }] }, 401))

    const error = await customerFetch(QUERY, { accessToken: 'stale' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CustomerAccountError)
    expect((error as CustomerAccountError).status).toBe(401)
    expect((error as CustomerAccountError).code).toBe('UNAUTHENTICATED')
    expect((error as CustomerAccountError).unauthenticated).toBe(true)
  })

  it('throws CustomerAccountError with the status on any other non-2xx', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({}, 500))
    const error = await customerFetch(QUERY, { accessToken: 'atkn' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CustomerAccountError)
    expect((error as CustomerAccountError).status).toBe(500)
    expect((error as CustomerAccountError).code).toBeUndefined()
  })

  it('surfaces GraphQL errors as CustomerAccountError with graphqlErrors', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ data: null, errors: [{ message: 'Field x does not exist' }] })
    )

    const error = await customerFetch(QUERY, { accessToken: 'atkn' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CustomerAccountError)
    expect((error as CustomerAccountError).graphqlErrors).toEqual([{ message: 'Field x does not exist' }])
    expect((error as Error).message).toContain('Field x does not exist')
  })

  it('treats a GraphQL UNAUTHENTICATED extension like a 401', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ errors: [{ message: 'Unauthenticated', extensions: { code: 'UNAUTHENTICATED' } }] })
    )
    const error = await customerFetch(QUERY, { accessToken: 'atkn' }).catch((e: unknown) => e)
    expect((error as CustomerAccountError).code).toBe('UNAUTHENTICATED')
    expect((error as CustomerAccountError).unauthenticated).toBe(true)
  })

  it('throws on a non-JSON or data-less 2xx response', async () => {
    mockFetch().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => {
        throw new SyntaxError('bad json')
      },
    } as unknown as Response)
    await expect(customerFetch(QUERY, { accessToken: 'atkn' })).rejects.toBeInstanceOf(CustomerAccountError)

    mockFetch().mockResolvedValueOnce(jsonResponse({ data: null }))
    await expect(customerFetch(QUERY, { accessToken: 'atkn' })).rejects.toBeInstanceOf(CustomerAccountError)
  })

  it('never puts the access token in an error message', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({}, 403))
    const error = await customerFetch(QUERY, { accessToken: 'super-secret-token' }).catch((e: unknown) => e)
    expect((error as Error).message).not.toContain('super-secret-token')
  })
})
