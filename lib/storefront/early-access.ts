// lib/storefront/early-access.ts
//
// "Does this visitor get into the drop before everyone else?" (Phase 5 plan,
// Task 1). Server-only: reads the Customer Account session and Prisma.
//
// Access comes from either source (design spec decision 10, plan decision
// "Early-access source of truth"):
// - the customer's loyalty tier has `earlyDropAccess`, or
// - an `EarlyAccessGrant` for the customer and the drop's Prisma product
//   (matched by `Product.slug` = Shopify handle) that has not expired.
//
// Never throws: every failure (no env, no session, Prisma down) is `false`,
// because the catalog must keep rendering and the cart gate must fail closed.

import 'server-only'

import { resolveCustomer } from '@/lib/loyalty/shopify-bridge'
import { prisma } from '@/lib/prisma'
import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import type { CustomerSession } from '@/lib/shopify/customer/session'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** True when `customerId` (Prisma) holds early access to the product with `handle`. */
export async function customerHasEarlyAccess(
  customerId: string,
  handle: string,
  now: Date = new Date()
): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { loyaltyTier: { select: { earlyDropAccess: true } } },
  })
  if (customer?.loyaltyTier?.earlyDropAccess) return true

  const grant = await prisma.earlyAccessGrant.findFirst({
    where: { customerId, product: { slug: handle }, validUntil: { gt: now } },
    select: { id: true },
  })
  return grant !== null
}

/**
 * Early access for the signed-in customer behind `session`. `false` for a
 * signed-out visitor, an unconfigured Customer Account API, or any failure.
 */
export async function hasEarlyAccess(
  session: CustomerSession | null,
  handle: string,
  now: Date = new Date()
): Promise<boolean> {
  if (!session || !hasCustomerAccountEnv()) return false
  try {
    const { id } = await resolveCustomer({
      shopifyCustomerId: session.customerId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
    })
    return await customerHasEarlyAccess(id, handle, now)
  } catch (error) {
    console.error(`[storefront] early access lookup failed: ${errorMessage(error)}`)
    return false
  }
}
