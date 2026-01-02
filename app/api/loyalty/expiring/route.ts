import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/loyalty/expiring - Get customer's expiring points summary
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('auth_session')?.value

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: sessionId },
      select: { id: true, currentPoints: true },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const now = new Date()
    
    // Points expiring in next 30 days
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const expiring30Days = await prisma.pointsTransaction.aggregate({
      where: {
        customerId: customer.id,
        expiresAt: {
          gt: now,
          lte: thirtyDaysFromNow,
        },
        isExpired: false,
        points: { gt: 0 },
      },
      _sum: { points: true },
    })

    // Points expiring in next 7 days
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const expiring7Days = await prisma.pointsTransaction.aggregate({
      where: {
        customerId: customer.id,
        expiresAt: {
          gt: now,
          lte: sevenDaysFromNow,
        },
        isExpired: false,
        points: { gt: 0 },
      },
      _sum: { points: true },
    })

    // Get detailed breakdown of expiring transactions
    const expiringTransactions = await prisma.pointsTransaction.findMany({
      where: {
        customerId: customer.id,
        expiresAt: {
          gt: now,
          lte: thirtyDaysFromNow,
        },
        isExpired: false,
        points: { gt: 0 },
      },
      select: {
        id: true,
        points: true,
        type: true,
        description: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { expiresAt: 'asc' },
      take: 10, // Limit to 10 most urgent
    })

    // Get next expiration date
    const nextExpiring = await prisma.pointsTransaction.findFirst({
      where: {
        customerId: customer.id,
        expiresAt: { gt: now },
        isExpired: false,
        points: { gt: 0 },
      },
      orderBy: { expiresAt: 'asc' },
      select: { expiresAt: true, points: true },
    })

    return NextResponse.json({
      data: {
        currentPoints: customer.currentPoints,
        expiringIn7Days: expiring7Days._sum.points || 0,
        expiringIn30Days: expiring30Days._sum.points || 0,
        nextExpiration: nextExpiring ? {
          date: nextExpiring.expiresAt,
          points: nextExpiring.points,
        } : null,
        upcomingExpirations: expiringTransactions.map(t => ({
          id: t.id,
          points: t.points,
          description: t.description,
          expiresAt: t.expiresAt,
          earnedAt: t.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('Failed to get expiring points:', error)
    return NextResponse.json(
      { error: 'Failed to get expiration info' },
      { status: 500 }
    )
  }
}
