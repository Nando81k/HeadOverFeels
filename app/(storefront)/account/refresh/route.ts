import { NextResponse } from 'next/server'

import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { discover, refreshTokens } from '@/lib/shopify/customer/oauth'
import {
  clearCustomerSession,
  isAccessTokenFresh,
  readCustomerSession,
  safeReturnTo,
  withRefreshedTokens,
  writeCustomerSession,
} from '@/lib/shopify/customer/session'

/**
 * GET /account/refresh?return_to=<path>
 *
 * Refreshes a stale access token with the refresh token and rewrites the
 * `hof_customer` cookie, then 302s back to `return_to` (a route handler,
 * because RSC cannot set cookies — `requireFreshSession` sends pages here).
 * No session → `/account/login?return_to=…`; refresh impossible or refused →
 * cookie cleared + `/account/login?return_to=…&error=expired`.
 */

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const returnTo = safeReturnTo(url.searchParams.get('return_to'), '/account')
  const back = () => NextResponse.redirect(new URL(returnTo, url), 302)
  const login = (error?: string) =>
    NextResponse.redirect(
      new URL(
        `/account/login?return_to=${encodeURIComponent(returnTo)}${error ? `&error=${error}` : ''}`,
        url
      ),
      302
    )

  if (!hasCustomerAccountEnv()) {
    return NextResponse.redirect(new URL('/account?unavailable=1', url), 302)
  }

  const session = await readCustomerSession()
  if (!session) return login()
  if (isAccessTokenFresh(session)) return back()

  if (!session.tokens.refreshToken) {
    await clearCustomerSession()
    return login('expired')
  }

  try {
    const discovery = await discover()
    const next = await refreshTokens(discovery, session.tokens.refreshToken)
    await writeCustomerSession(withRefreshedTokens(session, next))
    return back()
  } catch (error) {
    console.error(`[storefront] customer token refresh failed: ${errorMessage(error)}`)
    await clearCustomerSession()
    return login('expired')
  }
}
