'use server'

import { z } from 'zod'

import { applyRedeemedCode } from '@/app/(storefront)/_actions/cart'
import { getLedgerPage, type LedgerPage } from '@/lib/loyalty/ledger'
import {
  getLoyaltyOverview,
  LoyaltyError,
  redeemRewardToCode,
  resolveCustomer,
  type LoyaltyOverview,
  type RedeemResult,
} from '@/lib/loyalty/shopify-bridge'
import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { getCustomerSession, type CustomerSession } from '@/lib/shopify/customer/session'
import { hasShopifyAdminEnv } from '@/lib/shopify/env'
import type { Cart, LoyaltyActionResult } from '@/lib/shopify/types'

/**
 * Care Points Server Actions (Phase 4, Task 2). The only loyalty entry points the
 * storefront UI uses. Rules (cross-cutting notes 5, 6, 8):
 * - Accounts unconfigured → `{ ok: false, error: 'Accounts unavailable' }`, no fetch.
 * - Signed out → `{ ok: false, code: 'SIGNED_OUT' }` (the hub renders its gate inline).
 * - Admin API unconfigured → redemption returns 'Rewards unavailable'; no points move.
 * - Never throws to the client; unexpected failures are logged by message only.
 */

const UNAVAILABLE = { ok: false as const, error: 'Accounts unavailable', code: 'UNAVAILABLE' }
const SIGNED_OUT = { ok: false as const, error: 'Sign in to see your Care Points.', code: 'SIGNED_OUT' }
const REWARDS_UNAVAILABLE = { ok: false as const, error: 'Rewards unavailable', code: 'REWARDS_UNAVAILABLE' }
const GENERIC_ERROR = 'Something went wrong. Please try again.'

const redeemInputSchema = z.object({
  rewardId: z.string().trim().min(1).max(255),
  idempotencyKey: z.string().trim().min(8).max(128),
})

const ledgerInputSchema = z.object({
  cursor: z.string().trim().min(1).max(255).nullish(),
  limit: z.number().int().min(1).max(50).optional(),
  filter: z.enum(['all', 'earned', 'redeemed']).optional(),
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function failure<T>(scope: string, error: unknown): LoyaltyActionResult<T> {
  if (error instanceof LoyaltyError) return { ok: false, error: error.message, code: error.code }
  console.error(`[storefront] loyalty ${scope} failed: ${errorMessage(error)}`)
  return { ok: false, error: GENERIC_ERROR }
}

/** The Prisma customer behind the session, linking or creating the row as needed. */
async function customerIdFor(session: CustomerSession): Promise<string> {
  const { id } = await resolveCustomer({
    shopifyCustomerId: session.customerId,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
  })
  return id
}

export async function getLoyaltyOverviewAction(): Promise<LoyaltyActionResult<LoyaltyOverview>> {
  if (!hasCustomerAccountEnv()) return UNAVAILABLE
  const session = await getCustomerSession()
  if (!session) return SIGNED_OUT
  try {
    const customerId = await customerIdFor(session)
    return { ok: true, data: await getLoyaltyOverview(customerId) }
  } catch (error) {
    return failure('overview', error)
  }
}

/**
 * Redeems a reward, mints its Shopify code and, when the visitor has a cart,
 * applies the code to it. `cart` is the updated cart or null (no cart / early access).
 */
export async function redeemRewardAction(input: {
  rewardId: string
  idempotencyKey: string
}): Promise<LoyaltyActionResult<RedeemResult & { cart: Cart | null }>> {
  if (!hasCustomerAccountEnv()) return UNAVAILABLE
  const parsed = redeemInputSchema.safeParse(input ?? {})
  if (!parsed.success) return { ok: false, error: 'That reward could not be redeemed.', code: 'INVALID_INPUT' }
  const session = await getCustomerSession()
  if (!session) return SIGNED_OUT
  if (!hasShopifyAdminEnv()) return REWARDS_UNAVAILABLE

  try {
    const customerId = await customerIdFor(session)
    const result = await redeemRewardToCode({
      customerId,
      rewardId: parsed.data.rewardId,
      idempotencyKey: parsed.data.idempotencyKey,
      shopifyCustomerId: session.customerId,
    })
    const isCartCode = result.code.length > 0 && !result.code.startsWith('HOF-DROP-')
    const cart = isCartCode ? await applyRedeemedCode(result.code) : null
    return { ok: true, data: { ...result, cart } }
  } catch (error) {
    return failure<RedeemResult & { cart: Cart | null }>('redeem', error)
  }
}

export async function loadLedgerAction(
  input: { cursor?: string | null; limit?: number; filter?: 'all' | 'earned' | 'redeemed' } = {}
): Promise<LoyaltyActionResult<LedgerPage>> {
  if (!hasCustomerAccountEnv()) return UNAVAILABLE
  const parsed = ledgerInputSchema.safeParse(input ?? {})
  if (!parsed.success) return { ok: false, error: 'That history page could not be loaded.', code: 'INVALID_INPUT' }
  const session = await getCustomerSession()
  if (!session) return SIGNED_OUT

  try {
    const customerId = await customerIdFor(session)
    const page = await getLedgerPage(customerId, {
      cursor: parsed.data.cursor ?? null,
      limit: parsed.data.limit,
      filter: parsed.data.filter,
    })
    return { ok: true, data: page }
  } catch (error) {
    return failure<LedgerPage>('ledger', error)
  }
}
