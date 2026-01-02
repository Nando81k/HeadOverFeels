import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { sendPointsExpiringEmail } from '@/lib/email/loyalty'

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// It's protected by a secret key in the Authorization header

// POST /api/cron/expire-points - Process point expirations and send warnings
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = (await headers()).get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const now = new Date()
    const results = {
      expired: 0,
      warningsSent30Day: 0,
      warningsSent7Day: 0,
      errors: [] as string[],
    }

    // 1. Process expired points
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
        // Mark as expired
        await prisma.pointsTransaction.update({
          where: { id: transaction.id },
          data: { isExpired: true },
        })

        // Deduct from customer
        await prisma.customer.update({
          where: { id: transaction.customerId },
          data: {
            currentPoints: { decrement: transaction.points },
          },
        })

        // Create expiration transaction
        await prisma.pointsTransaction.create({
          data: {
            customerId: transaction.customerId,
            points: -transaction.points,
            type: 'EXPIRATION',
            description: `${transaction.points} Care Points expired after 12 months`,
          },
        })

        results.expired++

        // TODO: Send expiration notification email to customer
        console.log(`Expired ${transaction.points} points for customer ${transaction.customer?.email || transaction.customerId}`)
      } catch (err) {
        results.errors.push(`Failed to expire transaction ${transaction.id}: ${err}`)
      }
    }

    // 2. Send 30-day expiration warnings
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const nearExpiring30Day = await prisma.pointsTransaction.findMany({
      where: {
        expiresAt: {
          gt: now,
          lte: thirtyDaysFromNow,
        },
        isExpired: false,
        points: { gt: 0 },
        // Check metadata doesn't have 30-day warning sent flag
        NOT: {
          metadata: {
            contains: '"warning30Sent":true',
          },
        },
      },
      include: { customer: true },
    })

    // Group by customer to send one email per customer
    const customersNeedingWarning30 = new Map<string, { email: string; name: string; points: number; earliestExpiry: Date }>()
    
    for (const transaction of nearExpiring30Day) {
      if (!transaction.customer?.email) continue
      
      const existing = customersNeedingWarning30.get(transaction.customerId)
      if (existing) {
        existing.points += transaction.points
        if (transaction.expiresAt && transaction.expiresAt < existing.earliestExpiry) {
          existing.earliestExpiry = transaction.expiresAt
        }
      } else {
        customersNeedingWarning30.set(transaction.customerId, {
          email: transaction.customer.email,
          name: transaction.customer.name || 'Customer',
          points: transaction.points,
          earliestExpiry: transaction.expiresAt || thirtyDaysFromNow,
        })
      }

      // Mark as warned
      await prisma.pointsTransaction.update({
        where: { id: transaction.id },
        data: {
          metadata: JSON.stringify({
            ...JSON.parse(transaction.metadata || '{}'),
            warning30Sent: true,
            warning30SentAt: now.toISOString(),
          }),
        },
      })
    }

    // Send 30-day warning emails
    results.warningsSent30Day = customersNeedingWarning30.size
    for (const [customerId, data] of customersNeedingWarning30) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { currentPoints: true },
        })
        
        await sendPointsExpiringEmail({
          customerEmail: data.email,
          customerName: data.name,
          expiringPoints: data.points,
          expirationDate: data.earliestExpiry,
          daysUntilExpiration: 30,
          currentPoints: customer?.currentPoints || data.points,
        })
        console.log(`30-day warning email sent to ${data.email} for ${data.points} points`)
      } catch (emailErr) {
        console.error(`Failed to send 30-day warning to ${data.email}:`, emailErr)
        results.errors.push(`Failed to send 30-day warning to ${data.email}`)
      }
    }

    // 3. Send 7-day expiration warnings
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const nearExpiring7Day = await prisma.pointsTransaction.findMany({
      where: {
        expiresAt: {
          gt: now,
          lte: sevenDaysFromNow,
        },
        isExpired: false,
        points: { gt: 0 },
        // Has 30-day warning but not 7-day
        metadata: {
          contains: '"warning30Sent":true',
        },
        NOT: {
          metadata: {
            contains: '"warning7Sent":true',
          },
        },
      },
      include: { customer: true },
    })

    const customersNeedingWarning7 = new Map<string, { email: string; name: string; points: number; earliestExpiry: Date }>()
    
    for (const transaction of nearExpiring7Day) {
      if (!transaction.customer?.email) continue
      
      const existing = customersNeedingWarning7.get(transaction.customerId)
      if (existing) {
        existing.points += transaction.points
        if (transaction.expiresAt && transaction.expiresAt < existing.earliestExpiry) {
          existing.earliestExpiry = transaction.expiresAt
        }
      } else {
        customersNeedingWarning7.set(transaction.customerId, {
          email: transaction.customer.email,
          name: transaction.customer.name || 'Customer',
          points: transaction.points,
          earliestExpiry: transaction.expiresAt || sevenDaysFromNow,
        })
      }

      // Mark as warned
      await prisma.pointsTransaction.update({
        where: { id: transaction.id },
        data: {
          metadata: JSON.stringify({
            ...JSON.parse(transaction.metadata || '{}'),
            warning7Sent: true,
            warning7SentAt: now.toISOString(),
          }),
        },
      })
    }

    // Send 7-day warning emails (more urgent)
    results.warningsSent7Day = customersNeedingWarning7.size
    for (const [customerId, data] of customersNeedingWarning7) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { currentPoints: true },
        })
        
        await sendPointsExpiringEmail({
          customerEmail: data.email,
          customerName: data.name,
          expiringPoints: data.points,
          expirationDate: data.earliestExpiry,
          daysUntilExpiration: 7,
          currentPoints: customer?.currentPoints || data.points,
        })
        console.log(`7-day warning email sent to ${data.email} for ${data.points} points`)
      } catch (emailErr) {
        console.error(`Failed to send 7-day warning to ${data.email}:`, emailErr)
        results.errors.push(`Failed to send 7-day warning to ${data.email}`)
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.expired} expirations, sent ${results.warningsSent30Day} 30-day warnings, ${results.warningsSent7Day} 7-day warnings`,
    })
  } catch (error) {
    console.error('Failed to process point expirations:', error)
    return NextResponse.json(
      { error: 'Failed to process expirations' },
      { status: 500 }
    )
  }
}

// GET /api/cron/expire-points - Get expiration stats
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = (await headers()).get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    // Count points expiring in next 30 days
    const expiringIn30Days = await prisma.pointsTransaction.aggregate({
      where: {
        expiresAt: {
          gt: now,
          lte: thirtyDaysFromNow,
        },
        isExpired: false,
        points: { gt: 0 },
      },
      _sum: { points: true },
      _count: true,
    })

    // Count already expired (not processed)
    const alreadyExpired = await prisma.pointsTransaction.aggregate({
      where: {
        expiresAt: { lte: now },
        isExpired: false,
        points: { gt: 0 },
      },
      _sum: { points: true },
      _count: true,
    })

    // Total points with expiration set
    const totalWithExpiration = await prisma.pointsTransaction.aggregate({
      where: {
        expiresAt: { not: null },
        isExpired: false,
        points: { gt: 0 },
      },
      _sum: { points: true },
      _count: true,
    })

    return NextResponse.json({
      stats: {
        expiringIn30Days: {
          points: expiringIn30Days._sum.points || 0,
          transactions: expiringIn30Days._count || 0,
        },
        pendingExpiration: {
          points: alreadyExpired._sum.points || 0,
          transactions: alreadyExpired._count || 0,
        },
        totalTracked: {
          points: totalWithExpiration._sum.points || 0,
          transactions: totalWithExpiration._count || 0,
        },
      },
    })
  } catch (error) {
    console.error('Failed to get expiration stats:', error)
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}
