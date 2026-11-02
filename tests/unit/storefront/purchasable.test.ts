// tests/unit/storefront/purchasable.test.ts — lib/storefront/purchasable.ts (Phase 5, Task 1)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { variants, session, earlyAccess } = vi.hoisted(() => ({
  variants: { getVariantsByIds: vi.fn() },
  session: { getCustomerSession: vi.fn() },
  earlyAccess: { hasEarlyAccess: vi.fn() },
}))
vi.mock('@/lib/shopify/queries/variants', () => variants)
vi.mock('@/lib/shopify/customer/session', () => session)
vi.mock('@/lib/storefront/early-access', () => earlyAccess)

import type { ProductCardVariant } from '@/lib/shopify/queries/variants'
import { assertPurchasable } from '@/lib/storefront/purchasable'

const NOW = new Date('2026-09-10T12:00:00Z')
const VARIANT_ID = 'gid://shopify/ProductVariant/1'

function variant(drop: ProductCardVariant['product']['drop']): ProductCardVariant {
  return {
    id: VARIANT_ID,
    title: 'Default Title',
    availableForSale: true,
    quantityAvailable: 5,
    price: { amount: '120.0', currencyCode: 'USD' },
    compareAtPrice: null,
    selectedOptions: [],
    image: null,
    product: {
      id: 'gid://shopify/Product/1',
      handle: 'drop-01',
      title: 'Drop 01',
      tags: drop ? ['drop'] : [],
      availableForSale: true,
      featuredImage: null,
      drop,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  session.getCustomerSession.mockResolvedValue(null)
  earlyAccess.hasEarlyAccess.mockResolvedValue(false)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('assertPurchasable', () => {
  it('passes a product that is not a drop without reading the session', async () => {
    variants.getVariantsByIds.mockResolvedValue([variant(null)])

    await expect(assertPurchasable(VARIANT_ID, NOW)).resolves.toEqual({ ok: true })
    expect(variants.getVariantsByIds).toHaveBeenCalledWith([VARIANT_ID])
    expect(session.getCustomerSession).not.toHaveBeenCalled()
  })

  it('passes an unknown variant (Shopify reports its own error)', async () => {
    variants.getVariantsByIds.mockResolvedValue([])

    await expect(assertPurchasable(VARIANT_ID, NOW)).resolves.toEqual({ ok: true })
  })

  it('passes a live drop', async () => {
    variants.getVariantsByIds.mockResolvedValue([
      variant({ start: '2026-09-06T13:00:00Z', end: '2026-09-13T13:00:00Z', maxPerOrder: 2 }),
    ])

    await expect(assertPurchasable(VARIANT_ID, NOW)).resolves.toEqual({ ok: true })
    expect(session.getCustomerSession).not.toHaveBeenCalled()
  })

  it('refuses an ended drop', async () => {
    variants.getVariantsByIds.mockResolvedValue([
      variant({ start: '2026-08-06T13:00:00Z', end: '2026-09-01T13:00:00Z', maxPerOrder: null }),
    ])

    await expect(assertPurchasable(VARIANT_ID, NOW)).resolves.toEqual({
      ok: false,
      code: 'DROP_ENDED',
      error: 'This drop has ended.',
    })
  })

  it('refuses an upcoming drop for a visitor without early access', async () => {
    variants.getVariantsByIds.mockResolvedValue([
      variant({ start: '2026-09-13T13:00:00Z', end: null, maxPerOrder: null }),
    ])

    await expect(assertPurchasable(VARIANT_ID, NOW)).resolves.toEqual({
      ok: false,
      code: 'DROP_NOT_OPEN',
      error: 'This drop has not opened yet.',
    })
    expect(earlyAccess.hasEarlyAccess).toHaveBeenCalledWith(null, 'drop-01', NOW)
  })

  it('passes an upcoming drop for a customer with early access', async () => {
    variants.getVariantsByIds.mockResolvedValue([
      variant({ start: '2026-09-13T13:00:00Z', end: null, maxPerOrder: null }),
    ])
    const customer = { customerId: 'gid://shopify/Customer/1' }
    session.getCustomerSession.mockResolvedValue(customer)
    earlyAccess.hasEarlyAccess.mockResolvedValue(true)

    await expect(assertPurchasable(VARIANT_ID, NOW)).resolves.toEqual({ ok: true })
    expect(earlyAccess.hasEarlyAccess).toHaveBeenCalledWith(customer, 'drop-01', NOW)
  })

  it('passes and logs when the variant lookup fails (never a false "closed")', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    variants.getVariantsByIds.mockRejectedValue(new Error('storefront 502'))

    await expect(assertPurchasable(VARIANT_ID, NOW)).resolves.toEqual({ ok: true })
    expect(error).toHaveBeenCalledWith(expect.stringContaining('storefront 502'))
  })
})
