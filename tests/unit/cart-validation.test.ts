import { describe, expect, it } from 'vitest'
import type { CartItem } from '@/lib/store/cart'
import {
  getCartLineMaxQuantity,
  getCartLineValidation,
  hasCartBlockingIssues,
} from '@/lib/cart/cart-validation'

type CartItemOverrides = Omit<Partial<CartItem>, 'product' | 'variant'> & {
  product?: Partial<CartItem['product']>
  variant?: Partial<NonNullable<CartItem['variant']>>
}

function createCartItem(overrides: CartItemOverrides = {}): CartItem {
  const base: CartItem = {
    product: {
      id: 'product-1',
      name: 'Test Product',
      slug: 'test-product',
      price: 120,
      images: '[]',
      isActive: true,
      isFeatured: false,
      maxQuantity: null,
      variants: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    variant: {
      id: 'variant-1',
      sku: 'SKU-1',
      inventory: 8,
      isActive: true,
    },
    quantity: 3,
  }

  return {
    ...base,
    ...overrides,
    product: {
      ...base.product,
      ...(overrides.product || {}),
    },
    variant: {
      ...base.variant,
      ...(overrides.variant || {}),
    },
  }
}

describe('cart validation helpers', () => {
  it('caps line quantity by min(inventory, product.maxQuantity)', () => {
    const item = createCartItem({
      product: { maxQuantity: 5 },
      variant: { inventory: 12 },
    })

    expect(getCartLineMaxQuantity(item)).toBe(5)
  })

  it('marks out of stock lines as blocking', () => {
    const outOfStock = createCartItem({
      variant: { inventory: 0 },
      quantity: 1,
    })

    const validation = getCartLineValidation(outOfStock)
    expect(validation.isOutOfStock).toBe(true)
    expect(hasCartBlockingIssues([validation])).toBe(true)
  })

  it('detects over-cap persisted quantities and provides normalized quantity', () => {
    const item = createCartItem({
      product: { maxQuantity: 2 },
      variant: { inventory: 10 },
      quantity: 7,
    })

    const validation = getCartLineValidation(item)
    expect(validation.maxQuantity).toBe(2)
    expect(validation.isOverCap).toBe(true)
    expect(validation.normalizedQuantity).toBe(2)
  })
})
