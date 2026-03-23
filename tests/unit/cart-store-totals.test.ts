import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from '@/lib/store/cart'

function createCartItem() {
  return {
    product: {
      id: 'product-1',
      name: 'Product 1',
      slug: 'product-1',
      price: 100,
      images: '[]',
      isActive: true,
      isFeatured: false,
      variants: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    variant: {
      id: 'variant-1',
      sku: 'SKU-1',
      inventory: 5,
      isActive: true,
      price: 100,
    },
    quantity: 1,
  }
}

describe('cart store totals', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [createCartItem()],
      appliedCoupon: null,
    })
  })

  it('calculates base totals without coupon', () => {
    const totals = useCartStore.getState().getFinalTotal(10, 0.08)
    expect(totals.subtotal).toBe(100)
    expect(totals.shipping).toBe(10)
    expect(totals.discount).toBe(0)
    expect(Number(totals.tax.toFixed(2))).toBe(8)
    expect(Number(totals.total.toFixed(2))).toBe(118)
  })

  it('applies free shipping coupon in final totals', () => {
    useCartStore.getState().applyCoupon({
      code: 'FREE',
      discountType: 'free_shipping',
      discountAmount: 0,
      description: 'Free Shipping',
      rewardName: 'Free Shipping',
    })

    const totals = useCartStore.getState().getFinalTotal(10, 0.08)
    expect(totals.shipping).toBe(0)
    expect(Number(totals.total.toFixed(2))).toBe(108)
  })

  it('applies percentage discount before tax', () => {
    useCartStore.getState().applyCoupon({
      code: 'SAVE10',
      discountType: 'percentage',
      discountAmount: 10,
      description: '10% off',
      rewardName: 'Promo',
    })

    const totals = useCartStore.getState().getFinalTotal(10, 0.08)
    expect(totals.discount).toBe(10)
    expect(Number(totals.tax.toFixed(2))).toBe(7.2)
    expect(Number(totals.total.toFixed(2))).toBe(107.2)
  })
})
