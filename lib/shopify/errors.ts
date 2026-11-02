/**
 * Shared error type for every Shopify API call (Storefront + Admin).
 *
 * `graphqlErrors` carries the GraphQL `errors` array from a 200 response;
 * `userErrors` carries a mutation's `userErrors` payload; `status` is the HTTP
 * status when the failure was at the transport level.
 */

export type ShopifyGraphQLError = { message: string; [k: string]: unknown }

export type ShopifyUserError = { field?: string[] | null; message: string; code?: string }

export type ShopifyErrorOptions = {
  status?: number
  graphqlErrors?: ShopifyGraphQLError[]
  userErrors?: ShopifyUserError[]
  cause?: unknown
}

export class ShopifyError extends Error {
  status?: number
  graphqlErrors?: ShopifyGraphQLError[]
  userErrors?: ShopifyUserError[]

  constructor(message: string, options: ShopifyErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ShopifyError'
    if (options.status !== undefined) this.status = options.status
    if (options.graphqlErrors !== undefined) this.graphqlErrors = options.graphqlErrors
    if (options.userErrors !== undefined) this.userErrors = options.userErrors
  }
}
