'use server'

import { z } from 'zod'

import { getCustomerLoyaltyStats } from '@/lib/loyalty/service'
import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { CustomerAccountError } from '@/lib/shopify/customer/errors'
import { discover, refreshTokens } from '@/lib/shopify/customer/oauth'
import {
  createAddress,
  deleteAddress,
  getCustomerAddresses,
  getCustomerOrders,
  getCustomerSummary,
  updateAddress,
  updateCustomer,
} from '@/lib/shopify/customer/queries'
import {
  getCustomerSession,
  isAccessTokenFresh,
  withRefreshedTokens,
  writeCustomerSession,
  type CustomerSession,
} from '@/lib/shopify/customer/session'
import type {
  AccountActionResult,
  CustomerAddress,
  CustomerAddressInput,
  CustomerOrdersPage,
  CustomerSummary,
} from '@/lib/shopify/types'

/**
 * Account Server Actions: the only entry points the account UI uses
 * (Phase 4 plan, "Shared contracts" + cross-cutting notes 5 and 8).
 *
 * - Unconfigured (`hasCustomerAccountEnv()` false) → `Accounts unavailable`,
 *   nothing is fetched. Never throw to the client.
 * - A stale access token is refreshed inline here (a Server Action may set
 *   cookies); when that fails the result is `expired` / `UNAUTHENTICATED` and
 *   the provider sends the customer through `/account/refresh` or sign-in.
 * - Customer Account `userErrors` → `{ ok: false, error: <first message>, code }`;
 *   a 401 → `{ ok: false, error: 'Please sign in again.', code: 'UNAUTHENTICATED' }`;
 *   anything else → a generic message, logged with the error message only.
 */

export type CustomerSummaryStatus = 'signed-out' | 'unavailable' | 'expired' | 'ready'

export type CustomerLoyaltySlice = {
  points: number
  tierName: string
  nextTierName: string | null
  pointsToNext: number | null
}

export type CustomerSummaryState = {
  status: CustomerSummaryStatus
  customer: CustomerSummary | null
  loyalty: CustomerLoyaltySlice | null
}

const UNAVAILABLE = { ok: false, error: 'Accounts unavailable', code: 'UNAVAILABLE' } as const
const SIGNED_OUT = { ok: false, error: 'Please sign in.', code: 'SIGNED_OUT' } as const
const EXPIRED = { ok: false, error: 'Please sign in again.', code: 'UNAUTHENTICATED' } as const
const GENERIC_ERROR = 'Something went wrong. Please try again.'
const ORDERS_PAGE_SIZE = 10

const nameSchema = z.string().trim().min(1).max(100)
const profileSchema = z.object({ firstName: nameSchema, lastName: nameSchema })
const addressIdSchema = z.string().trim().startsWith('gid://shopify/CustomerAddress/').max(512)
const cursorSchema = z.string().trim().min(1).max(1024)

const optionalText = (max: number) => z.string().trim().max(max).nullable()
const addressSchema = z.object({
  firstName: optionalText(100),
  lastName: optionalText(100),
  company: optionalText(100),
  address1: optionalText(255),
  address2: optionalText(255),
  city: optionalText(100),
  zoneCode: z.string().trim().toUpperCase().max(10).nullable(),
  territoryCode: z.string().trim().toUpperCase().length(2).nullable(),
  zip: optionalText(20),
  phone: optionalText(30),
})

// ---------------------------------------------------------------- helpers

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function invalid<T>(error: string): AccountActionResult<T> {
  return { ok: false, error, code: 'INVALID_INPUT' }
}

/** Map any failure to a result; only unexpected failures are logged (message only). */
function failure<T>(error: unknown): AccountActionResult<T> {
  if (error instanceof CustomerAccountError) {
    if (error.unauthenticated) return EXPIRED
    const first = error.userErrors?.[0]
    if (first) {
      const code = error.code ?? first.code
      return code ? { ok: false, error: first.message, code } : { ok: false, error: first.message }
    }
  }
  console.error(`[storefront] account action failed: ${errorMessage(error)}`)
  return { ok: false, error: GENERIC_ERROR }
}

type ResolvedSession =
  | { kind: 'unavailable' }
  | { kind: 'signed-out' }
  | { kind: 'expired' }
  | { kind: 'ready'; session: CustomerSession }

/** Env gate, cookie read and an inline refresh of a stale access token. */
async function resolveSession(): Promise<ResolvedSession> {
  if (!hasCustomerAccountEnv()) return { kind: 'unavailable' }
  const session = await getCustomerSession()
  if (!session) return { kind: 'signed-out' }
  if (isAccessTokenFresh(session)) return { kind: 'ready', session }
  if (!session.tokens.refreshToken) return { kind: 'expired' }

  try {
    const discovery = await discover()
    const next = await refreshTokens(discovery, session.tokens.refreshToken)
    const refreshed = withRefreshedTokens(session, next)
    await writeCustomerSession(refreshed)
    return { kind: 'ready', session: refreshed }
  } catch (error) {
    console.error(`[storefront] customer token refresh failed: ${errorMessage(error)}`)
    return { kind: 'expired' }
  }
}

/** Shared shell for the mutations: session resolution + error mapping. */
async function withSession<T>(
  run: (session: CustomerSession) => Promise<T>
): Promise<AccountActionResult<T>> {
  const resolved = await resolveSession()
  if (resolved.kind === 'unavailable') return UNAVAILABLE
  if (resolved.kind === 'signed-out') return SIGNED_OUT
  if (resolved.kind === 'expired') return EXPIRED
  try {
    return { ok: true, data: await run(resolved.session) }
  } catch (error) {
    return failure<T>(error)
  }
}

/**
 * Care Points slice for the header / overview. The Prisma customer is resolved
 * through the loyalty bridge (dynamic import so this file does not depend on
 * it at build time); any failure yields `null` — the account still works
 * without loyalty.
 */
async function loadLoyalty(session: CustomerSession): Promise<CustomerLoyaltySlice | null> {
  try {
    const bridge = await import('@/lib/loyalty/shopify-bridge').catch(() => null)
    if (!bridge || typeof bridge.resolveCustomer !== 'function') return null
    const { id } = await bridge.resolveCustomer({
      shopifyCustomerId: session.customerId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
    })
    const stats = await getCustomerLoyaltyStats(id)
    return {
      points: stats.currentPoints,
      tierName: stats.currentTier?.name ?? 'Member',
      nextTierName: stats.nextTier?.name ?? null,
      pointsToNext: stats.pointsToNextTier ?? null,
    }
  } catch (error) {
    console.error(`[storefront] loyalty summary failed: ${errorMessage(error)}`)
    return null
  }
}

function field(formData: FormData, name: string): string | null {
  const value = formData.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function flag(formData: FormData, name: string): boolean | undefined {
  const value = formData.get(name)
  if (value === null) return undefined
  return value === 'on' || value === 'true' || value === '1'
}

/** `null` when the address fields are not valid. `defaultAddress` only when the field was sent. */
function parseAddressInput(formData: FormData): CustomerAddressInput | null {
  const parsed = addressSchema.safeParse({
    firstName: field(formData, 'firstName'),
    lastName: field(formData, 'lastName'),
    company: field(formData, 'company'),
    address1: field(formData, 'address1'),
    address2: field(formData, 'address2'),
    city: field(formData, 'city'),
    zoneCode: field(formData, 'zoneCode'),
    territoryCode: field(formData, 'territoryCode'),
    zip: field(formData, 'zip'),
    phone: field(formData, 'phone'),
  })
  if (!parsed.success) return null
  const defaultAddress = flag(formData, 'defaultAddress')
  return defaultAddress === undefined ? parsed.data : { ...parsed.data, defaultAddress }
}

// ---------------------------------------------------------------- actions

/** Loaded once by `CustomerProvider` after mount. Never throws. */
export async function getCustomerSummaryAction(): Promise<CustomerSummaryState> {
  const empty = (status: CustomerSummaryStatus): CustomerSummaryState => ({
    status,
    customer: null,
    loyalty: null,
  })

  const resolved = await resolveSession()
  if (resolved.kind !== 'ready') return empty(resolved.kind)

  try {
    const customer = await getCustomerSummary(resolved.session.tokens.accessToken)
    const loyalty = await loadLoyalty(resolved.session)
    return { status: 'ready', customer, loyalty }
  } catch (error) {
    if (!(error instanceof CustomerAccountError && error.unauthenticated)) {
      console.error(`[storefront] customer summary failed: ${errorMessage(error)}`)
    }
    return empty('expired')
  }
}

/** `useActionState` form: fields `firstName`, `lastName`. */
export async function updateProfileAction(
  _prev: AccountActionResult<CustomerSummary> | null,
  formData: FormData
): Promise<AccountActionResult<CustomerSummary>> {
  if (!hasCustomerAccountEnv()) return UNAVAILABLE
  const parsed = profileSchema.safeParse({
    firstName: formData.get('firstName') ?? '',
    lastName: formData.get('lastName') ?? '',
  })
  if (!parsed.success) return invalid('Enter your first and last name.')

  return withSession(async (session) => {
    const summary = await updateCustomer(session.tokens.accessToken, parsed.data)
    await writeCustomerSession({
      ...session,
      firstName: summary.firstName,
      lastName: summary.lastName,
    })
    return summary
  })
}

/** `useActionState` form: the address fields + optional `defaultAddress` checkbox. */
export async function createAddressAction(
  _prev: AccountActionResult<CustomerAddress[]> | null,
  formData: FormData
): Promise<AccountActionResult<CustomerAddress[]>> {
  if (!hasCustomerAccountEnv()) return UNAVAILABLE
  const input = parseAddressInput(formData)
  if (!input) return invalid('Check the address fields and try again.')
  return withSession((session) => createAddress(session.tokens.accessToken, input))
}

/** `useActionState` form: `addressId` + the address fields + optional `defaultAddress`. */
export async function updateAddressAction(
  _prev: AccountActionResult<CustomerAddress[]> | null,
  formData: FormData
): Promise<AccountActionResult<CustomerAddress[]>> {
  if (!hasCustomerAccountEnv()) return UNAVAILABLE
  const id = addressIdSchema.safeParse(formData.get('addressId') ?? '')
  if (!id.success) return invalid('That address could not be found.')
  const input = parseAddressInput(formData)
  if (!input) return invalid('Check the address fields and try again.')
  return withSession((session) => updateAddress(session.tokens.accessToken, id.data, input))
}

/** `useActionState` form: `addressId`. Returns the remaining addresses. */
export async function deleteAddressAction(
  _prev: AccountActionResult<CustomerAddress[]> | null,
  formData: FormData
): Promise<AccountActionResult<CustomerAddress[]>> {
  if (!hasCustomerAccountEnv()) return UNAVAILABLE
  const id = addressIdSchema.safeParse(formData.get('addressId') ?? '')
  if (!id.success) return invalid('That address could not be found.')
  return withSession(async (session) => {
    await deleteAddress(session.tokens.accessToken, id.data)
    return getCustomerAddresses(session.tokens.accessToken)
  })
}

/** Next page of the orders list, after the given cursor. */
export async function loadMoreOrdersAction(after: string): Promise<AccountActionResult<CustomerOrdersPage>> {
  if (!hasCustomerAccountEnv()) return UNAVAILABLE
  const cursor = cursorSchema.safeParse(after)
  if (!cursor.success) return invalid('No more orders to load.')
  return withSession((session) =>
    getCustomerOrders(session.tokens.accessToken, { first: ORDERS_PAGE_SIZE, after: cursor.data })
  )
}
