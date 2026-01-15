// tests/unit/email-templates.test.ts
import { describe, it, expect } from 'vitest'
import {
  generateShippedEmail,
  generateDeliveredEmail,
  generateRefundEmail,
  generateOutForDeliveryEmail,
} from '@/lib/email/templates/order-status'

describe('Email Templates', () => {
  const mockOrderData = {
    orderNumber: 'HOF-123456',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    items: [
      { name: 'Premium T-Shirt', quantity: 2, price: 29.99, variant: 'Size M' },
      { name: 'Hoodie', quantity: 1, price: 59.99 },
    ],
    total: 119.97,
    shippingAddress: {
      fullName: 'John Doe',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
  }

  describe('generateShippedEmail', () => {
    it('should generate shipped email with tracking info', () => {
      const result = generateShippedEmail({
        ...mockOrderData,
        carrier: 'USPS',
        trackingNumber: 'TRACK123456',
        trackingUrl: 'https://tracking.com/TRACK123456',
      })

      expect(result.subject).toContain('Shipped')
      expect(result.html).toContain('John Doe')
      expect(result.html).toContain('HOF-123456')
      expect(result.html).toContain('TRACK123456')
      expect(result.html).toContain('USPS')
      expect(result.text).toContain('Shipped') // Title case in template
      expect(result.text).toContain('TRACK123456')
    })

    it('should include items list in email', () => {
      const result = generateShippedEmail({
        ...mockOrderData,
        carrier: 'FedEx',
        trackingNumber: 'FX123',
        trackingUrl: 'https://fedex.com/FX123',
      })

      expect(result.html).toContain('Premium T-Shirt')
      expect(result.html).toContain('Hoodie')
    })
  })

  describe('generateDeliveredEmail', () => {
    it('should generate delivered email', () => {
      const result = generateDeliveredEmail(mockOrderData)

      expect(result.subject).toContain('Delivered')
      expect(result.html).toContain('John Doe')
      expect(result.html).toContain('HOF-123456')
      expect(result.text).toContain('delivered')
    })

    it('should include order items', () => {
      const result = generateDeliveredEmail(mockOrderData)

      expect(result.html).toContain('Premium T-Shirt')
      expect(result.html).toContain('Hoodie')
    })
  })

  describe('generateRefundEmail', () => {
    it('should generate refund email with full refund', () => {
      const result = generateRefundEmail({
        orderNumber: 'HOF-123456',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        refundAmount: 119.97,
        originalTotal: 119.97,
        refundReason: 'Customer requested',
        isPartialRefund: false,
      })

      expect(result.subject).toContain('Refund')
      expect(result.html).toContain('119.97')
      expect(result.html).toContain('Refund Processed') // Actual heading text
      expect(result.text).toContain('refund')
    })

    it('should generate refund email with partial refund', () => {
      const result = generateRefundEmail({
        orderNumber: 'HOF-123456',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        refundAmount: 50.00,
        originalTotal: 119.97,
        refundReason: 'Item returned',
        isPartialRefund: true,
      })

      expect(result.html).toContain('partial refund')
      expect(result.html).toContain('50.00')
    })
  })

  describe('generateOutForDeliveryEmail', () => {
    it('should generate out for delivery email', () => {
      const result = generateOutForDeliveryEmail(mockOrderData)

      expect(result.subject).toContain('Out for Delivery')
      expect(result.html).toContain('John Doe')
      expect(result.text).toContain('out for delivery')
    })
  })

  describe('Email Template Structure', () => {
    it('should include brand header in HTML emails', () => {
      const result = generateShippedEmail({
        ...mockOrderData,
        trackingNumber: 'TEST123',
        trackingUrl: 'https://test.com',
      })

      expect(result.html).toContain('HEAD OVER FEELS')
    })

    it('should include footer with company info', () => {
      const result = generateDeliveredEmail(mockOrderData)

      expect(result.html).toContain('footer')
    })
  })
})
