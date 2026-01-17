import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { awardBirthdayPoints } from '@/lib/loyalty/service'
import { sendBirthdayBonusEmail, sendPointsExpiringEmail } from '@/lib/email/loyalty'
import { getTrackingInfo } from '@/lib/shipping/tracking'

/**
 * POST /api/cron/run-all
 * 
 * Unified cron job that runs all scheduled tasks in sequence.
 * This allows us to stay within Vercel's free tier limit of 2 cron jobs.
 * 
 * Tasks run:
 * - Birthday points (only at hour 0 UTC)
 * - Expire points (only at hour 1 UTC)
 * - Sync tracking (every run)
 * - Track abandoned carts (every run)
 * 
 * Schedule: Runs hourly via Vercel Cron
 * Security: Bearer token authentication via CRON_SECRET
 */

interface TaskResult {
  task: string
  success: boolean
  skipped?: boolean
  message: string
  details?: Record<string, unknown>
  error?: string
}

// Verify cron secret
async function verifyCronSecret(): Promise<boolean> {
  const authHeader = (await headers()).get('authorization')
  const expectedSecret = process.env.CRON_SECRET
  
  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable is not set')
    return false
  }
  
  return authHeader === `Bearer ${expectedSecret}`
}

// ============================================
// TASK 1: Birthday Points (runs at hour 0 UTC)
// ============================================
async function runBirthdayPoints(currentHour: number): Promise<TaskResult> {
  // Only run at midnight UTC
  if (currentHour !== 0) {
    return {
      task: 'birthday-points',
      success: true,
      skipped: true,
      message: `Skipped - only runs at hour 0, current hour is ${currentHour}`,
    }
  }

  try {
    const today = new Date()
    const todayMonth = today.getMonth() + 1
    const todayDay = today.getDate()

    const customers = await prisma.customer.findMany({
      where: { birthday: { not: null } },
      select: { id: true, email: true, name: true, birthday: true },
    })

    const birthdayCustomers = customers.filter((customer) => {
      if (!customer.birthday) return false
      const birthday = new Date(customer.birthday)
      return birthday.getMonth() + 1 === todayMonth && birthday.getDate() === todayDay
    })

    let awarded = 0
    let emailsSent = 0

    for (const customer of birthdayCustomers) {
      try {
        const transaction = await awardBirthdayPoints(customer.id)
        awarded++

        const updatedCustomer = await prisma.customer.findUnique({
          where: { id: customer.id },
          select: { currentPoints: true, loyaltyTier: { select: { name: true } } },
        })

        if (customer.email) {
          try {
            await sendBirthdayBonusEmail({
              customerEmail: customer.email,
              customerName: customer.name || 'Friend',
              pointsAwarded: transaction.points,
              currentPoints: updatedCustomer?.currentPoints || transaction.points,
              tierName: updatedCustomer?.loyaltyTier?.name || 'Member',
            })
            emailsSent++
          } catch (emailError) {
            console.error(`Failed to send birthday email to ${customer.email}:`, emailError)
          }
        }
      } catch (err) {
        console.error(`Failed to award birthday points to ${customer.id}:`, err)
      }
    }

    return {
      task: 'birthday-points',
      success: true,
      message: `Processed ${birthdayCustomers.length} birthday customers`,
      details: { customersFound: birthdayCustomers.length, pointsAwarded: awarded, emailsSent },
    }
  } catch (error) {
    return {
      task: 'birthday-points',
      success: false,
      message: 'Failed to process birthday points',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================
// TASK 2: Expire Points (runs at hour 1 UTC)
// ============================================
async function runExpirePoints(currentHour: number): Promise<TaskResult> {
  // Only run at 1 AM UTC
  if (currentHour !== 1) {
    return {
      task: 'expire-points',
      success: true,
      skipped: true,
      message: `Skipped - only runs at hour 1, current hour is ${currentHour}`,
    }
  }

  try {
    const now = new Date()
    const results = { expired: 0, warningsSent30Day: 0, warningsSent7Day: 0 }

    // Process expired points
    const expiredTransactions = await prisma.pointsTransaction.findMany({
      where: {
        expiresAt: { lte: now },
        isExpired: false,
        points: { gt: 0 },
      },
      include: { customer: true },
    })

    for (const transaction of expiredTransactions) {
      try {
        await prisma.pointsTransaction.update({
          where: { id: transaction.id },
          data: { isExpired: true },
        })

        await prisma.customer.update({
          where: { id: transaction.customerId },
          data: { currentPoints: { decrement: transaction.points } },
        })

        await prisma.pointsTransaction.create({
          data: {
            customerId: transaction.customerId,
            points: -transaction.points,
            type: 'EXPIRATION',
            description: `${transaction.points} Care Points expired after 12 months`,
          },
        })

        results.expired++
      } catch (err) {
        console.error(`Failed to expire transaction ${transaction.id}:`, err)
      }
    }

    // Send 30-day warnings
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const nearExpiring30Day = await prisma.pointsTransaction.findMany({
      where: {
        expiresAt: { gt: now, lte: thirtyDaysFromNow },
        isExpired: false,
        points: { gt: 0 },
        NOT: { metadata: { contains: '"warning30Sent":true' } },
      },
      include: { customer: { select: { id: true, email: true, name: true, currentPoints: true } } },
    })

    const customersNeedingWarning30 = new Map<string, { email: string; name: string; points: number; currentPoints: number; earliestExpiry: Date }>()
    
    for (const transaction of nearExpiring30Day) {
      if (!transaction.customer?.email || !transaction.expiresAt) continue
      
      const existing = customersNeedingWarning30.get(transaction.customerId)
      if (!existing) {
        customersNeedingWarning30.set(transaction.customerId, {
          email: transaction.customer.email,
          name: transaction.customer.name || 'Friend',
          points: transaction.points,
          currentPoints: transaction.customer.currentPoints || 0,
          earliestExpiry: transaction.expiresAt,
        })
      } else {
        existing.points += transaction.points
        if (transaction.expiresAt < existing.earliestExpiry) {
          existing.earliestExpiry = transaction.expiresAt
        }
      }
    }

    for (const [customerId, data] of customersNeedingWarning30) {
      try {
        await sendPointsExpiringEmail({
          customerEmail: data.email,
          customerName: data.name,
          expiringPoints: data.points,
          expirationDate: data.earliestExpiry,
          daysUntilExpiration: 30,
          currentPoints: data.currentPoints,
        })
        results.warningsSent30Day++
        
        // Mark as sent
        await prisma.pointsTransaction.updateMany({
          where: { customerId, expiresAt: { gt: now, lte: thirtyDaysFromNow }, isExpired: false },
          data: { metadata: JSON.stringify({ warning30Sent: true }) },
        })
      } catch (err) {
        console.error(`Failed to send 30-day warning to ${data.email}:`, err)
      }
    }

    // Send 7-day warnings
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const nearExpiring7Day = await prisma.pointsTransaction.findMany({
      where: {
        expiresAt: { gt: now, lte: sevenDaysFromNow },
        isExpired: false,
        points: { gt: 0 },
        NOT: { metadata: { contains: '"warning7Sent":true' } },
      },
      include: { customer: { select: { id: true, email: true, name: true, currentPoints: true } } },
    })

    const customersNeedingWarning7 = new Map<string, { email: string; name: string; points: number; currentPoints: number; earliestExpiry: Date }>()
    
    for (const transaction of nearExpiring7Day) {
      if (!transaction.customer?.email || !transaction.expiresAt) continue
      
      const existing = customersNeedingWarning7.get(transaction.customerId)
      if (!existing) {
        customersNeedingWarning7.set(transaction.customerId, {
          email: transaction.customer.email,
          name: transaction.customer.name || 'Friend',
          points: transaction.points,
          currentPoints: transaction.customer.currentPoints || 0,
          earliestExpiry: transaction.expiresAt,
        })
      } else {
        existing.points += transaction.points
        if (transaction.expiresAt < existing.earliestExpiry) {
          existing.earliestExpiry = transaction.expiresAt
        }
      }
    }

    for (const [customerId, data] of customersNeedingWarning7) {
      try {
        await sendPointsExpiringEmail({
          customerEmail: data.email,
          customerName: data.name,
          expiringPoints: data.points,
          expirationDate: data.earliestExpiry,
          daysUntilExpiration: 7,
          currentPoints: data.currentPoints,
        })
        results.warningsSent7Day++
        
        await prisma.pointsTransaction.updateMany({
          where: { customerId, expiresAt: { gt: now, lte: sevenDaysFromNow }, isExpired: false },
          data: { metadata: JSON.stringify({ warning7Sent: true, warning30Sent: true }) },
        })
      } catch (err) {
        console.error(`Failed to send 7-day warning to ${data.email}:`, err)
      }
    }

    return {
      task: 'expire-points',
      success: true,
      message: `Processed point expirations and warnings`,
      details: results,
    }
  } catch (error) {
    return {
      task: 'expire-points',
      success: false,
      message: 'Failed to process point expirations',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================
// TASK 3: Sync Tracking (every run)
// ============================================
async function runSyncTracking(): Promise<TaskResult> {
  try {
    const ordersToSync = await prisma.order.findMany({
      where: {
        trackingNumber: { not: null },
        status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingNumber: true,
        carrier: true,
      },
      take: 50,
      orderBy: { updatedAt: 'asc' },
    })

    if (ordersToSync.length === 0) {
      return {
        task: 'sync-tracking',
        success: true,
        message: 'No orders to sync',
        details: { synced: 0, updated: 0 },
      }
    }

    let synced = 0
    let updated = 0

    for (const order of ordersToSync) {
      try {
        if (!order.trackingNumber) continue

        const trackingData = await getTrackingInfo(order.trackingNumber, order.carrier || undefined)
        synced++

        if (trackingData.status === 'delivered' && order.status !== 'DELIVERED') {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'DELIVERED',
              deliveredAt: trackingData.deliveredAt ? new Date(trackingData.deliveredAt) : new Date(),
            },
          })
          updated++
        } else if (
          ['in_transit', 'out_for_delivery'].includes(trackingData.status) &&
          ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)
        ) {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'SHIPPED' },
          })
          updated++
        }
      } catch (err) {
        console.error(`Failed to sync order ${order.orderNumber}:`, err)
      }
    }

    return {
      task: 'sync-tracking',
      success: true,
      message: `Synced ${synced} orders, updated ${updated}`,
      details: { synced, updated },
    }
  } catch (error) {
    return {
      task: 'sync-tracking',
      success: false,
      message: 'Failed to sync tracking',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================
// TASK 4: Track Abandoned Carts (every run)
// ============================================
async function runTrackAbandonedCarts(): Promise<TaskResult> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const cartItems = await prisma.cartItem.findMany({
      where: { createdAt: { lt: oneHourAgo } },
      include: { customer: true, product: true, productVariant: true },
      orderBy: { customerId: 'asc' },
    })

    const cartsByCustomer = new Map<string, typeof cartItems>()
    for (const item of cartItems) {
      const existing = cartsByCustomer.get(item.customerId) || []
      existing.push(item)
      cartsByCustomer.set(item.customerId, existing)
    }

    let created = 0
    let updated = 0

    for (const [customerId, items] of cartsByCustomer) {
      const customer = items[0].customer

      const existing = await prisma.abandonedCart.findFirst({
        where: { customerId, recovered: false, expiresAt: { gt: new Date() } },
      })

      const cartItemsData = items.map((item) => ({
        productName: item.product.name,
        variantName: item.productVariant
          ? `${item.productVariant.size || ''}${item.productVariant.size && item.productVariant.color ? ' - ' : ''}${item.productVariant.color || ''}`
          : undefined,
        quantity: item.quantity,
        price: item.productVariant?.price || item.product.price,
      }))

      const totalValue = cartItemsData.reduce((sum, item) => sum + item.price * item.quantity, 0)

      if (existing) {
        await prisma.abandonedCart.update({
          where: { id: existing.id },
          data: {
            items: JSON.stringify(cartItemsData),
            totalValue,
            itemCount: items.length,
            abandonedAt: new Date(),
          },
        })
        updated++
      } else {
        await prisma.abandonedCart.create({
          data: {
            customerId,
            customerEmail: customer.email,
            customerName: customer.name,
            items: JSON.stringify(cartItemsData),
            totalValue,
            itemCount: items.length,
            expiresAt: thirtyDaysFromNow,
          },
        })
        created++
      }
    }

    return {
      task: 'track-abandoned-carts',
      success: true,
      message: `Processed ${cartsByCustomer.size} carts`,
      details: { cartsProcessed: cartsByCustomer.size, created, updated },
    }
  } catch (error) {
    return {
      task: 'track-abandoned-carts',
      success: false,
      message: 'Failed to track abandoned carts',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================
// MAIN HANDLER
// ============================================
export async function POST(_request: NextRequest) {
  // Verify authorization
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const currentHour = new Date().getUTCHours()
  const results: TaskResult[] = []

  console.log(`[run-all] Starting unified cron at hour ${currentHour} UTC`)

  // Run all tasks in sequence (continue on error)
  results.push(await runBirthdayPoints(currentHour))
  results.push(await runExpirePoints(currentHour))
  results.push(await runSyncTracking())
  results.push(await runTrackAbandonedCarts())

  const duration = Date.now() - startTime
  const allSuccess = results.every((r) => r.success)
  const skippedCount = results.filter((r) => r.skipped).length

  console.log(`[run-all] Completed in ${duration}ms - ${results.length} tasks, ${skippedCount} skipped`)

  return NextResponse.json({
    success: allSuccess,
    message: `Unified cron completed in ${duration}ms`,
    currentHourUTC: currentHour,
    duration: `${duration}ms`,
    tasks: results,
  })
}

// Also support GET for manual testing/health check
export async function GET(_request: NextRequest) {
  // Verify authorization
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    status: 'ok',
    message: 'Unified cron endpoint is healthy. Use POST to execute tasks.',
    tasks: ['birthday-points', 'expire-points', 'sync-tracking', 'track-abandoned-carts'],
    schedule: 'Hourly - daily tasks gated by UTC hour',
  })
}
