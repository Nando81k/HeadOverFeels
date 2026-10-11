import 'server-only'

import { cookies } from 'next/headers'

/**
 * The `hof_cart` cookie: the only place the storefront remembers which Shopify
 * cart belongs to this browser. httpOnly, so client code never sees the id — it
 * talks to the cart exclusively through the Server Actions in
 * `app/(storefront)/_actions/cart.ts`.
 *
 * Writes (`writeCartId`, `clearCartId`) are only legal inside Server Actions and
 * route handlers (Next 16); reads work anywhere `cookies()` does.
 */

export const CART_COOKIE = 'hof_cart'

const CART_GID_PREFIX = 'gid://shopify/Cart/'
const MAX_CART_ID_LENGTH = 512
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30

/** A Shopify cart GID (`gid://shopify/Cart/<token>?key=<key>`): printable ASCII, no spaces. */
function isCartId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > CART_GID_PREFIX.length &&
    value.length <= MAX_CART_ID_LENGTH &&
    value.startsWith(CART_GID_PREFIX) &&
    /^[\x21-\x7e]+$/.test(value)
  )
}

/** The cart id from the cookie, or null when it is missing or not a cart GID. */
export async function readCartId(): Promise<string | null> {
  const jar = await cookies()
  const value = jar.get(CART_COOKIE)?.value
  return isCartId(value) ? value : null
}

export async function writeCartId(id: string): Promise<void> {
  const jar = await cookies()
  jar.set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS_IN_SECONDS,
  })
}

export async function clearCartId(): Promise<void> {
  const jar = await cookies()
  jar.delete(CART_COOKIE)
}
