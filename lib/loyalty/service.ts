import { prisma } from '@/lib/prisma'
import { PointsTransactionType } from '@prisma/client'
import { sendTierUpgradeEmail, sendReferralSuccessEmail, getTierColor } from '@/lib/email/loyalty'
import { notifyPointsEarned, notifyTierUpgrade } from '@/lib/notifications/service'

/**
 * Loyalty Service
 * Handles all Care Points operations for Head Over Feels
 */

// Points expire after 12 months of inactivity
const POINTS_EXPIRATION_MONTHS = 12

// ===== POINTS EARNING =====

/**
 * Award points to a customer
 * Points expire after 12 months from the transaction date
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
    expiresAt?: Date  // Override default expiration
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

  // Calculate expiration date (12 months from now) for positive points
  // Negative points (redemptions, expirations) don't expire
  let expiresAt: Date | null = null
  if (points > 0 && type !== 'EXPIRATION') {
    if (metadata?.expiresAt) {
      expiresAt = metadata.expiresAt
    } else {
      expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + POINTS_EXPIRATION_MONTHS)
    }
  }

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
      expiresAt,
    },
  })

  // Update customer points
  // Only increment annualPointsEarned for positive points (earnings, not redemptions)
  const updateData: { currentPoints: { increment: number }; lifetimePoints: { increment: number }; annualPointsEarned?: { increment: number } } = {
    currentPoints: { increment: finalPoints },
    lifetimePoints: { increment: finalPoints },
  }
  
  // Tier progression is based on points EARNED (not available balance)
  // So we track annual points earned separately
  if (finalPoints > 0 && type !== 'EXPIRATION') {
    updateData.annualPointsEarned = { increment: finalPoints }
  }
  
  await prisma.customer.update({
    where: { id: customerId },
    data: updateData,
  })

  // Create in-app notification for points earned (only for positive points)
  if (finalPoints > 0 && type !== 'EXPIRATION' && type !== 'REDEMPTION') {
    try {
      // Format a friendly reason based on transaction type
      const reason = getPointsReasonText(type, description)
      await notifyPointsEarned(customerId, finalPoints, reason, metadata?.orderId)
    } catch (err) {
      // Don't fail the transaction if notification fails
      console.error('Failed to create points notification:', err)
    }
  }

  return transaction
}

/**
 * Get a friendly reason text for points earned
 */
function getPointsReasonText(type: PointsTransactionType, description: string): string {
  switch (type) {
    case 'PURCHASE':
      return 'from your purchase'
    case 'ACCOUNT_CREATION':
      return 'for joining our community'
    case 'FIRST_PURCHASE':
      return 'for your first purchase'
    case 'REVIEW':
      return 'for writing a review'
    case 'SOCIAL_FOLLOW':
      return 'for following us on social media'
    case 'SOCIAL_SHARE':
      return 'for sharing on social media'
    case 'UGC_UPLOAD':
      return 'for sharing your photos'
    case 'BIRTHDAY':
      return 'as a birthday gift'
    case 'REFERRAL_GIVE':
      return 'for referring a friend'
    case 'REFERRAL_RECEIVE':
      return 'as a referral bonus'
    case 'ADMIN_ADJUSTMENT':
      return 'from admin adjustment'
    case 'TIER_BONUS':
      return 'as a tier bonus'
    default:
      return description || 'from an activity'
  }
}

/**
 * Get active multiplier event that applies to the customer
 * Returns the highest multiplier if multiple events are active
 */
export async function getActiveMultiplierEvent(customerId: string): Promise<{ multiplier: number; eventId: string; eventName: string } | null> {
  const now = new Date()
  
  // Get customer's tier for tier-specific events
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { loyaltyTierId: true },
  })

  // Find all active events where current time is within the event period
  const activeEvents = await prisma.pointsMultiplierEvent.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { multiplier: 'desc' }, // Get highest multiplier first
  })

  // Filter events based on tier requirements
  for (const event of activeEvents) {
    // If tierIds is set, check if customer's tier qualifies
    if (event.tierIds) {
      let tierIds: string[] = []
      try {
        const parsedTierIds = JSON.parse(event.tierIds) as unknown
        if (Array.isArray(parsedTierIds)) {
          tierIds = parsedTierIds.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0
          )
        }
      } catch (parseError) {
        console.error(`Invalid tierIds JSON for multiplier event ${event.id}:`, parseError)
        continue
      }

      if (customer?.loyaltyTierId && tierIds.includes(customer.loyaltyTierId)) {
        return { multiplier: event.multiplier, eventId: event.id, eventName: event.name }
      }
      // Skip this event if tier doesn't match
      continue
    }
    // No tier restriction - event applies to all
    return { multiplier: event.multiplier, eventId: event.id, eventName: event.name }
  }

  return null
}

/**
 * Award points for a purchase (1 point per $1)
 * Checks for active multiplier events (e.g., Double Points Weekend)
 */
export async function awardPurchasePoints(customerId: string, orderId: string, orderTotal: number) {
  const basePoints = Math.floor(orderTotal) // 1 point per dollar
  
  // Check for active multiplier event
  const activeEvent = await getActiveMultiplierEvent(customerId)
  
  if (activeEvent && activeEvent.multiplier > 1) {
    const bonusPoints = Math.floor(basePoints * (activeEvent.multiplier - 1))
    const totalPoints = basePoints + bonusPoints
    
    // Update event tracking
    await prisma.pointsMultiplierEvent.update({
      where: { id: activeEvent.eventId },
      data: {
        totalBonusPointsAwarded: { increment: bonusPoints },
        ordersAffected: { increment: 1 },
      },
    })
    
    // Award points with event description
    return awardPoints(
      customerId,
      totalPoints,
      'PURCHASE',
      `Earned ${basePoints} Care Points + ${bonusPoints} bonus from ${activeEvent.eventName}! 🎉`,
      { orderId }
    )
  }
  
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
 * Award points to the referrer when their referral makes first purchase
 */
export async function awardReferralPoints(referrerId: string, referredCustomerId: string) {
  const REFERRAL_POINTS = 250
  
  const transaction = await awardPoints(
    referrerId,
    REFERRAL_POINTS,
    'REFERRAL_GIVE',
    'Thanks for spreading the love! Your friend just made their first purchase 💕',
    { referralId: referredCustomerId }
  )
  
  // Send referral success email to referrer
  try {
    const [referrer, referredCustomer] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: referrerId },
        select: { email: true, name: true, currentPoints: true },
      }),
      prisma.customer.findUnique({
        where: { id: referredCustomerId },
        select: { name: true, email: true },
      }),
    ])
    
    if (referrer?.email) {
      await sendReferralSuccessEmail({
        referrerEmail: referrer.email,
        referrerName: referrer.name || 'Friend',
        referredName: referredCustomer?.name || referredCustomer?.email?.split('@')[0] || 'A friend',
        pointsEarned: REFERRAL_POINTS,
        currentPoints: referrer.currentPoints,
      })
      console.log(`Referral success email sent to ${referrer.email}`)
    }
  } catch (emailError) {
    // Log but don't fail the points award
    console.error(`Failed to send referral success email:`, emailError)
  }
  
  return transaction
}

/**
 * Award welcome bonus to new customer who signed up with a referral code
 * This is awarded immediately at signup (not on first purchase)
 */
export async function awardReferralWelcomeBonus(customerId: string, referrerId: string) {
  return awardPoints(
    customerId,
    100,
    'REFERRAL_RECEIVE',
    'Welcome bonus! Thanks for joining via a friend\'s referral 🎁',
    { referralId: referrerId }
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
 * Deduct points from customer — atomic and idempotent.
 *
 * The balance check and decrement happen in a single conditional `updateMany`
 * so two concurrent redemptions cannot both pass the balance check and then
 * each deduct, driving the balance negative.
 *
 * If an optional `idempotencyKey` is supplied, a prior transaction with the
 * same key is returned immediately (safe replay). On a concurrent race where
 * two callers share the same key, the P2002 unique-index violation is caught
 * and treated as success — only one row ever lands.
 */
export async function deductPoints(
  customerId: string,
  points: number,
  redemptionId: string,
  description: string,
  idempotencyKey?: string
) {
  return prisma.$transaction(async (tx) => {
    // --- Idempotency check (before any mutation) ---
    if (idempotencyKey) {
      const existing = await tx.pointsTransaction.findUnique({
        where: { idempotencyKey },
      })
      if (existing) {
        // Already processed — return the existing transaction as-is.
        return existing
      }
    }

    // --- Atomic conditional decrement ---
    // `updateMany` with a `where` filter on currentPoints is a single
    // compare-and-set at the DB level; no separate read required.
    const result = await tx.customer.updateMany({
      where: { id: customerId, currentPoints: { gte: points } },
      data: { currentPoints: { decrement: points } },
    })

    if (result.count === 0) {
      // Either the customer doesn't exist or they don't have enough points.
      // Distinguish the two cases for a clearer error message.
      const exists = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      })
      if (!exists) {
        throw new Error('Customer not found')
      }
      throw new Error('Insufficient points balance')
    }

    // --- Insert the transaction record ---
    try {
      const transaction = await tx.pointsTransaction.create({
        data: {
          customerId,
          points: -points,
          type: 'REDEMPTION',
          description,
          redemptionId,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      })
      return transaction
    } catch (err) {
      // P2002 = unique constraint on idempotencyKey — a concurrent caller
      // with the same key just won the race and inserted first.  The balance
      // was already decremented exactly once (the updateMany above also ran
      // for the winner), so we need to roll back our own decrement by
      // re-incrementing, then look up and return the winning transaction.
      if (
        idempotencyKey &&
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: string }).code === 'P2002'
      ) {
        // Undo our decrement — the concurrent winner already owns this deduction.
        await tx.customer.update({
          where: { id: customerId },
          data: { currentPoints: { increment: points } },
        })
        const winner = await tx.pointsTransaction.findUnique({
          where: { idempotencyKey },
        })
        if (winner) return winner
      }
      throw err
    }
  })
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

  // Get all tiers sorted by points requirement (highest first)
  const tiers = await prisma.loyaltyTier.findMany({
    where: { isActive: true, isInviteOnly: false },
    orderBy: { minAnnualPoints: 'desc' },
  })

  // Find appropriate tier based on annual points earned
  let newTier = tiers[tiers.length - 1] // Default to lowest tier
  for (const tier of tiers) {
    if (customer.annualPointsEarned >= tier.minAnnualPoints) {
      newTier = tier
      break
    }
  }

  // Update if tier changed
  if (newTier.id !== customer.loyaltyTierId) {
    const previousTier = customer.loyaltyTier
    
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyTierId: newTier.id,
        tierStartDate: new Date(),
      },
    })

    // Award tier upgrade bonus
    if (customer.loyaltyTierId) { // Not first tier assignment
      const bonusPoints = newTier.minAnnualPoints > 0 ? Math.floor(newTier.minAnnualPoints / 10) : 50
      await awardPoints(
        customerId,
        bonusPoints,
        'TIER_BONUS',
        `🎉 Welcome to ${newTier.name} tier! Enjoy your new perks!`
      )
      
      // Send in-app tier upgrade notification
      try {
        const benefits: string[] = []
        if (newTier.pointMultiplier > 1) benefits.push(`${newTier.pointMultiplier}x points`)
        if (newTier.freeShipping) benefits.push('Free shipping')
        if (newTier.earlyDropAccess) benefits.push('Early drop access')
        
        // Parse perks JSON if available
        if (newTier.perks) {
          try {
            const perksData = JSON.parse(newTier.perks) as Record<string, boolean>
            if (perksData.careBox) benefits.push('Exclusive Care Box')
            if (perksData.engravedItem) benefits.push('Engraved items')
            if (perksData.customItem) benefits.push('Custom items')
          } catch {
            // Ignore JSON parse errors
          }
        }
        
        await notifyTierUpgrade(customerId, newTier.name, benefits)
      } catch (notifyError) {
        console.error('Failed to create tier upgrade notification:', notifyError)
      }
      
      // Send tier upgrade email notification
      if (customer.email && previousTier) {
        const updatedCustomer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { currentPoints: true },
        })
        
        try {
          await sendTierUpgradeEmail({
            customerEmail: customer.email,
            customerName: customer.name || 'Valued Customer',
            previousTierName: previousTier.name,
            newTierName: newTier.name,
            newTierColor: getTierColor(newTier.slug),
            pointMultiplier: newTier.pointMultiplier,
            freeShipping: newTier.freeShipping,
            earlyDropAccess: newTier.earlyDropAccess,
            currentPoints: updatedCustomer?.currentPoints || customer.currentPoints + bonusPoints,
          })
          console.log(`Tier upgrade email sent to ${customer.email} for upgrade to ${newTier.name}`)
        } catch (emailError) {
          // Log but don't fail the tier upgrade
          console.error(`Failed to send tier upgrade email to ${customer.email}:`, emailError)
        }
      }
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

  // Get next tier based on points earned
  const nextTier = await prisma.loyaltyTier.findFirst({
    where: {
      isActive: true,
      isInviteOnly: false,
      minAnnualPoints: { gt: customer.annualPointsEarned },
    },
    orderBy: { minAnnualPoints: 'asc' },
  })

  return {
    currentPoints: customer.currentPoints,      // Available for redemption
    lifetimePoints: customer.lifetimePoints,    // Historical total
    annualPointsEarned: customer.annualPointsEarned, // For tier progression
    annualSpend: customer.annualSpend,          // For tracking (legacy)
    currentTier: customer.loyaltyTier,
    nextTier,
    pointsToNextTier: nextTier 
      ? nextTier.minAnnualPoints - customer.annualPointsEarned
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
  
  // Get all tiers to compare hierarchy
  const allTiers = await prisma.loyaltyTier.findMany({
    where: { isActive: true },
    orderBy: { minAnnualPoints: 'asc' },
  })
  
  const tierHierarchy = allTiers.map(t => t.slug)

  // Filter rewards based on tier requirements and customer points
  return rewards.map(reward => {
    const meetsPointRequirement = customer.currentPoints >= reward.pointsCost
    
    // Check tier requirement by comparing tier positions in hierarchy
    let meetsTierRequirement = true
    if (reward.minTierRequired && customer.loyaltyTier) {
      const customerTierIndex = tierHierarchy.indexOf(customer.loyaltyTier.slug)
      const requiredTierIndex = tierHierarchy.indexOf(reward.minTierRequired)
      meetsTierRequirement = customerTierIndex >= requiredTierIndex
    } else if (reward.minTierRequired && !customer.loyaltyTier) {
      meetsTierRequirement = false
    }

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
 * Reset annual points and spend for tier calculations (run yearly)
 * This should be run at the start of each year to reset tier progression
 */
export async function resetAnnualStats() {
  await prisma.customer.updateMany({
    data: { 
      annualSpend: 0,
      annualPointsEarned: 0,
    },
  })
}

// Legacy alias
export const resetAnnualSpend = resetAnnualStats
