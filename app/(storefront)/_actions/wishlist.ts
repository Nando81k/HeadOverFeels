'use server'

import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCustomerSession } from '@/lib/shopify/customer/session'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getVariantsByIds, type ProductCardVariant } from '@/lib/shopify/queries/variants'
import {
  isWishlistEntry,
  type WishlistActionResult,
  type WishlistEntry,
} from '@/lib/storefront/wishlist'

/**
 * Wishlist Server Actions (Phase 4, Task 4).
 *
 * - Signed-in customers' wishlists live in Prisma (`StorefrontWishlistItem`), keyed by
 *   the Prisma `Customer.id` that `Customer.shopifyCustomerId` maps the session's
 *   Shopify customer gid to (`/account/callback` links the row on first sign-in).
 * - Guests keep theirs in `localStorage` (`lib/storefront/wishlist.ts`): `getWishlistAction`
 *   answers an empty list and `toggle` / `merge` answer `{ ok: false, error: 'SIGNED_OUT' }`
 *   so the provider keeps the guest list client-side. A signed-in session without a
 *   Prisma row yet is treated the same way — nothing can be persisted for it.
 * - Card data comes from the Storefront API (`getVariantsByIds`) and is public, so
 *   `wishlistCardsAction` needs no session. An unconfigured store yields `[]`.
 * - Nothing here throws to the client; unexpected failures are logged by message only.
 */

const SIGNED_OUT: WishlistActionResult = { ok: false, error: 'SIGNED_OUT' }
const INVALID_INPUT: WishlistActionResult = { ok: false, error: 'INVALID_INPUT' }
const LOAD_ERROR = 'Something went wrong loading your wishlist.'
const UPDATE_ERROR = 'Something went wrong updating your wishlist.'

/** Upper bound on ids a single cards request will look up (= 4 Storefront calls). */
const MAX_CARD_IDS = 200

const variantIdSchema = z.string().trim().startsWith('gid://shopify/ProductVariant/')
const toggleInputSchema = z.object({
  variantId: variantIdSchema,
  productHandle: z.string().trim().min(1).max(255),
})

type WishlistRow = { variantId: string; productHandle: string; createdAt: Date }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toEntry(row: WishlistRow): WishlistEntry {
  return {
    variantId: row.variantId,
    productHandle: row.productHandle,
    addedAt: row.createdAt.toISOString(),
  }
}

/** The Prisma customer id for the current session, or `null` when signed out / unlinked. */
async function resolveCustomerId(): Promise<string | null> {
  const session = await getCustomerSession()
  if (!session) return null
  const customer = await prisma.customer.findUnique({
    where: { shopifyCustomerId: session.customerId },
    select: { id: true },
  })
  return customer?.id ?? null
}

async function listEntries(customerId: string): Promise<WishlistEntry[]> {
  const rows = await prisma.storefrontWishlistItem.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toEntry)
}

/** The signed-in customer's wishlist, newest first. Signed-out → an empty list. */
export async function getWishlistAction(): Promise<WishlistActionResult> {
  try {
    const customerId = await resolveCustomerId()
    if (!customerId) return { ok: true, entries: [] }
    return { ok: true, entries: await listEntries(customerId) }
  } catch (error) {
    console.error('[wishlist] getWishlistAction failed:', errorMessage(error))
    return { ok: false, error: LOAD_ERROR }
  }
}

/** Adds the variant when absent, removes it when present; returns the refreshed list. */
export async function toggleWishlistAction(input: {
  variantId: string
  productHandle: string
}): Promise<WishlistActionResult> {
  const parsed = toggleInputSchema.safeParse(input)
  if (!parsed.success) return INVALID_INPUT
  const { variantId, productHandle } = parsed.data

  try {
    const customerId = await resolveCustomerId()
    if (!customerId) return SIGNED_OUT

    const existing = await prisma.storefrontWishlistItem.findUnique({
      where: { customerId_variantId: { customerId, variantId } },
      select: { id: true },
    })
    if (existing) {
      await prisma.storefrontWishlistItem.delete({ where: { id: existing.id } })
    } else {
      await prisma.storefrontWishlistItem.create({
        data: { customerId, variantId, productHandle },
      })
    }
    return { ok: true, entries: await listEntries(customerId) }
  } catch (error) {
    console.error('[wishlist] toggleWishlistAction failed:', errorMessage(error))
    return { ok: false, error: UPDATE_ERROR }
  }
}

/**
 * Folds a guest's localStorage list into the signed-in customer's server list (called
 * once after sign-in). Existing server rows win over a duplicate guest entry
 * (`skipDuplicates`); malformed guest entries are dropped, not fatal. Returns the
 * merged server list.
 */
export async function mergeGuestWishlistAction(
  entries: WishlistEntry[]
): Promise<WishlistActionResult> {
  const clean = Array.isArray(entries) ? entries.filter(isWishlistEntry) : []

  try {
    const customerId = await resolveCustomerId()
    if (!customerId) return SIGNED_OUT

    if (clean.length > 0) {
      const seen = new Set<string>()
      const data = []
      for (const entry of clean) {
        if (seen.has(entry.variantId)) continue
        seen.add(entry.variantId)
        data.push({
          customerId,
          variantId: entry.variantId,
          productHandle: entry.productHandle,
          createdAt: new Date(entry.addedAt),
        })
      }
      await prisma.storefrontWishlistItem.createMany({ data, skipDuplicates: true })
    }

    return { ok: true, entries: await listEntries(customerId) }
  } catch (error) {
    console.error('[wishlist] mergeGuestWishlistAction failed:', errorMessage(error))
    return { ok: false, error: UPDATE_ERROR }
  }
}

/**
 * Card data for a list of variant ids, in the given order; ids Shopify no longer knows
 * are simply absent. Public data, so it serves guests too.
 */
export async function wishlistCardsAction(variantIds: string[]): Promise<ProductCardVariant[]> {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const candidate of Array.isArray(variantIds) ? variantIds : []) {
    const parsed = variantIdSchema.safeParse(candidate)
    if (!parsed.success || seen.has(parsed.data)) continue
    seen.add(parsed.data)
    ids.push(parsed.data)
    if (ids.length >= MAX_CARD_IDS) break
  }
  if (ids.length === 0 || !hasShopifyEnv()) return []

  try {
    return await getVariantsByIds(ids)
  } catch (error) {
    console.error('[wishlist] wishlistCardsAction failed:', errorMessage(error))
    return []
  }
}
