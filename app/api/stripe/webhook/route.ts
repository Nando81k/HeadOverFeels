import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/config'
import { prisma } from '@/lib/prisma'
import { enqueueEmail } from '@/lib/email/queue'
import { notifyOrderStatus } from '@/lib/notifications/service'
import { updateCustomerStatsOnOrderCompletion } from '@/lib/crm/service'
import { awardReferralPoints } from '@/lib/loyalty/service'
import { recoverMissingLoyaltyForOrder } from '@/lib/loyalty/recovery'
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

    // Idempotency guard: record this event before any side effects.
    // If Stripe retries, the unique PK constraint raises P2002 and we return
    // 200 immediately — short-circuiting all per-event logic.
    // Trade-off: event is marked processed BEFORE the handler runs, so a
    // mid-handler crash will not be retried by Stripe. Acceptable for Wave 1
    // vs. duplicate-effect risk. Follow-up: per-side-effect idempotency keys.
    try {
      await prisma.processedWebhookEvent.create({
        data: { stripeEventId: event.id, eventType: event.type },
      });
    } catch (err) {
      // P2002 = unique constraint violation — already processed
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw err;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log('Payment succeeded:', paymentIntent.id)

        // Wave 3A: the order ALWAYS exists here — it was created atomically in
        // POST /api/orders (along with the PI) before the customer ever saw the
        // payment form. This handler only updates an existing order's status; it
        // never creates a new order. stripePaymentIntentId is already set on the
        // row, but we write it again as a safe no-op for idempotency.
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

            // Enqueue order confirmation email for durable delivery with retry.
            // The webhook no longer awaits a Resend HTTP call — a Resend outage
            // will not drop the receipt; the cron at /api/cron/process-email-queue
            // drains the queue every 5 min with exponential backoff (max 5 attempts).
            try {
              await enqueueEmail({
                type: 'order-confirmation',
                recipient: order.customerEmail,
                payload: {
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
                },
              })
              console.log(`Order confirmation email queued for order ${orderId}`)
            } catch (emailError) {
              // Log error but don't fail the webhook — the row may still have
              // been written; the cron will pick it up on the next run.
              console.error(`Failed to enqueue order confirmation email for order ${orderId}:`, emailError)
            }

            // Write in-app notification (signed-in customers only). Wrapped
            // separately from the email send so a notification failure can't
            // mask an email failure or vice versa.
            if (order.customerId) {
              try {
                await notifyOrderStatus(order.customerId, order.orderNumber, 'confirmed')
              } catch (notifError) {
                console.error(`Failed to write order-confirmed notification for ${orderId}:`, notifError)
              }
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

                // Award referral points if this was the first purchase and customer was referred.
                // Stable per-event key ensures webhook retries cannot double-award.
                if (crmResult?.isFirstOrder && customer?.referredBy) {
                  await awardReferralPoints(
                    customer.referredBy,
                    order.customerId,
                    `stripe-evt-${event.id}-referral`
                  )
                  console.log(`Awarded referral points to customer ${customer.referredBy}`)
                }
              } catch (loyaltyError) {
                // Log error but don't fail the webhook
                console.error(`Failed to process CRM/loyalty for order ${orderId}:`, loyaltyError)

                try {
                  const recoveryResult = await recoverMissingLoyaltyForOrder(
                    orderId,
                    order.customerId,
                    order.total
                  )
                  if (recoveryResult.recovered) {
                    console.log(`Recovered missing loyalty points for order ${orderId}:`, recoveryResult)
                  }
                } catch (recoveryError) {
                  console.error(`Failed loyalty recovery for order ${orderId}:`, recoveryError)
                }
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

        // Wave 3A: the order ALWAYS exists at this point (created atomically in
        // POST /api/orders before the PI was presented to the customer). This
        // handler only updates status — it never creates an order.
        const orderId = paymentIntent.metadata?.orderId
        if (orderId) {
          try {
            await prisma.order.update({
              where: { id: orderId },
              data: {
                status: 'CANCELLED',
                paymentStatus: 'FAILED',
              },
            })
            console.log(`Order ${orderId} marked as FAILED`)
          } catch (error) {
            console.error(`Failed to update order ${orderId} to FAILED:`, error)
          }
        }

        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log('PaymentIntent canceled:', paymentIntent.id)

        // Wave 3A: mark the pre-existing order as CANCELLED and restore inventory
        // so the reserved stock becomes available again. The order row was created
        // atomically when the PI was created, so it always exists here.
        const orderId = paymentIntent.metadata?.orderId
        if (orderId) {
          try {
            // Fetch order items to restore inventory
            const order = await prisma.order.findUnique({
              where: { id: orderId },
              include: { items: true },
            })

            if (order) {
              await prisma.$transaction(async (tx) => {
                // Restore inventory for each variant that was decremented at order time
                for (const item of order.items) {
                  if (item.productVariantId) {
                    await tx.productVariant.update({
                      where: { id: item.productVariantId },
                      data: { inventory: { increment: item.quantity } },
                    })
                  }
                }

                await tx.order.update({
                  where: { id: orderId },
                  data: {
                    status: 'CANCELLED',
                    paymentStatus: 'FAILED',
                  },
                })
              })
              console.log(`Order ${orderId} canceled and inventory restored`)
            }
          } catch (error) {
            console.error(`Failed to cancel order ${orderId}:`, error)
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
