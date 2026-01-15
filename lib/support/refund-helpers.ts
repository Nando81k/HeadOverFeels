import { prisma } from '@/lib/prisma'
import { processStripeRefund, checkStripeRefundEligibility } from '@/lib/stripe/refunds'
import { createReturnLabel, isEasyPostConfigured, type ReturnLabelResult } from '@/lib/shipping/easypost'

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
 * Generate return shipping label using EasyPost integration
 * Falls back to demo mode if API not configured
 */
export async function generateReturnLabel(orderId: string): Promise<{
  labelUrl: string
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
  qrCodeUrl?: string
  expiresAt?: Date
}> {
  // Use the EasyPost integration
  const result: ReturnLabelResult = await createReturnLabel(orderId)
  
  if (!result.success || !result.labelUrl) {
    // Return a fallback URL that explains the error
    console.error('[Returns] Failed to generate label:', result.error)
    return {
      labelUrl: `/api/shipping/label/${orderId}?error=generation_failed`,
    }
  }

  return {
    labelUrl: result.labelUrl,
    trackingNumber: result.trackingNumber,
    trackingUrl: result.trackingUrl,
    carrier: result.carrier,
    qrCodeUrl: result.qrCodeUrl,
    expiresAt: result.expiresAt,
  }
}

/**
 * Check if shipping API is configured for returns
 */
export function isReturnShippingConfigured(): boolean {
  return isEasyPostConfigured()
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
  const { ticketId, orderId, amount, reason, itemsToRefund: _itemsToRefund } = options

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

    // 3. Check Stripe eligibility
    const stripeEligibility = await checkStripeRefundEligibility(orderId)
    
    // 4. Process refund through Stripe
    if (stripeEligibility.eligible) {
      const stripeResult = await processStripeRefund({
        orderId,
        amount,
        reason: 'requested_by_customer',
        metadata: {
          ticketId,
          refundReason: reason,
        },
      })

      if (!stripeResult.success) {
        return {
          success: false,
          message: stripeResult.message,
        }
      }

      // Stripe refund successful - update ticket
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: 'RESOLVED',
          resolution: `Refund of $${amount} processed successfully (${stripeResult.refundId})`,
          resolvedAt: new Date(),
        },
      })

      // Create success message
      await prisma.supportMessage.create({
        data: {
          ticketId,
          message: `Refund of $${amount} has been processed. Funds should appear in your account within 5-10 business days.`,
          senderType: 'admin',
          senderName: 'System',
          isInternal: false,
        },
      })

      return {
        success: true,
        message: stripeResult.message,
        refundId: stripeResult.refundId,
      }
    }

    // 5. Fallback: Manual refund tracking (for orders without Stripe payment intent)
    // This handles legacy orders or alternative payment methods
    console.log(`Order ${orderId} requires manual refund processing - no Stripe payment intent found`)

    // Update order status manually
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
        internalNotes: `Manual refund of $${amount} processed via ticket ${ticketId}. Reason: ${reason}. Note: No Stripe payment intent - manual processing required.`,
      },
    })

    // Update ticket
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolution: `Manual refund of $${amount} recorded. Requires manual payment processing.`,
        resolvedAt: new Date(),
      },
    })

    // Create internal message
    await prisma.supportMessage.create({
      data: {
        ticketId,
        message: `Refund of $${amount} has been initiated. Funds should appear in your account within 5-10 business days.`,
        senderType: 'admin',
        senderName: 'System',
        isInternal: false,
      },
    })

    return {
      success: true,
      message: 'Refund initiated successfully (manual processing required)',
      refundId: `manual_ref_${Date.now()}`,
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
): Promise<{ 
  success: boolean
  message: string
  returnLabel?: string
  trackingNumber?: string
  qrCodeUrl?: string
}> {
  try {
    // 1. Check eligibility
    const eligibility = await checkRefundEligibility(orderId)
    
    if (!eligibility.eligible) {
      return {
        success: false,
        message: eligibility.reason || 'Order not eligible for return',
      }
    }

    // 2. Generate return shipping label via EasyPost
    const labelResult = await generateReturnLabel(orderId)

    // 3. Update ticket with label details
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        returnApproved: true,
        returnLabel: labelResult.labelUrl,
        status: 'WAITING_CUSTOMER',
      },
    })

    // 4. Build customer message with all available info
    let customerMessage = `Your return has been approved! 🎉\n\n`
    
    if (labelResult.carrier) {
      customerMessage += `**Carrier:** ${labelResult.carrier}\n`
    }
    
    if (labelResult.trackingNumber) {
      customerMessage += `**Tracking Number:** ${labelResult.trackingNumber}\n`
    }
    
    customerMessage += `\n**📄 Print Your Label:** ${labelResult.labelUrl}\n`
    
    if (labelResult.qrCodeUrl) {
      customerMessage += `\n**📱 Paperless Return:** Show this QR code at drop-off: ${labelResult.qrCodeUrl}\n`
    }
    
    if (labelResult.expiresAt) {
      customerMessage += `\n⏰ Label expires: ${labelResult.expiresAt.toLocaleDateString()}\n`
    }
    
    customerMessage += `
Once we receive your return, we'll process your refund within 3-5 business days.

**Return Instructions:**
1. Pack items securely in original packaging (if available)
2. Print the return label OR use the QR code for paperless returns
3. Drop off at any ${labelResult.carrier || 'authorized carrier'} location
4. Keep your tracking number for reference`

    // 5. Add message with label
    await prisma.supportMessage.create({
      data: {
        ticketId,
        message: customerMessage,
        senderType: 'admin',
        senderName: 'Returns Team',
        isInternal: false,
      },
    })

    return {
      success: true,
      message: 'Return approved and shipping label generated',
      returnLabel: labelResult.labelUrl,
      trackingNumber: labelResult.trackingNumber,
      qrCodeUrl: labelResult.qrCodeUrl,
    }
  } catch (error) {
    console.error('Error approving return:', error)
    return {
      success: false,
      message: 'Failed to approve return',
    }
  }
}
