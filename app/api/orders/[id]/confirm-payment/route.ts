import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateCustomerStatsOnOrderCompletion } from '@/lib/crm/service'
import { awardReferralPoints } from '@/lib/loyalty/service'
import { recoverMissingLoyaltyForOrder } from '@/lib/loyalty/recovery'
import { sendOrderConfirmation } from '@/lib/email/resend'
import { auth } from '@/lib/auth/auth'

/**
 * POST /api/orders/[id]/confirm-payment
 * 
 * Called by the frontend after successful Stripe payment to:
 * 1. Update order status to CONFIRMED + PAID
 * 2. Award loyalty points to customer
 * 3. Send confirmation email
 * 
 * This serves as a fallback for when Stripe webhooks aren't working
 * (e.g., local development without stripe listen)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const body = await request.json()
    const { paymentIntentId } = body
    const session = await auth()
    const authenticatedCustomerId =
      session?.user?.id || request.cookies.get('auth_session')?.value || null

    // Get the order
    let order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        shippingAddress: true,
        customer: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // If the requester is authenticated and the emails match, ensure the order
    // is linked to that authenticated customer (prevents split accounts from
    // mixed-case checkout emails).
    if (authenticatedCustomerId && order.customerId !== authenticatedCustomerId) {
      const authenticatedCustomer = await prisma.customer.findUnique({
        where: { id: authenticatedCustomerId },
        select: { id: true, email: true },
      })

      if (
        authenticatedCustomer &&
        authenticatedCustomer.email.toLowerCase().trim() === order.customerEmail.toLowerCase().trim()
      ) {
        order = await prisma.order.update({
          where: { id: orderId },
          data: {
            customerId: authenticatedCustomer.id,
            customerEmail: authenticatedCustomer.email,
          },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
            shippingAddress: true,
            customer: true,
          },
        })
      }
    }

    // If order is already confirmed/paid, skip (webhook might have already processed it)
    if (order.status === 'CONFIRMED' && order.paymentStatus === 'PAID') {
      console.log(`Order ${orderId} already confirmed - skipping duplicate processing`)
      
      // Check if points were already awarded
      let pointsEarned = 0
      let tierUpgrade: string | undefined
      let recoveredLoyalty = false
      if (order.customerId) {
        const existingTransaction = await prisma.pointsTransaction.findFirst({
          where: {
            orderId,
            customerId: order.customerId,
            type: 'PURCHASE',
            points: { gt: 0 },
          },
          orderBy: { createdAt: 'desc' },
        })

        if (existingTransaction) {
          pointsEarned = existingTransaction.points
        } else {
          try {
            const recoveryResult = await recoverMissingLoyaltyForOrder(
              orderId,
              order.customerId,
              order.total
            )
            pointsEarned = recoveryResult.pointsEarned
            tierUpgrade = recoveryResult.tierUpgrade
            recoveredLoyalty = recoveryResult.recovered
          } catch (recoveryError) {
            console.error(`Failed loyalty recovery for confirmed order ${orderId}:`, recoveryError)
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Order already confirmed',
        alreadyProcessed: true,
        pointsEarned,
        tierUpgrade,
        recoveredLoyalty,
      })
    }

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        stripePaymentIntentId: paymentIntentId || null,
      },
    })
    console.log(`Order ${orderId} marked as CONFIRMED/PAID`)

    // Award loyalty points and update CRM stats
    let pointsEarned = 0
    let tierUpgrade: string | undefined
    let recoveredLoyalty = false

    if (order.customerId) {
      try {
        // Check if customer was referred (for referral bonus)
        const customer = await prisma.customer.findUnique({
          where: { id: order.customerId },
          select: { referredBy: true },
        })

        // Update CRM stats, award points, check tier upgrade - all in one call
        const crmResult = await updateCustomerStatsOnOrderCompletion(
          order.customerId,
          orderId,
          order.total
        )

        console.log(`✅ CRM integration completed for order ${orderId}:`, crmResult)

        // Get the points that were just awarded
        const pointsTransaction = await prisma.pointsTransaction.findFirst({
          where: {
            orderId,
            customerId: order.customerId,
            type: 'PURCHASE',
            points: { gt: 0 },
          },
          orderBy: { createdAt: 'desc' },
        })
        pointsEarned = pointsTransaction?.points || 0
        tierUpgrade = crmResult?.tierUpgrade

        // Award referral points if this was the first purchase and customer was referred
        if (crmResult?.isFirstOrder && customer?.referredBy) {
          await awardReferralPoints(customer.referredBy, order.customerId)
          console.log(`Awarded referral points to customer ${customer.referredBy}`)
        }
      } catch (loyaltyError) {
        // Log error but don't fail the request
        console.error(`Failed to process CRM/loyalty for order ${orderId}:`, loyaltyError)

        try {
          const recoveryResult = await recoverMissingLoyaltyForOrder(
            orderId,
            order.customerId,
            order.total
          )
          pointsEarned = recoveryResult.pointsEarned
          tierUpgrade = recoveryResult.tierUpgrade || tierUpgrade
          recoveredLoyalty = recoveryResult.recovered
        } catch (recoveryError) {
          console.error(`Failed loyalty recovery for order ${orderId}:`, recoveryError)
        }
      }
    }

    // Send order confirmation email
    try {
      await sendOrderConfirmation({
        to: order.customerEmail,
        orderNumber: order.orderNumber,
        customerName: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
        items: order.items.map((item) => ({
          productName: item.product.name,
          variantDetails: item.variantDetails || 'N/A',
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: order.subtotal,
        shipping: order.shipping,
        tax: order.tax,
        total: order.total,
        shippingAddress: {
          firstName: order.shippingAddress.firstName,
          lastName: order.shippingAddress.lastName,
          addressLine1: order.shippingAddress.address1,
          addressLine2: order.shippingAddress.address2 || undefined,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          zipCode: order.shippingAddress.postalCode,
        },
      })
      console.log(`Order confirmation email sent for order ${orderId}`)
    } catch (emailError) {
      // Log error but don't fail the request
      console.error(`Failed to send order confirmation email for order ${orderId}:`, emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Order confirmed and points awarded',
      pointsEarned,
      tierUpgrade,
      recoveredLoyalty,
    })
  } catch (error) {
    console.error('Error confirming payment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
