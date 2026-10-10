'use server'

import { z } from 'zod'

import { clearCartId, readCartId, writeCartId } from '@/lib/shopify/cart/cookie'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { ShopifyError } from '@/lib/shopify/errors'
import {
  addCartLines,
  createCart,
  getCartById,
  removeCartLines,
  updateCartDiscountCodes,
  updateCartLines,
  updateCartNote,
  type CartWarning,
} from '@/lib/shopify/queries/cart'
import type { Cart, CartActionResult } from '@/lib/shopify/types'

/**
 * Cart Server Actions. The only way the storefront mutates a cart.
 *
 * Rules (Phase 3 plan, cross-cutting notes 5–7):
 * - Unconfigured store → `{ ok: false, error: 'Cart unavailable' }` (and `null`
 *   from `getCartAction`) without touching the query layer. Never throw.
 * - Every result carries the full normalised cart; the client swaps its state
 *   for it. Nothing caches the cart, so nothing here revalidates a tag.
 * - Shopify `userErrors` → `{ ok: false, error: <first message>, code }`; any
 *   other failure → the friendly generic error, logged with its message only.
 * - Shopify cart `warnings` (low stock etc.) surface as `warning`, never errors.
 */

const UNAVAILABLE: CartActionResult = { ok: false, error: 'Cart unavailable' }
const GENERIC_ERROR = 'Something went wrong updating your cart.'
const CART_NOT_FOUND: CartActionResult = {
  ok: false,
  error: 'Your cart has expired. Add something to start a new one.',
  code: 'CART_NOT_FOUND',
}

const variantIdSchema = z.string().trim().startsWith('gid://shopify/ProductVariant/')
const lineIdSchema = z.string().trim().startsWith('gid://shopify/CartLine/')

const addInputSchema = z.object({
  variantId: variantIdSchema,
  quantity: z.number().int().min(1).max(99).default(1),
})
const updateInputSchema = z.object({
  lineId: lineIdSchema,
  quantity: z.number().int().min(0).max(99),
})
const removeInputSchema = z.object({ lineId: lineIdSchema })
const codeInputSchema = z.object({ code: z.string().trim().min(1).max(64) })
const noteInputSchema = z.object({ note: z.string().trim().max(1000) })

function invalid(error: string): CartActionResult {
  return { ok: false, error, code: 'INVALID_INPUT' }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Shopify says the cart id itself is bad: it expired, was completed, or never
 * existed. Either a userError on `cartId` / naming the cart, or the query
 * layer's "returned no cart" error for a payload whose `cart` is null.
 */
function isMissingCartError(error: unknown, cartId: string): boolean {
  if (!(error instanceof ShopifyError)) return false
  if (!error.userErrors?.length) return /returned no cart$/.test(error.message)
  return error.userErrors.some(
    (userError) =>
      (userError.field ?? []).includes('cartId') ||
      userError.message.includes(cartId) ||
      /\bcart\b.*\b(does not exist|not found|expired)\b/i.test(userError.message)
  )
}

/** Map any failure to a result; only unexpected failures are logged (message only). */
function failure(error: unknown): CartActionResult {
  if (error instanceof ShopifyError && error.userErrors?.length) {
    const [first] = error.userErrors
    return first.code
      ? { ok: false, error: first.message, code: first.code }
      : { ok: false, error: first.message }
  }
  console.error(`[storefront] cart action failed: ${errorMessage(error)}`)
  return { ok: false, error: GENERIC_ERROR }
}

/** Collects Shopify cart warnings across the mutations of one action. */
function warningCollector() {
  const warnings: CartWarning[] = []
  return {
    onWarnings: (next: CartWarning[]) => {
      warnings.push(...next)
    },
    first: (): string | undefined => warnings.find((warning) => warning.message)?.message,
  }
}

function success(cart: Cart, warning?: string): CartActionResult {
  return warning ? { ok: true, cart, warning } : { ok: true, cart }
}

/**
 * Shared shell for the mutations that need an existing cart: env gate, cookie,
 * expired-cart cleanup and error mapping.
 */
async function withExistingCart(
  run: (cartId: string) => Promise<CartActionResult>
): Promise<CartActionResult> {
  const cartId = await readCartId()
  if (!cartId) return CART_NOT_FOUND
  try {
    return await run(cartId)
  } catch (error) {
    if (isMissingCartError(error, cartId)) {
      await clearCartId()
      return CART_NOT_FOUND
    }
    return failure(error)
  }
}

/** The visitor's cart, loaded once by `CartProvider` on mount. Never throws. */
export async function getCartAction(): Promise<Cart | null> {
  if (!hasShopifyEnv()) return null
  const cartId = await readCartId()
  if (!cartId) return null
  try {
    const cart = await getCartById(cartId)
    if (!cart) {
      // Clearing is only legal inside an action; a render-time caller keeps
      // the stale cookie and simply gets no cart.
      try {
        await clearCartId()
      } catch {
        /* not in a Server Action */
      }
      return null
    }
    return cart
  } catch (error) {
    console.error(`[storefront] cart action failed: ${errorMessage(error)}`)
    return null
  }
}

/** Create a cart holding `lines` and remember it in the cookie. */
async function createCartWith(
  lines: { merchandiseId: string; quantity: number }[],
  onWarnings: (warnings: CartWarning[]) => void
): Promise<Cart> {
  const cart = await createCart({ lines }, onWarnings)
  await writeCartId(cart.id)
  return cart
}

export async function addCartLine(input: {
  variantId: string
  quantity?: number
}): Promise<CartActionResult> {
  if (!hasShopifyEnv()) return UNAVAILABLE
  const parsed = addInputSchema.safeParse(input ?? {})
  if (!parsed.success) return invalid('That item could not be added.')
  const { variantId, quantity } = parsed.data
  const lines = [{ merchandiseId: variantId, quantity }]
  const warnings = warningCollector()

  try {
    const cartId = await readCartId()
    let cart: Cart
    if (!cartId) {
      cart = await createCartWith(lines, warnings.onWarnings)
    } else {
      try {
        cart = await addCartLines(cartId, lines, warnings.onWarnings)
      } catch (error) {
        if (!isMissingCartError(error, cartId)) throw error
        // The cookie outlived its cart: start over, once.
        await clearCartId()
        cart = await createCartWith(lines, warnings.onWarnings)
      }
    }

    // Cap the affected line at the product's per-order limit and the stock on hand.
    const line = cart.lines.find((candidate) => candidate.merchandise.id === variantId)
    if (line) {
      const { maxPerOrder, title } = line.merchandise.product
      const available = line.merchandise.quantityAvailable
      const maxCap =
        typeof maxPerOrder === 'number' && Number.isInteger(maxPerOrder) && maxPerOrder >= 1
          ? maxPerOrder
          : Infinity
      const stockCap = typeof available === 'number' && available > 0 ? available : Infinity
      const cap = Math.min(maxCap, stockCap)
      if (line.quantity > cap) {
        const capped = await updateCartLines(
          cart.id,
          [{ id: line.id, quantity: cap }],
          warnings.onWarnings
        )
        const warning =
          cap === maxCap ? `Max ${cap} per order for ${title}.` : `Only ${cap} left for ${title}.`
        return success(capped, warning)
      }
    }

    return success(cart, warnings.first())
  } catch (error) {
    return failure(error)
  }
}

/** `useActionState` / no-JS wrapper over `addCartLine` (fields `variantId`, `quantity`). */
export async function addCartLineForm(
  _prev: CartActionResult | null,
  formData: FormData
): Promise<CartActionResult> {
  const variantId = formData.get('variantId')
  const rawQuantity = formData.get('quantity')
  const quantity =
    typeof rawQuantity === 'string' && rawQuantity.trim() !== '' ? Number(rawQuantity) : undefined
  return addCartLine({
    variantId: typeof variantId === 'string' ? variantId : '',
    quantity,
  })
}

/** Set a line's quantity; 0 removes it. */
export async function updateCartLine(input: {
  lineId: string
  quantity: number
}): Promise<CartActionResult> {
  if (!hasShopifyEnv()) return UNAVAILABLE
  const parsed = updateInputSchema.safeParse(input ?? {})
  if (!parsed.success) return invalid('That quantity is not valid.')
  const { lineId, quantity } = parsed.data

  return withExistingCart(async (cartId) => {
    const warnings = warningCollector()
    const cart =
      quantity === 0
        ? await removeCartLines(cartId, [lineId], warnings.onWarnings)
        : await updateCartLines(cartId, [{ id: lineId, quantity }], warnings.onWarnings)
    return success(cart, warnings.first())
  })
}

export async function removeCartLine(input: { lineId: string }): Promise<CartActionResult> {
  if (!hasShopifyEnv()) return UNAVAILABLE
  const parsed = removeInputSchema.safeParse(input ?? {})
  if (!parsed.success) return invalid('That item could not be removed.')
  const { lineId } = parsed.data

  return withExistingCart(async (cartId) => {
    const warnings = warningCollector()
    const cart = await removeCartLines(cartId, [lineId], warnings.onWarnings)
    return success(cart, warnings.first())
  })
}

const sameCode = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Add a discount code on top of the applicable ones. Shopify accepts any string
 * and flags it `applicable: false`, so a dud code is removed again and reported.
 */
export async function applyDiscountCode(input: { code: string }): Promise<CartActionResult> {
  if (!hasShopifyEnv()) return UNAVAILABLE
  const parsed = codeInputSchema.safeParse(input ?? {})
  if (!parsed.success) return invalid('Enter a discount code.')
  const { code } = parsed.data

  return withExistingCart(async (cartId) => {
    const current = await getCartById(cartId)
    if (!current) {
      await clearCartId()
      return CART_NOT_FOUND
    }
    const warnings = warningCollector()
    const kept = current.discountCodes
      .filter((entry) => entry.applicable && !sameCode(entry.code, code))
      .map((entry) => entry.code)

    const cart = await updateCartDiscountCodes(cartId, [...kept, code], warnings.onWarnings)
    const applied = cart.discountCodes.find((entry) => sameCode(entry.code, code))
    if (applied?.applicable) return success(cart, warnings.first())

    const reverted = await updateCartDiscountCodes(cartId, kept, warnings.onWarnings)
    return {
      ok: false,
      error: `${code} isn't valid for this cart.`,
      code: 'DISCOUNT_NOT_APPLICABLE',
      cart: reverted,
    }
  })
}

export async function removeDiscountCode(input: { code: string }): Promise<CartActionResult> {
  if (!hasShopifyEnv()) return UNAVAILABLE
  const parsed = codeInputSchema.safeParse(input ?? {})
  if (!parsed.success) return invalid('Enter a discount code.')
  const { code } = parsed.data

  return withExistingCart(async (cartId) => {
    const current = await getCartById(cartId)
    if (!current) {
      await clearCartId()
      return CART_NOT_FOUND
    }
    const warnings = warningCollector()
    const remaining = current.discountCodes
      .map((entry) => entry.code)
      .filter((existing) => !sameCode(existing, code))
    const cart = await updateCartDiscountCodes(cartId, remaining, warnings.onWarnings)
    return success(cart, warnings.first())
  })
}

export async function updateCartNoteAction(input: { note: string }): Promise<CartActionResult> {
  if (!hasShopifyEnv()) return UNAVAILABLE
  const parsed = noteInputSchema.safeParse(input ?? {})
  if (!parsed.success) return invalid('Notes can be up to 1000 characters.')
  const { note } = parsed.data

  return withExistingCart(async (cartId) => {
    const warnings = warningCollector()
    const cart = await updateCartNote(cartId, note, warnings.onWarnings)
    return success(cart, warnings.first())
  })
}
