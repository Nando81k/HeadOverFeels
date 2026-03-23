import { describe, expect, it } from 'vitest'
import {
  calculateConfirmationSavings,
  getConfirmationEtaText,
  getConfirmationOfferSummary,
  getConfirmationStatusDescriptor,
} from '@/lib/orders/confirmation-insights'

describe('order confirmation insights', () => {
  it('maps status metadata with tone and description', () => {
    const shipped = getConfirmationStatusDescriptor('SHIPPED')
    expect(shipped.label).toBe('Shipped')
    expect(shipped.tone).toBe('success')
    expect(shipped.description).toContain('in transit')

    const cancelled = getConfirmationStatusDescriptor('CANCELLED')
    expect(cancelled.label).toBe('Cancelled')
    expect(cancelled.tone).toBe('danger')
  })

  it('derives ETA text from explicit estimated delivery date first', () => {
    const eta = getConfirmationEtaText({
      status: 'SHIPPED',
      estimatedDelivery: '2026-03-28T00:00:00.000Z',
      shippedAt: '2026-03-25T00:00:00.000Z',
    })

    expect(eta).toContain('Estimated delivery')
    expect(eta).toContain('Mar')
  })

  it('calculates savings from discount + shipping + tax impact', () => {
    const savings = calculateConfirmationSavings({
      subtotal: 120,
      discount: 20,
      shipping: 0,
      tax: 8,
      taxRate: 0.08,
      standardShippingRate: 10,
    })

    expect(savings.discountSavings).toBe(20)
    expect(savings.shippingSavings).toBe(10)
    expect(savings.taxSavings).toBe(1.6)
    expect(savings.totalSavings).toBe(31.6)
  })

  it('builds active offer summary from coupon/discount/shipping signals', () => {
    const offer = getConfirmationOfferSummary({
      couponCode: 'save15',
      discount: 12,
      shipping: 0,
    })

    expect(offer).toContain('SAVE15')
    expect(offer).toContain('Discount applied')
    expect(offer).toContain('Free shipping')
  })
})
