import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// GET /api/loyalty/referrals - Get customer's referral info
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('auth_session')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get or create referral code for customer
    let referralCode = await prisma.referralCode.findUnique({
      where: { customerId: userId },
    })

    if (!referralCode) {
      // Generate a unique referral code
      const customer = await prisma.customer.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      })

      const baseName = (customer?.name || customer?.email?.split('@')[0] || 'HOF')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6)
      
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
      const code = `${baseName}-${randomSuffix}`

      referralCode = await prisma.referralCode.create({
        data: {
          customerId: userId,
          code,
        },
      })
    }

    // Get referral stats
    const referralTransactions = await prisma.pointsTransaction.findMany({
      where: {
        customerId: userId,
        type: 'REFERRAL_GIVE',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Count total successful referrals
    const totalReferrals = await prisma.pointsTransaction.count({
      where: {
        customerId: userId,
        type: 'REFERRAL_GIVE',
      },
    })

    // Calculate total points from referrals
    const totalPointsEarned = referralTransactions.reduce((acc, tx) => acc + tx.points, 0)

    return NextResponse.json({
      code: referralCode.code,
      timesUsed: referralCode.timesUsed,
      totalReferrals,
      totalPointsEarned,
      recentReferrals: referralTransactions.map(tx => ({
        id: tx.id,
        points: tx.points,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      })),
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'}/signup?ref=${referralCode.code}`,
    })
  } catch (error) {
    console.error('Failed to fetch referral info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referral info' },
      { status: 500 }
    )
  }
}

// POST /api/loyalty/referrals/apply - Apply a referral code during signup
const ApplyReferralSchema = z.object({
  referralCode: z.string().min(1).max(50),
})

export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get('auth_session')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { referralCode } = ApplyReferralSchema.parse(body)

    // Find the referral code
    const referral = await prisma.referralCode.findUnique({
      where: { code: referralCode.toUpperCase() },
      include: {
        customer: {
          select: { id: true, email: true, name: true },
        },
      },
    })

    if (!referral) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      )
    }

    // Can't refer yourself
    if (referral.customerId === userId) {
      return NextResponse.json(
        { error: 'You cannot use your own referral code' },
        { status: 400 }
      )
    }

    // Check if this user was already referred
    const existingReferral = await prisma.pointsTransaction.findFirst({
      where: {
        customerId: userId,
        type: 'REFERRAL_RECEIVE',
        description: { contains: 'Welcome bonus' },
      },
    })

    if (existingReferral) {
      return NextResponse.json(
        { error: 'You have already used a referral code' },
        { status: 400 }
      )
    }

    // Award points to both parties
    const REFERRAL_BONUS_NEW_USER = 50 // Points for the new user
    const REFERRAL_BONUS_REFERRER = 100 // Points for the referrer

    await prisma.$transaction(async (tx) => {
      // Award points to new user
      await tx.pointsTransaction.create({
        data: {
          customerId: userId,
          points: REFERRAL_BONUS_NEW_USER,
          type: 'REFERRAL_RECEIVE',
          description: `Welcome bonus from referral`,
          referralId: referral.customerId,
        },
      })

      await tx.customer.update({
        where: { id: userId },
        data: {
          currentPoints: { increment: REFERRAL_BONUS_NEW_USER },
          lifetimePoints: { increment: REFERRAL_BONUS_NEW_USER },
          annualPointsEarned: { increment: REFERRAL_BONUS_NEW_USER },
        },
      })

      // Award points to referrer
      await tx.pointsTransaction.create({
        data: {
          customerId: referral.customerId,
          points: REFERRAL_BONUS_REFERRER,
          type: 'REFERRAL_GIVE',
          description: `Referral bonus - new member joined`,
          referralId: userId,
        },
      })

      await tx.customer.update({
        where: { id: referral.customerId },
        data: {
          currentPoints: { increment: REFERRAL_BONUS_REFERRER },
          lifetimePoints: { increment: REFERRAL_BONUS_REFERRER },
          annualPointsEarned: { increment: REFERRAL_BONUS_REFERRER },
        },
      })

      // Update referral code usage count
      await tx.referralCode.update({
        where: { id: referral.id },
        data: {
          timesUsed: { increment: 1 },
        },
      })
    })

    return NextResponse.json({
      success: true,
      pointsEarned: REFERRAL_BONUS_NEW_USER,
      message: `You earned ${REFERRAL_BONUS_NEW_USER} bonus points!`,
    })
  } catch (error) {
    console.error('Failed to apply referral code:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid referral code format' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to apply referral code' },
      { status: 500 }
    )
  }
}
