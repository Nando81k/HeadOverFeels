// tests/unit/storefront/back-in-stock-actions.test.ts — app/(storefront)/_actions/back-in-stock.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { env, session, bridge, lib } = vi.hoisted(() => ({
  env: { hasCustomerAccountEnv: vi.fn(() => true) },
  session: { getCustomerSession: vi.fn() },
  bridge: { resolveCustomer: vi.fn() },
  lib: { subscribe: vi.fn(), normalizeEmail: (email: string) => email.trim().toLowerCase() },
}))
vi.mock('@/lib/shopify/customer/env', () => env)
vi.mock('@/lib/shopify/customer/session', () => session)
vi.mock('@/lib/loyalty/shopify-bridge', () => bridge)
vi.mock('@/lib/storefront/back-in-stock', () => lib)

import { subscribeBackInStockAction } from '@/app/(storefront)/_actions/back-in-stock'
import { BACK_IN_STOCK_EMAIL_ERROR, BACK_IN_STOCK_IDLE } from '@/lib/storefront/back-in-stock-form'

const VARIANT = 'gid://shopify/ProductVariant/46601236185313'

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  env.hasCustomerAccountEnv.mockReturnValue(true)
  session.getCustomerSession.mockResolvedValue(null)
  bridge.resolveCustomer.mockResolvedValue({ id: 'cust-1' })
  lib.subscribe.mockImplementation(async (input: { email: string }) => ({ id: 'bis-1', status: 'PENDING', email: input.email }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('subscribeBackInStockAction', () => {
  it('subscribes a guest by typed email', async () => {
    const state = await subscribeBackInStockAction(BACK_IN_STOCK_IDLE, form({ variantId: VARIANT, handle: 'core-hoodie', email: 'Guest@Example.com' }))
    expect(state).toEqual({ status: 'success', email: 'guest@example.com' })
    expect(lib.subscribe).toHaveBeenCalledWith({ variantId: VARIANT, handle: 'core-hoodie', email: 'guest@example.com', customerId: null })
  })

  it('uses the account email and links the customer when signed in', async () => {
    session.getCustomerSession.mockResolvedValue({ customerId: 'gid://shopify/Customer/1', email: 'nando@example.com', firstName: 'Nando', lastName: null })
    const state = await subscribeBackInStockAction(BACK_IN_STOCK_IDLE, form({ variantId: VARIANT, handle: 'core-hoodie', email: 'other@example.com' }))
    expect(state).toEqual({ status: 'success', email: 'nando@example.com' })
    expect(lib.subscribe).toHaveBeenCalledWith(expect.objectContaining({ email: 'nando@example.com', customerId: 'cust-1' }))
  })

  it('still subscribes by email when the customer link fails', async () => {
    session.getCustomerSession.mockResolvedValue({ customerId: 'gid://shopify/Customer/1', email: 'nando@example.com', firstName: null, lastName: null })
    bridge.resolveCustomer.mockRejectedValue(new Error('no db'))
    const state = await subscribeBackInStockAction(BACK_IN_STOCK_IDLE, form({ variantId: VARIANT, handle: 'core-hoodie' }))
    expect(state.status).toBe('success')
    expect(lib.subscribe).toHaveBeenCalledWith(expect.objectContaining({ customerId: null }))
  })

  it('rejects a bad email and keeps what was typed', async () => {
    const state = await subscribeBackInStockAction(BACK_IN_STOCK_IDLE, form({ variantId: VARIANT, handle: 'core-hoodie', email: 'nope' }))
    expect(state).toEqual({ status: 'error', error: BACK_IN_STOCK_EMAIL_ERROR, code: 'INVALID_EMAIL', values: { email: 'nope' } })
    expect(lib.subscribe).not.toHaveBeenCalled()
  })

  it('refuses a non-variant id and a tripped honeypot with the generic error', async () => {
    await expect(subscribeBackInStockAction(BACK_IN_STOCK_IDLE, form({ variantId: 'gid://shopify/Product/1', handle: 'x', email: 'a@b.co' }))).resolves.toMatchObject({ status: 'error', error: /Could not save/ })
    await expect(subscribeBackInStockAction(BACK_IN_STOCK_IDLE, form({ variantId: VARIANT, handle: 'x', email: 'a@b.co', website: 'spam' }))).resolves.toMatchObject({ status: 'error' })
    expect(lib.subscribe).not.toHaveBeenCalled()
  })

  it('never throws when the database is down', async () => {
    lib.subscribe.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(subscribeBackInStockAction(BACK_IN_STOCK_IDLE, form({ variantId: VARIANT, handle: 'core-hoodie', email: 'a@b.co' }))).resolves.toMatchObject({ status: 'error', error: /Could not save/ })
    expect(console.error).toHaveBeenCalled()
  })
})
