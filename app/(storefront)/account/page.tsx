import type { Metadata } from 'next'
import Link from 'next/link'
import { getLoyaltyOverviewAction } from '@/app/(storefront)/_actions/loyalty'
import { renderAccountPage } from '@/components/storefront/account/AccountShell'
import { customerFirstName } from '@/components/storefront/account/customer-name'
import { EarlierOrdersList, loadEarlierOrders } from '@/components/storefront/account/EarlierOrders'
import { OrderCard } from '@/components/storefront/account/OrderCard'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import type { LoyaltyOverview } from '@/lib/loyalty/shopify-bridge'
import { getCustomerOrders, getCustomerSummary } from '@/lib/shopify/customer/queries'
import type { CustomerSummary, LoyaltyActionResult } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/**
 * `/account` overview (Phase 4 plan, Task 5; mockup 02): greeting, Care
 * Points chip, then cards for recent orders, Care Points, the default address
 * and the profile, and a strip of earlier (legacy) orders.
 *
 * `?error=` comes from the login / callback / refresh routes and turns into
 * a notice on the gate; `?unavailable=1` needs nothing — an unconfigured
 * store renders `AccountUnavailable` regardless.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
}

const PATH = '/account'
const RECENT_ORDERS = 2
const EARLIER_ORDERS = 3

const NOTICES: Record<string, string> = {
  signin: 'Sign-in could not start. Please try again.',
  state: 'That sign-in link expired. Please try again.',
  expired: 'Your session expired. Please sign in again.',
  callback: 'Sign-in did not complete. Please try again.',
}

const CARD_CLASS = 'flex flex-col gap-4 rounded-sharp border border-line bg-paper p-5'
const CARD_TITLE_CLASS = 'text-xs font-semibold uppercase tracking-eyebrow text-ink-mute'
const CARD_LINK_CLASS = cn(
  'self-start text-xs font-semibold uppercase tracking-eyebrow text-ink underline underline-offset-4 decoration-line-strong',
  'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
)

const NUMBER = new Intl.NumberFormat('en-US')

function CarePointsCard({ loyalty }: { loyalty: LoyaltyActionResult<LoyaltyOverview> }) {
  if (!loyalty.ok) {
    return (
      <section aria-labelledby="overview-points-title" className={CARD_CLASS}>
        <h2 id="overview-points-title" className={CARD_TITLE_CLASS}>
          Care Points
        </h2>
        <p className="text-sm text-ink-soft">Your balance is taking a moment. The hub has the details.</p>
        <Link href="/loyalty" className={CARD_LINK_CLASS}>
          Care Points hub
        </Link>
      </section>
    )
  }

  const { points, tier, nextTier, pointsToNext, progressRatio } = loyalty.data
  const percent = Math.round(Math.min(1, Math.max(0, progressRatio)) * 100)

  return (
    <section aria-labelledby="overview-points-title" className={CARD_CLASS} data-points-card="">
      <h2 id="overview-points-title" className={CARD_TITLE_CLASS}>
        Care Points
      </h2>
      <p className="flex items-baseline gap-2">
        <span className="num font-mono text-3xl font-semibold tabular-nums text-ink">{NUMBER.format(points)}</span>
        <span className="text-sm text-ink-soft">points · {tier.name}</span>
      </p>
      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-label={nextTier ? `Progress to ${nextTier.name}` : 'Top tier reached'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 w-full overflow-hidden rounded-pill bg-line"
        >
          <div className="h-full bg-signal" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-ink-mute">
          {nextTier && pointsToNext !== null ? (
            <>
              <span className="num">{NUMBER.format(pointsToNext)}</span> points to {nextTier.name}
            </>
          ) : (
            'You are in the top tier.'
          )}
        </p>
      </div>
      <Link href="/loyalty" className={CARD_LINK_CLASS}>
        Redeem rewards
      </Link>
    </section>
  )
}

function ProfileCard({ customer }: { customer: CustomerSummary }) {
  return (
    <section aria-labelledby="overview-profile-title" className={CARD_CLASS}>
      <h2 id="overview-profile-title" className={CARD_TITLE_CLASS}>
        Profile
      </h2>
      <p className="flex flex-col gap-0.5 text-sm">
        <span className="font-semibold text-ink">{customer.displayName}</span>
        <span className="text-ink-soft">{customer.email}</span>
        {customer.phone ? <span className="num text-ink-soft">{customer.phone}</span> : null}
      </p>
      <Link href="/account/profile" className={CARD_LINK_CLASS}>
        Edit profile
      </Link>
    </section>
  )
}

function AddressCardSummary({ customer }: { customer: CustomerSummary }) {
  const lines = customer.defaultAddress?.formatted ?? []
  return (
    <section aria-labelledby="overview-address-title" className={CARD_CLASS}>
      <h2 id="overview-address-title" className={CARD_TITLE_CLASS}>
        Default address
      </h2>
      {lines.length > 0 ? (
        <address className="text-sm not-italic text-ink-soft">
          {lines.map((line, index) => (
            <span key={index} className={cn('block', index === 0 && 'font-semibold text-ink')}>
              {line}
            </span>
          ))}
        </address>
      ) : (
        <p className="text-sm text-ink-soft">No default address yet.</p>
      )}
      <Link href="/account/addresses" className={CARD_LINK_CLASS}>
        {lines.length > 0 ? 'Manage addresses' : 'Add an address'}
      </Link>
    </section>
  )
}

export default async function AccountRoute({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const error = Array.isArray(params.error) ? params.error[0] : params.error
  const notice = error ? (NOTICES[error] ?? null) : null

  return renderAccountPage(
    PATH,
    async (session) => {
      const token = session.tokens.accessToken
      const [customer, recent, loyalty, earlier] = await Promise.all([
        getCustomerSummary(token),
        getCustomerOrders(token, { first: RECENT_ORDERS }),
        getLoyaltyOverviewAction(),
        loadEarlierOrders(session.email, EARLIER_ORDERS),
      ])

      return (
        <div className="flex flex-col gap-10">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Eyebrow>Account</Eyebrow>
              <Display as="h1" size="md">
                Hey, {customerFirstName(customer)}.
              </Display>
            </div>
            {loyalty.ok ? (
              <Link
                href="/loyalty"
                data-points-chip=""
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-pill border border-ink px-4 text-sm text-ink',
                  'transition-colors duration-sf-fast ease-sf-out hover:bg-ink hover:text-bone',
                  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
                )}
              >
                <span className="num font-mono font-semibold tabular-nums">{NUMBER.format(loyalty.data.points)}</span>
                <span>Care Points</span>
                <span aria-hidden="true">·</span>
                <span>{loyalty.data.tier.name}</span>
              </Link>
            ) : null}
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <section aria-labelledby="overview-orders-title" className={cn(CARD_CLASS, 'md:col-span-2')}>
              <h2 id="overview-orders-title" className={CARD_TITLE_CLASS}>
                Recent orders
              </h2>
              {recent.orders.length > 0 ? (
                <div className="border-t border-line">
                  {recent.orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-soft">No orders yet — your first one earns Care Points.</p>
              )}
              <Link href="/account/orders" className={CARD_LINK_CLASS}>
                All orders
              </Link>
            </section>

            <CarePointsCard loyalty={loyalty} />
            <AddressCardSummary customer={customer} />
            <ProfileCard customer={customer} />
          </div>

          {earlier.length > 0 ? (
            <div className="flex flex-col gap-3">
              <EarlierOrdersList orders={earlier} variant="strip" id="earlier" />
              <Link href="/account/orders#earlier" className={CARD_LINK_CLASS}>
                All earlier orders
              </Link>
            </div>
          ) : null}
        </div>
      )
    },
    { notice }
  )
}
