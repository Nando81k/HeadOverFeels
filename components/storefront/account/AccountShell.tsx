import * as React from 'react'
import { redirect } from 'next/navigation'
import { AccountNav } from '@/components/storefront/account/AccountNav'
import { AccountUnavailable } from '@/components/storefront/account/AccountUnavailable'
import { SignInGate } from '@/components/storefront/account/SignInGate'
import { Section } from '@/components/storefront/ui/Section'
import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { isUnauthenticatedError, SignedOutError } from '@/lib/shopify/customer/errors'
import {
  refreshPath,
  requireFreshSession,
  type CustomerSession,
} from '@/lib/shopify/customer/session'

/**
 * Chrome for every `/account/*` page (Phase 4 plan, Task 5; mockup 02/09).
 *
 * Server component. The `/account` layout decides the two flags once per
 * request: `available` (`hasCustomerAccountEnv()`) and `signedIn`
 * (`getCustomerSession() !== null`, stale or not). Unconfigured → the
 * `AccountUnavailable` notice replaces the page; signed in → side nav
 * (tabs on small screens) beside the page; signed out → the page alone, which
 * is the `SignInGate` the page helper below produces.
 *
 * This module imports the server-only session layer, so it is deliberately
 * left out of the `components/storefront/account` barrel.
 */

export interface AccountShellProps {
  children: React.ReactNode
  /** `hasCustomerAccountEnv()`. */
  available: boolean
  /** A session cookie exists (fresh or stale). */
  signedIn: boolean
}

export function AccountShell({ children, available, signedIn }: AccountShellProps) {
  if (!available) {
    return (
      <Section data-account-shell="unconfigured">
        <AccountUnavailable />
      </Section>
    )
  }

  if (!signedIn) {
    return <Section data-account-shell="signed-out">{children}</Section>
  }

  return (
    <Section data-account-shell="ready" className="py-10 md:py-14">
      <div className="grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <AccountNav className="lg:sticky lg:top-24" />
        <div className="min-w-0">{children}</div>
      </div>
    </Section>
  )
}

export type AccountPageRenderer = (
  session: CustomerSession
) => React.ReactNode | Promise<React.ReactNode>

export interface RenderAccountPageOptions {
  /** Shown above the gate's headline (a failed sign-in, an expired session). */
  notice?: string | null
}

/**
 * The one way an account page reads its session. Applied the same way by
 * every page under `/account`:
 *
 * - unconfigured → `AccountUnavailable` (the shell renders the same; this
 *   keeps the page honest on its own);
 * - no session → `SignInGate` with `return_to` = this page (HTTP 200);
 * - stale access token → `requireFreshSession` redirects through
 *   `/account/refresh`, which can rewrite the cookie;
 * - the API still answering 401 → the same refresh redirect (the refresh
 *   route clears the cookie and sends the visitor to sign in when the
 *   refresh token is refused, so this cannot loop);
 * - anything else → thrown to the route-group error boundary.
 */
export async function renderAccountPage(
  path: string,
  render: AccountPageRenderer,
  options: RenderAccountPageOptions = {}
): Promise<React.ReactNode> {
  if (!hasCustomerAccountEnv()) return <AccountUnavailable />

  let session: CustomerSession
  try {
    session = await requireFreshSession(path)
  } catch (error) {
    if (error instanceof SignedOutError) {
      return <SignInGate returnTo={path} notice={options.notice ?? null} />
    }
    throw error
  }

  try {
    return await render(session)
  } catch (error) {
    if (!isUnauthenticatedError(error)) throw error
  }
  // Outside the try: `redirect` throws NEXT_REDIRECT and must not be caught here.
  redirect(refreshPath(path))
}
