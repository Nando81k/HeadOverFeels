/**
 * Gift Card Service
 * 
 * Functions for managing gift cards including:
 * - Code generation
 * - Purchase/creation
 * - Redemption
 * - Balance management
 */

import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { GiftCardStatus, GiftCardTransactionType } from '@prisma/client'

// ===== TYPES =====

export interface CreateGiftCardInput {
  initialBalance: number
  currency?: string
  expiresAt?: Date
  purchasedById?: string
  purchaseOrderId?: string
  recipientEmail?: string
  recipientName?: string
  senderName?: string
  personalMessage?: string
}

export interface GiftCardResult {
  success: boolean
  giftCard?: {
    id: string
    code: string
    initialBalance: number
    currentBalance: number
    status: GiftCardStatus
    expiresAt: Date | null
    recipientEmail: string | null
    recipientName: string | null
  }
  error?: string
}

export interface RedeemGiftCardInput {
  code: string
  amount: number
  orderId: string
  customerId?: string
}

export interface RedemptionResult {
  success: boolean
  amountRedeemed?: number
  remainingBalance?: number
  giftCardId?: string
  error?: string
}

export interface GiftCardBalanceResult {
  success: boolean
  balance?: number
  status?: GiftCardStatus
  expiresAt?: Date | null
  error?: string
}

// ===== GIFT CARD CODE GENERATION =====

/**
 * Generate a unique, user-friendly gift card code
 * Format: HOF-XXXX-XXXX-XXXX (16 chars with dashes)
 */
export function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars: I, O, 0, 1
  let code = ''
  
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  // Format: HOF-XXXX-XXXX-XXXX
  return `HOF-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
}

/**
 * Validate gift card code format
 */
export function isValidGiftCardCode(code: string): boolean {
  const pattern = /^HOF-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/
  return pattern.test(code.toUpperCase())
}

// ===== GIFT CARD CREATION =====

/**
 * Create a new gift card
 */
export async function createGiftCard(input: CreateGiftCardInput): Promise<GiftCardResult> {
  try {
    // Generate unique code
    let code = generateGiftCardCode()
    let attempts = 0
    const maxAttempts = 10
    
    // Ensure code is unique
    while (attempts < maxAttempts) {
      const existing = await prisma.giftCard.findUnique({ where: { code } })
      if (!existing) break
      code = generateGiftCardCode()
      attempts++
    }
    
    if (attempts >= maxAttempts) {
      return { success: false, error: 'Failed to generate unique gift card code' }
    }
    
    // Create gift card
    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        initialBalance: input.initialBalance,
        currentBalance: input.initialBalance,
        currency: input.currency || 'USD',
        status: input.purchaseOrderId ? 'ACTIVE' : 'PENDING', // Active only after payment
        expiresAt: input.expiresAt,
        purchasedById: input.purchasedById,
        purchaseOrderId: input.purchaseOrderId,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        senderName: input.senderName,
        personalMessage: input.personalMessage,
      },
    })
    
    // Create initial load transaction
    await prisma.giftCardTransaction.create({
      data: {
        giftCardId: giftCard.id,
        type: 'INITIAL_LOAD',
        amount: input.initialBalance,
        balanceAfter: input.initialBalance,
        description: `Gift card created with $${input.initialBalance.toFixed(2)} balance`,
        customerId: input.purchasedById,
      },
    })
    
    return {
      success: true,
      giftCard: {
        id: giftCard.id,
        code: giftCard.code,
        initialBalance: giftCard.initialBalance,
        currentBalance: giftCard.currentBalance,
        status: giftCard.status,
        expiresAt: giftCard.expiresAt,
        recipientEmail: giftCard.recipientEmail,
        recipientName: giftCard.recipientName,
      },
    }
  } catch (error) {
    console.error('Failed to create gift card:', error)
    return { success: false, error: 'Failed to create gift card' }
  }
}

// ===== GIFT CARD LOOKUP =====

/**
 * Get gift card balance and status by code
 */
export async function getGiftCardBalance(code: string): Promise<GiftCardBalanceResult> {
  try {
    const normalizedCode = code.toUpperCase().trim()
    
    if (!isValidGiftCardCode(normalizedCode)) {
      return { success: false, error: 'Invalid gift card code format' }
    }
    
    const giftCard = await prisma.giftCard.findUnique({
      where: { code: normalizedCode },
    })
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' }
    }
    
    // Check if expired
    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      // Update status if not already expired
      if (giftCard.status !== 'EXPIRED') {
        await prisma.giftCard.update({
          where: { id: giftCard.id },
          data: { status: 'EXPIRED' },
        })
      }
      return { 
        success: true, 
        balance: 0, 
        status: 'EXPIRED',
        expiresAt: giftCard.expiresAt,
      }
    }
    
    return {
      success: true,
      balance: giftCard.currentBalance,
      status: giftCard.status,
      expiresAt: giftCard.expiresAt,
    }
  } catch (error) {
    console.error('Failed to get gift card balance:', error)
    return { success: false, error: 'Failed to retrieve gift card' }
  }
}

/**
 * Get full gift card details (for admin or owner)
 */
export async function getGiftCardDetails(id: string) {
  return prisma.giftCard.findUnique({
    where: { id },
    include: {
      purchasedBy: {
        select: { id: true, name: true, email: true },
      },
      redeemedBy: {
        select: { id: true, name: true, email: true },
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: { id: true, orderNumber: true },
          },
        },
      },
      appliedToOrders: {
        include: {
          order: {
            select: { id: true, orderNumber: true, total: true, createdAt: true },
          },
        },
      },
    },
  })
}

// ===== GIFT CARD REDEMPTION =====

/**
 * Redeem gift card balance for an order
 */
export async function redeemGiftCard(input: RedeemGiftCardInput): Promise<RedemptionResult> {
  try {
    const normalizedCode = input.code.toUpperCase().trim()

    if (!isValidGiftCardCode(normalizedCode)) {
      return { success: false, error: 'Invalid gift card code format' }
    }

    // Look up the gift card for upfront validation (status, expiry) before entering the transaction.
    // The actual balance deduction is guarded atomically inside the transaction below.
    const giftCard = await prisma.giftCard.findUnique({
      where: { code: normalizedCode },
    })

    if (!giftCard) {
      return { success: false, error: 'Gift card not found' }
    }

    // Validate status
    if (giftCard.status !== 'ACTIVE') {
      return {
        success: false,
        error: giftCard.status === 'EXPIRED'
          ? 'Gift card has expired'
          : giftCard.status === 'DEPLETED'
            ? 'Gift card has no remaining balance'
            : 'Gift card is not active'
      }
    }

    // Check expiration
    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { status: 'EXPIRED' },
      })
      return { success: false, error: 'Gift card has expired' }
    }

    // Calculate amount to redeem (cap at current balance observed pre-transaction)
    const amountToRedeem = Math.min(input.amount, giftCard.currentBalance)

    if (amountToRedeem <= 0) {
      return { success: false, error: 'Gift card has no remaining balance' }
    }

    // Atomic interactive transaction: the conditional updateMany ensures the decrement
    // only fires when currentBalance is still sufficient at the moment of the write,
    // closing the race window between the pre-check read and the update.
    const result = await prisma.$transaction(async (tx) => {
      // Conditionally decrement only if balance is still >= amountToRedeem
      const updateResult = await tx.giftCard.updateMany({
        where: {
          id: giftCard.id,
          status: 'ACTIVE',
          currentBalance: { gte: amountToRedeem },
        },
        data: {
          currentBalance: { decrement: amountToRedeem },
          redeemedById: input.customerId || giftCard.redeemedById,
        },
      })

      if (updateResult.count === 0) {
        throw new Error('Insufficient gift card balance')
      }

      // Derive the new balance without a second read (avoids extra round-trip)
      const newBalance = giftCard.currentBalance - amountToRedeem
      const newStatus: GiftCardStatus = newBalance <= 0 ? 'DEPLETED' : 'ACTIVE'

      // If depleted, update status separately (updateMany above already decremented)
      if (newStatus === 'DEPLETED') {
        await tx.giftCard.updateMany({
          where: { id: giftCard.id },
          data: { status: 'DEPLETED' },
        })
      }

      // Create transaction record
      await tx.giftCardTransaction.create({
        data: {
          giftCardId: giftCard.id,
          type: 'REDEMPTION',
          amount: -amountToRedeem, // Negative for debit
          balanceAfter: newBalance,
          orderId: input.orderId,
          description: `Redeemed $${amountToRedeem.toFixed(2)} for order`,
          customerId: input.customerId,
        },
      })

      // Create order-gift card link
      await tx.orderGiftCard.create({
        data: {
          orderId: input.orderId,
          giftCardId: giftCard.id,
          amountApplied: amountToRedeem,
        },
      })

      return { amountToRedeem, newBalance, giftCardId: giftCard.id }
    })

    return {
      success: true,
      amountRedeemed: result.amountToRedeem,
      remainingBalance: result.newBalance,
      giftCardId: result.giftCardId,
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Insufficient gift card balance') {
      return { success: false, error: 'Insufficient gift card balance' }
    }
    console.error('Failed to redeem gift card:', error)
    return { success: false, error: 'Failed to redeem gift card' }
  }
}

/**
 * Refund amount back to gift card (e.g., when order is cancelled)
 */
export async function refundToGiftCard(
  giftCardId: string,
  amount: number,
  orderId: string,
  description?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: giftCardId },
    })
    
    if (!giftCard) {
      return { success: false, error: 'Gift card not found' }
    }
    
    const newBalance = giftCard.currentBalance + amount
    
    await prisma.$transaction([
      // Update gift card balance
      prisma.giftCard.update({
        where: { id: giftCardId },
        data: {
          currentBalance: newBalance,
          status: 'ACTIVE', // Reactivate if was depleted
        },
      }),
      
      // Create refund transaction
      prisma.giftCardTransaction.create({
        data: {
          giftCardId,
          type: 'REFUND',
          amount: amount, // Positive for credit
          balanceAfter: newBalance,
          orderId,
          description: description || `Refund of $${amount.toFixed(2)} from cancelled order`,
        },
      }),
    ])
    
    return { success: true, newBalance }
  } catch (error) {
    console.error('Failed to refund to gift card:', error)
    return { success: false, error: 'Failed to refund to gift card' }
  }
}

// ===== ADMIN FUNCTIONS =====

/**
 * Adjust gift card balance (admin only)
 */
export async function adjustGiftCardBalance(
  giftCardId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: giftCardId },
    })

    if (!giftCard) {
      return { success: false, error: 'Gift card not found' }
    }

    // For negative adjustments (debits) use a conditional updateMany so the
    // operation is atomic — two concurrent admin debits cannot both succeed if
    // combined they would produce a negative balance.
    const newBalance = await prisma.$transaction(async (tx) => {
      if (amount < 0) {
        const debit = Math.abs(amount)
        const updateResult = await tx.giftCard.updateMany({
          where: {
            id: giftCardId,
            currentBalance: { gte: debit },
          },
          data: {
            currentBalance: { decrement: debit },
            status: giftCard.currentBalance - debit <= 0 ? 'DEPLETED' : 'ACTIVE',
          },
        })

        if (updateResult.count === 0) {
          throw new Error('Adjustment would result in negative balance')
        }
      } else {
        // Positive adjustments (credits) are safe to apply non-conditionally
        await tx.giftCard.update({
          where: { id: giftCardId },
          data: {
            currentBalance: { increment: amount },
            status: 'ACTIVE',
          },
        })
      }

      const computed = giftCard.currentBalance + amount

      await tx.giftCardTransaction.create({
        data: {
          giftCardId,
          type: 'ADJUSTMENT',
          amount,
          balanceAfter: computed,
          description: `Admin adjustment: ${reason}`,
        },
      })

      return computed
    })

    return { success: true, newBalance }
  } catch (error) {
    if (error instanceof Error && error.message === 'Adjustment would result in negative balance') {
      return { success: false, error: 'Adjustment would result in negative balance' }
    }
    console.error('Failed to adjust gift card balance:', error)
    return { success: false, error: 'Failed to adjust balance' }
  }
}

/**
 * Disable a gift card (admin only)
 */
export async function disableGiftCard(
  giftCardId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.giftCard.update({
      where: { id: giftCardId },
      data: { status: 'DISABLED' },
    })
    
    // Log the action
    await prisma.giftCardTransaction.create({
      data: {
        giftCardId,
        type: 'ADJUSTMENT',
        amount: 0,
        balanceAfter: 0,
        description: `Gift card disabled: ${reason}`,
      },
    })
    
    return { success: true }
  } catch (error) {
    console.error('Failed to disable gift card:', error)
    return { success: false, error: 'Failed to disable gift card' }
  }
}

/**
 * Activate a pending gift card (after payment confirmation)
 */
export async function activateGiftCard(giftCardId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.giftCard.update({
      where: { id: giftCardId },
      data: { status: 'ACTIVE' },
    })
    
    return { success: true }
  } catch (error) {
    console.error('Failed to activate gift card:', error)
    return { success: false, error: 'Failed to activate gift card' }
  }
}

// ===== LISTING FUNCTIONS =====

/**
 * List gift cards with filters
 */
export async function listGiftCards(options: {
  status?: GiftCardStatus
  purchasedById?: string
  search?: string
  page?: number
  limit?: number
}) {
  const { status, purchasedById, search, page = 1, limit = 20 } = options
  
  const where: Record<string, unknown> = {}
  
  if (status) where.status = status
  if (purchasedById) where.purchasedById = purchasedById
  if (search) {
    where.OR = [
      { code: { contains: search.toUpperCase() } },
      { recipientEmail: { contains: search.toLowerCase() } },
      { recipientName: { contains: search } },
    ]
  }
  
  const [giftCards, total] = await Promise.all([
    prisma.giftCard.findMany({
      where,
      include: {
        purchasedBy: { select: { name: true, email: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.giftCard.count({ where }),
  ])
  
  return {
    giftCards,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}
