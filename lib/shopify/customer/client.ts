import 'server-only'

import type { ShopifyGraphQLError } from '../errors'
import { CustomerAccountError } from './errors'
import { discover, USER_AGENT } from './oauth'

/**
 * Server-only Customer Account API fetcher.
 *
 * POSTs to the GraphQL endpoint found by `discover()` with the customer's
 * access token as the raw `Authorization` header value (the Customer Account
 * API takes the token as-is — no `Bearer` prefix). Every call is
 * `cache: 'no-store'` and carries no cache tags: responses are per customer
 * and must never land in the data cache (plan, note 7).
 *
 * Errors: 401 → `CustomerAccountError({ status: 401, code: 'UNAUTHENTICATED' })`
 * (the actions turn this into "Please sign in again."); a GraphQL error with
 * `extensions.code: 'UNAUTHENTICATED'` is mapped the same way; other GraphQL
 * errors → `CustomerAccountError({ graphqlErrors })`. Token values never
 * appear in messages.
 */

export type CustomerFetchOptions = {
  variables?: Record<string, unknown>
  accessToken: string
}

type CustomerGraphQLError = ShopifyGraphQLError & { extensions?: { code?: unknown } | null }

type CustomerResponseBody<T> = {
  data?: T | null
  errors?: CustomerGraphQLError[] | null
}

function hasUnauthenticatedExtension(errors: CustomerGraphQLError[]): boolean {
  return errors.some((error) => error.extensions?.code === 'UNAUTHENTICATED')
}

export async function customerFetch<T>(query: string, opts: CustomerFetchOptions): Promise<T> {
  const { graphqlEndpoint } = await discover()

  const response = await fetch(graphqlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: opts.accessToken,
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(
      opts.variables === undefined ? { query } : { query, variables: opts.variables }
    ),
    cache: 'no-store',
  })

  if (response.status === 401) {
    throw new CustomerAccountError('Customer Account API rejected the access token', {
      status: 401,
      code: 'UNAUTHENTICATED',
    })
  }

  if (!response.ok) {
    throw new CustomerAccountError(
      `Customer Account API request failed with status ${response.status}`,
      { status: response.status }
    )
  }

  let body: CustomerResponseBody<T>
  try {
    body = (await response.json()) as CustomerResponseBody<T>
  } catch (cause) {
    throw new CustomerAccountError('Customer Account API returned a non-JSON response', {
      status: response.status,
      cause,
    })
  }

  const errors = body.errors ?? []
  if (errors.length > 0) {
    const unauthenticated = hasUnauthenticatedExtension(errors)
    throw new CustomerAccountError(
      `Customer Account API returned errors: ${errors.map((e) => e.message).join('; ')}`,
      unauthenticated
        ? { status: 401, code: 'UNAUTHENTICATED', graphqlErrors: errors }
        : { status: response.status, graphqlErrors: errors }
    )
  }

  if (body.data === undefined || body.data === null) {
    throw new CustomerAccountError('Customer Account API returned no data', {
      status: response.status,
    })
  }

  return body.data
}
