import { NextResponse } from 'next/server'

import { getCustomerAccountEnv, hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { buildAuthorizeUrl, createPkce, discover, randomToken } from '@/lib/shopify/customer/oauth'
import { safeReturnTo, writeOAuthState } from '@/lib/shopify/customer/session'

/**
 * GET /account/login?return_to=<path>
 *
 * Starts the Customer Account OAuth flow (public client + PKCE): stores
 * `{ state, nonce, verifier, returnTo }` in the 10-minute `hof_customer_oauth`
 * cookie and 302s to Shopify's hosted login. Unconfigured → `/account?unavailable=1`
 * (the page renders `AccountUnavailable`). `return_to` must be a same-origin path.
 */

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (!hasCustomerAccountEnv()) {
    return NextResponse.redirect(new URL('/account?unavailable=1', url), 302)
  }

  const returnTo = safeReturnTo(url.searchParams.get('return_to'), '/account')

  try {
    const { baseUrl } = getCustomerAccountEnv()
    const discovery = await discover()
    const { verifier, challenge } = createPkce()
    const state = randomToken()
    const nonce = randomToken()
    await writeOAuthState({ state, nonce, verifier, returnTo })

    const authorizeUrl = buildAuthorizeUrl(discovery, {
      state,
      nonce,
      challenge,
      redirectUri: `${baseUrl}/account/callback`,
    })
    return NextResponse.redirect(authorizeUrl, 302)
  } catch (error) {
    console.error(`[storefront] customer login could not start: ${errorMessage(error)}`)
    return NextResponse.redirect(new URL('/account?error=signin', url), 302)
  }
}
