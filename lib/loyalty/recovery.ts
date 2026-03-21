import { prisma } from '@/lib/prisma'
import { recalculateCustomerStats } from '@/lib/crm/service'
import {
  awardFirstPurchasePoints,
  awardPurchasePoints,
  awardReferralPoints,
  updateCustomerTier,
} from '@/lib/loyalty/service'

const COMPLETED_ORDER_STATUSES: Array<'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED'> = [
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
]

export interface LoyaltyRecoveryResult {
  pointsEarned: number
  tierUpgrade?: string
  recovered: boolean
}

export async function recoverMissingLoyaltyForOrder(
  orderId: string,
  customerId: string,
  orderTotal: number
): Promise<LoyaltyRecoveryResult> {
  const existingPurchaseTransaction = await prisma.pointsTransaction.findFirst({
    where: {
      orderId,
      customerId,
      type: 'PURCHASE',
      points: { gt: 0 },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existingPurchaseTransaction) {
    return { pointsEarned: existingPurchaseTransaction.points, recovered: false }
  }

  const customerSnapshot = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      totalOrders: true,
      totalSpent: true,
      referredBy: true,
    },
  })

  if (!customerSnapshot) {
    return { pointsEarned: 0, recovered: false }
  }

  const completedOrdersAggregate = await prisma.order.aggregate({
    where: {
      customerId,
      status: { in: COMPLETED_ORDER_STATUSES },
    },
    _count: { id: true },
    _sum: { total: true },
  })

  const completedOrderCount = completedOrdersAggregate._count.id || 0
  const completedSpend = Number(completedOrdersAggregate._sum.total || 0)

  const needsStatsRecalculation =
    customerSnapshot.totalOrders !== completedOrderCount ||
    Math.abs(customerSnapshot.totalSpent - completedSpend) > 0.01

  if (needsStatsRecalculation) {
    await recalculateCustomerStats(customerId)
  }

  const purchaseTransaction = await awardPurchasePoints(customerId, orderId, orderTotal)

  if (completedOrderCount === 1) {
    const existingFirstPurchaseBonus = await prisma.pointsTransaction.findFirst({
      where: {
        orderId,
        customerId,
        type: 'FIRST_PURCHASE',
        points: { gt: 0 },
      },
      select: { id: true },
    })

    if (!existingFirstPurchaseBonus) {
      await awardFirstPurchasePoints(customerId, orderId)
    }

    if (customerSnapshot.referredBy) {
      const existingReferralAward = await prisma.pointsTransaction.findFirst({
        where: {
          customerId: customerSnapshot.referredBy,
          type: 'REFERRAL_GIVE',
          referralId: customerId,
          points: { gt: 0 },
        },
        select: { id: true },
      })

      if (!existingReferralAward) {
        await awardReferralPoints(customerSnapshot.referredBy, customerId)
      }
    }
  }

  const upgradedTier = await updateCustomerTier(customerId)

  return {
    pointsEarned: purchaseTransaction.points || 0,
    tierUpgrade: upgradedTier?.name,
    recovered: true,
  }
}
