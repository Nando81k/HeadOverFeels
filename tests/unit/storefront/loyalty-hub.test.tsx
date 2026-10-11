// tests/unit/storefront/loyalty-hub.test.tsx — LoyaltyHub + the static sections (Task 6)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('server-only', () => ({}))

const { actions, cartCtx } = vi.hoisted(() => ({
  actions: {
    getLoyaltyOverviewAction: vi.fn(),
    redeemRewardAction: vi.fn(),
    loadLedgerAction: vi.fn(),
  },
  cartCtx: { current: null as null | { seed: ReturnType<typeof vi.fn> } },
}))
vi.mock('@/app/(storefront)/_actions/loyalty', () => actions)
vi.mock('@/components/storefront/cart/CartProvider', () => ({
  useCartOptional: () => cartCtx.current,
}))

import { LoyaltyHub, LOYALTY_ANCHORS } from '@/components/storefront/loyalty'
import { LEDGER_PAGE, OVERVIEW, PUBLIC_DATA, overviewWith } from './loyalty-fixture'

const SIGN_IN_HREF = '/account/login?return_to=%2Floyalty'

function renderHub(props: Partial<React.ComponentProps<typeof LoyaltyHub>> = {}) {
  return render(
    <LoyaltyHub
      publicData={PUBLIC_DATA}
      available
      signedIn={false}
      initialOverview={null}
      initialLedger={null}
      {...props}
    />
  )
}

function renderSignedIn(props: Partial<React.ComponentProps<typeof LoyaltyHub>> = {}) {
  return renderHub({ signedIn: true, initialOverview: OVERVIEW, initialLedger: LEDGER_PAGE, ...props })
}

beforeEach(() => {
  vi.clearAllMocks()
  cartCtx.current = null
})
afterEach(() => cleanup())

describe('LoyaltyHub — anchors', () => {
  it('exposes the five anchors the redirects point at, in both states', () => {
    expect(LOYALTY_ANCHORS).toEqual(['rewards', 'earn', 'tiers', 'history', 'refer'])
    const { unmount, container } = renderHub()
    for (const id of LOYALTY_ANCHORS) expect(container.querySelector(`#${id}`)).not.toBeNull()
    const nav = screen.getByRole('navigation', { name: /Care Points sections/i })
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '#rewards',
      '#earn',
      '#tiers',
      '#history',
      '#refer',
    ])
    unmount()
    const signedIn = renderSignedIn()
    for (const id of LOYALTY_ANCHORS) expect(signedIn.container.querySelector(`#${id}`)).not.toBeNull()
  })
})

describe('LoyaltyHub — signed out (board 08)', () => {
  it('shows the public hero with Join free / Sign in and keeps the catalogue visible', () => {
    renderHub()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Earn on every order. Spend on what you want.'
    )
    const hero = screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement
    expect(within(hero).getByRole('link', { name: 'Join free' })).toHaveAttribute('href', SIGN_IN_HREF)
    expect(within(hero).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', SIGN_IN_HREF)

    // Catalogue, how to earn and tiers stay public.
    const rewards = screen.getByRole('region', { name: /Rewards/i })
    expect(within(rewards).getByText('$5 off')).toBeInTheDocument()
    expect(within(rewards).getByText('Free shipping')).toBeInTheDocument()
    expect(within(rewards).getAllByRole('link', { name: 'Sign in to redeem' })).toHaveLength(
      PUBLIC_DATA.rewards.length
    )
    expect(within(rewards).queryByRole('button', { name: 'Redeem' })).not.toBeInTheDocument()

    const earn = screen.getByRole('region', { name: /How to earn/i })
    expect(within(earn).getByText('1 pt per $1')).toBeInTheDocument()
    expect(within(earn).getByText(/review/i)).toBeInTheDocument()
    expect(within(earn).getByText(/referral/i)).toBeInTheDocument()
    expect(within(earn).getByText(/birthday/i)).toBeInTheDocument()

    const tiers = screen.getByRole('region', { name: /^Tiers/i })
    expect(within(tiers).getByText('Member')).toBeInTheDocument()
    expect(within(tiers).getByText('Inner Circle')).toBeInTheDocument()
    expect(within(tiers).queryByText("You're here")).not.toBeInTheDocument()
  })

  it('gates balance, history and referral inline with a sign-in link (HTTP 200, no redirect)', () => {
    renderHub()
    expect(screen.queryByText('1,240')).not.toBeInTheDocument()
    const history = screen.getByRole('region', { name: /History/i })
    expect(within(history).getByRole('link', { name: /Sign in/i })).toHaveAttribute('href', SIGN_IN_HREF)
    const refer = screen.getByRole('region', { name: /Refer a friend/i })
    expect(within(refer).getByRole('link', { name: /Sign in/i })).toHaveAttribute('href', SIGN_IN_HREF)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the quiet "Sign-in is being set up" note when accounts are unconfigured', () => {
    renderHub({ available: false })
    const notes = screen.getAllByText(/Sign-in is being set up/i)
    expect(notes.length).toBeGreaterThanOrEqual(1)
    for (const note of notes) {
      expect(note).toHaveAttribute('data-account', 'unconfigured')
      expect(note).toHaveAttribute('role', 'status')
    }
    expect(screen.queryByRole('link', { name: 'Join free' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.getByText('$5 off')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign in to redeem' })).not.toBeInTheDocument()
  })
})

describe('LoyaltyHub — signed in (board 06)', () => {
  it('renders the balance hero with worth / next-tier copy and the tier card', () => {
    renderSignedIn()
    const hero = screen.getByRole('region', { name: /Your balance/i })
    const balance = within(hero).getByText('1,240')
    expect(balance.className).toContain('num')
    expect(hero).toHaveTextContent('Worth $5 off right now, or hold out 520 more for Inner Circle.')
    expect(within(hero).getByRole('link', { name: 'Redeem' })).toHaveAttribute('href', '#rewards')
    expect(within(hero).getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/collections/all')

    const tierCard = within(hero).getByRole('group', { name: /Insider/ })
    const bar = within(tierCard).getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '48')
    expect(within(tierCard).getByText('Lifetime').nextSibling).toHaveTextContent('3,210')
    expect(within(tierCard).getByText('Multiplier').nextSibling).toHaveTextContent('1.25×')
    expect(within(tierCard).getByText('Expiring').nextSibling).toHaveTextContent('120')
    expect(screen.queryByRole('link', { name: 'Join free' })).not.toBeInTheDocument()
  })

  it('shows the expiring banner only when points expire soon', () => {
    renderSignedIn()
    const hero = screen.getByRole('region', { name: /Your balance/i })
    expect(within(hero).getByRole('status')).toHaveTextContent(/120 points expire on Nov \d{1,2}, 2026/)
    cleanup()
    renderSignedIn({ initialOverview: overviewWith({ expiringSoon: null }) })
    expect(within(screen.getByRole('region', { name: /Your balance/i })).queryByRole('status')).not.toBeInTheDocument()
  })

  it('says you are at the top tier when there is no next tier', () => {
    renderSignedIn({
      initialOverview: overviewWith({ nextTier: null, pointsToNext: null, tier: OVERVIEW.tiers[2] }),
    })
    expect(screen.getByRole('region', { name: /Your balance/i })).toHaveTextContent(
      "Worth $5 off right now. You're at the top tier."
    )
  })

  it('renders the rewards grid with the gating reasons', () => {
    renderSignedIn()
    const rewards = screen.getByRole('region', { name: /Rewards/i })
    const cards = within(rewards).getAllByRole('article')
    expect(cards).toHaveLength(OVERVIEW.rewards.length)

    const five = cards.find((card) => within(card).queryByText('$5 off')) as HTMLElement
    expect(within(five).getByText('Discount')).toBeInTheDocument()
    expect(within(five).getByText('500').className).toContain('num')
    expect(within(five).getByRole('button', { name: 'Redeem' })).toBeEnabled()

    const twenty = cards.find((card) => within(card).queryByText('$20 off')) as HTMLElement
    expect(within(twenty).getByRole('button', { name: 'Need 760 more' })).toBeDisabled()

    const drop = cards.find((card) => within(card).queryByText('Early drop access')) as HTMLElement
    expect(within(drop).getByRole('button', { name: 'Higher tier required' })).toBeDisabled()

    const limit = cards.find((card) => within(card).queryByText('Welcome $10')) as HTMLElement
    expect(within(limit).getByRole('button', { name: 'Already redeemed' })).toBeDisabled()

    const soldout = cards.find((card) => within(card).queryByText('Signed tee')) as HTMLElement
    expect(within(soldout).getByRole('button', { name: 'Sold out' })).toBeDisabled()
  })

  it('marks the current and next tiers in the tiers row', () => {
    renderSignedIn()
    const tiers = screen.getByRole('region', { name: /^Tiers/i })
    const insider = within(tiers).getByRole('article', { name: /Insider/ })
    expect(within(insider).getByText("You're here")).toBeInTheDocument()
    expect(insider).toHaveAttribute('data-tier', 'current')
    const inner = within(tiers).getByRole('article', { name: /Inner Circle/ })
    expect(within(inner).getByText((_, el) => el?.textContent === '520 points away')).toBeInTheDocument()
    expect(inner).toHaveAttribute('data-tier', 'next')
    expect(within(inner).getByText('Free shipping')).toBeInTheDocument()
  })

  it('renders the history table from the server page and the referral card', () => {
    renderSignedIn()
    const history = screen.getByRole('region', { name: /History/i })
    const table = within(history).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(LEDGER_PAGE.rows.length + 1)
    expect(within(table).getByText('+96')).toBeInTheDocument()
    expect(within(table).getByText('−500')).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: '#1042' })).toHaveAttribute(
      'href',
      LEDGER_PAGE.rows[0].reference.href
    )

    const refer = screen.getByRole('region', { name: /Refer a friend/i })
    const link = within(refer).getByLabelText('Your referral link') as HTMLInputElement
    expect(link).toHaveAttribute('readonly')
    expect(link.value).toBe(OVERVIEW.referral.url)
    expect(within(refer).getByRole('button', { name: /Copy/ })).toBeInTheDocument()
    expect(within(refer).getByRole('link', { name: /Text/ }).getAttribute('href')).toMatch(/^sms:/)
    expect(within(refer).getByRole('link', { name: /Email/ }).getAttribute('href')).toMatch(/^mailto:/)
    expect(within(refer).getByText('Joined').nextSibling).toHaveTextContent('3')
  })

  it('shows the action error inline when the overview could not load', () => {
    renderHub({ signedIn: true, initialOverview: null, overviewError: 'Something went wrong. Please try again.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    expect(screen.getByText('$5 off')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Join free' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign in to redeem' })).not.toBeInTheDocument()
    expect(screen.getByText(/couldn't load your history/)).toBeInTheDocument()
  })
})
