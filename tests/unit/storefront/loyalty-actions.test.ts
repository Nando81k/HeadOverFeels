// tests/unit/storefront/loyalty-actions.test.ts — app/(storefront)/_actions/loyalty.ts (+ applyRedeemedCode)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// In-memory cookie jar for the real cart action module (`applyRedeemedCode`).
const jarStore = new Map<string, string>()
const jar = {
  get: vi.fn((name: string) => (jarStore.has(name) ? { name, value: jarStore.get(name) as string } : undefined)),
  set: vi.fn((name: string, value: string) => {
    jarStore.set(name, value)
  }),
  delete: vi.fn((name: string) => {
    jarStore.delete(name)
  }),
}
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => jar) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))

const { session, customerEnv, env, bridge, ledger, cartQueries } = vi.hoisted(() => ({
  session: { getCustomerSession: vi.fn() },
  customerEnv: { hasCustomerAccountEnv: vi.fn(() => true) },
  env: { hasShopifyEnv: vi.fn(() => true), hasShopifyAdminEnv: vi.fn(() => true) },
  bridge: {
    resolveCustomer: vi.fn(),
    getLoyaltyOverview: vi.fn(),
    redeemRewardToCode: vi.fn(),
    LoyaltyError: class LoyaltyError extends Error {
      code: string
      constructor(code: string, message: string) {
        super(message)
        this.name = 'LoyaltyError'
        this.code = code
      }
    },
  },
  ledger: { getLedgerPage: vi.fn() },
  cartQueries: {
    getCartById: vi.fn(),
    createCart: vi.fn(),
    addCartLines: vi.fn(),
    updateCartLines: vi.fn(),
    removeCartLines: vi.fn(),
    updateCartDiscountCodes: vi.fn(),
    updateCartNote: vi.fn(),
  },
}))

vi.mock('@/lib/shopify/customer/session', () => session)
vi.mock('@/lib/shopify/customer/env', () => customerEnv)
vi.mock('@/lib/shopify/env', () => env)
vi.mock('@/lib/loyalty/shopify-bridge', () => bridge)
vi.mock('@/lib/loyalty/ledger', () => ledger)
vi.mock('@/lib/shopify/queries/cart', () => cartQueries)

import { applyRedeemedCode } from '@/app/(storefront)/_actions/cart'
import { getLoyaltyOverviewAction, loadLedgerAction, redeemRewardAction } from '@/app/(storefront)/_actions/loyalty'
import { CART_COOKIE } from '@/lib/shopify/cart/cookie'
import type { Cart } from '@/lib/shopify/types'

const CART_ID = 'gid://shopify/Cart/Z2NwLXVzLWVhc3QxOjAx?key=abc123'
const CUSTOMER_GID = 'gid://shopify/Customer/8125374129377'
const signedIn = {
  tokens: { accessToken: 'at', refreshToken: null, idToken: null, expiresAt: Date.now() + 60_000 },
  customerId: CUSTOMER_GID,
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: 'Rivera',
}

const usd = (amount: string) => ({ amount, currencyCode: 'USD' })
function makeCart(discountCodes: Cart['discountCodes'] = []): Cart {
  return {
    id: CART_ID,
    checkoutUrl: 'https://tgqucm-qg.myshopify.com/cart/c/x',
    totalQuantity: 1,
    note: null,
    lines: [],
    discountCodes,
    cost: { subtotal: usd('88.0'), total: usd('88.0'), discount: null },
    buyer: { email: null, customerId: null },
  } as Cart
}

const redeemed = { redemptionId: 'red_1', code: 'HOF-DISC-K7M2P9', expiresAt: '2027-01-09T00:00:00.000Z', newBalance: 700 }
let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  jarStore.clear()
  customerEnv.hasCustomerAccountEnv.mockReturnValue(true)
  env.hasShopifyEnv.mockReturnValue(true)
  env.hasShopifyAdminEnv.mockReturnValue(true)
  session.getCustomerSession.mockResolvedValue(signedIn)
  bridge.resolveCustomer.mockResolvedValue({ id: 'cus_1', created: false })
  bridge.getLoyaltyOverview.mockResolvedValue({ points: 1240 })
  bridge.redeemRewardToCode.mockResolvedValue(redeemed)
  ledger.getLedgerPage.mockResolvedValue({ rows: [], nextCursor: null })
  cartQueries.getCartById.mockResolvedValue(makeCart([{ code: 'WELCOME10', applicable: true }]))
  cartQueries.updateCartDiscountCodes.mockImplementation(async (_id: string, codes: string[]) =>
    makeCart(codes.map((code) => ({ code, applicable: true })))
  )
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

describe('getLoyaltyOverviewAction', () => {
  it('returns Accounts unavailable without touching the session when accounts are unconfigured', async () => {
    customerEnv.hasCustomerAccountEnv.mockReturnValue(false)
    await expect(getLoyaltyOverviewAction()).resolves.toEqual({ ok: false, error: 'Accounts unavailable', code: 'UNAVAILABLE' })
    expect(session.getCustomerSession).not.toHaveBeenCalled()
  })

  it('returns SIGNED_OUT without a session', async () => {
    session.getCustomerSession.mockResolvedValue(null)
    const result = await getLoyaltyOverviewAction()
    expect(result).toMatchObject({ ok: false, code: 'SIGNED_OUT' })
    expect(bridge.resolveCustomer).not.toHaveBeenCalled()
  })

  it('resolves the Prisma customer from the session and returns the overview', async () => {
    await expect(getLoyaltyOverviewAction()).resolves.toEqual({ ok: true, data: { points: 1240 } })
    expect(bridge.resolveCustomer).toHaveBeenCalledWith({ shopifyCustomerId: CUSTOMER_GID, email: 'nando@example.com', firstName: 'Nando', lastName: 'Rivera' })
    expect(bridge.getLoyaltyOverview).toHaveBeenCalledWith('cus_1')
  })

  it('maps unexpected failures to a generic error and logs the message only', async () => {
    bridge.getLoyaltyOverview.mockRejectedValue(new Error('db down'))
    await expect(getLoyaltyOverviewAction()).resolves.toEqual({ ok: false, error: 'Something went wrong. Please try again.' })
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })
})

describe('redeemRewardAction', () => {
  const input = { rewardId: 'reward-5off', idempotencyKey: 'f0e1d2c3-b4a5-6789-0123-456789abcdef' }

  it('gates: unconfigured accounts, bad input, signed out, Rewards unavailable (no points move)', async () => {
    customerEnv.hasCustomerAccountEnv.mockReturnValue(false)
    await expect(redeemRewardAction(input)).resolves.toMatchObject({ ok: false, error: 'Accounts unavailable' })
    customerEnv.hasCustomerAccountEnv.mockReturnValue(true)

    await expect(redeemRewardAction({ rewardId: '', idempotencyKey: 'x' })).resolves.toMatchObject({ ok: false, code: 'INVALID_INPUT' })

    session.getCustomerSession.mockResolvedValueOnce(null)
    await expect(redeemRewardAction(input)).resolves.toMatchObject({ ok: false, code: 'SIGNED_OUT' })

    env.hasShopifyAdminEnv.mockReturnValue(false)
    await expect(redeemRewardAction(input)).resolves.toEqual({ ok: false, error: 'Rewards unavailable', code: 'REWARDS_UNAVAILABLE' })
    expect(bridge.redeemRewardToCode).not.toHaveBeenCalled()
  })

  it('mints the code and applies it to the existing cart on top of its codes', async () => {
    jarStore.set(CART_COOKIE, CART_ID)
    const result = await redeemRewardAction(input)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.data).toMatchObject(redeemed)
    expect(result.data.cart?.discountCodes.map((entry) => entry.code)).toEqual(['WELCOME10', 'HOF-DISC-K7M2P9'])
    expect(bridge.redeemRewardToCode).toHaveBeenCalledWith({ customerId: 'cus_1', rewardId: 'reward-5off', idempotencyKey: input.idempotencyKey, shopifyCustomerId: CUSTOMER_GID })
    expect(cartQueries.updateCartDiscountCodes).toHaveBeenCalledWith(CART_ID, ['WELCOME10', 'HOF-DISC-K7M2P9'])
  })

  it('returns cart null without a cart cookie, and never applies a DROP code', async () => {
    await expect(redeemRewardAction(input)).resolves.toEqual({ ok: true, data: { ...redeemed, cart: null } })
    expect(cartQueries.getCartById).not.toHaveBeenCalled()

    jarStore.set(CART_COOKIE, CART_ID)
    bridge.redeemRewardToCode.mockResolvedValue({ ...redeemed, code: 'HOF-DROP-AB23CD', expiresAt: '' })
    const result = await redeemRewardAction(input)
    expect(result).toMatchObject({ ok: true, data: { code: 'HOF-DROP-AB23CD', cart: null } })
    expect(cartQueries.updateCartDiscountCodes).not.toHaveBeenCalled()
  })

  it('maps LoyaltyError codes 1:1 and other failures to the generic error', async () => {
    bridge.redeemRewardToCode.mockRejectedValue(new bridge.LoyaltyError('INSUFFICIENT_POINTS', 'Not enough Care Points yet.'))
    await expect(redeemRewardAction(input)).resolves.toEqual({ ok: false, error: 'Not enough Care Points yet.', code: 'INSUFFICIENT_POINTS' })

    bridge.redeemRewardToCode.mockRejectedValue(new Error('boom'))
    await expect(redeemRewardAction(input)).resolves.toEqual({ ok: false, error: 'Something went wrong. Please try again.' })
  })
})

describe('loadLedgerAction', () => {
  it('gates like the overview and forwards cursor/limit/filter', async () => {
    session.getCustomerSession.mockResolvedValueOnce(null)
    await expect(loadLedgerAction({})).resolves.toMatchObject({ ok: false, code: 'SIGNED_OUT' })

    await expect(loadLedgerAction({ filter: 'nope' as 'all' })).resolves.toMatchObject({ ok: false, code: 'INVALID_INPUT' })

    ledger.getLedgerPage.mockResolvedValue({ rows: [{ id: 'ptx_1' }], nextCursor: 'ptx_1' })
    await expect(loadLedgerAction({ cursor: 'ptx_0', limit: 10, filter: 'earned' })).resolves.toEqual({ ok: true, data: { rows: [{ id: 'ptx_1' }], nextCursor: 'ptx_1' } })
    expect(ledger.getLedgerPage).toHaveBeenCalledWith('cus_1', { cursor: 'ptx_0', limit: 10, filter: 'earned' })

    await loadLedgerAction()
    expect(ledger.getLedgerPage).toHaveBeenLastCalledWith('cus_1', { cursor: null, limit: undefined, filter: undefined })
  })
})

describe('applyRedeemedCode (cart action helper)', () => {
  it('returns null when the store is unconfigured, the code is invalid or there is no cart', async () => {
    env.hasShopifyEnv.mockReturnValueOnce(false)
    await expect(applyRedeemedCode('HOF-DISC-K7M2P9')).resolves.toBeNull()
    await expect(applyRedeemedCode('   ')).resolves.toBeNull()
    await expect(applyRedeemedCode('HOF-DISC-K7M2P9')).resolves.toBeNull()
    expect(cartQueries.getCartById).not.toHaveBeenCalled()
  })

  it('merges the code into the existing codes (deduped, case-insensitive) and returns the cart', async () => {
    jarStore.set(CART_COOKIE, CART_ID)
    cartQueries.getCartById.mockResolvedValue(makeCart([{ code: 'WELCOME10', applicable: true }, { code: 'hof-disc-k7m2p9', applicable: false }]))
    const cart = await applyRedeemedCode('HOF-DISC-K7M2P9')
    expect(cartQueries.updateCartDiscountCodes).toHaveBeenCalledWith(CART_ID, ['WELCOME10', 'HOF-DISC-K7M2P9'])
    expect(cart?.discountCodes.map((entry) => entry.code)).toEqual(['WELCOME10', 'HOF-DISC-K7M2P9'])
  })

  it('never throws: a missing cart or a Shopify failure yields null', async () => {
    jarStore.set(CART_COOKIE, CART_ID)
    cartQueries.getCartById.mockResolvedValueOnce(null)
    await expect(applyRedeemedCode('HOF-DISC-K7M2P9')).resolves.toBeNull()

    cartQueries.updateCartDiscountCodes.mockRejectedValueOnce(new Error('network'))
    await expect(applyRedeemedCode('HOF-DISC-K7M2P9')).resolves.toBeNull()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('applyRedeemedCode'))
  })
})
