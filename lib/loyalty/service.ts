import { prisma } from '@/lib/prisma'
import { PointsTransactionType } from '@prisma/client'

/**
 * Loyalty Service
 * Handles all Care Points operations for Head Over Feels
 */

// ===== POINTS EARNING =====

/**
 * Award points to a customer
 */
export async function awardPoints(
  customerId: string,
  points: number,
  type: PointsTransactionType,
  description: string,
  metadata?: {
    orderId?: string
    reviewId?: string
    referralId?: string
    expiresAt?: Date
  }
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { loyaltyTier: true },
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Apply tier multiplier
  const multiplier = customer.loyaltyTier?.pointMultiplier || 1.0
  const finalPoints = Math.floor(points * multiplier)

  // Create transaction
  const transaction = await prisma.pointsTransaction.create({
    data: {
      customerId,
      points: finalPoints,
      type,
      description,
      orderId: metadata?.orderId,
      reviewId: metadata?.reviewId,
      referralId: metadata?.referralId,
      expiresAt: metadata?.expiresAt,
    },
  })

  // Update customer points
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      currentPoints: { increment: finalPoints },
      lifetimePoints: { increment: finalPoints },
    },
  })

  return transaction
}

/**
 * Award points for a purchase (1 point per $1)
 */
export async function awardPurchasePoints(customerId: string, orderId: string, orderTotal: number) {
  const basePoints = Math.floor(orderTotal) // 1 point per dollar
  
  return awardPoints(
    customerId,
    basePoints,
    'PURCHASE',
    `Earned ${basePoints} Care Points from purchase`,
    { orderId }
  )
}

/**
 * Award points for account creation
 */
export async function awardAccountCreationPoints(customerId: string) {
  return awardPoints(
    customerId,
    50,
    'ACCOUNT_CREATION',
    'Welcome bonus! Thanks for joining our community 💙'
  )
}

/**
 * Award points for first purchase
 */
export async function awardFirstPurchasePoints(customerId: string, orderId: string) {
  return awardPoints(
    customerId,
    100,
    'FIRST_PURCHASE',
    'First purchase bonus! You\'re officially part of the family 🎉',
    { orderId }
  )
}

/**
 * Award points for writing a review
 */
export async function awardReviewPoints(customerId: string, reviewId: string) {
  return awardPoints(
    customerId,
    25,
    'REVIEW',
    'Thanks for sharing your thoughts! 📝',
    { reviewId }
  )
}

/**
 * Award points for birthday
 */
export async function awardBirthdayPoints(customerId: string) {
  return awardPoints(
    customerId,
    50,
    'BIRTHDAY',
    'Happy Birthday! 🎂 Here\'s a little something special'
  )
}

/**
 * Award points for referral
 */
export async function awardReferralPoints(referrerId: string, referredCustomerId: string) {
  return awardPoints(
    referrerId,
    250,
    'REFERRAL_GIVE',
    'Thanks for spreading the love! Your friend just made their first purchase 💕',
    { referralId: referredCustomerId }
  )
}

/**
 * Award points for social actions
 */
export async function awardSocialPoints(
  customerId: string,
  action: 'SOCIAL_FOLLOW' | 'SOCIAL_SHARE' | 'UGC_UPLOAD',
  points: number,
  description: string
) {
  return awardPoints(customerId, points, action, description)
}

// ===== POINTS REDEMPTION =====

/**
 * Check if customer has enough points
 */
export async function hasEnoughPoints(customerId: string, pointsRequired: number): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { currentPoints: true },
  })

  return (customer?.currentPoints || 0) >= pointsRequired
}

/**
 * Deduct points from customer
 */
export async function deductPoints(
  customerId: string,
  points: number,
  redemptionId: string,
  description: string
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  if (customer.currentPoints < points) {
    throw new Error('Insufficient points')
  }

  // Create negative transaction
  const transaction = await prisma.pointsTransaction.create({
    data: {
      customerId,
      points: -points,
      type: 'REDEMPTION',
      description,
      redemptionId,
    },
  })

  // Update customer points
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      currentPoints: { decrement: points },
    },
  })

  return transaction
}

// ===== TIER MANAGEMENT =====

/**
 * Calculate and update customer tier based on annual spend
 */
export async function updateCustomerTier(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { loyaltyTier: true },
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Get all tiers sorted by spend requirement
  const tiers = await prisma.loyaltyTier.findMany({
    where: { isActive: true, isInviteOnly: false },
    orderBy: { minAnnualSpend: 'desc' },
  })

  // Find appropriate tier
  let newTier = tiers[tiers.length - 1] // Default to lowest tier
  for (const tier of tiers) {
    if (customer.annualSpend >= tier.minAnnualSpend) {
      newTier = tier
      break
    }
  }

  // Update if tier changed
  if (newTier.id !== customer.loyaltyTierId) {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyTierId: newTier.id,
        tierStartDate: new Date(),
      },
    })

    // Award tier upgrade bonus
    if (customer.loyaltyTierId) { // Not first tier assignment
      const bonusPoints = newTier.minAnnualSpend > 0 ? Math.floor(newTier.minAnnualSpend / 10) : 50
      await awardPoints(
        customerId,
        bonusPoints,
        'TIER_BONUS',
        `🎉 Welcome to ${newTier.name} tier! Enjoy your new perks!`
      )
    }

    return newTier
  }

  return null // No tier change
}

/**
 * Get customer's loyalty stats
 */
export async function getCustomerLoyaltyStats(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      loyaltyTier: true,
      pointsTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      redemptions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { reward: true },
      },
    },
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Get next tier
  const nextTier = await prisma.loyaltyTier.findFirst({
    where: {
      isActive: true,
      isInviteOnly: false,
      minAnnualSpend: { gt: customer.annualSpend },
    },
    orderBy: { minAnnualSpend: 'asc' },
  })

  return {
    currentPoints: customer.currentPoints,
    lifetimePoints: customer.lifetimePoints,
    annualSpend: customer.annualSpend,
    currentTier: customer.loyaltyTier,
    nextTier,
    pointsToNextTier: nextTier 
      ? Math.floor((nextTier.minAnnualSpend - customer.annualSpend) * (customer.loyaltyTier?.pointMultiplier || 1))
      : null,
    recentTransactions: customer.pointsTransactions,
    recentRedemptions: customer.redemptions,
  }
}

/**
 * Get available rewards for customer
 */
export async function getAvailableRewards(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { loyaltyTier: true },
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  const rewards = await prisma.reward.findMany({
    where: { isActive: true },
    orderBy: { pointsCost: 'asc' },
  })

  // Filter rewards based on tier requirements and customer points
  return rewards.map(reward => {
    const meetsPointRequirement = customer.currentPoints >= reward.pointsCost
    const meetsTierRequirement = !reward.minTierRequired || 
      (customer.loyaltyTier && customer.loyaltyTier.minAnnualSpend >= 
        (rewards.find(r => r.slug === reward.minTierRequired)?.pointsCost || 0))

    return {
      ...reward,
      canRedeem: meetsPointRequirement && meetsTierRequirement,
      locked: !meetsTierRequirement,
    }
  })
}

// ===== REFERRAL SYSTEM =====

/**
 * Generate unique referral code for customer
 */
export async function generateReferralCode(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { email: true, name: true },
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Generate code from name or email
  const baseName = customer.name?.toLowerCase().replace(/\s+/g, '') || 
                   customer.email.split('@')[0].toLowerCase()
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const code = `${baseName.substring(0, 8)}${randomSuffix}`.toUpperCase()

  return prisma.referralCode.create({
    data: {
      customerId,
      code,
    },
  })
}

/**
 * Get or create referral code
 */
export async function getReferralCode(customerId: string) {
  let referralCode = await prisma.referralCode.findUnique({
    where: { customerId },
  })

  if (!referralCode) {
    referralCode = await generateReferralCode(customerId)
  }

  return referralCode
}

// ===== UTILITY FUNCTIONS =====

/**
 * Expire old bonus points
 */
export async function expireOldPoints() {
  const expiredTransactions = await prisma.pointsTransaction.findMany({
    where: {
      expiresAt: { lte: new Date() },
      isExpired: false,
      points: { gt: 0 }, // Only positive (earning) transactions
    },
    include: { customer: true },
  })

  for (const transaction of expiredTransactions) {
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
        description: `${transaction.points} bonus points expired`,
      },
    })
  }

  return expiredTransactions.length
}

/**
 * Reset annual spend for tier calculations (run yearly)
 */
export async function resetAnnualSpend() {
  await prisma.customer.updateMany({
    data: { annualSpend: 0 },
  })
}
