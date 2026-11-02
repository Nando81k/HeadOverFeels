/**
 * Polls an async `productSet(synchronous: false)` operation to completion (Phase 1, Task 4).
 *
 * Admin API 2026-07. The query below must be validated against the store's API version before
 * the first `--apply` run of scripts/shopify/migrate-catalog.ts.
 *
 * `request` and `sleep` are injectable so the polling loop is unit-testable without credentials;
 * the default `request` lazily imports the Admin client so that importing this module (in tests,
 * or from a pure-logic context) never touches `server-only` or the environment.
 */

export const PRODUCT_OPERATION_QUERY = /* GraphQL */ `
  query ProductSetOperation($id: ID!) {
    productOperation(id: $id) {
      ... on ProductSetOperation {
        status
        product {
          id
          handle
          variants(first: 100) {
            nodes {
              id
              sku
            }
          }
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  }
`

/** Admin API `ProductOperationStatusType`. */
export type ProductOperationStatus = 'CREATED' | 'ACTIVE' | 'COMPLETE' | 'FAILED'

export interface ProductOperationUserError {
  field?: string[] | null
  message: string
  code?: string | null
}

export interface ProductOperationResponse {
  productOperation: {
    status: ProductOperationStatus
    product: {
      id: string
      handle: string
      variants: { nodes: { id: string; sku: string | null }[] }
    } | null
    userErrors: ProductOperationUserError[]
  } | null
}

/** Same shape as `adminRequest` from `lib/shopify/admin-client`. */
export type AdminRequestFn = <T>(
  query: string,
  variables?: Record<string, unknown>
) => Promise<T>

export interface PollProductOperationOptions {
  request?: AdminRequestFn
  intervalMs?: number
  timeoutMs?: number
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>
  /** Injectable clock for tests; defaults to `Date.now`. */
  now?: () => number
}

export interface ProductOperationResult {
  productId: string
  handle: string
  variants: { id: string; sku: string | null }[]
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const defaultRequest: AdminRequestFn = async <T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> => {
  const { adminRequest } = await import('../../../lib/shopify/admin-client')
  return adminRequest<T>(query, variables)
}

function formatUserErrors(errors: ProductOperationUserError[]): string {
  if (errors.length === 0) return 'no userErrors returned'
  return errors
    .map((error) => {
      const field = error.field?.length ? `${error.field.join('.')}: ` : ''
      const code = error.code ? ` (${error.code})` : ''
      return `${field}${error.message}${code}`
    })
    .join('; ')
}

/**
 * Polls `productOperation(id:)` until the operation is `COMPLETE` (resolves) or `FAILED`
 * (throws with the operation's `userErrors`). Throws when the deadline passes first.
 */
export async function pollProductOperation(
  id: string,
  options: PollProductOperationOptions = {}
): Promise<ProductOperationResult> {
  const {
    request = defaultRequest,
    intervalMs = 1500,
    timeoutMs = 120_000,
    sleep = defaultSleep,
    now = Date.now,
  } = options

  const deadline = now() + timeoutMs

  for (;;) {
    const data = await request<ProductOperationResponse>(PRODUCT_OPERATION_QUERY, { id })
    const operation = data?.productOperation

    if (!operation) {
      throw new Error(`Product operation ${id} not found`)
    }

    if (operation.status === 'FAILED') {
      throw new Error(
        `Product operation ${id} FAILED — ${formatUserErrors(operation.userErrors ?? [])}`
      )
    }

    if (operation.status === 'COMPLETE') {
      if (!operation.product) {
        throw new Error(`Product operation ${id} completed without a product`)
      }
      return {
        productId: operation.product.id,
        handle: operation.product.handle,
        variants: operation.product.variants?.nodes ?? [],
      }
    }

    if (now() >= deadline) {
      throw new Error(
        `Product operation ${id} timed out after ${timeoutMs}ms (last status ${operation.status})`
      )
    }

    await sleep(intervalMs)
  }
}
