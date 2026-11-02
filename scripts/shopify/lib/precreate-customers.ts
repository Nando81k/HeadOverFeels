/**
 * Pure helpers for scripts/shopify/precreate-customers.ts (Phase 4, Task 3).
 *
 * Pre-creates every active Prisma `Customer` in Shopify so the Customer Account API sign-in
 * lands on an existing Shopify customer whose gid the loyalty bridge can key on
 * (`Customer.shopifyCustomerId`). No I/O here: `adminRequest`, the Prisma write and the sleep
 * are injected, so the decisions (lookup → link, else create → link; dry run never mutates)
 * are unit-testable without credentials or a database.
 *
 * Admin API 2026-07. Both documents below were validated with the Shopify MCP on 2026-10-11
 * and must be copied verbatim (the tests pin them).
 */
import { ShopifyError } from '../../../lib/shopify/errors'

// ---------------------------------------------------------------------------
// GraphQL documents (validated — do not reformat)
// ---------------------------------------------------------------------------

export const CUSTOMER_PRECREATE_MUTATION =
  'mutation CustomerPrecreate($input: CustomerInput!) { customerCreate(input: $input) { customer { id defaultEmailAddress { emailAddress } } userErrors { field message } } }'

export const CUSTOMER_BY_EMAIL_QUERY =
  'query CustomerByEmail($query: String!) { customers(first: 1, query: $query) { nodes { id defaultEmailAddress { emailAddress } } } }'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The Prisma columns the script selects (kept Prisma-free so tests need no generated client). */
export interface PrecreateCustomerRow {
  id: string
  email: string
  name: string | null
  newsletter: boolean
}

/** Admin `CustomerInput` subset used for pre-creation. */
export interface CustomerPrecreateInput {
  email: string
  firstName?: string
  lastName?: string
  emailMarketingConsent: {
    marketingState: 'SUBSCRIBED' | 'NOT_SUBSCRIBED'
    marketingOptInLevel: 'SINGLE_OPT_IN'
  }
}

export interface CustomerNode {
  id: string
  defaultEmailAddress: { emailAddress: string | null } | null
}

export interface CustomerByEmailResponse {
  customers: { nodes: CustomerNode[] }
}

export interface CustomerPrecreateResponse {
  customerCreate: {
    customer: CustomerNode | null
    userErrors: { field?: string[] | null; message: string }[]
  }
}

export type CustomerMapAction =
  | 'linked' // found by email, gid written
  | 'created' // customerCreate, gid written
  | 'would-link' // dry run: found by email
  | 'would-create' // dry run: not found (or lookup skipped)
  | 'skipped' // no usable email
  | 'error' // userErrors / request failure (row left untouched)

export interface CustomerMapEntry {
  prismaCustomerId: string
  email: string
  shopifyCustomerId: string | null
  action: CustomerMapAction
  note?: string
}

/** Same shape as `adminRequest` from `lib/shopify/admin-client`. */
export type AdminRequestFn = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>

export interface PrecreateDeps {
  /** `null` = store unreachable (dry run only): lookups are skipped. */
  request: AdminRequestFn | null
  /** `false` = dry run: read-only lookups, no mutation, no Prisma write. */
  apply: boolean
  /** Writes `Customer.shopifyCustomerId`; only called with `apply: true`. */
  link: (prismaCustomerId: string, shopifyCustomerId: string) => Promise<void>
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>
  /** Called after each row so the CLI can stream progress. */
  onEntry?: (entry: CustomerMapEntry) => void
}

// ---------------------------------------------------------------------------
// Pure mapping
// ---------------------------------------------------------------------------

/** Splits `Customer.name` on the first space: `"Ana Maria Lopez"` → Ana / Maria Lopez. */
export function splitName(name: string | null): {
  firstName: string | null
  lastName: string | null
} {
  const trimmed = (name ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return { firstName: null, lastName: null }
  const space = trimmed.indexOf(' ')
  if (space === -1) return { firstName: trimmed, lastName: null }
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Loose sanity check — Shopify rejects the rest with a userError, which the table reports. */
export function isUsableEmail(email: string): boolean {
  const value = normalizeEmail(email)
  return value.length > 3 && value.includes('@') && !value.startsWith('@') && !value.endsWith('@')
}

/** Shopify search syntax: `email:"<email>"` (exact match on the normalised email). */
export function buildCustomerSearchQuery(email: string): string {
  const escaped = normalizeEmail(email).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `email:"${escaped}"`
}

/** `CustomerInput` for `customerCreate`, with marketing consent derived from `newsletter`. */
export function buildCustomerInput(row: PrecreateCustomerRow): CustomerPrecreateInput {
  const { firstName, lastName } = splitName(row.name)
  return {
    email: normalizeEmail(row.email),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    emailMarketingConsent: {
      marketingState: row.newsletter ? 'SUBSCRIBED' : 'NOT_SUBSCRIBED',
      marketingOptInLevel: 'SINGLE_OPT_IN',
    },
  }
}

/**
 * The gid of the first node when its email equals `email` (case-insensitive), else null —
 * Shopify search can return near matches, so the email is checked before linking.
 */
export function matchCustomerByEmail(response: CustomerByEmailResponse, email: string): string | null {
  const node = response.customers?.nodes?.[0]
  const nodeEmail = node?.defaultEmailAddress?.emailAddress
  if (!node || !nodeEmail) return null
  return normalizeEmail(nodeEmail) === normalizeEmail(email) ? node.id : null
}

export function formatUserErrors(errors: { field?: string[] | null; message: string }[]): string {
  return errors
    .map((error) => (error.field?.length ? `${error.field.join('.')}: ${error.message}` : error.message))
    .join('; ')
}

// ---------------------------------------------------------------------------
// Throttling (Admin API cost-based rate limit)
// ---------------------------------------------------------------------------

/** True for a `ShopifyError` carrying a `THROTTLED` GraphQL error, an HTTP 429 or a throttled message. */
export function isThrottledError(error: unknown): boolean {
  if (!(error instanceof ShopifyError)) return false
  if (error.status === 429) return true
  if (
    error.graphqlErrors?.some(
      (graphqlError) =>
        (graphqlError.extensions as { code?: string } | undefined)?.code === 'THROTTLED'
    )
  ) {
    return true
  }
  return /throttled/i.test(error.message)
}

export interface ThrottleRetryOptions {
  sleep?: (ms: number) => Promise<void>
  /** First back-off; doubles on every further THROTTLED answer. */
  delayMs?: number
  maxAttempts?: number
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/** Runs `fn`, sleeping and retrying (exponential back-off) while Shopify answers THROTTLED. */
export async function withThrottleRetry<T>(
  fn: () => Promise<T>,
  options: ThrottleRetryOptions = {}
): Promise<T> {
  const { sleep = defaultSleep, delayMs = 1000, maxAttempts = 5 } = options
  let delay = delayMs
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (!isThrottledError(error) || attempt >= maxAttempts) throw error
      await sleep(delay)
      delay *= 2
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestration (I/O injected)
// ---------------------------------------------------------------------------

async function processRow(row: PrecreateCustomerRow, deps: PrecreateDeps): Promise<CustomerMapEntry> {
  const email = normalizeEmail(row.email)
  const base = { prismaCustomerId: row.id, email }

  if (!isUsableEmail(email)) {
    return { ...base, shopifyCustomerId: null, action: 'skipped', note: 'invalid email' }
  }

  const { request, apply, sleep } = deps
  if (!request) {
    return { ...base, shopifyCustomerId: null, action: 'would-create', note: 'lookup skipped' }
  }
  const retry = { sleep }

  // 1. Lookup (read-only, runs in both modes).
  const lookup = await withThrottleRetry(
    () => request<CustomerByEmailResponse>(CUSTOMER_BY_EMAIL_QUERY, { query: buildCustomerSearchQuery(email) }),
    retry
  )
  const existingId = matchCustomerByEmail(lookup, email)

  if (existingId) {
    if (!apply) return { ...base, shopifyCustomerId: existingId, action: 'would-link' }
    await deps.link(row.id, existingId)
    return { ...base, shopifyCustomerId: existingId, action: 'linked' }
  }

  if (!apply) return { ...base, shopifyCustomerId: null, action: 'would-create' }

  // 2. Create, then link.
  const created = await withThrottleRetry(
    () => request<CustomerPrecreateResponse>(CUSTOMER_PRECREATE_MUTATION, { input: buildCustomerInput(row) }),
    retry
  )
  const errors = created.customerCreate?.userErrors ?? []
  const createdId = created.customerCreate?.customer?.id ?? null
  if (errors.length > 0 || !createdId) {
    return {
      ...base,
      shopifyCustomerId: null,
      action: 'error',
      note: errors.length > 0 ? formatUserErrors(errors) : 'customerCreate returned no customer',
    }
  }
  await deps.link(row.id, createdId)
  return { ...base, shopifyCustomerId: createdId, action: 'created' }
}

/**
 * Sequentially (rate-limit friendly) resolves every row: found by email → link the gid; else
 * create → link. Dry run (`apply: false`) stops after the lookup. A failing row becomes an
 * `error` entry and the run continues; the row keeps `shopifyCustomerId = null` for a re-run.
 */
export async function precreateCustomers(
  rows: PrecreateCustomerRow[],
  deps: PrecreateDeps
): Promise<CustomerMapEntry[]> {
  const entries: CustomerMapEntry[] = []
  for (const row of rows) {
    let entry: CustomerMapEntry
    try {
      entry = await processRow(row, deps)
    } catch (error) {
      entry = {
        prismaCustomerId: row.id,
        email: normalizeEmail(row.email),
        shopifyCustomerId: null,
        action: 'error',
        note: (error as Error).message,
      }
    }
    entries.push(entry)
    deps.onEntry?.(entry)
  }
  return entries
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Plain aligned text table: action, email, prisma id, shopify id, note. */
export function formatCustomerTable(entries: CustomerMapEntry[]): string {
  const rows = [
    ['action', 'email', 'prisma id', 'shopify id', 'note'],
    ...entries.map((entry) => [
      entry.action,
      entry.email,
      entry.prismaCustomerId,
      entry.shopifyCustomerId ?? '-',
      entry.note ?? '',
    ]),
  ]
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)))
  return rows
    .map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd())
    .join('\n')
}

/** Counts per action, for the summary line. */
export function summarizeEntries(entries: CustomerMapEntry[]): Record<CustomerMapAction, number> {
  const summary: Record<CustomerMapAction, number> = {
    linked: 0,
    created: 0,
    'would-link': 0,
    'would-create': 0,
    skipped: 0,
    error: 0,
  }
  for (const entry of entries) summary[entry.action] += 1
  return summary
}
