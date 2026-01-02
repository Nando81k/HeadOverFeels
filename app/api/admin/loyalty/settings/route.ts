import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// Default settings to use if none exist
const DEFAULT_SETTINGS = {
  id: 'default',
  isEnabled: true,
  programName: 'Loyalty Rewards',
  pointsPerDollar: 1,
  pointsRoundingMode: 'round',
  minimumOrderForPoints: 0,
  referralPointsReferrer: 100,
  referralPointsReferred: 50,
  referralEnabled: true,
  reviewPointsEnabled: true,
  reviewPointsAmount: 25,
  reviewWithPhotoBonus: 25,
  birthdayRewardsEnabled: true,
  birthdayRewardType: 'points',
  birthdayRewardValue: 100,
  birthdayRewardExpireDays: 30,
  pointsExpireEnabled: false,
  pointsExpireMonths: 12,
  tierEvaluationPeriod: 'annual',
  tierDowngradeEnabled: true,
  showPointsInCart: true,
  showPointsInCheckout: true,
  showTierProgress: true,
}

// GET /api/admin/loyalty/settings - Get loyalty program settings
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let settings = await prisma.loyaltySettings.findUnique({
      where: { id: 'default' }
    })

    // If no settings exist, create default settings
    if (!settings) {
      settings = await prisma.loyaltySettings.create({
        data: DEFAULT_SETTINGS
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Failed to fetch loyalty settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch loyalty settings' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/loyalty/settings - Update loyalty program settings
export async function PUT(request: NextRequest) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate required fields
    if (body.pointsPerDollar !== undefined && body.pointsPerDollar < 0) {
      return NextResponse.json(
        { error: 'Points per dollar must be non-negative' },
        { status: 400 }
      )
    }

    if (body.minimumOrderForPoints !== undefined && body.minimumOrderForPoints < 0) {
      return NextResponse.json(
        { error: 'Minimum order for points must be non-negative' },
        { status: 400 }
      )
    }

    // Update or create settings (upsert)
    const settings = await prisma.loyaltySettings.upsert({
      where: { id: 'default' },
      update: {
        isEnabled: body.isEnabled,
        programName: body.programName,
        pointsPerDollar: body.pointsPerDollar,
        pointsRoundingMode: body.pointsRoundingMode,
        minimumOrderForPoints: body.minimumOrderForPoints,
        referralPointsReferrer: body.referralPointsReferrer,
        referralPointsReferred: body.referralPointsReferred,
        referralEnabled: body.referralEnabled,
        reviewPointsEnabled: body.reviewPointsEnabled,
        reviewPointsAmount: body.reviewPointsAmount,
        reviewWithPhotoBonus: body.reviewWithPhotoBonus,
        birthdayRewardsEnabled: body.birthdayRewardsEnabled,
        birthdayRewardType: body.birthdayRewardType,
        birthdayRewardValue: body.birthdayRewardValue,
        birthdayRewardExpireDays: body.birthdayRewardExpireDays,
        pointsExpireEnabled: body.pointsExpireEnabled,
        pointsExpireMonths: body.pointsExpireMonths,
        tierEvaluationPeriod: body.tierEvaluationPeriod,
        tierDowngradeEnabled: body.tierDowngradeEnabled,
        showPointsInCart: body.showPointsInCart,
        showPointsInCheckout: body.showPointsInCheckout,
        showTierProgress: body.showTierProgress,
      },
      create: {
        ...DEFAULT_SETTINGS,
        ...body,
      }
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Failed to update loyalty settings:', error)
    return NextResponse.json(
      { error: 'Failed to update loyalty settings' },
      { status: 500 }
    )
  }
}
