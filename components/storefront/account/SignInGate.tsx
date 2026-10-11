import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/storefront/ui/Button'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'

/** Default copy — exported so pages and e2e can assert on it. */
export const SIGN_IN_GATE_TITLE = 'Sign in to see your account'
export const SIGN_IN_GATE_MESSAGE =
  'Orders, addresses, Care Points and your wishlist live here. Sign-in is handled by Shopify — no password to remember.'

/** `/account/login?return_to=<path>` — the login route whitelists the path. */
export function signInHref(returnTo: string): string {
  return `/account/login?return_to=${encodeURIComponent(returnTo)}`
}

export interface SignInGateProps {
  /** The page to come back to after sign-in (a same-origin path). */
  returnTo: string
  title?: string
  message?: string
  /** One-line notice above the headline (a failed sign-in, an expired session). */
  notice?: string | null
  className?: string
}

/**
 * What `/account/*` and the signed-in parts of `/wishlist` render for a
 * signed-out visitor: HTTP-200 content with a link into the hosted login,
 * never a redirect from RSC (Phase 4 plan, cross-cutting note 6; mockup 08).
 *
 * Server-safe — no state, no handlers.
 */
export function SignInGate({
  returnTo,
  title = SIGN_IN_GATE_TITLE,
  message = SIGN_IN_GATE_MESSAGE,
  notice = null,
  className,
}: SignInGateProps) {
  return (
    <div
      data-account="signed-out"
      className={cn('flex max-w-[42rem] flex-col items-start gap-4', className)}
    >
      {notice ? (
        <p role="alert" className="border border-danger bg-paper px-4 py-3 text-sm text-danger">
          {notice}
        </p>
      ) : null}
      <Eyebrow>Account</Eyebrow>
      <Display as="h1" size="md">
        {title}
      </Display>
      <p className="text-sm text-ink-soft">{message}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href={signInHref(returnTo)}>Sign in</Link>
        </Button>
        <Button asChild variant="link">
          <Link href="/collections/all">Keep shopping</Link>
        </Button>
      </div>
    </div>
  )
}
