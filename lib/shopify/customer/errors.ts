import { ShopifyError, type ShopifyErrorOptions } from '../errors'

/**
 * Errors raised by the Customer Account layer (`lib/shopify/customer/*`).
 *
 * `CustomerAccountError` is a `ShopifyError` with a machine-readable `code`:
 * `UNAUTHENTICATED` for a rejected or expired access token (HTTP 401 or a
 * GraphQL `UNAUTHENTICATED` extension), the OAuth `error` value for a failed
 * token request (`invalid_grant`, …), or a mutation's first `userErrors[].code`.
 * Actions map `code`/`status` to `AccountActionResult` (plan, note 8).
 *
 * `SignedOutError` is thrown by `requireFreshSession` when no session cookie is
 * present; the `SignInGate` boundary catches it and renders the inline gate.
 */

export type CustomerAccountErrorOptions = ShopifyErrorOptions & { code?: string }

export class CustomerAccountError extends ShopifyError {
  code?: string

  constructor(message: string, options: CustomerAccountErrorOptions = {}) {
    const { code, ...rest } = options
    super(message, rest)
    this.name = 'CustomerAccountError'
    if (code !== undefined) this.code = code
  }

  /** True for a 401 or an `UNAUTHENTICATED` code: the customer must sign in again. */
  get unauthenticated(): boolean {
    return this.status === 401 || this.code === 'UNAUTHENTICATED'
  }
}

export class SignedOutError extends Error {
  constructor() {
    super('Signed out')
    this.name = 'SignedOutError'
  }
}

export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof CustomerAccountError && error.unauthenticated
}
