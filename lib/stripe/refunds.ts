/**
 * Stripe Refund Service
 * 
 * Handles processing refunds through Stripe API
 */

import { stripe } from './config'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

// ===== Types =====

export interface RefundRequest {
  orderId: string
  amount?: number  // If not provided, full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  metadata?: Record<string, string>
}

export interface RefundResult {
  success: boolean
  message: string
  refundId?: string
  amount?: number
  status?: string
  error?: string
}

// ===== Refund Functions =====

/**
 * Process a refund through Stripe
 */
export async function processStripeRefund(request: RefundRequest): Promise<RefundResult> {
  const { orderId, amount, reason = 'requested_by_customer', metadata } = request

  try {
    // 1. Fetch the order with payment info
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        stripePaymentIntentId: true,
        stripeRefundId: true,
        paymentStatus: true,
        status: true,
      },
    })

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
        error: 'ORDER_NOT_FOUND',
      }
    }

    // 2. Check if already refunded
    if (order.stripeRefundId) {
      return {
        success: false,
        message: 'Order has already been refunded',
        error: 'ALREADY_REFUNDED',
        refundId: order.stripeRefundId,
      }
    }

    // 3. Check if we have a payment intent ID
    if (!order.stripePaymentIntentId) {
      return {
        success: false,
        message: 'No payment intent found for this order. Manual refund may be required.',
        error: 'NO_PAYMENT_INTENT',
      }
    }

    // 4. Calculate refund amount (in cents for Stripe)
    const refundAmountCents = amount 
      ? Math.round(amount * 100)
      : Math.round(order.total * 100)

    // 5. Process refund through Stripe
    let refund: Stripe.Refund
    try {
      refund = await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        amount: refundAmountCents,
        reason,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          ...metadata,
        },
      })
    } catch (stripeError) {
      const error = stripeError as Stripe.errors.StripeError
      console.error('Stripe refund error:', error)
      
      // Handle specific Stripe errors
      if (error.code === 'charge_already_refunded') {
        return {
          success: false,
          message: 'This charge has already been refunded',
          error: 'ALREADY_REFUNDED',
        }
      }
      
      if (error.code === 'charge_expired_for_capture') {
        return {
          success: false,
          message: 'The charge has expired and cannot be refunded',
          error: 'CHARGE_EXPIRED',
        }
      }

      return {
        success: false,
        message: error.message || 'Failed to process refund with Stripe',
        error: 'STRIPE_ERROR',
      }
    }

    // 6. Update order with refund info
    const refundAmountDollars = refundAmountCents / 100
    const isFullRefund = refundAmountDollars >= order.total

    await prisma.order.update({
      where: { id: orderId },
      data: {
        stripeRefundId: refund.id,
        status: isFullRefund ? 'REFUNDED' : order.status,
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PAID',
        internalNotes: {
          set: order.status === 'REFUNDED' 
            ? undefined
            : `Refund ${refund.id}: $${refundAmountDollars.toFixed(2)} processed on ${new Date().toISOString()}`,
        },
      },
    })

    return {
      success: true,
      message: `Refund of $${refundAmountDollars.toFixed(2)} processed successfully`,
      refundId: refund.id,
      amount: refundAmountDollars,
      status: refund.status ?? undefined,
    }
  } catch (error) {
    console.error('Error processing refund:', error)
    return {
      success: false,
      message: 'An unexpected error occurred while processing the refund',
      error: 'INTERNAL_ERROR',
    }
  }
}

/**
 * Get refund status from Stripe
 */
export async function getRefundStatus(refundId: string): Promise<{
  status: string | null
  amount: number | null
  created: Date | null
  error?: string
}> {
  try {
    const refund = await stripe.refunds.retrieve(refundId)
    
    return {
      status: refund.status,
      amount: refund.amount / 100, // Convert from cents
      created: new Date(refund.created * 1000),
    }
  } catch (error) {
    console.error('Error fetching refund status:', error)
    return {
      status: null,
      amount: null,
      created: null,
      error: 'Failed to fetch refund status',
    }
  }
}

/**
 * Check if an order is eligible for Stripe refund
 */
export async function checkStripeRefundEligibility(orderId: string): Promise<{
  eligible: boolean
  reason?: string
  paymentIntentId?: string
  maxRefundAmount?: number
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      total: true,
      stripePaymentIntentId: true,
      stripeRefundId: true,
      paymentStatus: true,
      status: true,
    },
  })

  if (!order) {
    return {
      eligible: false,
      reason: 'Order not found',
    }
  }

  if (order.stripeRefundId) {
    return {
      eligible: false,
      reason: 'Order has already been refunded',
    }
  }

  if (order.paymentStatus !== 'PAID') {
    return {
      eligible: false,
      reason: `Order payment status is ${order.paymentStatus}, cannot refund`,
    }
  }

  if (!order.stripePaymentIntentId) {
    return {
      eligible: false,
      reason: 'No Stripe payment intent found for this order',
    }
  }

  return {
    eligible: true,
    paymentIntentId: order.stripePaymentIntentId,
    maxRefundAmount: order.total,
  }
}
