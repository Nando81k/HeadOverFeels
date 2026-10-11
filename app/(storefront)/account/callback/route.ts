import { decodeJwt } from 'jose'
import { NextResponse } from 'next/server'

import { readCartId } from '@/lib/shopify/cart/cookie'
import { getCustomerAccountEnv, hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { discover, exchangeCode } from '@/lib/shopify/customer/oauth'
import { getCustomerSummary } from '@/lib/shopify/customer/queries'
import {
  clearOAuthState,
  readOAuthState,
  safeReturnTo,
  writeCustomerSession,
  type CustomerSession,
} from '@/lib/shopify/customer/session'
import { updateCartBuyerIdentity } from '@/lib/shopify/queries/cart'

/**
 * GET /account/callback?code=&state=
 *
 * Finishes the OAuth flow: checks `state` (and the id token `nonce`) against
 * the `hof_customer_oauth` cookie, exchanges the code with PKCE, reads the
 * customer summary, seals the `hof_customer` session, links the Prisma
 * customer through the loyalty bridge (dynamic import, failure tolerated),
 * attaches the `hof_cart` cart to the customer (failure tolerated) and 302s to
 * the whitelisted `return_to`.
 *
 * Errors: state/nonce problems → `/account/login?error=state`; a provider
 * error → `/account/login?error=<sanitised>`; exchange/summary failure →
 * `/account/login?error=exchange`. Tokens never appear in logs.
 */

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Keep only an OAuth-style error token (`access_denied`, `invalid_request`, …). */
function sanitizeProviderError(value: string | null): string | null {
  if (!value) return null
  const match = value.toLowerCase().match(/^[a-z_]{1,40}/)
  return match ? match[0] : 'denied'
}

/** The id token's `nonce` must match the one we sent; no id token → nothing to check. */
function nonceMatches(idToken: string | null, expected: string): boolean {
  if (!idToken) return true
  try {
    const { nonce } = decodeJwt(idToken)
    return nonce === undefined || nonce === expected
  } catch {
    return false
  }
}

async function linkLoyaltyCustomer(session: CustomerSession): Promise<void> {
  try {
    const bridge = await import('@/lib/loyalty/shopify-bridge').catch(() => null)
    if (!bridge || typeof bridge.resolveCustomer !== 'function') return
    await bridge.resolveCustomer({
      shopifyCustomerId: session.customerId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
    })
  } catch (error) {
    console.error(`[storefront] customer link failed for ${session.customerId}: ${errorMessage(error)}`)
  }
}

async function attachCart(accessToken: string): Promise<void> {
  try {
    const cartId = await readCartId()
    if (!cartId) return
    await updateCartBuyerIdentity(cartId, { customerAccessToken: accessToken })
  } catch (error) {
    console.error(`[storefront] cart buyer identity update failed: ${errorMessage(error)}`)
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const toLogin = (error: string) =>
    NextResponse.redirect(new URL(`/account/login?error=${error}`, url), 302)

  if (!hasCustomerAccountEnv()) {
    return NextResponse.redirect(new URL('/account?unavailable=1', url), 302)
  }

  const stored = await readOAuthState()

  const providerError = sanitizeProviderError(url.searchParams.get('error'))
  if (providerError) {
    if (stored) await clearOAuthState()
    return toLogin(providerError)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!stored || !code || !state || state !== stored.state) {
    if (stored) await clearOAuthState()
    return toLogin('state')
  }

  const returnTo = safeReturnTo(stored.returnTo, '/account')

  try {
    const { baseUrl } = getCustomerAccountEnv()
    const discovery = await discover()
    const tokens = await exchangeCode(discovery, {
      code,
      verifier: stored.verifier,
      redirectUri: `${baseUrl}/account/callback`,
    })

    if (!nonceMatches(tokens.idToken, stored.nonce)) {
      await clearOAuthState()
      return toLogin('state')
    }

    const summary = await getCustomerSummary(tokens.accessToken)
    const session: CustomerSession = {
      tokens,
      customerId: summary.id,
      email: summary.email,
      firstName: summary.firstName,
      lastName: summary.lastName,
    }
    await writeCustomerSession(session)
    await clearOAuthState()

    await linkLoyaltyCustomer(session)
    await attachCart(tokens.accessToken)

    return NextResponse.redirect(new URL(returnTo, url), 302)
  } catch (error) {
    console.error(`[storefront] customer sign-in failed: ${errorMessage(error)}`)
    await clearOAuthState()
    return toLogin('exchange')
  }
}
