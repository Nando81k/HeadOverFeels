import * as React from 'react'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'
import { LOYALTY_SIGN_IN_HREF } from './format'

export const SIGNED_OUT_HEADLINE = 'Earn on every order. Spend on what you want.'
export const ACCOUNTS_UNAVAILABLE_COPY = 'Sign-in is being set up'

export interface LoyaltySignedOutHeroProps {
  /** `hasCustomerAccountEnv()`: false swaps the buttons for the quiet note. */
  available: boolean
  /**
   * A session exists but the overview failed: the hero stays public and the
   * sign-in buttons are dropped (the hub shows the error beneath it).
   */
  signedIn?: boolean
}

/**
 * The public hero (mockup board 08). Shopify's hosted login is passwordless,
 * so "Join free" and "Sign in" are the same flow — both land on `/account/login`.
 */
export function LoyaltySignedOutHero({ available, signedIn = false }: LoyaltySignedOutHeroProps) {
  return (
    <Section tone="ink" aria-labelledby="loyalty-hero-title">
      <div className="flex max-w-[52rem] flex-col items-start gap-6">
        <Eyebrow className="text-bone/70">Care Points</Eyebrow>
        <Display as="h1" size="lg" id="loyalty-hero-title">
          {SIGNED_OUT_HEADLINE}
        </Display>
        <p className="max-w-[36rem] text-base text-bone/80">
          One point for every dollar, bonuses for reviews, referrals and birthdays, and
          rewards you can put straight on your next order.
        </p>
        {!available ? (
          <AccountsUnavailableNote className="text-bone/80" />
        ) : signedIn ? null : (
          <div className="flex flex-wrap gap-3">
            {/* Plain anchors: `/account/login` is a route handler that 302s to
                Shopify; a `next/link` soft navigation would hit CORS on the
                redirect and log before falling back (see `SignInGate`). */}
            <Button asChild variant="signal" size="lg">
              <a href={LOYALTY_SIGN_IN_HREF}>Join free</a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-bone text-bone hover:bg-bone hover:text-ink"
            >
              <a href={LOYALTY_SIGN_IN_HREF}>Sign in</a>
            </Button>
          </div>
        )}
      </div>
    </Section>
  )
}

/** The HTTP-200 note for a store without Customer Account credentials (plan, note 5). */
export function AccountsUnavailableNote({ className }: { className?: string }) {
  return (
    <p role="status" data-account="unconfigured" className={cn('text-sm', className)}>
      {ACCOUNTS_UNAVAILABLE_COPY}. Rewards and tiers are below; your balance will appear
      here once sign-in is live.
    </p>
  )
}

export interface LoyaltyGateProps {
  /** What the section holds, e.g. "your history". */
  what: string
  /** False renders the unconfigured note instead of the sign-in link. */
  available?: boolean
  /** Signed in but the data failed to load: no sign-in link, a retry hint instead. */
  signedIn?: boolean
  className?: string
}

/**
 * Inline gate for a signed-in-only section (plan, note 6): the page stays
 * HTTP 200 and the visitor gets a link back to this page after sign-in.
 */
export function LoyaltyGate({ what, available = true, signedIn = false, className }: LoyaltyGateProps) {
  return (
    <div
      data-loyalty-gate=""
      className={cn(
        'flex flex-col items-start gap-4 rounded-sharp border border-dashed border-line-strong bg-paper p-6',
        className
      )}
    >
      {!available ? (
        <AccountsUnavailableNote className="text-ink-soft" />
      ) : signedIn ? (
        <p className="text-sm text-ink-soft">We couldn&apos;t load {what} right now. Refresh to try again.</p>
      ) : (
        <>
          <p className="text-sm text-ink-soft">Sign in to see {what}.</p>
          <Button asChild variant="outline" size="sm">
            <a href={LOYALTY_SIGN_IN_HREF}>Sign in</a>
          </Button>
        </>
      )}
    </div>
  )
}
