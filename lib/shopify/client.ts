import 'server-only'

import { getShopifyEnv } from './env'
import { ShopifyError, type ShopifyGraphQLError } from './errors'

/**
 * Server-only Storefront API fetcher.
 *
 * We deliberately use the global `fetch` rather than `@shopify/storefront-api-client`'s
 * request wrapper: Next.js only applies `next: { tags, revalidate }` to its patched
 * global fetch, and the SDK's wrapper owns its own retry/abort handling. The URL and
 * header names below match what `createStorefrontApiClient().getApiUrl()/getHeaders()`
 * produce for API version 2026-07.
 */
export type StorefrontFetchOptions = {
  variables?: Record<string, unknown>
  tags?: string[]
  revalidate?: number | false
  buyerIp?: string
}

type StorefrontResponseBody<T> = {
  data?: T | null
  errors?: ShopifyGraphQLError[] | null
}

type NextFetchOptions = { tags?: string[]; revalidate?: number | false }
type StorefrontRequestInit = RequestInit & { next?: NextFetchOptions }

/** HTTP statuses Shopify uses for throttling (430 = "shop is throttled"). */
const RETRYABLE_STATUSES = new Set([429, 430])
const DEFAULT_RETRY_AFTER_SECONDS = 1

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function retryAfterMs(response: Response): number {
  const header = response.headers?.get?.('Retry-After')
  const seconds = header === null || header === undefined ? NaN : Number(header)
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS
  return safe * 1000
}

export async function storefrontFetch<T>(
  query: string,
  opts: StorefrontFetchOptions = {}
): Promise<T> {
  const { storeDomain, apiVersion, privateToken } = getShopifyEnv()
  const url = `https://${storeDomain}/api/${apiVersion}/graphql.json`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Shopify-Storefront-Private-Token': privateToken,
  }
  if (opts.buyerIp) headers['Shopify-Storefront-Buyer-IP'] = opts.buyerIp

  const next: NextFetchOptions = {}
  if (opts.tags !== undefined) next.tags = opts.tags
  if (opts.revalidate !== undefined) next.revalidate = opts.revalidate

  const init: StorefrontRequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify(
      opts.variables === undefined ? { query } : { query, variables: opts.variables }
    ),
  }
  if (Object.keys(next).length > 0) init.next = next
  if (opts.revalidate === false) init.cache = 'no-store'

  let response = await fetch(url, init)

  if (RETRYABLE_STATUSES.has(response.status)) {
    await sleep(retryAfterMs(response))
    response = await fetch(url, init)
  }

  if (!response.ok) {
    throw new ShopifyError(
      `Shopify Storefront API request failed with status ${response.status}`,
      { status: response.status }
    )
  }

  let body: StorefrontResponseBody<T>
  try {
    body = (await response.json()) as StorefrontResponseBody<T>
  } catch (cause) {
    throw new ShopifyError('Shopify Storefront API returned a non-JSON response', {
      status: response.status,
      cause,
    })
  }

  if (body.errors && body.errors.length > 0) {
    throw new ShopifyError(
      `Shopify Storefront API returned errors: ${body.errors.map((e) => e.message).join('; ')}`,
      { status: response.status, graphqlErrors: body.errors }
    )
  }

  if (body.data === undefined || body.data === null) {
    throw new ShopifyError('Shopify Storefront API returned no data', { status: response.status })
  }

  return body.data
}
