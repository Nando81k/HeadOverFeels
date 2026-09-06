/**
 * Shopify Admin API client.
 *
 * IMPORTANT: this module must only be imported from server code (Route Handlers,
 * Server Components/Actions) or from `scripts/shopify/*`. It intentionally does NOT
 * `import 'server-only'` — the scripts run under `tsx`, which has no `react-server`
 * export condition, so that import would throw there. Never import it from a client
 * component: it reads `SHOPIFY_ADMIN_ACCESS_TOKEN`.
 */
import { createAdminApiClient, type AdminApiClient } from '@shopify/admin-api-client'

import { SHOPIFY_API_VERSION, getShopifyAdminEnv } from './env'
import {
  ShopifyError,
  type ShopifyGraphQLError,
  type ShopifyUserError,
} from './errors'

let client: AdminApiClient | null = null

function getAdminClient(): AdminApiClient {
  if (!client) {
    const { storeDomain, accessToken } = getShopifyAdminEnv()
    client = createAdminApiClient({
      storeDomain,
      apiVersion: SHOPIFY_API_VERSION,
      accessToken,
    })
  }
  return client
}

/** Test hook: drop the memoised client so a new env is picked up. */
export function resetAdminClientCache(): void {
  client = null
}

/**
 * Runs a GraphQL operation against the Admin API and returns `data`.
 * Throws a `ShopifyError` on transport or GraphQL errors — never returns partial data.
 */
export async function adminRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const { data, errors } = await getAdminClient().request<T>(
    query,
    variables === undefined ? {} : { variables }
  )

  if (errors) {
    throw new ShopifyError(errors.message ?? 'Shopify Admin API request failed', {
      status: errors.networkStatusCode,
      // GraphQLError is an interface, so it needs a cast to satisfy the index signature.
      graphqlErrors: errors.graphQLErrors as ShopifyGraphQLError[] | undefined,
    })
  }

  if (data === undefined || data === null) {
    throw new ShopifyError('Shopify Admin API returned no data')
  }

  return data
}

function formatUserError(error: ShopifyUserError): string {
  const field = error.field && error.field.length > 0 ? error.field.join('.') : null
  const code = error.code ? ` (${error.code})` : ''
  return field ? `${field}: ${error.message}${code}` : `${error.message}${code}`
}

/**
 * Walks `path` (dot-separated, e.g. `'productSet'` or `'data.productSet'`) into `obj`
 * and throws a `ShopifyError` when the resolved node has a non-empty `userErrors` array.
 * A path that does not resolve is a no-op — there is nothing to assert.
 */
export function assertNoUserErrors(obj: unknown, path: string): void {
  let current: unknown = obj
  for (const segment of path.split('.')) {
    if (segment === '') continue
    if (current === null || typeof current !== 'object') return
    current = (current as Record<string, unknown>)[segment]
  }

  if (current === null || typeof current !== 'object') return
  const userErrors = (current as { userErrors?: unknown }).userErrors
  if (!Array.isArray(userErrors) || userErrors.length === 0) return

  const typed = userErrors as ShopifyUserError[]
  throw new ShopifyError(
    `${path || 'mutation'} returned userErrors: ${typed.map(formatUserError).join('; ')}`,
    { userErrors: typed }
  )
}
