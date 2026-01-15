// tests/unit/stripe-refunds.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock stripe config
vi.mock('@/lib/stripe/config', () => ({
  stripe: {
    refunds: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
}))

describe('Stripe Refund Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module cache to get fresh mocks
    vi.resetModules()
  })

  describe('checkStripeRefundEligibility', () => {
    it('should return ineligible when order not found', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { checkStripeRefundEligibility } = await import('@/lib/stripe/refunds')
      
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const result = await checkStripeRefundEligibility('order-1')
      
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('not found')
    })

    it('should return ineligible when order is already refunded', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { checkStripeRefundEligibility } = await import('@/lib/stripe/refunds')
      
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        stripePaymentIntentId: 'pi_test',
        stripeRefundId: 'ref_existing',
        paymentStatus: 'REFUNDED',
        status: 'REFUNDED',
        total: 100,
      } as any)

      const result = await checkStripeRefundEligibility('order-1')
      
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('already been refunded')
    })

    it('should return ineligible when payment status is not PAID', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { checkStripeRefundEligibility } = await import('@/lib/stripe/refunds')
      
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        stripePaymentIntentId: 'pi_test',
        stripeRefundId: null,
        paymentStatus: 'PENDING',
        status: 'PENDING',
        total: 100,
      } as any)

      const result = await checkStripeRefundEligibility('order-1')
      
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('PENDING')
    })

    it('should return ineligible when no payment intent', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { checkStripeRefundEligibility } = await import('@/lib/stripe/refunds')
      
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        stripePaymentIntentId: null,
        stripeRefundId: null,
        paymentStatus: 'PAID',
        status: 'DELIVERED',
        total: 100,
      } as any)

      const result = await checkStripeRefundEligibility('order-1')
      
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('No Stripe payment')
    })

    it('should return eligible when order has payment intent and is paid', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { checkStripeRefundEligibility } = await import('@/lib/stripe/refunds')
      
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        stripePaymentIntentId: 'pi_test123',
        stripeRefundId: null,
        paymentStatus: 'PAID',
        status: 'DELIVERED',
        total: 100,
      } as any)

      const result = await checkStripeRefundEligibility('order-1')
      
      expect(result.eligible).toBe(true)
      expect(result.maxRefundAmount).toBe(100)
      expect(result.paymentIntentId).toBe('pi_test123')
    })
  })

  describe('processStripeRefund', () => {
    it('should return error when order not found', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { processStripeRefund } = await import('@/lib/stripe/refunds')
      
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const result = await processStripeRefund({ orderId: 'nonexistent-order' })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('ORDER_NOT_FOUND')
    })

    it('should return error when no payment intent exists', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { processStripeRefund } = await import('@/lib/stripe/refunds')
      
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        orderNumber: 'HOF-001',
        stripePaymentIntentId: null,
        stripeRefundId: null,
        total: 100,
        paymentStatus: 'PAID',
        status: 'DELIVERED',
      } as any)

      const result = await processStripeRefund({ orderId: 'order-1' })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_PAYMENT_INTENT')
    })

    it('should return error when already refunded', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { processStripeRefund } = await import('@/lib/stripe/refunds')
      
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        orderNumber: 'HOF-001',
        stripePaymentIntentId: 'pi_test',
        stripeRefundId: 'ref_existing',
        total: 100,
        paymentStatus: 'REFUNDED',
        status: 'REFUNDED',
      } as any)

      const result = await processStripeRefund({ orderId: 'order-1' })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('ALREADY_REFUNDED')
    })
  })
})
