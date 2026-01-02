import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/auth/admin'

// GET /api/admin/loyalty/stats - Get comprehensive loyalty program statistics
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Run all queries in parallel for performance
    const [
      // Total members (customers with any loyalty activity)
      totalMembers,
      // Active members (engaged in last 30 days)
      activeMembers,
      // Total points in circulation
      totalPointsResult,
      // Points earned in last 30 days
      pointsEarnedLast30Days,
      // Points redeemed in last 30 days
      pointsRedeemedLast30Days,
      // Tier distribution
      tierDistribution,
      // Recent transactions
      recentTransactions,
      // Popular rewards
      popularRewards,
      // Recent redemptions
      recentRedemptions,
      // Daily points activity (last 30 days)
      dailyActivity,
    ] = await Promise.all([
      // Total members with points
      prisma.customer.count({
        where: {
          currentPoints: { gt: 0 }
        }
      }),

      // Active members (transactions in last 30 days)
      prisma.customer.count({
        where: {
          pointsTransactions: {
            some: {
              createdAt: { gte: thirtyDaysAgo }
            }
          }
        }
      }),

      // Total points in circulation
      prisma.customer.aggregate({
        _sum: { currentPoints: true }
      }),

      // Points earned in last 30 days
      prisma.pointsTransaction.aggregate({
        where: {
          type: { in: ['PURCHASE', 'ACCOUNT_CREATION', 'FIRST_PURCHASE', 'REVIEW', 'SOCIAL_FOLLOW', 'SOCIAL_SHARE', 'UGC_UPLOAD', 'BIRTHDAY', 'REFERRAL_GIVE', 'REFERRAL_RECEIVE', 'ADMIN_ADJUSTMENT', 'TIER_BONUS'] },
          points: { gt: 0 },
          createdAt: { gte: thirtyDaysAgo }
        },
        _sum: { points: true }
      }),

      // Points redeemed in last 30 days
      prisma.pointsTransaction.aggregate({
        where: {
          type: 'REDEMPTION',
          createdAt: { gte: thirtyDaysAgo }
        },
        _sum: { points: true }
      }),

      // Tier distribution
      prisma.customer.groupBy({
        by: ['loyaltyTierId'],
        _count: true,
        where: {
          currentPoints: { gt: 0 }
        }
      }),

      // Recent transactions (last 10)
      prisma.pointsTransaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { 
              email: true, 
              name: true,
              loyaltyTier: { select: { name: true } }
            }
          }
        }
      }),

      // Popular rewards (most redeemed)
      prisma.reward.findMany({
        where: { isActive: true },
        include: {
          _count: { select: { redemptions: true } }
        },
        orderBy: {
          redemptions: { _count: 'desc' }
        },
        take: 5
      }),

      // Recent redemptions
      prisma.rewardRedemption.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { email: true, name: true }
          },
          reward: {
            select: { name: true, rewardType: true, pointsCost: true }
          }
        }
      }),

      // Daily points activity (group by date for last 30 days)
      prisma.pointsTransaction.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: thirtyDaysAgo }
        },
        _sum: { points: true },
        _count: true
      })
    ])

    // Get tier names for distribution
    const tiers = await prisma.loyaltyTier.findMany({
      select: { id: true, name: true, minAnnualSpend: true, sortOrder: true }
    })

    const tierMap = Object.fromEntries(tiers.map(t => [t.id, t]))

    // Format tier distribution
    const formattedTierDistribution = tierDistribution.map(item => ({
      tierId: item.loyaltyTierId,
      tierName: item.loyaltyTierId ? tierMap[item.loyaltyTierId]?.name || 'Unknown' : 'No Tier',
      count: item._count
    }))

    // Calculate week-over-week change
    const pointsThisWeek = await prisma.pointsTransaction.aggregate({
      where: {
        type: { in: ['PURCHASE', 'ACCOUNT_CREATION', 'FIRST_PURCHASE', 'REVIEW', 'SOCIAL_FOLLOW', 'SOCIAL_SHARE', 'UGC_UPLOAD', 'BIRTHDAY', 'REFERRAL_GIVE', 'REFERRAL_RECEIVE', 'ADMIN_ADJUSTMENT', 'TIER_BONUS'] },
        points: { gt: 0 },
        createdAt: { gte: sevenDaysAgo }
      },
      _sum: { points: true }
    })

    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const pointsLastWeek = await prisma.pointsTransaction.aggregate({
      where: {
        type: { in: ['PURCHASE', 'ACCOUNT_CREATION', 'FIRST_PURCHASE', 'REVIEW', 'SOCIAL_FOLLOW', 'SOCIAL_SHARE', 'UGC_UPLOAD', 'BIRTHDAY', 'REFERRAL_GIVE', 'REFERRAL_RECEIVE', 'ADMIN_ADJUSTMENT', 'TIER_BONUS'] },
        points: { gt: 0 },
        createdAt: { gte: twoWeeksAgo, lt: sevenDaysAgo }
      },
      _sum: { points: true }
    })

    const thisWeekPoints = pointsThisWeek._sum.points || 0
    const lastWeekPoints = pointsLastWeek._sum.points || 0
    const weekOverWeekChange = lastWeekPoints > 0 
      ? ((thisWeekPoints - lastWeekPoints) / lastWeekPoints * 100).toFixed(1)
      : 0

    // Aggregate daily activity into buckets
    const dailyPointsMap = new Map<string, { earned: number; redeemed: number; count: number }>()
    
    // Initialize all days in the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split('T')[0]
      dailyPointsMap.set(dateKey, { earned: 0, redeemed: 0, count: 0 })
    }

    // Get detailed daily breakdown
    const dailyEarned = await prisma.pointsTransaction.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        type: { in: ['PURCHASE', 'REFERRAL_GIVE', 'REFERRAL_RECEIVE', 'TIER_BONUS'] },
        points: { gt: 0 }
      },
      _sum: { points: true },
      _count: true
    })

    const dailyRedeemed = await prisma.pointsTransaction.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        type: 'REDEMPTION'
      },
      _sum: { points: true }
    })

    // Process earned transactions by date
    dailyEarned.forEach(item => {
      const dateKey = new Date(item.createdAt).toISOString().split('T')[0]
      const existing = dailyPointsMap.get(dateKey)
      if (existing) {
        existing.earned += item._sum.points || 0
        existing.count += item._count
      }
    })

    // Process redeemed transactions by date
    dailyRedeemed.forEach(item => {
      const dateKey = new Date(item.createdAt).toISOString().split('T')[0]
      const existing = dailyPointsMap.get(dateKey)
      if (existing) {
        existing.redeemed += Math.abs(item._sum.points || 0)
      }
    })

    // Convert to array sorted by date
    const dailyActivityArray = Array.from(dailyPointsMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      overview: {
        totalMembers,
        activeMembers,
        activeMemberPercentage: totalMembers > 0 
          ? ((activeMembers / totalMembers) * 100).toFixed(1) 
          : 0,
        totalPointsInCirculation: totalPointsResult._sum.currentPoints || 0,
        pointsEarnedLast30Days: pointsEarnedLast30Days._sum.points || 0,
        pointsRedeemedLast30Days: Math.abs(pointsRedeemedLast30Days._sum.points || 0),
        weekOverWeekChange: Number(weekOverWeekChange),
      },
      tierDistribution: formattedTierDistribution,
      popularRewards: popularRewards.map(r => ({
        id: r.id,
        name: r.name,
        pointsCost: r.pointsCost,
        rewardType: r.rewardType,
        redemptionCount: r._count.redemptions
      })),
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        customerEmail: t.customer.email,
        customerName: t.customer.name || t.customer.email,
        customerTier: t.customer.loyaltyTier?.name || 'No Tier',
        type: t.type,
        points: t.points,
        description: t.description,
        createdAt: t.createdAt.toISOString()
      })),
      recentRedemptions: recentRedemptions.map(r => ({
        id: r.id,
        customerEmail: r.customer.email,
        customerName: r.customer.name || r.customer.email,
        rewardName: r.reward.name,
        rewardType: r.reward.rewardType,
        pointsSpent: r.pointsSpent,
        status: r.status,
        couponCode: r.couponCode,
        createdAt: r.createdAt.toISOString()
      })),
      dailyActivity: dailyActivityArray,
      tiers: tiers.sort((a, b) => a.sortOrder - b.sortOrder)
    })
  } catch (error) {
    console.error('Failed to fetch loyalty stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch loyalty statistics' },
      { status: 500 }
    )
  }
}
