import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/config'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmation } from '@/lib/email/resend'
import { updateCustomerStatsOnOrderCompletion } from '@/lib/crm/service'
import { awardReferralPoints } from '@/lib/loyalty/service'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// POST /api/stripe/webhook - Handle Stripe webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log('Payment succeeded:', paymentIntent.id)
        
        // Update order status if orderId is in metadata
        const orderId = paymentIntent.metadata?.orderId
        if (orderId) {
          try {
            const order = await prisma.order.update({
              where: { id: orderId },
              data: { 
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                stripePaymentIntentId: paymentIntent.id, // Store for refunds
              },
              include: {
                items: {
                  include: {
                    product: true,
                    productVariant: true,
                  },
                },
                shippingAddress: true,
                redemption: true, // Include coupon redemption
              },
            })
            console.log(`Order ${orderId} marked as PAID`)

            // Mark coupon/redemption as used
            if (order.redemptionId) {
              try {
                await prisma.rewardRedemption.update({
                  where: { id: order.redemptionId },
                  data: {
                    status: 'USED',
                    usedAt: new Date(),
                    orderId: order.id,
                  },
                })
                console.log(`Coupon ${order.couponCode} marked as used for order ${orderId}`)
              } catch (couponError) {
                console.error(`Failed to mark coupon as used for order ${orderId}:`, couponError)
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
              // Log error but don't fail the webhook
              console.error(`Failed to send order confirmation email for order ${orderId}:`, emailError)
            }

            // Release cart reservations if sessionId is present
            const sessionId = paymentIntent.metadata?.sessionId
            if (sessionId) {
              try {
                // Delete cart reservations for this session
                await prisma.cartReservation.deleteMany({
                  where: { sessionId },
                })
                console.log(`Cart reservations released for session ${sessionId}`)
              } catch (reservationError) {
                console.error(`Failed to release cart reservations for session ${sessionId}:`, reservationError)
              }
            }

            // Reduce inventory for purchased items
            try {
              for (const item of order.items) {
                if (item.productVariantId) {
                  await prisma.productVariant.update({
                    where: { id: item.productVariantId },
                    data: {
                      inventory: {
                        decrement: item.quantity,
                      },
                    },
                  })
                }
              }
              console.log(`Inventory reduced for order ${orderId}`)
            } catch (inventoryError) {
              console.error(`Failed to reduce inventory for order ${orderId}:`, inventoryError)
            }

            // Award loyalty points and update CRM stats
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

                // Award referral points if this was the first purchase and customer was referred
                if (crmResult?.isFirstOrder && customer?.referredBy) {
                  await awardReferralPoints(customer.referredBy, order.customerId)
                  console.log(`Awarded referral points to customer ${customer.referredBy}`)
                }
              } catch (loyaltyError) {
                // Log error but don't fail the webhook
                console.error(`Failed to process CRM/loyalty for order ${orderId}:`, loyaltyError)
              }

              // Unlock avatar items for purchased products
              try {
                const orderWithAvatarItems = await prisma.order.findUnique({
                  where: { id: orderId },
                  include: {
                    items: {
                      include: {
                        product: {
                          include: {
                            avatarItems: true,
                          },
                        },
                      },
                    },
                  },
                })

                if (orderWithAvatarItems) {
                  const avatarItemsToUnlock: string[] = []
                  for (const orderItem of orderWithAvatarItems.items) {
                    if (orderItem.product.avatarItems && orderItem.product.avatarItems.length > 0) {
                      avatarItemsToUnlock.push(
                        ...orderItem.product.avatarItems.map((item) => item.id)
                      )
                    }
                  }

                  if (avatarItemsToUnlock.length > 0) {
                    const unlockPromises = avatarItemsToUnlock.map((avatarItemId) =>
                      prisma.userAvatarItem.upsert({
                        where: {
                          customerId_avatarItemId: {
                            customerId: order.customerId!,
                            avatarItemId,
                          },
                        },
                        update: {},
                        create: {
                          customerId: order.customerId!,
                          avatarItemId,
                          unlockedVia: 'purchase',
                          orderId,
                        },
                      })
                    )

                    await Promise.all(unlockPromises)
                    console.log(`✅ Unlocked ${avatarItemsToUnlock.length} avatar item(s) for order ${orderId}`)
                  }
                }
              } catch (avatarError) {
                // Log error but don't fail the webhook
                console.error(`Failed to unlock avatar items for order ${orderId}:`, avatarError)
              }
            } else {
              console.log(`Order ${orderId} has no customerId - skipping CRM/loyalty`)
            }
          } catch (error) {
            console.error(`Failed to update order ${orderId}:`, error)
          }
        } else {
          console.warn('Payment succeeded but no orderId in metadata:', paymentIntent.id)
        }
        
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log('Payment failed:', paymentIntent.id)
        
        // Update order status if orderId is in metadata
        const orderId = paymentIntent.metadata?.orderId
        if (orderId) {
          try {
            await prisma.order.update({
              where: { id: orderId },
              data: { 
                status: 'CANCELLED',
                paymentStatus: 'FAILED'
              }
            })
            console.log(`Order ${orderId} marked as FAILED`)
          } catch (error) {
            console.error(`Failed to update order ${orderId}:`, error)
          }
        }
        
        break
      }

      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge
        console.log('Charge succeeded:', charge.id)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
