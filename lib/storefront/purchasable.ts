// lib/storefront/purchasable.ts
//
// The server-side drop gate (Phase 5 plan, Task 1; design spec decision 10,
// open question 10a resolved as "gate in our add-to-cart action"). Every path
// that adds a line — the buy box, the sticky bar, the wishlist, the no-JS form
// — goes through `addCartLine`, which calls this before touching Shopify.
//
// The per-order cap (`custom.max_per_order`) is enforced after the add in
// `addCartLine` (Phase 3), where the resulting line quantity is known; this
// module only answers "is the drop open for this visitor right now".

import 'server-only'

import { getCustomerSession } from '@/lib/shopify/customer/session'
import { getVariantsByIds } from '@/lib/shopify/queries/variants'
import { dropRefusal, dropState, type DropRefusalCode } from '@/lib/storefront/drops'
import { hasEarlyAccess } from '@/lib/storefront/early-access'

export type Purchasable = { ok: true } | { ok: false; error: string; code: DropRefusalCode }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Refuses an add while the variant's drop is upcoming (for a visitor without
 * early access) or ended. An unknown variant, a product that is not a drop, or
 * a lookup failure all pass: Shopify's own `userErrors` cover the first, and
 * a Storefront outage must not turn into a false "drop closed".
 */
export async function assertPurchasable(variantId: string, now: Date = new Date()): Promise<Purchasable> {
  let variant
  try {
    ;[variant] = await getVariantsByIds([variantId])
  } catch (error) {
    console.error(`[storefront] drop gate lookup failed: ${errorMessage(error)}`)
    return { ok: true }
  }
  const drop = variant?.product.drop ?? null
  if (!drop) return { ok: true }

  // Time alone decides for live/ended; the session is only read when it matters.
  const timeOnly = dropState(drop, now, false)
  if (timeOnly?.state !== 'upcoming') {
    const refusal = dropRefusal(timeOnly)
    return refusal ? { ok: false, ...refusal } : { ok: true }
  }

  const session = await getCustomerSession()
  const access = await hasEarlyAccess(session, variant!.product.handle, now)
  const refusal = dropRefusal(dropState(drop, now, access))
  return refusal ? { ok: false, ...refusal } : { ok: true }
}
