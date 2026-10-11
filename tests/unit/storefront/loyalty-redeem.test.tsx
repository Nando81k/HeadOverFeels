// tests/unit/storefront/loyalty-redeem.test.tsx — RedeemDialog + the hub's redeem flow (Task 6)
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

import type { Cart } from '@/lib/shopify/types'
import { LoyaltyHub, RedeemDialog } from '@/components/storefront/loyalty'
import { LEDGER_PAGE, OVERVIEW, PUBLIC_DATA, REWARDS } from './loyalty-fixture'

/** jsdom has no `showModal`/`close`; the overlays suite documents the same polyfill. */
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (typeof proto.close !== 'function') {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

const FAKE_CART = { id: 'gid://shopify/Cart/1', totalQuantity: 1 } as unknown as Cart
const SUCCESS = {
  ok: true as const,
  data: {
    redemptionId: 'red-1',
    code: 'HOF-DISC-4K2M9Q',
    expiresAt: '2027-01-09T00:00:00.000Z',
    newBalance: 740,
    cart: FAKE_CART,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  cartCtx.current = { seed: vi.fn() }
  actions.redeemRewardAction.mockResolvedValue(SUCCESS)
})
afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

function renderDialog(props: Partial<React.ComponentProps<typeof RedeemDialog>> = {}) {
  const onOpenChange = vi.fn()
  const onRedeemed = vi.fn()
  render(
    <RedeemDialog
      reward={REWARDS[0]}
      balance={OVERVIEW.points}
      open
      onOpenChange={onOpenChange}
      onRedeemed={onRedeemed}
      {...props}
    />
  )
  return { onOpenChange, onRedeemed }
}

describe('RedeemDialog', () => {
  it('confirms the spend, then shows the code with Copy and View cart and seeds the cart', async () => {
    // `userEvent.setup()` installs its own clipboard stub; spy on that one.
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const { onRedeemed } = renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveTextContent('Spend 500 points on $5 off?')
    expect(dialog).toHaveTextContent('Balance after: 740')

    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(within(dialog).getByText('HOF-DISC-4K2M9Q')).toBeInTheDocument())
    expect(within(dialog).getByText('HOF-DISC-4K2M9Q').className).toContain('num')
    expect(within(dialog).getByText(/Applied to your cart/)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart')
    expect(cartCtx.current?.seed).toHaveBeenCalledWith(FAKE_CART)
    expect(onRedeemed).toHaveBeenCalledWith(SUCCESS.data, REWARDS[0])

    await user.click(within(dialog).getByRole('button', { name: /Copy/ }))
    expect(writeText).toHaveBeenCalledWith('HOF-DISC-4K2M9Q')
    expect(await within(dialog).findByText('Copied')).toBeInTheDocument()
  })

  it('sends one idempotency key per open and reuses it on retry', async () => {
    const user = userEvent.setup()
    actions.redeemRewardAction
      .mockResolvedValueOnce({ ok: false, error: 'Something went wrong. Please try again.' })
      .mockResolvedValueOnce(SUCCESS)
    renderDialog()
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(within(dialog).getByText('HOF-DISC-4K2M9Q')).toBeInTheDocument())

    expect(actions.redeemRewardAction).toHaveBeenCalledTimes(2)
    const [first, second] = actions.redeemRewardAction.mock.calls.map((call) => call[0])
    expect(first.rewardId).toBe('reward-5')
    expect(first.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(second.idempotencyKey).toBe(first.idempotencyKey)
  })

  it('shows the failed-mint copy inline and keeps the points message', async () => {
    const user = userEvent.setup()
    actions.redeemRewardAction.mockResolvedValue({
      ok: false,
      error: 'We could not issue your code. Your points were not taken.',
      code: 'CODE_FAILED',
    })
    const { onRedeemed } = renderDialog()
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('We could not issue your code. Your points were not taken.')
    expect(onRedeemed).not.toHaveBeenCalled()
    expect(cartCtx.current?.seed).not.toHaveBeenCalled()
    expect(within(dialog).queryByRole('link', { name: 'View cart' })).not.toBeInTheDocument()
  })

  it('does not seed the cart when the action returns no cart (early access)', async () => {
    const user = userEvent.setup()
    actions.redeemRewardAction.mockResolvedValue({
      ok: true,
      data: { ...SUCCESS.data, code: '', expiresAt: '', cart: null },
    })
    renderDialog({ reward: { ...REWARDS[3], canRedeem: true, reason: 'ok' } })
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(within(dialog).getByText(/You're in/)).toBeInTheDocument())
    expect(cartCtx.current?.seed).not.toHaveBeenCalled()
    expect(within(dialog).queryByRole('link', { name: 'View cart' })).not.toBeInTheDocument()
  })

  it('treats a thrown action as a failure, never an unhandled rejection', async () => {
    const user = userEvent.setup()
    actions.redeemRewardAction.mockRejectedValue(new Error('network'))
    renderDialog()
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Something went wrong/)
  })
})

describe('LoyaltyHub — redeem flow', () => {
  it('opens the dialog from a card, then shows the redeemed banner and the new balance', async () => {
    const user = userEvent.setup()
    render(
      <LoyaltyHub
        publicData={PUBLIC_DATA}
        available
        signedIn
        initialOverview={OVERVIEW}
        initialLedger={LEDGER_PAGE}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const rewards = screen.getByRole('region', { name: /Rewards/i })
    await user.click(within(rewards).getAllByRole('button', { name: 'Redeem' })[0])
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(within(dialog).getByText('HOF-DISC-4K2M9Q')).toBeInTheDocument())
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    })
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))

    const banner = within(rewards).getByRole('status')
    expect(banner).toHaveTextContent('HOF-DISC-4K2M9Q')
    expect(within(banner).getByRole('button', { name: /Copy/ })).toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart')

    const hero = screen.getByRole('region', { name: /Your balance/i })
    expect(within(hero).getByText('740')).toBeInTheDocument()
    // Re-gated against the new balance: $5 off (500) still ok, Free shipping (750) now short 10.
    expect(within(rewards).getByRole('button', { name: 'Need 10 more' })).toBeDisabled()
  })
})
