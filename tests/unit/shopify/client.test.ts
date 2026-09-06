// tests/unit/shopify/client.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `server-only` throws outside a React Server environment; the client imports it on purpose.
vi.mock('server-only', () => ({}))

import { storefrontFetch } from '@/lib/shopify/client'
import { resetShopifyEnvCache } from '@/lib/shopify/env'
import { ShopifyError } from '@/lib/shopify/errors'

const QUERY = 'query Shop { shop { name } }'
const API_URL = 'https://tgqucm-qg.myshopify.com/api/2026-07/graphql.json'

type MockHeaders = { get(name: string): string | null }

function headers(values: Record<string, string> = {}): MockHeaders {
  const lower = new Map(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]))
  return { get: (name) => lower.get(name.toLowerCase()) ?? null }
}

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(init.headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

const mockFetch = () => vi.mocked(fetch)

function lastInit(call = 0): RequestInit & { next?: { tags?: string[]; revalidate?: number | false } } {
  return mockFetch().mock.calls[call][1] as RequestInit & {
    next?: { tags?: string[]; revalidate?: number | false }
  }
}

beforeEach(() => {
  vi.mocked(fetch).mockReset()
  process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
  process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = 'private-token'
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN = 'public-token'
  delete process.env.SHOPIFY_STOREFRONT_API_VERSION
  resetShopifyEnvCache()
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.SHOPIFY_STORE_DOMAIN
  delete process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN
  delete process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN
  resetShopifyEnvCache()
})

describe('storefrontFetch', () => {
  it('POSTs to the 2026-07 GraphQL endpoint with the private token header', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { shop: { name: 'Head Over Feels' } } }))

    const data = await storefrontFetch<{ shop: { name: string } }>(QUERY, {
      variables: { handle: 'tee' },
    })

    expect(data).toEqual({ shop: { name: 'Head Over Feels' } })
    expect(mockFetch()).toHaveBeenCalledTimes(1)

    const [url, init] = mockFetch().mock.calls[0]
    expect(url).toBe(API_URL)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Shopify-Storefront-Private-Token': 'private-token',
    })
    expect(JSON.parse(String(init?.body))).toEqual({ query: QUERY, variables: { handle: 'tee' } })
  })

  it('omits the buyer IP header unless buyerIp is given', async () => {
    mockFetch().mockResolvedValue(jsonResponse({ data: { ok: true } }))

    await storefrontFetch(QUERY)
    expect(lastInit(0).headers).not.toHaveProperty('Shopify-Storefront-Buyer-IP')

    await storefrontFetch(QUERY, { buyerIp: '203.0.113.7' })
    expect(lastInit(1).headers).toMatchObject({ 'Shopify-Storefront-Buyer-IP': '203.0.113.7' })
  })

  it('passes next: { tags, revalidate } through to fetch', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))

    await storefrontFetch(QUERY, { tags: ['product:tee', 'collections'], revalidate: 300 })

    expect(lastInit().next).toEqual({ tags: ['product:tee', 'collections'], revalidate: 300 })
    expect(lastInit().cache).toBeUndefined()
  })

  it('sets cache: no-store when revalidate is false', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))

    await storefrontFetch(QUERY, { tags: ['search'], revalidate: false })

    expect(lastInit().next).toEqual({ tags: ['search'], revalidate: false })
    expect(lastInit().cache).toBe('no-store')
  })

  it('omits next entirely when neither tags nor revalidate are given', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))

    await storefrontFetch(QUERY)

    expect(lastInit().next).toBeUndefined()
  })

  it('throws ShopifyError with the status on a non-2xx response', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ errors: [{ message: 'nope' }] }, { status: 401 }))

    const error = await storefrontFetch(QUERY).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ShopifyError)
    expect((error as ShopifyError).status).toBe(401)
    expect(mockFetch()).toHaveBeenCalledTimes(1)
  })

  it('throws ShopifyError with graphqlErrors when the body carries errors', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({
        data: { product: null },
        errors: [{ message: 'Field "nope" doesn\'t exist' }, { message: 'second problem' }],
      })
    )

    const error = (await storefrontFetch(QUERY).catch((e: unknown) => e)) as ShopifyError

    expect(error).toBeInstanceOf(ShopifyError)
    expect(error.graphqlErrors).toHaveLength(2)
    expect(error.message).toContain('Field "nope" doesn\'t exist')
  })

  it('throws when the response has no data and no errors', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({}))

    await expect(storefrontFetch(QUERY)).rejects.toBeInstanceOf(ShopifyError)
  })

  it('retries once on 429 after Retry-After seconds', async () => {
    vi.useFakeTimers()
    mockFetch()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))

    const promise = storefrontFetch<{ ok: boolean }>(QUERY)

    await vi.advanceTimersByTimeAsync(1_900)
    expect(mockFetch()).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(200)
    await expect(promise).resolves.toEqual({ ok: true })
    expect(mockFetch()).toHaveBeenCalledTimes(2)
  })

  it('retries once on 430 with a 1s default when Retry-After is absent', async () => {
    vi.useFakeTimers()
    mockFetch()
      .mockResolvedValueOnce(jsonResponse({}, { status: 430 }))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))

    const promise = storefrontFetch<{ ok: boolean }>(QUERY)

    await vi.advanceTimersByTimeAsync(1_000)
    await expect(promise).resolves.toEqual({ ok: true })
    expect(mockFetch()).toHaveBeenCalledTimes(2)
  })

  it('retries at most once and then throws with the status', async () => {
    vi.useFakeTimers()
    mockFetch().mockResolvedValue(jsonResponse({}, { status: 429, headers: { 'Retry-After': '1' } }))

    const promise = storefrontFetch(QUERY)
    const settled = promise.catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(5_000)

    const error = (await settled) as ShopifyError
    expect(error).toBeInstanceOf(ShopifyError)
    expect(error.status).toBe(429)
    expect(mockFetch()).toHaveBeenCalledTimes(2)
  })
})
