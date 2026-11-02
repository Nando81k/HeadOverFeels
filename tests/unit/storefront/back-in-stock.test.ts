// tests/unit/storefront/back-in-stock.test.ts — lib/storefront/back-in-stock.ts (Phase 5, Task 3)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import fixture from '@/tests/fixtures/shopify/webhooks/products-update.json'

vi.mock('server-only', () => ({}))

const { prisma, sender } = vi.hoisted(() => ({
  prisma: {
    product: { findUnique: vi.fn() },
    backInStockNotification: { upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  },
  sender: { sendBackInStockEmail: vi.fn(), isBackInStockEmailConfigured: vi.fn(() => true) },
}))
vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('@/lib/back-in-stock/send', () => sender)

import {
  cancelSubscription,
  notifyVariantsBackInStock,
  parseProductsUpdate,
  subscribe,
  unsubscribeUrl,
  variantAvailable,
} from '@/lib/storefront/back-in-stock'

beforeEach(() => {
  vi.clearAllMocks()
  sender.isBackInStockEmailConfigured.mockReturnValue(true)
  sender.sendBackInStockEmail.mockResolvedValue({ ok: true })
  prisma.backInStockNotification.updateMany.mockResolvedValue({ count: 1 })
  process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.example'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('subscribe', () => {
  it('upserts a PENDING row keyed by variant gid + email and links the Prisma product by slug', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' })
    prisma.backInStockNotification.upsert.mockResolvedValue({ id: 'bis-1' })
    const result = await subscribe({
      variantId: 'gid://shopify/ProductVariant/1',
      handle: 'core-hoodie',
      email: ' Nando@Example.com ',
      customerId: 'cust-1',
    })
    expect(result).toEqual({ id: 'bis-1', status: 'PENDING', email: 'nando@example.com' })
    const call = prisma.backInStockNotification.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ shopifyVariantId_email: { shopifyVariantId: 'gid://shopify/ProductVariant/1', email: 'nando@example.com' } })
    expect(call.create).toMatchObject({ shopifyVariantId: 'gid://shopify/ProductVariant/1', productHandle: 'core-hoodie', productId: 'prod-1', customerId: 'cust-1' })
    expect(call.update).toMatchObject({ status: 'PENDING', notifiedAt: null })
    expect(call.create.expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 3600 * 1000)
  })

  it('stores a null product id when the handle has no Prisma product', async () => {
    prisma.product.findUnique.mockResolvedValue(null)
    prisma.backInStockNotification.upsert.mockResolvedValue({ id: 'bis-2' })
    await subscribe({ variantId: 'gid://shopify/ProductVariant/2', handle: 'new', email: 'a@b.co' })
    expect(prisma.backInStockNotification.upsert.mock.calls[0][0].create).toMatchObject({ productId: null, customerId: null })
  })
})

describe('cancelSubscription', () => {
  it('cancels only a pending row that matches id and email', async () => {
    await expect(cancelSubscription('bis-1', 'Nando@Example.com')).resolves.toBe(true)
    expect(prisma.backInStockNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'bis-1', email: 'nando@example.com', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    })
    prisma.backInStockNotification.updateMany.mockResolvedValue({ count: 0 })
    await expect(cancelSubscription('bis-1', 'x@y.z')).resolves.toBe(false)
  })

  it('builds the unsubscribe link on the public base URL', () => {
    expect(unsubscribeUrl('bis-1', 'a@b.co')).toBe('https://preview.example/back-in-stock/unsubscribe?id=bis-1&email=a%40b.co')
  })
})

describe('parseProductsUpdate', () => {
  it('reads handle, title and per-variant availability from the REST payload', () => {
    const update = parseProductsUpdate(fixture)
    expect(update.productGid).toBe('gid://shopify/Product/8841287434465')
    expect(update.handle).toBe('core-hoodie')
    expect(update.title).toBe('Core Hoodie')
    expect(update.variants).toEqual([
      { id: 'gid://shopify/ProductVariant/46601236185313', title: 'S / Black', availableForSale: true },
      { id: 'gid://shopify/ProductVariant/46601236218081', title: 'M / Black', availableForSale: false },
      { id: 'gid://shopify/ProductVariant/46601236250849', title: 'L / Black', availableForSale: true },
      { id: 'gid://shopify/ProductVariant/46601236283617', title: 'XL / Black', availableForSale: true },
    ])
  })

  it('throws without a title and tolerates missing variants', () => {
    expect(() => parseProductsUpdate({ id: 1 })).toThrow(/title/)
    expect(parseProductsUpdate({ id: 1, title: 'X' })).toEqual({ productGid: 'gid://shopify/Product/1', handle: null, title: 'X', variants: [] })
  })

  it('variantAvailable: stock, continue policy or untracked inventory', () => {
    expect(variantAvailable({ inventory_quantity: 0, inventory_policy: 'deny', inventory_management: 'shopify' })).toBe(false)
    expect(variantAvailable({ inventory_quantity: 1, inventory_policy: 'deny', inventory_management: 'shopify' })).toBe(true)
    expect(variantAvailable({ inventory_quantity: 0, inventory_policy: 'continue', inventory_management: 'shopify' })).toBe(true)
    expect(variantAvailable({ inventory_quantity: 0, inventory_policy: 'deny', inventory_management: null })).toBe(true)
  })
})

describe('notifyVariantsBackInStock', () => {
  const update = parseProductsUpdate(fixture)
  const row = (id: string, variant: string, email = `${id}@example.com`) => ({
    id,
    email,
    shopifyVariantId: variant,
    productHandle: 'core-hoodie',
    customer: { name: 'Nando Rodriguez' },
  })

  it('does nothing when no variant became available', async () => {
    const result = await notifyVariantsBackInStock({ ...update, variants: update.variants.map((v) => ({ ...v, availableForSale: false })) })
    expect(result).toEqual({ available: 0, sent: 0, failed: 0, skipped: 0 })
    expect(prisma.backInStockNotification.findMany).not.toHaveBeenCalled()
  })

  it('emails each pending row for an available variant and marks them NOTIFIED', async () => {
    prisma.backInStockNotification.findMany.mockResolvedValue([
      row('bis-1', 'gid://shopify/ProductVariant/46601236185313'),
      row('bis-2', 'gid://shopify/ProductVariant/46601236250849'),
    ])
    const result = await notifyVariantsBackInStock(update)
    expect(result).toEqual({ available: 3, sent: 2, failed: 0, skipped: 0 })
    const where = prisma.backInStockNotification.findMany.mock.calls[0][0].where
    expect(where.shopifyVariantId.in).toEqual([
      'gid://shopify/ProductVariant/46601236185313',
      'gid://shopify/ProductVariant/46601236250849',
      'gid://shopify/ProductVariant/46601236283617',
    ])
    expect(where.status).toBe('PENDING')
    expect(sender.sendBackInStockEmail).toHaveBeenCalledWith({
      to: 'bis-1@example.com',
      customerName: 'Nando Rodriguez',
      productTitle: 'Core Hoodie',
      variantTitle: 'S / Black',
      productUrl: 'https://preview.example/products/core-hoodie',
      unsubscribeUrl: 'https://preview.example/back-in-stock/unsubscribe?id=bis-1&email=bis-1%40example.com',
    })
    expect(prisma.backInStockNotification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['bis-1', 'bis-2'] } },
      data: { status: 'NOTIFIED', notifiedAt: expect.any(Date) },
    })
  })

  it('leaves a row PENDING when its send fails', async () => {
    prisma.backInStockNotification.findMany.mockResolvedValue([
      row('bis-1', 'gid://shopify/ProductVariant/46601236185313'),
      row('bis-2', 'gid://shopify/ProductVariant/46601236185313'),
    ])
    sender.sendBackInStockEmail.mockResolvedValueOnce({ ok: false, error: 'bounce' }).mockResolvedValueOnce({ ok: true })
    const result = await notifyVariantsBackInStock(update)
    expect(result).toMatchObject({ sent: 1, failed: 1 })
    expect(prisma.backInStockNotification.updateMany.mock.calls[0][0].where).toEqual({ id: { in: ['bis-2'] } })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('bis-1'))
  })

  it('marks rows without sending when no email provider is configured', async () => {
    sender.isBackInStockEmailConfigured.mockReturnValue(false)
    prisma.backInStockNotification.findMany.mockResolvedValue([row('bis-1', 'gid://shopify/ProductVariant/46601236185313')])
    const result = await notifyVariantsBackInStock(update)
    expect(result).toMatchObject({ sent: 0, skipped: 1 })
    expect(sender.sendBackInStockEmail).not.toHaveBeenCalled()
    expect(prisma.backInStockNotification.updateMany).toHaveBeenCalled()
  })
})
