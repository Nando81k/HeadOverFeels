import { prisma } from '@/lib/prisma'

interface RefundEligibility {
  eligible: boolean
  reason?: string
  maxRefundAmount?: number
  daysRemaining?: number
}

/**
 * Check if an order is eligible for refund
 * Policy: 30 days from delivery, order must be delivered or shipped
 */
export async function checkRefundEligibility(
  orderId: string
): Promise<RefundEligibility> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    })

    if (!order) {
      return {
        eligible: false,
        reason: 'Order not found',
      }
    }

    // Check if already refunded
    if (order.status === 'REFUNDED' || order.paymentStatus === 'REFUNDED') {
      return {
        eligible: false,
        reason: 'Order has already been refunded',
      }
    }

    // Check if cancelled
    if (order.status === 'CANCELLED') {
      return {
        eligible: false,
        reason: 'Cannot refund a cancelled order',
      }
    }

    // Check if order is old enough to have been received
    const referenceDate = order.deliveredAt || order.shippedAt || order.createdAt
    const daysSinceReference = Math.floor(
      (Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // 30-day return window
    const RETURN_WINDOW_DAYS = 30

    if (daysSinceReference > RETURN_WINDOW_DAYS) {
      return {
        eligible: false,
        reason: `Return window expired. Returns must be initiated within ${RETURN_WINDOW_DAYS} days of delivery.`,
      }
    }

    // Calculate max refund (could be reduced for partial refunds, restocking fees, etc.)
    const maxRefundAmount = order.total - order.shipping // Typically shipping is non-refundable

    return {
      eligible: true,
      maxRefundAmount,
      daysRemaining: RETURN_WINDOW_DAYS - daysSinceReference,
    }
  } catch (error) {
    console.error('Error checking refund eligibility:', error)
    return {
      eligible: false,
      reason: 'Unable to verify refund eligibility',
    }
  }
}

/**
 * Calculate refund amount based on various factors
 */
export function calculateRefundAmount(options: {
  orderTotal: number
  shippingCost: number
  itemsToRefund?: { quantity: number; price: number }[]
  restockingFee?: number
  includeShipping?: boolean
}): number {
  const {
    orderTotal,
    shippingCost,
    itemsToRefund,
    restockingFee = 0,
    includeShipping = false,
  } = options

  let refundAmount = 0

  if (itemsToRefund && itemsToRefund.length > 0) {
    // Partial refund - only specific items
    refundAmount = itemsToRefund.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    )
  } else {
    // Full refund
    refundAmount = orderTotal
  }

  // Subtract shipping if not included
  if (!includeShipping) {
    refundAmount = Math.max(0, refundAmount - shippingCost)
  }

  // Apply restocking fee if applicable
  refundAmount = Math.max(0, refundAmount - restockingFee)

  return Math.round(refundAmount * 100) / 100 // Round to 2 decimals
}

/**
 * Generate return shipping label (placeholder - would integrate with shipping API)
 */
export async function generateReturnLabel(orderId: string): Promise<string> {
  // In production, this would integrate with:
  // - Shippo API
  // - EasyPost API
  // - Carrier-specific APIs (USPS, FedEx, UPS)
  
  // For now, return a placeholder
  return `https://returns.headoverfeels.com/label/${orderId}`
}

/**
 * Process refund request
 */
export async function initiateRefund(options: {
  ticketId: string
  orderId: string
  amount: number
  reason: string
  itemsToRefund?: string[] // Item IDs
}): Promise<{ success: boolean; message: string; refundId?: string }> {
  const { ticketId, orderId, amount, reason, itemsToRefund } = options

  try {
    // 1. Verify eligibility
    const eligibility = await checkRefundEligibility(orderId)
    
    if (!eligibility.eligible) {
      return {
        success: false,
        message: eligibility.reason || 'Order not eligible for refund',
      }
    }

    // 2. Check amount doesn't exceed max
    if (
      eligibility.maxRefundAmount &&
      amount > eligibility.maxRefundAmount
    ) {
      return {
        success: false,
        message: `Refund amount ($${amount}) exceeds maximum refundable amount ($${eligibility.maxRefundAmount})`,
      }
    }

    // 3. Process refund through payment gateway (Stripe in this case)
    // In production, integrate with Stripe API
    // const refund = await stripe.refunds.create({
    //   charge: order.stripeChargeId,
    //   amount: Math.round(amount * 100), // Convert to cents
    //   reason: 'requested_by_customer',
    // })

    // 4. Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
        internalNotes: `Refund of $${amount} processed via ticket ${ticketId}. Reason: ${reason}`,
      },
    })

    // 5. Update ticket
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolution: `Refund of $${amount} processed successfully`,
        resolvedAt: new Date(),
      },
    })

    // 6. Create internal message
    await prisma.supportMessage.create({
      data: {
        ticketId,
        message: `Refund of $${amount} has been initiated. Funds should appear in customer's account within 5-10 business days.`,
        senderType: 'admin',
        senderName: 'System',
        isInternal: false,
      },
    })

    return {
      success: true,
      message: 'Refund initiated successfully',
      refundId: `ref_${Date.now()}`, // Would be actual refund ID from payment processor
    }
  } catch (error) {
    console.error('Error processing refund:', error)
    return {
      success: false,
      message: 'Failed to process refund',
    }
  }
}

/**
 * Approve return request and generate shipping label
 */
export async function approveReturn(
  ticketId: string,
  orderId: string
): Promise<{ success: boolean; message: string; returnLabel?: string }> {
  try {
    // 1. Check eligibility
    const eligibility = await checkRefundEligibility(orderId)
    
    if (!eligibility.eligible) {
      return {
        success: false,
        message: eligibility.reason || 'Order not eligible for return',
      }
    }

    // 2. Generate return shipping label
    const returnLabel = await generateReturnLabel(orderId)

    // 3. Update ticket
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        returnApproved: true,
        returnLabel,
        status: 'WAITING_CUSTOMER',
      },
    })

    // 4. Add message with label
    await prisma.supportMessage.create({
      data: {
        ticketId,
        message: `Your return has been approved! Please use the prepaid shipping label to send your items back: ${returnLabel}

Once we receive your return, we'll process your refund within 3-5 business days.

Return Instructions:
1. Pack items securely in original packaging (if available)
2. Print the return label
3. Drop off at any authorized carrier location
4. Keep your tracking number for reference`,
        senderType: 'admin',
        senderName: 'Returns Team',
        isInternal: false,
      },
    })

    return {
      success: true,
      message: 'Return approved and shipping label generated',
      returnLabel,
    }
  } catch (error) {
    console.error('Error approving return:', error)
    return {
      success: false,
      message: 'Failed to approve return',
    }
  }
}
